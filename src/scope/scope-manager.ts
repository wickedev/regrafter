/**
 * Scope Manager
 *
 * Provides scope tracking infrastructure for dependency analysis.
 */

import type { NodePath, Binding } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { createValidationError, createInternalError, type ValidationErrorType, type InternalErrorType } from '../errors/index.js';
import type { IScopeManager } from '../interfaces/index.js';
import { ok, err, type Result } from '../result/index.js';
import {
  createScopeInfo,
  createComponentScope,
  generateId,
} from '../types/factories.js';
import { loadTraverseFunction, type TraverseFunction } from '../utils/index.js';

import {
  ScopeType,
  type ScopeInfo,
  type ComponentScope,
  type AccessibilityResult,
  type LCAResult,
  type BindingInfo,
  type ComponentInfo,
  type HookInfo,
  type ScopeTree,
} from './types.js';
import { createScopeTreeBuilder, type ScopeTreeBuilder } from './components/scope-tree-builder.js';
import { createBindingTracker, type BindingTracker } from './components/binding-tracker.js';
import { createHookTracker, type HookTracker } from './components/hook-tracker.js';

const traverse: TraverseFunction = loadTraverseFunction(traverseModule);


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
 * Type guard to check if a ScopeInfo is a ComponentScope
 */
function isComponentScope(scope: ScopeInfo): scope is ComponentScope {
  return scope.type === ScopeType.Component;
}

/**
 * ScopeManager handles scope tracking and analysis
 */
export class ScopeManager implements IScopeManager {
  private scopeTree: ScopeTree | null = null;
  private readonly components: Map<string, ComponentInfo> = new Map();
  private readonly treeBuilder: ScopeTreeBuilder;
  private readonly bindingTracker: BindingTracker;
  private readonly hookTracker: HookTracker;

  constructor() {
    this.treeBuilder = createScopeTreeBuilder();
    this.bindingTracker = createBindingTracker();
    this.hookTracker = createHookTracker();
  }

  /**
   * Analyzes the AST and builds a hierarchical scope tree
   * tracking all scopes, bindings, and component boundaries.
   *
   * @param ast - The AST to analyze
   * @returns Result with the built scope tree or ValidationError
   */
  buildScopeTree(ast: t.File): Result<ScopeTree, ValidationErrorType> {
    // Clear components map for new tree
    this.components.clear();

    // Delegate to ScopeTreeBuilder
    const result = this.treeBuilder.buildScopeTree(
      ast,
      (path: NodePath) => this.detectHooks(path),
      (path: NodePath, scope: ScopeInfo, scopeTree: ScopeTree) => this.extractBindings(path, scope, scopeTree)
    );

    if (result.ok) {
      this.scopeTree = result.value;
      // Copy components from builder
      const builderComponents = this.treeBuilder.getComponents();
      for (const [id, info] of builderComponents.entries()) {
        this.components.set(id, info);
      }
    }

    return result;
  }

  /**
   * Get the current scope tree
   */
  getScopeTree(): ScopeTree | null {
    return this.scopeTree;
  }

  /**
   * Check if a path represents a React component
   *
   * Note: This is part of the IScopeManager interface but is no longer used internally.
   * Component detection is now handled by ScopeTreeBuilder during tree construction.
   */
  isReactComponent(path: NodePath): boolean {
    // For backwards compatibility, we need to implement this method
    // but in practice it's only used during scope tree building which is now delegated
    const name = this.getFunctionName(path);
    if (name === null || !/^[A-Z]/.test(name)) {
      return false;
    }
    return this.returnsJSX(path);
  }

  /**
   * Create component scope from a NodePath
   *
   * Note: This is part of the IScopeManager interface but is no longer used internally.
   * Component scope creation is now handled by ScopeTreeBuilder during tree construction.
   */
  createComponentScopeFromPath(
    path: NodePath,
    parent: ScopeInfo | null,
    scopeTree: ScopeTree
  ): ComponentScope | null {
    // For backwards compatibility with the interface
    // In practice, this is now handled by ScopeTreeBuilder
    return null;
  }

  /**
   * Get the name of a function
   */
  private getFunctionName(path: NodePath): string | null {
    const node = path.node;

    if (t.isFunctionDeclaration(node) && node.id) {
      return node.id.name;
    }

    if (
      (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) &&
      path.parentPath
    ) {
      const parent = path.parentPath.node;

      // const Foo = () => {}
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
        return parent.id.name;
      }

      // { foo: () => {} }
      if (t.isObjectProperty(parent) && t.isIdentifier(parent.key)) {
        return parent.key.name;
      }
    }

    if (t.isFunctionExpression(node) && node.id) {
      return node.id.name;
    }

