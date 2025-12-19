/**
 * Identifier Collector
 *
 * Collects all identifier references from a JSX element subtree.
 */

import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

import type { ScopeManager } from "../../scope/index.js";
import type {
  IdentifierReference,
  IdentifierCollectionResult,
} from "../types.js";

/**
 * Interface for identifier collection operations
 */
export interface IIdentifierCollector {
  /**
   * Traverses the JSX element to find all identifier references
   */
  collectIdentifiers(elementPath: NodePath): IdentifierCollectionResult;
}

/**
 * Collects identifier references from JSX element subtrees
 */
export class IdentifierCollector implements IIdentifierCollector {
  constructor(private readonly scopeManager: ScopeManager) {}

  /**
   * Traverses the JSX element to find all identifier references that
   * the element depends on.
   *
   * @param elementPath - Path to the JSX element to analyze
   * @returns Collection result with all identifiers found
   */
  collectIdentifiers(elementPath: NodePath): IdentifierCollectionResult {
    const identifiers: IdentifierReference[] = [];
    const jsxElementNames: string[] = [];
    const spreads: NodePath[] = [];
    const errors: string[] = [];
    const seenIdentifiers = new Set<string>();

    const addIdentifier = (ref: IdentifierReference): void => {
      // Create unique key for deduplication
      const key = `${ref.name}:${ref.path.node.start}`;
      if (!seenIdentifiers.has(key)) {
        seenIdentifiers.add(key);
        identifiers.push(ref);
      }
    };

    // Traverse the JSX element subtree
    elementPath.traverse({
      // Regular identifier references
      Identifier: (idPath) => {
        // Skip if this is a JSX element name (handled separately)
        if (this.isJSXElementName(idPath)) {
          return;
        }

        // Skip if this is a property key
        if (this.isPropertyKey(idPath)) {
          return;
        }

        // Skip if this is a declaration
        if (this.isDeclaration(idPath)) {
          return;
        }

        const scope = this.scopeManager.getScopeForPath(idPath);
        addIdentifier({
          name: idPath.node.name,
          path: idPath,
          usage: this.getIdentifierUsage(idPath),
          scope,
        });
      },

      // JSX element opening names
      JSXOpeningElement: (jsxPath) => {
        const nameNode = jsxPath.node.name;
        if (t.isJSXIdentifier(nameNode)) {
          // Only track user-defined components (start with uppercase)
          if (/^[A-Z]/.test(nameNode.name)) {
            jsxElementNames.push(nameNode.name);

            // Also add as identifier reference
            const scope = this.scopeManager.getScopeForPath(jsxPath);
            addIdentifier({
              name: nameNode.name,
              path: jsxPath,
              usage: "jsx-element",
              scope,
            });
          }
        } else if (t.isJSXMemberExpression(nameNode)) {
          // Handle Compound.Component pattern
          const names = this.extractMemberExpressionNames(nameNode);
          if (names.length > 0 && names[0] !== undefined && names[0] !== "") {
            jsxElementNames.push(names.join("."));

            const scope = this.scopeManager.getScopeForPath(jsxPath);
            addIdentifier({
              name: names[0],
              path: jsxPath,
              usage: "jsx-element",
              scope,
            });
          }
        }
      },

      // JSX spread attributes
      JSXSpreadAttribute: (spreadPath) => {
        spreads.push(spreadPath);

        // Get the argument identifier if it's a simple identifier
        const arg = spreadPath.node.argument;
        if (t.isIdentifier(arg)) {
          const scope = this.scopeManager.getScopeForPath(spreadPath);
          addIdentifier({
            name: arg.name,
            path: spreadPath,
            usage: "spread",
            scope,
          });
        }
      },

      // Member expressions (like obj.prop or arr[0])
      MemberExpression: (memberPath) => {
        // Get the root object of the member expression
        const rootObject = this.getRootObject(memberPath.node);
        if (rootObject && t.isIdentifier(rootObject)) {
          const scope = this.scopeManager.getScopeForPath(memberPath);
          addIdentifier({
            name: rootObject.name,
            path: memberPath,
            usage: "value",
            scope,
          });
        }
      },

      // Call expressions
      CallExpression: (callPath) => {
        const callee = callPath.node.callee;

        // Handle direct function calls: foo()
        if (t.isIdentifier(callee)) {
          const scope = this.scopeManager.getScopeForPath(callPath);
          addIdentifier({
            name: callee.name,
            path: callPath,
            usage: "call",
            scope,
          });
        }

        // Handle method calls: obj.method()
        if (t.isMemberExpression(callee)) {
          const rootObject = this.getRootObject(callee);
          if (rootObject && t.isIdentifier(rootObject)) {
            const scope = this.scopeManager.getScopeForPath(callPath);
            addIdentifier({
              name: rootObject.name,
              path: callPath,
              usage: "call",
              scope,
            });
          }
        }
      },
    });

    return {
      identifiers,
      jsxElementNames,
      spreads,
      errors,
    };
  }

