/**
 * Dependency Resolver
 *
 * Checks if dependencies can be resolved at target scope.
 *
 * Responsibilities:
 * - Validate hook dependencies aren't moved outside components
 * - Check dependency accessibility via scope hierarchy
 * - Determine if hoisting is needed
 *
 * Single Responsibility: Dependency resolution validation
 */

import { ScopeType } from "../scope/index.js";
import type { ScopeInfo } from "../scope/index.js";

import type { IScopeAccessibility, IBindingQuery, IDependencyResolver } from "./interfaces.js";
import { DependencyType, type InternalDependency } from "./types.js";

/**
 * DependencyResolver class for checking dependency resolution
 */
export class DependencyResolver implements IDependencyResolver {
  constructor(
    private readonly scopeAccessibility: IScopeAccessibility,
    private readonly bindingQuery: IBindingQuery
  ) {}

  /**
   * Check if all dependencies can be resolved at the target scope
   *
   * @param deps - Dependencies to check
   * @param targetScope - Target scope for the move
   * @returns Resolution result with can/reason
   */
  checkResolution(
    deps: InternalDependency[],
    targetScope: ScopeInfo | null
  ): { can: boolean; reason?: string } {
    for (const dep of deps) {
      // Context dependencies may not be resolvable
      if (dep.type === DependencyType.Context) {
        // Check if context is available at target
        // For now, assume context needs special handling
        // In a real implementation, we'd check the provider hierarchy
        // Currently we allow context dependencies (same as original behavior)
        continue;
      }

      // Hook dependencies can't be moved outside of components
      if (dep.type === DependencyType.Hook) {
        // null targetScope or Module scope both indicate moving to module level
        if (!targetScope || targetScope.type === ScopeType.Module) {
          return {
            can: false,
            reason: `Hook dependency "${dep.symbol}" cannot be moved to module scope`,
          };
        }
      }
    }

    return { can: true };
  }

  /**
   * Check if a specific dependency needs hoisting
   *
   * A dependency needs hoisting if it's not accessible from the target scope.
   *
   * @param dep - Dependency to check
   * @param targetScope - Target scope
   * @returns True if dependency needs hoisting
   */
  needsHoisting(
    dep: InternalDependency,
    targetScope: ScopeInfo | null
  ): boolean {
    // Imports don't need hoisting, they need re-importing
    if (dep.type === DependencyType.Import) {
      return false;
    }

    // If no target scope, assume moving to module level
    // Most dependencies need hoisting when moving to module level
    if (!targetScope) {
      return true;
    }

    // Check if target scope already has bindings for all required symbols
    // If yes, the references will be rebound to the target scope's bindings (no hoisting needed)
    const targetBindings = this.bindingQuery.getBindingsInScope(targetScope);

    // Parse comma-separated symbols (e.g., "theme, toggleTheme" -> ["theme", "toggleTheme"])
    const symbols = dep.symbol.split(',').map(s => s.trim());
    const allSymbolsExist = symbols.every(symbol => targetBindings.has(symbol));

    if (allSymbolsExist) {
      return false;
    }

    // Check if dependency scope is accessible from target
    const accessibility = this.scopeAccessibility.checkAccessibility(
      dep.scope,
      targetScope
    );
    return !accessibility.accessible;
  }
}

/**
 * Create a new DependencyResolver instance
 */
export function createDependencyResolver(
  scopeAccessibility: IScopeAccessibility,
  bindingQuery: IBindingQuery
): DependencyResolver {
  return new DependencyResolver(scopeAccessibility, bindingQuery);
}
