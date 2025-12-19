/**
 * Hook Tracker
 *
 * Responsible for detecting and tracking React hooks in component scopes.
 * Identifies hook calls, return bindings, and dependency arrays.
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import type { HookInfo } from '../types.js';

/**
 * List of React hooks that we track
 */
const REACT_HOOKS = new Set([
  'useState',
  'useEffect',
  'useContext',
  'useReducer',
  'useCallback',
  'useMemo',
  'useRef',
  'useImperativeHandle',
  'useLayoutEffect',
  'useDebugValue',
  'useDeferredValue',
  'useTransition',
  'useId',
  'useSyncExternalStore',
  'useInsertionEffect',
]);

/**
 * HookTracker handles React hook detection and analysis
 */
export class HookTracker {
  /**
   * Detect hooks used in a component
   */
  detectHooks(path: NodePath): HookInfo[] {
    const hooks: HookInfo[] = [];

    path.traverse({
      CallExpression(callPath) {
        const callee = callPath.node.callee;

        // Check for direct hook calls: useState()
        if (t.isIdentifier(callee) && REACT_HOOKS.has(callee.name)) {
          hooks.push({
            name: callee.name,
            path: callPath,
            returnBindings: getHookReturnBindings(callPath),
            dependencies: getHookDependencies(callPath, callee.name),
          });
        }

        // Check for React.useState() pattern
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object) &&
          callee.object.name === 'React' &&
          t.isIdentifier(callee.property) &&
          REACT_HOOKS.has(callee.property.name)
        ) {
          hooks.push({
            name: callee.property.name,
            path: callPath,
            returnBindings: getHookReturnBindings(callPath),
            dependencies: getHookDependencies(callPath, callee.property.name),
          });
        }

        // Check for custom hooks (useXxx pattern)
        if (
          t.isIdentifier(callee) &&
          /^use[A-Z]/.test(callee.name) &&
          !REACT_HOOKS.has(callee.name)
        ) {
          hooks.push({
            name: callee.name,
            path: callPath,
            returnBindings: getHookReturnBindings(callPath),
            dependencies: [],
          });
        }
      },
    });

    return hooks;
  }
}

/**
 * Helper: Get return bindings from a hook call
 */
function getHookReturnBindings(callPath: NodePath): string[] {
  const parent = callPath.parentPath;
  if (!parent) return [];

  // const [state, setState] = useState()
  if (
    t.isVariableDeclarator(parent.node) &&
    t.isArrayPattern(parent.node.id)
  ) {
    return parent.node.id.elements
      .filter((e): e is t.Identifier => t.isIdentifier(e))
      .map((e) => e.name);
  }

  // const ref = useRef()
  if (
    t.isVariableDeclarator(parent.node) &&
    t.isIdentifier(parent.node.id)
  ) {
    return [parent.node.id.name];
  }

  return [];
}

/**
 * Helper: Get dependencies array from hooks like useEffect, useMemo
 */
function getHookDependencies(callPath: NodePath, hookName: string): string[] {
  const node = callPath.node;
  if (!t.isCallExpression(node)) return [];

  // Hooks with dependency arrays: useEffect, useLayoutEffect, useMemo, useCallback
  const hooksWithDeps = ['useEffect', 'useLayoutEffect', 'useMemo', 'useCallback', 'useInsertionEffect'];
  if (!hooksWithDeps.includes(hookName)) return [];

  // Dependencies are in the second argument
  const depsArg = node.arguments[1];
  if (!t.isArrayExpression(depsArg)) return [];

  return depsArg.elements
    .filter((e): e is t.Identifier => t.isIdentifier(e))
    .map((e) => e.name);
}

/**
 * Create a new HookTracker instance
 */
export function createHookTracker(): HookTracker {
  return new HookTracker();
}
