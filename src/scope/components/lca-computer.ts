/**
 * LCA Computer
 *
 * Responsible for computing the Lowest Common Ancestor (LCA) of scopes.
 * Used to determine where to hoist dependencies when moving elements.
 */

import {
  type ScopeInfo,
  type LCAResult,
} from '../types.js';

/**
 * LCAComputer handles lowest common ancestor computation
 */
export class LCAComputer {
  /**
   * Uses path-to-root comparison for efficient LCA computation.
   */
  computeLCA(scopeA: ScopeInfo, scopeB: ScopeInfo): LCAResult {
    // Get paths to root for both scopes
    const pathA = this.getPathToRoot(scopeA);
    const pathB = this.getPathToRoot(scopeB);

    // Create set of scope IDs in path A for O(1) lookup
    const pathASet = new Set(pathA.map(s => s.id));

    // Find first scope in path B that's also in path A
    let lca: ScopeInfo | null = null;
    let lcaIndexB = -1;

    for (let i = 0; i < pathB.length; i++) {
      const scopeB_i = pathB[i];
      if (scopeB_i !== undefined && pathASet.has(scopeB_i.id)) {
        lca = scopeB_i;
        lcaIndexB = i;
        break;
      }
    }

    if (lca === null) {
      return {
        lca: null,
        distanceA: -1,
        distanceB: -1,
        pathA: [],
        pathB: [],
      };
    }

    // Find LCA index in path A
    const lcaIndexA = pathA.findIndex(s => s.id === lca.id);

    return {
      lca,
      distanceA: lcaIndexA,
      distanceB: lcaIndexB,
      pathA: pathA.slice(0, lcaIndexA + 1),
      pathB: pathB.slice(0, lcaIndexB + 1),
    };
  }

  /**
   * Get the path from a scope to the root
   */
  getPathToRoot(scope: ScopeInfo): ScopeInfo[] {
    const path: ScopeInfo[] = [];
    let current: ScopeInfo | null = scope;

    while (current) {
      path.push(current);
      current = current.parent;
    }

    return path;
  }

  /**
   * Check if scopeA is an ancestor of scopeB
   */
  isAncestor(scopeA: ScopeInfo, scopeB: ScopeInfo): boolean {
    let current: ScopeInfo | null = scopeB.parent;

    while (current) {
      if (current.id === scopeA.id) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }
}

/**
 * Create a new LCAComputer instance
 */
export function createLCAComputer(): LCAComputer {
  return new LCAComputer();
}
