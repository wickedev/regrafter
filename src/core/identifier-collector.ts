/**
 * IdentifierCollector
 *
 * Shared utility for collecting identifiers from AST nodes.
 * Consolidates duplicated logic from DependencyAnalyzer, ExtractDependencyAnalyzer,
 * SinkExecutor, and SharedModuleCreator.
 *
 * Phase 1.1 of functional duplication consolidation.
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

/**
 * Options for identifier collection
 */
export interface IdentifierCollectorOptions {
  /** Include JSX element names in collection */
  includeJSXElements?: boolean;
  /** Include property keys in collection */
  includePropertyKeys?: boolean;
  /** Include JSX attribute names in collection */
  includeJSXAttributeNames?: boolean;
  /** Include declarations in collection */
  includeDeclarations?: boolean;
}

/**
 * Identifier reference with detailed metadata
 */
export interface IdentifierReference {
  name: string;
  path: NodePath;
  usage: 'value' | 'call' | 'jsx-element' | 'jsx-attribute' | 'spread';
  scope?: any; // ScopeInfo from ScopeManager if provided
}

/**
 * Detailed collection result
 */
export interface DetailedCollectionResult {
  identifiers: IdentifierReference[];
  jsxElementNames?: string[];
  spreads?: NodePath[];
  errors?: string[];
}

/**
 * Shared identifier collector
 */
export class IdentifierCollector {
  private readonly options: IdentifierCollectorOptions;

  constructor(options: IdentifierCollectorOptions = {}) {
    this.options = {
      includeJSXElements: options.includeJSXElements ?? false,
      includePropertyKeys: options.includePropertyKeys ?? false,
      includeJSXAttributeNames: options.includeJSXAttributeNames ?? false,
      includeDeclarations: options.includeDeclarations ?? false,
    };
  }

  /**
   * Collect identifier names as a Set<string>
   * Used by ExtractDependencyAnalyzer and SharedModuleCreator
   */
  collectNames(nodePath: NodePath): Set<string> {
    const names = new Set<string>();

    nodePath.traverse({
      Identifier: (path) => {
        // Exclude JSX element names (unless option set)
        if (!this.options.includeJSXElements && this.isJSXElementName(path)) {
          return;
        }

        // Exclude JSX attribute names (unless option set)
        if (!this.options.includeJSXAttributeNames && this.isJSXAttributeName(path)) {
          return;
        }

        // Exclude property keys (unless option set)
        if (!this.options.includePropertyKeys && this.isPropertyKey(path)) {
          return;
        }

        // Exclude declarations (unless option set)
        if (!this.options.includeDeclarations && this.isDeclaration(path)) {
          return;
        }

        names.add(path.node.name);
      },

      JSXIdentifier: (path) => {
        if (this.options.includeJSXElements) {
          // Collect only JSX element names (exclude attribute names)
          if (t.isJSXOpeningElement(path.parent) || t.isJSXClosingElement(path.parent)) {
            names.add(path.node.name);
          }
        }
      },
    });

    return names;
  }

