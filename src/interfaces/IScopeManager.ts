/**
 * Scope Manager Interface
 *
 * Defines the contract for scope tracking and analysis.
 * Implementations build and maintain a hierarchical scope tree
 * that tracks component boundaries, variable bindings, and scope relationships.
 *
 * @deprecated This interface combines multiple responsibilities and violates
 * the Interface Segregation Principle. Prefer using the focused interfaces instead:
 * - IScopeTreeBuilder for tree construction
 * - IScopeQuery for scope lookups
 * - IScopeAccessibility for accessibility checking
 * - IBindingQuery for binding queries
 * - IComponentInfo for component information
 *
 * This interface is maintained for backward compatibility but will be removed
 * in a future major version.
 *
 * @module interfaces/IScopeManager
 */

import type {
  IScopeTreeBuilder,
  IScopeQuery,
  IScopeAccessibility,
  IBindingQuery,
  IComponentInfo,
} from './scope-interfaces.js';

/**
 * Interface for scope management operations
 *
 * @deprecated Use focused interfaces instead: IScopeTreeBuilder, IScopeQuery,
 * IScopeAccessibility, IBindingQuery, IComponentInfo
 *
 * Implementations must:
 * - Build hierarchical scope tree from AST
 * - Track component boundaries and React hooks
 * - Determine binding accessibility between scopes
 * - Compute lowest common ancestor (LCA) for hoisting
 * - Maintain scope-to-node mapping
 *
 * @example
 * ```typescript
 * // Deprecated approach:
 * const scopeManager: IScopeManager = createScopeManager();
 * const buildResult = scopeManager.buildScopeTree(ast);
 * const scope = scopeManager.getScopeForPath(elementPath);
 *
 * // Preferred approach:
 * const scopeManager = createScopeManager();
 * const builder: IScopeTreeBuilder = scopeManager;
 * const query: IScopeQuery = scopeManager;
 * const buildResult = builder.buildScopeTree(ast);
 * const scope = query.getScopeForPath(elementPath);
 * ```
 */
export interface IScopeManager
  extends IScopeTreeBuilder,
    IScopeQuery,
    IScopeAccessibility,
    IBindingQuery,
    IComponentInfo {
  // This interface intentionally has no additional methods.
  // It exists only for backward compatibility and extends all focused interfaces.
}
