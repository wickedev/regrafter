/**
 * AST Traversal Utilities
 *
 * Provides reusable utilities for traversing AST nodes and filtering
 * identifier references based on their context (declarations, property keys,
 * JSX attributes, type annotations).
 *
 * @module utils/ast-traversal
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// ===============================================================================
// Type Definitions
// ===============================================================================

/**
 * Options for configuring identifier reference traversal
 */
export interface TraverseIdentifierOptions {
  /**
   * Skip identifiers that are declarations (variables, functions, classes, imports)
   * @default true
   */
  skipDeclarations?: boolean;

  /**
   * Skip identifiers that are property keys in objects or member expressions
   * @default true
   */
  skipPropertyKeys?: boolean;

  /**
   * Skip identifiers that are JSX attribute names
   * @default true
   */
  skipJSXAttributes?: boolean;

  /**
   * Skip identifiers that are part of type annotations
   * @default true
   */
  skipTypeAnnotations?: boolean;
}

/**
 * Callback function for identifier references
 */
export type IdentifierCallback = (path: NodePath<t.Identifier>) => void;

// ===============================================================================
// Helper Functions
// ===============================================================================

/**
 * Check if an identifier is a declaration
 *
 * Declarations include:
 * - Variable declarator identifiers: `const foo = ...`
 * - Function declaration identifiers: `function foo() {}`
 * - Class declaration identifiers: `class Foo {}`
 * - Import specifiers: `import { foo } from "bar"`
 * - Import default specifiers: `import Foo from "bar"`
 * - Import namespace specifiers: `import * as foo from "bar"`
 *
 * @param path - The identifier path to check
 * @returns True if the identifier is a declaration
 *
 * @example
 * ```typescript
 * const code = 'const foo = 123;';
 * const ast = parse(code);
 * traverse(ast, {
 *   Identifier(path) {
 *     if (isDeclarationIdentifier(path)) {
 *       console.log('Declaration:', path.node.name);
 *     }
 *   }
 * });
 * ```
 */
export function isDeclarationIdentifier(path: NodePath<t.Identifier>): boolean {
  const parent = path.parent;

  // Variable declarator: const foo = ...
  if (t.isVariableDeclarator(parent) && parent.id === path.node) {
    return true;
  }

  // Function declaration: function foo() {}
  if (t.isFunctionDeclaration(parent) && parent.id === path.node) {
    return true;
  }

  // Class declaration: class Foo {}
  if (t.isClassDeclaration(parent) && parent.id === path.node) {
    return true;
  }

  // Import specifiers: import { foo } from "bar"
  if (t.isImportSpecifier(parent)) {
    return true;
  }

  // Import default specifier: import Foo from "bar"
  if (t.isImportDefaultSpecifier(parent)) {
    return true;
  }

  // Import namespace specifier: import * as foo from "bar"
  if (t.isImportNamespaceSpecifier(parent)) {
    return true;
  }

  return false;
}

/**
 * Check if an identifier is a property key
 *
 * Property keys include:
 * - Non-computed object property keys: `{ foo: 123 }`
 * - Non-computed member expression properties: `obj.foo`
 *
 * Note: Computed properties are NOT considered property keys:
 * - `{ [foo]: 123 }` - foo is a reference, not a key
 * - `obj[foo]` - foo is a reference, not a key
 *
 * @param path - The identifier path to check
 * @returns True if the identifier is a property key
 *
 * @example
 * ```typescript
 * const code = 'const obj = { foo: 123 };';
 * const ast = parse(code);
 * traverse(ast, {
 *   Identifier(path) {
 *     if (isPropertyKey(path)) {
 *       console.log('Property key:', path.node.name);
 *     }
 *   }
 * });
 * ```
 */
export function isPropertyKey(path: NodePath<t.Identifier>): boolean {
  const parent = path.parent;

  // Object property key: { foo: 123 }
  if (
    t.isObjectProperty(parent) &&
    parent.key === path.node &&
    !parent.computed
  ) {
    return true;
  }

  // Member expression property: obj.foo
  if (
    t.isMemberExpression(parent) &&
    parent.property === path.node &&
    !parent.computed
  ) {
    return true;
  }

  return false;
}

/**
 * Check if an identifier is used in a JSX attribute value
 *
 * Identifiers used in JSX attribute values are inside JSXExpressionContainers
 * that are children of JSXAttributes:
 * - `<div className={foo} />` - foo is in a JSX attribute value
 * - `<div onClick={handler} />` - handler is in a JSX attribute value
 *
 * Note: Identifiers in JSX children are NOT in attributes:
 * - `<div>{foo}</div>` - foo is in children, not an attribute
 *
 * @param path - The identifier path to check
 * @returns True if the identifier is used in a JSX attribute value
 *
 * @example
 * ```typescript
 * const code = '<div className={foo} />';
 * const ast = parse(code, { plugins: ['jsx'] });
 * traverse(ast, {
 *   Identifier(path) {
 *     if (isJSXAttribute(path)) {
 *       console.log('JSX attribute value:', path.node.name);
 *     }
 *   }
 * });
 * ```
 */
