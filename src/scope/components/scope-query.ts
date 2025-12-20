/**
 * Scope Query
 *
 * Responsible for querying scope information from the scope tree.
 * Provides lookups for nodes, paths, and component information.
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import { createInternalError, type InternalErrorType } from '../../errors/index.js';
import { ok, err, type Result } from '../../result/index.js';
import {
  ScopeType,
  type ScopeInfo,
  type ComponentScope,
  type ComponentInfo,
  type ScopeTree,
} from '../types.js';

/**
 * Type guard to check if a ScopeInfo is a ComponentScope
 */
function isComponentScope(scope: ScopeInfo): scope is ComponentScope {
  return scope.type === ScopeType.Component;
}

/**
 * ScopeQuery provides scope lookup operations
 */
export class ScopeQuery {
  /**
   * Get the scope containing a specific AST node
   */
  getScopeForNode(node: t.Node, scopeTree: ScopeTree | null): ScopeInfo | null {
    if (!scopeTree) return null;
    return scopeTree.nodeToScope.get(node) ?? null;
  }

  /**
   * Get the scope containing a specific path
   */
  getScopeForPath(path: NodePath, scopeTree: ScopeTree | null): ScopeInfo | null {
    return this.getScopeForNode(path.node, scopeTree);
  }

  /**
   * Find the enclosing component scope for a path
   */
  findEnclosingComponent(path: NodePath, scopeTree: ScopeTree | null): Result<ComponentScope | null, InternalErrorType> {
    let current: NodePath | null = path;
    const MAX_DEPTH = 1000;
    let depth = 0;

    while (current?.node && depth < MAX_DEPTH) {
      depth++;
      const scope = this.getScopeForNode(current.node, scopeTree);
      if (scope !== null && isComponentScope(scope)) {
        return ok(scope);
      }
      current = current.parentPath;
    }

    if (depth >= MAX_DEPTH) {
      return err(
        createInternalError({
          code: 'E001',
          message: `ScopeQuery.findEnclosingComponent: Maximum tree depth (${MAX_DEPTH}) exceeded for path node type ${path.node.type}`,
        })
      );
    }

    return ok(null);
  }

  /**
   * Get all components in the scope tree
   */
  getAllComponents(components: Map<string, ComponentInfo>): ComponentInfo[] {
    return Array.from(components.values());
  }

  /**
   * Get component info by scope ID
   */
  getComponentInfo(scopeId: string, components: Map<string, ComponentInfo>): ComponentInfo | null {
    return components.get(scopeId) ?? null;
  }
}

/**
 * Create a new ScopeQuery instance
 */
export function createScopeQuery(): ScopeQuery {
  return new ScopeQuery();
}