  /**
   * Collect identifiers with detailed metadata
   * Used by DependencyAnalyzer
   */
  collectDetailed(nodePath: NodePath): DetailedCollectionResult {
    const identifiers: IdentifierReference[] = [];
    const jsxElementNames: string[] = [];
    const spreads: NodePath[] = [];
    const errors: string[] = [];
    const seenIdentifiers = new Set<string>();

    const addIdentifier = (ref: IdentifierReference) => {
      const uniqueKey = `${ref.name}:${ref.usage}`;
      if (!seenIdentifiers.has(uniqueKey)) {
        seenIdentifiers.add(uniqueKey);
        identifiers.push(ref);
      }
    };

    nodePath.traverse({
      Identifier: (idPath) => {
        // Skip JSX element names
        if (this.isJSXElementName(idPath)) return;

        // Skip property keys
        if (this.isPropertyKey(idPath)) return;

        // Skip declarations
        if (this.isDeclaration(idPath)) return;

        addIdentifier({
          name: idPath.node.name,
          path: idPath,
          usage: this.getIdentifierUsage(idPath),
        });
      },

      JSXOpeningElement: (jsxPath) => {
        const nameNode = jsxPath.node.name;
        if (t.isJSXIdentifier(nameNode)) {
          jsxElementNames.push(nameNode.name);
        }
      },

      JSXSpreadAttribute: (spreadPath) => {
        spreads.push(spreadPath);
      },
    });

    return {
      identifiers,
      jsxElementNames: jsxElementNames.length > 0 ? jsxElementNames : undefined,
      spreads: spreads.length > 0 ? spreads : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Collect used identifiers (excluding bindings)
   * Used by SinkExecutor
   */
  collectUsed(nodePath: NodePath): Set<string> {
    const used = new Set<string>();
    const bindings = new Set<string>();

    const collectRecursive = (node: t.Node): void => {
      if (t.isIdentifier(node)) {
        used.add(node.name);
      }

      // Track bindings
      if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
        bindings.add(node.id.name);
      }

      if (t.isFunctionDeclaration(node) && node.id && t.isIdentifier(node.id)) {
        bindings.add(node.id.name);
      }

      if (t.isClassDeclaration(node) && node.id && t.isIdentifier(node.id)) {
        bindings.add(node.id.name);
      }

      if (t.isImportSpecifier(node) && t.isIdentifier(node.local)) {
        bindings.add(node.local.name);
      }

      if (t.isImportDefaultSpecifier(node) && t.isIdentifier(node.local)) {
        bindings.add(node.local.name);
      }

      // Recurse through child nodes
      const keys = Object.keys(node);
      for (const key of keys) {
        const value: unknown = Reflect.get(node, key);

        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (this.isNode(item)) {
                collectRecursive(item);
              }
            }
          } else if (this.isNode(value)) {
            collectRecursive(value);
          }
        }
      }
    };

    collectRecursive(nodePath.node);

    // Remove bindings from used set
    for (const binding of bindings) {
      used.delete(binding);
    }

    return used;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if identifier is a JSX element name
   */
  private isJSXElementName(path: NodePath): boolean {
    const parent = path.parent;
    if (!parent) return false;

    // <Component />
    if (t.isJSXOpeningElement(parent) || t.isJSXClosingElement(parent)) {
      return parent.name === path.node;
    }

    // <Component.SubComponent />
    if (t.isJSXMemberExpression(parent)) {
      return true;
    }

    return false;
  }

  /**
   * Check if identifier is a JSX attribute name
   */
  private isJSXAttributeName(path: NodePath): boolean {
    const parent = path.parent;
    if (!parent) return false;

    // <div className="..." />
    if (t.isJSXAttribute(parent)) {
      return parent.name === path.node;
    }

    return false;
  }

  /**
   * Check if identifier is an object property key
   */
  private isPropertyKey(path: NodePath): boolean {
    const parent = path.parent;
    if (!parent) return false;

    // { key: value } - exclude non-computed keys
    if (t.isObjectProperty(parent)) {
      return parent.key === path.node && !parent.computed;
    }

    // { method() {} } - exclude method names
    if (t.isObjectMethod(parent)) {
      return parent.key === path.node && !parent.computed;
    }

    return false;
  }

  /**
   * Check if identifier is a declaration
   */
  private isDeclaration(path: NodePath): boolean {
    const parent = path.parent;
    if (!parent) return false;

    // const foo = ...
    if (t.isVariableDeclarator(parent)) {
      return parent.id === path.node;
    }

    // function foo() {}
    if (t.isFunctionDeclaration(parent)) {
      return parent.id === path.node;
    }

    // class Foo {}
    if (t.isClassDeclaration(parent)) {
      return parent.id === path.node;
    }

    return false;
  }

  /**
   * Determine identifier usage type
   */
  private getIdentifierUsage(
    path: NodePath
  ): 'value' | 'call' | 'jsx-element' | 'jsx-attribute' | 'spread' {
    const parent = path.parent;
    if (!parent) return 'value';

    // myFunction()
    if (t.isCallExpression(parent) && parent.callee === path.node) {
      return 'call';
    }

    // <Component />
    if (t.isJSXOpeningElement(parent) || t.isJSXClosingElement(parent)) {
      return 'jsx-element';
    }

    // <div prop={value} />
    if (t.isJSXAttribute(parent)) {
      return 'jsx-attribute';
    }

    // {...props}
    if (t.isSpreadElement(parent) || t.isJSXSpreadAttribute(parent)) {
      return 'spread';
    }

    return 'value';
  }

  /**
   * Type guard for Babel nodes
   */
  private isNode(value: unknown): value is t.Node {
    return typeof value === 'object' && value !== null && 'type' in value;
  }
}
