/**
 * AST Helper Utilities
 *
 * Provides reusable utilities for working with AST nodes, including
 * function name extraction, React hook name detection, and component
 * name validation.
 *
 * @module utils/ast-helpers
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// ===============================================================================
// React Hook Detection
// ===============================================================================

/**
 * Built-in React hooks
 *
 * Comprehensive list of all official React hooks including:
 * - State hooks (useState, useReducer)
 * - Effect hooks (useEffect, useLayoutEffect, useInsertionEffect)
 * - Context hooks (useContext)
 * - Ref hooks (useRef, useImperativeHandle)
 * - Performance hooks (useCallback, useMemo)
 * - React 18+ hooks (useDeferredValue, useTransition, useId, useSyncExternalStore)
 * - React 19+ hooks (useActionState, useFormStatus, useOptimistic, use)
 */
const REACT_HOOKS = new Set([
  // State hooks
  'useState',
  'useReducer',

  // Effect hooks
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',

  // Context hooks
  'useContext',

  // Ref hooks
  'useRef',
  'useImperativeHandle',

  // Performance hooks
  'useCallback',
  'useMemo',

  // Other hooks
  'useDebugValue',
  'useDeferredValue',
  'useTransition',
  'useId',
  'useSyncExternalStore',
  'useActionState',
  'useFormStatus',
  'useOptimistic',
  'use',
]);

/**
 * Pattern for detecting custom hooks
 *
 * Custom hooks must start with 'use' followed by an uppercase letter.
 * Examples: useCustomHook, useMyState, useAuth
 */
const CUSTOM_HOOK_PATTERN = /^use[A-Z]/;

/**
 * Check if a name is a React hook (built-in or custom)
 *
 * A valid React hook name either:
 * 1. Is a built-in React hook (useState, useEffect, etc.)
 * 2. Follows the custom hook naming convention (useXxx where X is uppercase)
 *
 * @param name - The function name to check
 * @returns True if the name is a React hook
 *
 * @example
 * ```typescript
 * isReactHookName('useState');      // true (built-in)
 * isReactHookName('useCustomHook'); // true (custom)
 * isReactHookName('useless');       // false (lowercase after 'use')
 * isReactHookName('user');          // false (doesn't match pattern)
 * isReactHookName('normalFunc');    // false (not a hook)
 * ```
 */
export function isReactHookName(name: string): boolean {
  return REACT_HOOKS.has(name) || CUSTOM_HOOK_PATTERN.test(name);
}

// ===============================================================================
// Component Name Validation
// ===============================================================================

/**
 * Pattern for detecting valid React component names
 *
 * Component names must start with an uppercase letter (PascalCase).
 * This is a React convention that distinguishes components from regular functions.
 */
const COMPONENT_NAME_PATTERN = /^[A-Z]/;

/**
 * Check if a name is a valid React component name
 *
 * React components must start with an uppercase letter to be recognized
 * as components by React (this allows React to distinguish between
 * components and regular HTML elements in JSX).
 *
 * @param name - The name to check
 * @returns True if the name is a valid React component name
 *
 * @example
 * ```typescript
 * isComponentName('MyComponent'); // true
 * isComponentName('Button');      // true
 * isComponentName('myComponent'); // false (starts with lowercase)
 * isComponentName('button');      // false (starts with lowercase)
 * isComponentName('_Component');  // false (starts with underscore)
 * ```
 */
export function isComponentName(name: string): boolean {
  return COMPONENT_NAME_PATTERN.test(name);
}

// ===============================================================================
// Function Name Extraction
// ===============================================================================

/**
 * Extract the name of a function from its AST path
 *
 * This function handles various function declaration patterns:
 * - Function declarations: `function foo() {}`
 * - Named function expressions: `const x = function foo() {}`
 * - Arrow functions in variable declarators: `const foo = () => {}`
 * - Object properties: `{ foo: () => {} }`
 * - Class methods: `class X { foo() {} }`
 *
 * @param path - The function path to extract the name from
 * @returns The function name, or null if the function is anonymous and not assigned
 *
 * @example
 * ```typescript
 * // Function declaration
 * const ast = parse('function myFunc() {}');
 * const funcPath = getFunctionPath(ast);
 * extractFunctionName(funcPath); // 'myFunc'
 *
 * // Arrow function in variable declarator
 * const ast = parse('const MyComponent = () => {}');
 * const funcPath = getFunctionPath(ast);
 * extractFunctionName(funcPath); // 'MyComponent'
 *
 * // Object property
 * const ast = parse('const obj = { method: () => {} }');
 * const funcPath = getFunctionPath(ast);
 * extractFunctionName(funcPath); // 'method'
 *
 * // Anonymous function
 * const ast = parse('() => {}');
 * const funcPath = getFunctionPath(ast);
 * extractFunctionName(funcPath); // null
 * ```
 */
export function extractFunctionName(path: NodePath): string | null {
  const node = path.node;

  // Function declaration with id: function foo() {}
  if (t.isFunctionDeclaration(node) && node.id) {
    return node.id.name;
  }

  // Named function expression: const x = function foo() {}
  if (t.isFunctionExpression(node) && node.id) {
    return node.id.name;
  }

  // Class method or object method
  if (t.isObjectMethod(node) || t.isClassMethod(node)) {
    if (t.isIdentifier(node.key)) {
      return node.key.name;
    }
  }

  // Check parent context for arrow functions and anonymous function expressions
  if (
    (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) &&
    path.parentPath
  ) {
    const parent = path.parentPath.node;

    // Variable declarator: const foo = () => {}
    if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
      return parent.id.name;
    }

    // Object property: { foo: () => {} }
    if (t.isObjectProperty(parent) && t.isIdentifier(parent.key)) {
      return parent.key.name;
    }

    // Class property: class X { foo = () => {} }
    if (t.isClassProperty(parent) && t.isIdentifier(parent.key)) {
      return parent.key.name;
    }
  }

  // Could not determine name
  return null;
}
