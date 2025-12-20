/**
 * Scope Helper Utilities
 *
 * Common patterns for scope traversal and querying.
 * Eliminates code duplication across the codebase.
 *
 * These utilities provide reusable implementations of common scope operations
 * that were previously duplicated across multiple files (143 instances).
 *
 * @module scope/scope-helpers
 */

import type { NodePath } from '@babel/traverse';

import { isErr } from '../result/index.js';

import type { IScopeManager } from '../interfaces/IScopeManager.js';
import type { ScopeInfo, ComponentScope } from './types.js';

/**
 * Get scope for path with automatic fallback to enclosing component
 *
 * Common pattern: Try direct scope lookup, fall back to component scope if not found.
 * This is the most common pattern in the codebase (~50 instances).
 *
 * @param path - NodePath to get scope for
 * @param scopeManager - Scope manager instance
 * @returns Scope containing the path, or null if not found
 *
 * @example
 * ```typescript
 * const scope = getScopeWithFallback(elementPath, scopeManager);
 * if (scope) {
 *   // use scope
 * } else {
 *   // handle error - path not in any scope
 * }
 * ```
 */
export function getScopeWithFallback(
  path: NodePath,
  scopeManager: IScopeManager
): ScopeInfo | null {
  // Try direct scope lookup first
  let scope = scopeManager.getScopeForPath(path);

  // Fall back to enclosing component if direct lookup fails
  if (!scope) {
    const enclosingResult = scopeManager.findEnclosingComponent(path);
    if (!isErr(enclosingResult) && enclosingResult.value) {
      scope = enclosingResult.value;
    }
  }

  return scope;
}

/**
 * Safely unwrap enclosing component Result to ComponentScope | null
 *
 * Common pattern: Unwrap Result and handle error/null cases.
 * Reduces boilerplate for the ~30 instances that just need the component or null.
 *
 * @param path - NodePath to find component for
 * @param scopeManager - Scope manager instance
 * @returns Component scope or null if not found or error occurred
 *
 * @example
 * ```typescript
 * const component = getEnclosingComponentOrNull(elementPath, scopeManager);
 * if (component) {
 *   console.log('Component:', component.componentName);
 * } else {
 *   console.log('Not inside a component');
 * }
 * ```
 */
export function getEnclosingComponentOrNull(
  path: NodePath,
  scopeManager: IScopeManager
): ComponentScope | null {
  const result = scopeManager.findEnclosingComponent(path);
  return isErr(result) ? null : result.value;
}

/**
 * Build array of scopes from current scope to root
 *
 * Returns path from root to current scope (inclusive).
 * Used for LCA computation and scope distance calculations.
 *
 * @param scope - Starting scope
 * @returns Array of scopes from root (index 0) to current scope (last index)
 *
 * @example
 * ```typescript
 * const path = buildScopePath(scope);
 * console.log('Depth:', path.length);
 * console.log('Root:', path[0].id);
 * console.log('Current:', path[path.length - 1].id);
 * ```
 */
export function buildScopePath(scope: ScopeInfo): ScopeInfo[] {
  const path: ScopeInfo[] = [];
  let current: ScopeInfo | null = scope;

  // Walk up to root, collecting scopes
  while (current !== null) {
    path.unshift(current); // Add to front for root-first order
    current = current.parent;
  }

  return path;
}

/**
 * Find lowest common ancestor (LCA) of two scopes
 *
 * Computes the nearest common parent scope that contains both scopes.
 * Used extensively in hoisting logic to determine target scope.
 *
 * @param scopeA - First scope
 * @param scopeB - Second scope
 * @returns LCA scope or null if scopes don't share ancestry
 *
 * @example
 * ```typescript
 * const lca = findCommonAncestor(sourceScope, targetScope);
 * if (lca) {
 *   console.log('Hoist to:', lca.id);
 * } else {
 *   console.log('Scopes are in different trees');
 * }
 * ```
 */
export function findCommonAncestor(
  scopeA: ScopeInfo,
  scopeB: ScopeInfo
): ScopeInfo | null {
  // Build paths from root to each scope
  const pathA = buildScopePath(scopeA);
  const pathB = buildScopePath(scopeB);

  let lca: ScopeInfo | null = null;

  // Find last common scope in paths
  for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
    const scopeA = pathA[i];
    const scopeB = pathB[i];
    if (scopeA && scopeB && scopeA.id === scopeB.id) {
      lca = scopeA;
    } else {
      break; // Paths diverge, stop here
    }
  }

  return lca;
}

