/**
 * Analyzer Interfaces
 *
 * Segregated interfaces for dependency analysis components.
 * Supports Dependency Inversion Principle (SOLID).
 */

import type { NodePath } from "@babel/traverse";

import type { ScopeInfo, BindingInfo } from "../scope/index.js";

import type { InternalDependency } from "./types.js";

/**
 * Interface for scope accessibility checking
 *
 * Determines if a scope can access another scope.
 */
export interface IScopeAccessibility {
  /**
   * Check if a dependency scope is accessible from a target scope
   */
  checkAccessibility(
    dependencyScope: ScopeInfo,
    targetScope: ScopeInfo | null
  ): { accessible: boolean; reason?: string };
}

/**
 * Interface for binding queries
 *
 * Provides access to variable bindings in scopes.
 */
export interface IBindingQuery {
  /**
   * Get all bindings available in a scope
   */
  getBindingsInScope(scope: ScopeInfo): Map<string, BindingInfo>;
}

/**
 * Interface for dependency resolution checking
 *
 * Determines if dependencies can be resolved at target scope.
 */
export interface IDependencyResolver {
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
  ): { can: boolean; reason?: string };

  /**
   * Check if a specific dependency needs hoisting
   *
   * @param dep - Dependency to check
   * @param targetScope - Target scope
   * @returns True if dependency needs hoisting
   */
  needsHoisting(
    dep: InternalDependency,
    targetScope: ScopeInfo | null
  ): boolean;
}

/**
 * Interface for related dependency detection
 *
 * Detects transitive dependencies that reference hoisted symbols.
 */
export interface IRelatedDependencyDetector {
  /**
   * Detect related dependencies that should be hoisted together.
   * This includes:
   * - useEffect calls that reference hoisted state
   * - Helper functions that use hoisted variables
   * - Variables that reference hoisted symbols
   *
   * @param dependencies - All dependencies detected so far
   * @param elementScope - Scope of the element being moved
   * @param elementPath - Path to the element being moved
   * @returns Array of {dependency, path} tuples
   */
  detectRelatedDependencies(
    dependencies: InternalDependency[],
    elementScope: ScopeInfo | null,
    elementPath: NodePath
  ): Array<{ dependency: InternalDependency; path: NodePath }>;
}