  /**
   * Check if an identifier is a JSX element name
   */
  private isJSXElementName(path: NodePath<t.Identifier>): boolean {
    const parent = path.parent;
    return (
      t.isJSXOpeningElement(parent) &&
      ((t.isJSXIdentifier(parent.name) &&
        parent.name.name === path.node.name) ||
        this.isPartOfJSXName(parent.name, path.node))
    );
  }

  /**
   * Check if identifier is part of a JSX member expression name
   */
  private isPartOfJSXName(
    name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
    node: t.Identifier
  ): boolean {
    if (t.isJSXMemberExpression(name)) {
      if (
        t.isJSXIdentifier(name.property) &&
        name.property.name === node.name
      ) {
        return true;
      }
      if (t.isJSXIdentifier(name.object) && name.object.name === node.name) {
        return true;
      }
      if (t.isJSXMemberExpression(name.object)) {
        return this.isPartOfJSXName(name.object, node);
      }
    }
    return false;
  }

  /**
   * Check if an identifier is a property key
   */
  private isPropertyKey(path: NodePath<t.Identifier>): boolean {
    const parent = path.parent;
    return (
      (t.isObjectProperty(parent) &&
        parent.key === path.node &&
        !parent.computed) ||
      (t.isMemberExpression(parent) &&
        parent.property === path.node &&
        !parent.computed)
    );
  }

  /**
   * Check if an identifier is a declaration
   */
  private isDeclaration(path: NodePath<t.Identifier>): boolean {
    const parent = path.parent;
    return (
      (t.isVariableDeclarator(parent) && parent.id === path.node) ||
      (t.isFunctionDeclaration(parent) && parent.id === path.node) ||
      (t.isClassDeclaration(parent) && parent.id === path.node) ||
      t.isImportSpecifier(parent) ||
      t.isImportDefaultSpecifier(parent) ||
      t.isImportNamespaceSpecifier(parent)
    );
  }

  /**
   * Get how an identifier is used
   */
  private getIdentifierUsage(
    path: NodePath<t.Identifier>
  ): IdentifierReference["usage"] {
    const parent = path.parent;

    if (t.isCallExpression(parent) && parent.callee === path.node) {
      return "call";
    }

    // Check if inside JSX attribute (through expression container)
    if (t.isJSXExpressionContainer(parent)) {
      const grandParent = path.parentPath.parent;
      if (t.isJSXAttribute(grandParent)) {
        return "jsx-attribute";
      }
      return "value";
    }

    if (t.isJSXAttribute(parent)) {
      return "jsx-attribute";
    }

    return "value";
  }

  /**
   * Extract names from a JSX member expression
   */
  private extractMemberExpressionNames(node: t.JSXMemberExpression): string[] {
    const names: string[] = [];

    if (t.isJSXIdentifier(node.object)) {
      names.push(node.object.name);
    } else if (t.isJSXMemberExpression(node.object)) {
      names.push(...this.extractMemberExpressionNames(node.object));
    }

    if (t.isJSXIdentifier(node.property)) {
      names.push(node.property.name);
    }

    return names;
  }

  /**
   * Get root object of a member expression
   */
  private getRootObject(node: t.MemberExpression): t.Expression | null {
    let current: t.Expression = node;

    while (t.isMemberExpression(current)) {
      current = current.object;
    }

    return current;
  }
}

/**
 * Create a new IdentifierCollector instance
 */
export function createIdentifierCollector(
  scopeManager: ScopeManager
): IIdentifierCollector {
  return new IdentifierCollector(scopeManager);
}
