/**
 * Segregated Scope Interfaces (Interface Segregation Principle)
 *
 * This module provides focused interfaces for scope management operations.
 * Each interface represents a specific responsibility, allowing consumers
 * to depend only on the methods they actually use.
 *
 * This follows the Interface Segregation Principle (ISP): clients should not
 * be forced to depend on interfaces they do not use.
 *
 * @module interfaces/scope-interfaces
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import type { InternalErrorType, ValidationErrorType } from '../errors/index.js';
import type { Result } from '../result/index.js';
import type {
  AccessibilityResult,
  BindingInfo,
  ComponentInfo,
  ComponentScope,
  LCAResult,
  ScopeInfo,
  ScopeTree,
} from '../scope/types.js';

/**
 * Interface for scope tree construction operations
 *
 * Implementations must:
 * - Build hierarchical scope tree from AST
 * - Track component boundaries and React components
 * - Provide access to the built scope tree
 *
 * Use this interface when you need to build or access the scope tree structure.
 *
 * @example
 * ```typescript
 * function initializeScopeAnalysis(
 *   builder: IScopeTreeBuilder,
 *   ast: t.File
 * ): Result<ScopeTree, ValidationErrorType> {
 *   return builder.buildScopeTree(ast);
 * }
 * ```
 */
export interface IScopeTreeBuilder {
  /**
   * Build scope tree from AST
   *
   * Analyzes the AST and builds a hierarchical scope tree that tracks:
   * - Module/file-level scope
   * - Component boundaries (function components)
   * - Block scopes (loops, conditionals)
   * - Variable bindings in each scope
   * - React hooks in each component
   *
   * @param ast - The AST to analyze
   * @returns Result with the built scope tree or ValidationError
   *
   * @example
   * ```typescript
   * const result = builder.buildScopeTree(ast);
   * if (isErr(result)) {
   *   console.error('Invalid AST:', result.error.message);
   *   return;
   * }
   * const scopeTree = result.value;
   * ```
   */
  buildScopeTree(ast: t.File): Result<ScopeTree, ValidationErrorType>;

  /**
   * Get the current scope tree
   *
   * @returns The scope tree or null if not built yet
   */
  getScopeTree(): ScopeTree | null;

  /**
   * Check if a path represents a React component
   *
   * @param path - Path to check
   * @returns True if the path is a React component function
   */
  isReactComponent(path: NodePath): boolean;

  /**
   * Create component scope from a NodePath
   *
   * @param path - Path to component function
   * @param parent - Parent scope
   * @param scopeTree - The scope tree being built
   * @returns Component scope or null if not a component
   */
  createComponentScopeFromPath(
    path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>,
    parent: ScopeInfo | null,
    scopeTree: ScopeTree
  ): ComponentScope | null;
}

/**
 * Interface for scope lookup and query operations
 *
 * Implementations must:
 * - Look up scopes for AST nodes and paths
 * - Find enclosing component boundaries
 *
 * Use this interface when you need to query scope information for specific nodes or paths.
 *
 * @example
 * ```typescript
 * function getElementScope(
 *   query: IScopeQuery,
 *   elementPath: NodePath
 * ): ScopeInfo | null {
 *   return query.getScopeForPath(elementPath);
 * }
 * ```
 */
export interface IScopeQuery {
  /**
   * Get scope for a node
   *
   * @param node - AST node to lookup
   * @returns Scope containing the node or null if not found
   */
  getScopeForNode(node: t.Node): ScopeInfo | null;

  /**
   * Get scope for a path
   *
   * @param path - NodePath to lookup
   * @returns Scope containing the path or null if not found
   */
  getScopeForPath(path: NodePath): ScopeInfo | null;

  /**
   * Find enclosing component scope
   *
   * Walks up the scope tree to find the nearest component boundary.
   *
   * @param path - Path to start from
   * @returns Result with component scope or null, or InternalError
   *
   * @example
   * ```typescript
   * const result = query.findEnclosingComponent(elementPath);
   * if (isErr(result)) {
   *   console.error('Lookup failed:', result.error);
   *   return;
   * }
   * const component = result.value; // ComponentScope | null
   * ```
   */
  findEnclosingComponent(path: NodePath): Result<ComponentScope | null, InternalErrorType>;
}

