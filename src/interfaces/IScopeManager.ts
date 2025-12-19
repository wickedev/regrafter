/**
 * Scope Manager Interface
 *
 * Defines the contract for scope tracking and analysis.
 * Implementations build and maintain a hierarchical scope tree
 * that tracks component boundaries, variable bindings, and scope relationships.
 *
 * @module interfaces/IScopeManager
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
 * Interface for scope management operations
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
 * const scopeManager: IScopeManager = createScopeManager();
 *
 * const buildResult = scopeManager.buildScopeTree(ast);
 * if (isErr(buildResult)) {
 *   console.error('Failed to build scope tree:', buildResult.error);
 *   return;
 * }
 *
 * const scope = scopeManager.getScopeForPath(elementPath);
 * const bindings = scopeManager.getBindingsInScope(scope);
 * ```
 */
export interface IScopeManager {
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
   * const result = scopeManager.buildScopeTree(ast);
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
   * const result = scopeManager.checkAccessibility(sourceScope, targetScope);
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
   * const lca = scopeManager.computeLCA(sourceScope, targetScope);
   * console.log('Hoist to:', lca.lca.id);
   * console.log('Distance:', lca.distance);
   * ```
   */
  computeLCA(scopeA: ScopeInfo, scopeB: ScopeInfo): LCAResult;

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
   * const result = scopeManager.findEnclosingComponent(elementPath);
   * if (isErr(result)) {
   *   console.error('Lookup failed:', result.error);
   *   return;
   * }
   * const component = result.value; // ComponentScope | null
   * ```
   */
  findEnclosingComponent(path: NodePath): Result<ComponentScope | null, InternalErrorType>;

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