    return null;
  }

  /**
   * Check if a function returns JSX
   */
  private returnsJSX(path: NodePath): boolean {
    const node = path.node;
    let hasJSXReturn = false;

    // For arrow functions with expression body
    if (
      t.isArrowFunctionExpression(node) &&
      !t.isBlockStatement(node.body)
    ) {
      return t.isJSXElement(node.body) || t.isJSXFragment(node.body);
    }

    // Traverse function body for return statements
    path.traverse({
      ReturnStatement(returnPath) {
        const arg = returnPath.node.argument;
        if (arg && (t.isJSXElement(arg) || t.isJSXFragment(arg))) {
          hasJSXReturn = true;
          returnPath.stop();
        }
      },
    });

    return hasJSXReturn;
  }

  /**
   * A scope is accessible if:
   * - They share a common ancestor
   * - The access doesn't violate closure rules
   * - Variables defined in source scope are visible in target scope
   */
  checkAccessibility(
    sourceScope: ScopeInfo,
    targetScope: ScopeInfo
  ): AccessibilityResult {
    // Same scope is always accessible
    if (sourceScope.id === targetScope.id) {
      return {
        accessible: true,
        scopePath: [sourceScope],
        lca: sourceScope,
      };
    }

    // Compute LCA
    const lcaResult = this.computeLCA(sourceScope, targetScope);

    if (!lcaResult.lca) {
      return {
        accessible: false,
        scopePath: [],
        lca: null,
        reason: 'Scopes do not share a common ancestor',
      };
    }

    // Build scope path from source through LCA to target
    const scopePath = [...lcaResult.pathA.reverse(), ...lcaResult.pathB.slice(1)];

    // Check for accessibility violations
    // A variable defined in source is accessible in target if:
    // 1. Target is a descendant of source (closure access)
    // 2. Both are in the same scope chain to LCA

    // Check if source is ancestor of target (closure access allowed)
    if (this.isAncestor(sourceScope, targetScope)) {
      return {
        accessible: true,
        scopePath,
        lca: lcaResult.lca,
      };
    }

    // Check if target is ancestor of source (reverse not allowed for new bindings)
    if (this.isAncestor(targetScope, sourceScope)) {
      return {
        accessible: false,
        scopePath,
        lca: lcaResult.lca,
        reason: 'Cannot move bindings to a parent scope without hoisting',
      };
    }

    // Sibling scopes - check if both are components
    // Variables in sibling component scopes are not accessible without hoisting
    if (isComponentScope(sourceScope) && isComponentScope(targetScope)) {
      return {
        accessible: false,
        scopePath,
        lca: lcaResult.lca,
        reason: 'Variables in sibling component scopes require hoisting to common ancestor',
      };
    }

    // Other sibling scopes (e.g., sibling functions within same component) are accessible
    return {
      accessible: true,
      scopePath,
      lca: lcaResult.lca,
    };
  }

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
   * Get the scope containing a specific AST node
   */
  getScopeForNode(node: t.Node): ScopeInfo | null {
    if (!this.scopeTree) return null;
    return this.scopeTree.nodeToScope.get(node) ?? null;
  }

  /**
   * Get the scope containing a specific path
   */
  getScopeForPath(path: NodePath): ScopeInfo | null {
    return this.getScopeForNode(path.node);
  }

  /**
   * Find the enclosing component scope for a path
   */
  findEnclosingComponent(path: NodePath): Result<ComponentScope | null, InternalErrorType> {
    let current: NodePath | null = path;
    const MAX_DEPTH = 1000;
    let depth = 0;

    while (current !== null && depth < MAX_DEPTH) {
      depth++;
      const scope = this.getScopeForNode(current.node);
      if (scope !== null && isComponentScope(scope)) {
        return ok(scope);
      }
      current = current.parentPath;
    }

    if (depth >= MAX_DEPTH) {
      return err(
        createInternalError({
          code: 'E001',
          message: `ScopeManager.findEnclosingComponent: Maximum tree depth (${MAX_DEPTH}) exceeded for path node type ${path.node.type}`,
        })
      );
    }

    return ok(null);
  }

  /**
   * Get all bindings in a scope
   */
  getBindingsInScope(scope: ScopeInfo): Map<string, BindingInfo> {
    return this.bindingTracker.getBindingsInScope(scope, this.scopeTree);
  }

  /**
   * Check if a binding is accessible from a given scope
   */
  isBindingAccessible(
    bindingName: string,
    fromScope: ScopeInfo,
    bindingScope: ScopeInfo
  ): boolean {
    return this.bindingTracker.isBindingAccessible(
      bindingName,
      fromScope,
      bindingScope,
      this.scopeTree,
      (sourceScope, targetScope) => this.checkAccessibility(sourceScope, targetScope)
    );
  }

  /**
   * Get all components in the scope tree
   */
  getAllComponents(): ComponentInfo[] {
    return Array.from(this.components.values());
  }

  /**
   * Get component info by scope ID
   */
  getComponentInfo(scopeId: string): ComponentInfo | null {
    return this.components.get(scopeId) ?? null;
  }

  // ===================================================================
  // Private helper methods
  // ===================================================================

  /**
   * Extract bindings from a function path
   */
  private extractBindings(
    path: NodePath,
    scope: ScopeInfo,
    scopeTree: ScopeTree
  ): void {
    this.bindingTracker.extractBindings(path, scope, scopeTree);
  }


  /**
   * Detect hooks used in a component
   */
  private detectHooks(path: NodePath): HookInfo[] {
    return this.hookTracker.detectHooks(path);
  }



  /**
   * Get the path from a scope to the root
   */
  private getPathToRoot(scope: ScopeInfo): ScopeInfo[] {
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
  private isAncestor(scopeA: ScopeInfo, scopeB: ScopeInfo): boolean {
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
 * Create a new ScopeManager instance
 */
export function createScopeManager(): ScopeManager {
  return new ScopeManager();
}
