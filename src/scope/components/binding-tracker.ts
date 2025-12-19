/**
 * Binding Tracker
 *
 * Responsible for tracking variable bindings within scopes.
 * Handles binding extraction, accessibility checks, and JSX usage detection.
 */

import type { NodePath, Binding } from '@babel/traverse';
import * as t from '@babel/types';

import {
  type ScopeInfo,
  type BindingInfo,
  type ScopeTree,
  type AccessibilityResult,
} from '../types.js';

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
 * BindingTracker handles variable binding tracking and accessibility
 */
export class BindingTracker {
  /**
   * Extract bindings from a function path
   */
  extractBindings(
    path: NodePath,
    scope: ScopeInfo,
    scopeTree: ScopeTree
  ): void {
    const bindings = new Map<string, BindingInfo>();

    // Get Babel's scope bindings
    const babelScope = path.scope;
    for (const [name, binding] of Object.entries(babelScope.bindings)) {
      const isHook = this.isHookCall(binding.path);
      const usedInJSX = this.isUsedInJSX(binding);

      bindings.set(name, {
        binding,
        scope,
        isHook,
        usedInJSX,
        references: binding.referencePaths,
      });
    }

    scopeTree.bindingsByScope.set(scope.id, bindings);
  }

  /**
   * Get all bindings in a scope
   */
  getBindingsInScope(scope: ScopeInfo, scopeTree: ScopeTree | null): Map<string, BindingInfo> {
    if (!scopeTree) return new Map<string, BindingInfo>();
    return scopeTree.bindingsByScope.get(scope.id) ?? new Map<string, BindingInfo>();
  }

  /**
   * Check if a binding is accessible from a given scope
   */
  isBindingAccessible(
    bindingName: string,
    fromScope: ScopeInfo,
    bindingScope: ScopeInfo,
    scopeTree: ScopeTree | null,
    checkAccessibilityFn: (sourceScope: ScopeInfo, targetScope: ScopeInfo) => AccessibilityResult
  ): boolean {
    const accessibility = checkAccessibilityFn(bindingScope, fromScope);
    if (!accessibility.accessible) return false;

    // Check if binding is actually defined in bindingScope
    const bindings = this.getBindingsInScope(bindingScope, scopeTree);
    return bindings.has(bindingName);
  }

  /**
   * Check if a binding is from a hook call
   */
  private isHookCall(path: NodePath): boolean {
    const parent = path.parentPath;
    if (!parent) return false;

    // Check for const [x, setX] = useState()
    if (t.isVariableDeclarator(parent.node)) {
      const init = parent.node.init;
      if (t.isCallExpression(init)) {
        const callee = init.callee;
        if (t.isIdentifier(callee) && REACT_HOOKS.has(callee.name)) {
          return true;
        }
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.property) &&
          REACT_HOOKS.has(callee.property.name)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a binding is used in JSX
   */
  private isUsedInJSX(binding: Binding): boolean {
    for (const ref of binding.referencePaths) {
      if (this.isInJSXContext(ref)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a path is in a JSX context
   */
  private isInJSXContext(path: NodePath): boolean {
    let current: NodePath | null = path;

    while (current) {
      if (
        t.isJSXElement(current.node) ||
        t.isJSXFragment(current.node) ||
        t.isJSXAttribute(current.node) ||
        t.isJSXExpressionContainer(current.node)
      ) {
        return true;
      }
      current = current.parentPath;
    }

    return false;
  }
}

/**
 * Create a new BindingTracker instance
 */
export function createBindingTracker(): BindingTracker {
  return new BindingTracker();
}
