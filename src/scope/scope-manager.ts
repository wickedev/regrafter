/**
 * Scope Manager (Coordinator)
 *
 * Coordinates scope tracking operations by delegating to specialized components.
 * Acts as the main entry point for scope analysis while distributing work to:
 * - ScopeTreeBuilder: AST traversal and scope tree construction
 * - BindingTracker: Variable binding tracking and accessibility
 * - HookTracker: React hooks detection and analysis
 * - ScopeQuery: Scope lookup and component queries
 * - LCAComputer: Lowest common ancestor computation
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { type ValidationErrorType, type InternalErrorType } from '../errors/index.js';
import type { IScopeManager } from '../interfaces/index.js';
import { type Result } from '../result/index.js';
import type { HookUsage } from '../types/internal.js';
import { extractFunctionName } from '../utils/index.js';

import { createBindingTracker, type BindingTracker } from './components/binding-tracker.js';
import { createHookTracker, type HookTracker } from './components/hook-tracker.js';
import { createLCAComputer, type LCAComputer } from './components/lca-computer.js';
import { createScopeQuery, type ScopeQuery } from './components/scope-query.js';
import { createScopeTreeBuilder, type ScopeTreeBuilder } from './components/scope-tree-builder.js';
import {
  ScopeType,
  type ScopeInfo,
  type ComponentScope,
  type AccessibilityResult,
  type LCAResult,
  type BindingInfo,
  type ComponentInfo,
  type ScopeTree,
} from './types.js';

/**
 * Type guard to check if a ScopeInfo is a ComponentScope
 */
function isComponentScope(scope: ScopeInfo): scope is ComponentScope {
  return scope.type === ScopeType.Component;
}

/**
 * ScopeManager coordinates scope tracking and analysis operations
 *
 * This class acts as a coordinator that delegates work to specialized components:
 * - Maintains the scope tree and component information
 * - Delegates tree building to ScopeTreeBuilder
 * - Delegates binding operations to BindingTracker
 * - Delegates hook detection to HookTracker
 * - Delegates queries to ScopeQuery
 * - Delegates LCA computation to LCAComputer
 *
 * Implements the IScopeManager interface for external consumers.
 */
export class ScopeManager implements IScopeManager {
  private scopeTree: ScopeTree | null = null;
  private readonly components: Map<string, ComponentInfo> = new Map();
  private readonly treeBuilder: ScopeTreeBuilder;
  private readonly bindingTracker: BindingTracker;
  private readonly hookTracker: HookTracker;
  private readonly scopeQuery: ScopeQuery;
  private readonly lcaComputer: LCAComputer;

  constructor() {
    this.treeBuilder = createScopeTreeBuilder();
    this.bindingTracker = createBindingTracker();
    this.hookTracker = createHookTracker();
    this.scopeQuery = createScopeQuery();
    this.lcaComputer = createLCAComputer();
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
        const componentInfo: ComponentInfo = info;
        this.components.set(id, componentInfo);
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
    const name = extractFunctionName(path);
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
    _path: NodePath,
    _parent: ScopeInfo | null,
    _scopeTree: ScopeTree
  ): ComponentScope | null {
    // For backwards compatibility with the interface
    // In practice, this is now handled by ScopeTreeBuilder
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
    const lcaResult = this.lcaComputer.computeLCA(sourceScope, targetScope);

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
    if (this.lcaComputer.isAncestor(sourceScope, targetScope)) {
      return {
        accessible: true,
        scopePath,
        lca: lcaResult.lca,
      };
    }

    // Check if target is ancestor of source (reverse not allowed for new bindings)
    if (this.lcaComputer.isAncestor(targetScope, sourceScope)) {
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
    return this.lcaComputer.computeLCA(scopeA, scopeB);
  }

  /**
   * Get the scope containing a specific AST node
   */
  getScopeForNode(node: t.Node): ScopeInfo | null {
    return this.scopeQuery.getScopeForNode(node, this.scopeTree);
  }

  /**
   * Get the scope containing a specific path
   */
  getScopeForPath(path: NodePath): ScopeInfo | null {
    return this.scopeQuery.getScopeForPath(path, this.scopeTree);
  }

  /**
   * Find the enclosing component scope for a path
   */
  findEnclosingComponent(path: NodePath): Result<ComponentScope | null, InternalErrorType> {
    return this.scopeQuery.findEnclosingComponent(path, this.scopeTree);
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
    return this.scopeQuery.getAllComponents(this.components);
  }

  /**
   * Get component info by scope ID
   */
  getComponentInfo(scopeId: string): ComponentInfo | null {
    return this.scopeQuery.getComponentInfo(scopeId, this.components);
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
  private detectHooks(path: NodePath): HookUsage[] {
    const hookInfos = this.hookTracker.detectHooks(path);
    // Convert HookInfo to HookUsage
    return hookInfos.map((hookInfo) => ({
      name: hookInfo.name,
      path: hookInfo.path,
      dependencies: hookInfo.dependencies ?? [],
    }));
  }



}


/**
 * Create a new ScopeManager instance
 */
export function createScopeManager(): ScopeManager {
  return new ScopeManager();
}