export function isJSXAttribute(path: NodePath<t.Identifier>): boolean {
  // Check if inside a JSX expression container
  let currentPath: NodePath | null = path;

  while (currentPath) {
    const node = currentPath.node;
    const parent = currentPath.parent;

    // If we find a JSXExpressionContainer, check if it's in an attribute
    if (t.isJSXExpressionContainer(node)) {
      // JSXExpressionContainer can be in JSXAttribute or as a child
      if (t.isJSXAttribute(parent)) {
        return true;
      }
      return false;
    }

    // Stop at statement boundaries
    if (t.isStatement(node)) {
      break;
    }

    currentPath = currentPath.parentPath;
  }

  return false;
}

/**
 * Check if an identifier is part of a type annotation
 *
 * Type annotations include:
 * - TypeScript type references: `const foo: string = ...`
 * - Generic type parameters: `function foo<T>() {}`
 * - Interface/type declarations
 *
 * @param path - The identifier path to check
 * @returns True if the identifier is part of a type annotation
 *
 * @example
 * ```typescript
 * const code = 'const foo: string = "bar";';
 * const ast = parse(code, { plugins: ['typescript'] });
 * traverse(ast, {
 *   Identifier(path) {
 *     if (isTypeAnnotation(path)) {
 *       console.log('Type annotation:', path.node.name);
 *     }
 *   }
 * });
 * ```
 */
export function isTypeAnnotation(path: NodePath<t.Identifier>): boolean {
  // Check if any parent is a TypeScript type node
  let currentPath: NodePath | null = path;

  while (currentPath) {
    const node = currentPath.node;

    // TypeScript type nodes
    if (
      t.isTSType(node) ||
      t.isTSTypeAnnotation(node) ||
      t.isTSTypeReference(node) ||
      t.isTSTypeParameter(node) ||
      t.isTSTypeParameterDeclaration(node) ||
      t.isTSTypeParameterInstantiation(node) ||
      t.isTSInterfaceDeclaration(node) ||
      t.isTSTypeAliasDeclaration(node)
    ) {
      return true;
    }

    // Stop at statement or expression boundaries
    if (t.isStatement(node) || t.isExpression(node)) {
      // Exception: continue if it's a type assertion or similar
      if (
        !t.isTSAsExpression(node) &&
        !t.isTSTypeAssertion(node) &&
        !t.isTSNonNullExpression(node)
      ) {
        break;
      }
    }

    currentPath = currentPath.parentPath;
  }

  return false;
}

// ===============================================================================
// Traversal Functions
// ===============================================================================

/**
 * Traverse identifier references with configurable filtering
 *
 * This function traverses all identifiers in the given AST path and calls
 * the callback for each identifier that matches the filtering criteria.
 *
 * By default, it skips:
 * - Declarations (variable/function/class/import declarations)
 * - Property keys (non-computed object properties and member expressions)
 * - JSX attributes (attribute names in JSX elements)
 * - Type annotations (TypeScript type references)
 *
 * @param path - The AST path to traverse
 * @param callback - Function to call for each matching identifier
 * @param options - Options to configure which identifiers to skip
 *
 * @example
 * ```typescript
 * // Collect all identifier references (excluding declarations and keys)
 * const references: string[] = [];
 * traverseIdentifierReferences(
 *   programPath,
 *   (idPath) => references.push(idPath.node.name)
 * );
 *
 * // Collect all identifiers including declarations
 * const allIdentifiers: string[] = [];
 * traverseIdentifierReferences(
 *   programPath,
 *   (idPath) => allIdentifiers.push(idPath.node.name),
 *   { skipDeclarations: false }
 * );
 *
 * // Collect only value references (skip all contextual uses)
 * const valueReferences: string[] = [];
 * traverseIdentifierReferences(
 *   programPath,
 *   (idPath) => valueReferences.push(idPath.node.name),
 *   {
 *     skipDeclarations: true,
 *     skipPropertyKeys: true,
 *     skipJSXAttributes: true,
 *     skipTypeAnnotations: true,
 *   }
 * );
 * ```
 */
export function traverseIdentifierReferences(
  path: NodePath,
  callback: IdentifierCallback,
  options: TraverseIdentifierOptions = {}
): void {
  const {
    skipDeclarations = true,
    skipPropertyKeys = true,
    skipJSXAttributes = true,
    skipTypeAnnotations = true,
  } = options;

  path.traverse({
    Identifier(idPath) {
      // Apply filters based on options
      if (skipDeclarations && isDeclarationIdentifier(idPath)) {
        return;
      }

      if (skipPropertyKeys && isPropertyKey(idPath)) {
        return;
      }

      if (skipJSXAttributes && isJSXAttribute(idPath)) {
        return;
      }

      if (skipTypeAnnotations && isTypeAnnotation(idPath)) {
        return;
      }

      // Call the callback for identifiers that pass all filters
      callback(idPath);
    },
  });
}