/**
 * Check if targetScope is an ancestor of sourceScope
 *
 * Returns true if targetScope is a parent (or grandparent, etc.) of sourceScope.
 * Used to validate hoisting targets and scope accessibility.
 *
 * @param targetScope - Potential ancestor scope
 * @param sourceScope - Scope to check ancestry for
 * @returns True if targetScope is an ancestor of sourceScope
 *
 * @example
 * ```typescript
 * if (isAncestorOf(targetScope, sourceScope)) {
 *   console.log('Target contains source');
 * } else {
 *   console.log('Target does not contain source');
 * }
 * ```
 */
export function isAncestorOf(
  targetScope: ScopeInfo,
  sourceScope: ScopeInfo
): boolean {
  let current: ScopeInfo | null = sourceScope;
  let depth = 0;
  const MAX_DEPTH = 100; // Prevent infinite loops

  // Walk up from source to root
  while (current !== null && depth < MAX_DEPTH) {
    if (current.id === targetScope.id) {
      return true; // Found target in ancestry
    }
    current = current.parent;
    depth++;
  }

  return false; // Target not found in ancestry
}

/**
 * Find nearest ancestor scope matching a predicate
 *
 * Walks up the scope tree to find the first ancestor (not including current scope)
 * that satisfies the given predicate.
 *
 * @param scope - Starting scope
 * @param predicate - Function to test each ancestor scope
 * @returns First matching ancestor or null if none found
 *
 * @example
 * ```typescript
 * import { ScopeType } from './types.js';
 *
 * const componentScope = findNearestAncestor(
 *   scope,
 *   s => s.type === ScopeType.Component
 * );
 *
 * if (componentScope) {
 *   console.log('Found component:', componentScope.id);
 * }
 * ```
 */
export function findNearestAncestor(
  scope: ScopeInfo,
  predicate: (scope: ScopeInfo) => boolean
): ScopeInfo | null {
  let current: ScopeInfo | null = scope.parent; // Start from parent, not current
  let depth = 0;
  const MAX_DEPTH = 100; // Prevent infinite loops

  // Walk up tree testing each ancestor
  while (current !== null && depth < MAX_DEPTH) {
    if (predicate(current)) {
      return current; // Found match
    }
    current = current.parent;
    depth++;
  }

  return null; // No match found
}

/**
 * Compute distance between two scopes
 *
 * Returns the number of edges in the scope tree between two scopes.
 * If scopes are not related (in different trees), returns -1.
 *
 * Distance calculation:
 * - Same scope: 0
 * - Parent-child: 1
 * - Through LCA: distanceA + distanceB
 *
 * @param scopeA - First scope
 * @param scopeB - Second scope
 * @returns Number of edges between scopes, or -1 if not related
 *
 * @example
 * ```typescript
 * const distance = computeScopeDistance(sourceScope, targetScope);
 * if (distance === -1) {
 *   console.log('Scopes are not related');
 * } else {
 *   console.log('Distance:', distance);
 * }
 * ```
 */
export function computeScopeDistance(
  scopeA: ScopeInfo,
  scopeB: ScopeInfo
): number {
  // Same scope = distance 0
  if (scopeA.id === scopeB.id) {
    return 0;
  }

  // Build paths from root
  const pathA = buildScopePath(scopeA);
  const pathB = buildScopePath(scopeB);

  // Find LCA index
  let lcaIndex = -1;
  for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
    const scopeA = pathA[i];
    const scopeB = pathB[i];
    if (scopeA && scopeB && scopeA.id === scopeB.id) {
      lcaIndex = i;
    } else {
      break;
    }
  }

  // No common ancestor = scopes in different trees
  if (lcaIndex === -1) {
    return -1;
  }

  // Distance = edges from A to LCA + edges from LCA to B
  const distanceA = pathA.length - 1 - lcaIndex;
  const distanceB = pathB.length - 1 - lcaIndex;

  return distanceA + distanceB;
}