/**
 * Interface for scope accessibility checking operations
 *
 * Implementations must:
 * - Determine if scopes can access each other
 * - Compute lowest common ancestor (LCA) for hoisting
 *
 * Use this interface when you need to check if dependencies can be resolved
 * between scopes or determine where to hoist dependencies.
 *
 * @example
 * ```typescript
 * function canMoveElement(
 *   accessibility: IScopeAccessibility,
 *   sourceScope: ScopeInfo,
 *   targetScope: ScopeInfo
 * ): boolean {
 *   const result = accessibility.checkAccessibility(sourceScope, targetScope);
 *   return result.accessible;
 * }
 * ```
 */
export interface IScopeAccessibility {
  /**
   * Check if a binding is accessible from a scope
   *
   * Determines if variables from source scope can be accessed from target scope
   * based on scope hierarchy and closure rules.
   *
   * @param sourceScope - Scope where bindings are defined
   * @param targetScope - Scope where bindings are accessed
   * @returns Accessibility result with boolean and optional explanation
   *
   * @example
   * ```typescript
   * const result = accessibility.checkAccessibility(sourceScope, targetScope);
   * if (!result.accessible) {
   *   console.log('Not accessible:', result.reason);
   * }
   * ```
   */
  checkAccessibility(sourceScope: ScopeInfo, targetScope: ScopeInfo): AccessibilityResult;

  /**
   * Compute lowest common ancestor (LCA) of two scopes
   *
   * Finds the nearest common parent scope that contains both scopes.
   * Used to determine where to hoist dependencies.
   *
   * @param scopeA - First scope
   * @param scopeB - Second scope
   * @returns LCA result with common ancestor and hoisting path
   *
   * @example
   * ```typescript
   * const lca = accessibility.computeLCA(sourceScope, targetScope);
   * console.log('Hoist to:', lca.lca.id);
   * console.log('Distance:', lca.distance);
   * ```
   */
  computeLCA(scopeA: ScopeInfo, scopeB: ScopeInfo): LCAResult;
}

/**
 * Interface for variable binding query operations
 *
 * Implementations must:
 * - Retrieve bindings within a scope
 * - Check if specific bindings are accessible
 *
 * Use this interface when you need to query variable bindings and their accessibility.
 *
 * @example
 * ```typescript
 * function findAccessibleBindings(
 *   bindingQuery: IBindingQuery,
 *   scope: ScopeInfo,
 *   targetScope: ScopeInfo
 * ): Map<string, BindingInfo> {
 *   const bindings = bindingQuery.getBindingsInScope(scope);
 *   const accessible = new Map<string, BindingInfo>();
 *
 *   for (const [name, binding] of bindings) {
 *     if (bindingQuery.isBindingAccessible(name, targetScope, scope)) {
 *       accessible.set(name, binding);
 *     }
 *   }
 *
 *   return accessible;
 * }
 * ```
 */
export interface IBindingQuery {
  /**
   * Get all variable bindings in a scope
   *
   * @param scope - Scope to query
   * @returns Map of binding names to binding information
   */
  getBindingsInScope(scope: ScopeInfo): Map<string, BindingInfo>;

  /**
   * Check if a specific binding is accessible from a scope
   *
   * @param bindingName - Name of the binding
   * @param fromScope - Scope to check from
   * @param bindingScope - Scope where binding is defined
   * @returns True if accessible
   */
  isBindingAccessible(
    bindingName: string,
    fromScope: ScopeInfo,
    bindingScope: ScopeInfo
  ): boolean;
}

/**
 * Interface for component information query operations
 *
 * Implementations must:
 * - Provide access to all detected components
 * - Look up component information by scope ID
 *
 * Use this interface when you need to query component-specific information.
 *
 * @example
 * ```typescript
 * function analyzeComponents(
 *   componentInfo: IComponentInfo
 * ): void {
 *   const components = componentInfo.getAllComponents();
 *   for (const component of components) {
 *     console.log('Component:', component.name);
 *     console.log('Hooks:', component.hooks.length);
 *   }
 * }
 * ```
 */
export interface IComponentInfo {
  /**
   * Get all components in the file
   *
   * @returns Array of component information
   */
  getAllComponents(): ComponentInfo[];

  /**
   * Get component information by scope ID
   *
   * @param scopeId - ID of the component scope
   * @returns Component information or null if not found
   */
  getComponentInfo(scopeId: string): ComponentInfo | null;
}
