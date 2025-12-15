/**
 * Scope Manager
 *
 * Provides scope tracking infrastructure for dependency analysis.
 *
 * Task 2.2: Scope Manager implementation
 * - 2.2.1: Scope tracking infrastructure
 * - 2.2.2: Component scope detection
 * - 2.2.3: Scope accessibility checking
 * - 2.2.4: LCA (Lowest Common Ancestor) algorithm
 */

import type { NodePath, Binding } from '@babel/traverse';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

import {
  createScopeInfo,
  createComponentScope,
  generateId,
} from '../types/factories.js';

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
 * ScopeManager handles scope tracking and analysis
 */
export class ScopeManager {
  private scopeTree: ScopeTree | null = null;
  private components: Map<string, ComponentInfo> = new Map();

  /**
   * Task 2.2.1: Build scope tree from AST
   *
   * Analyzes the AST and builds a hierarchical scope tree
   * tracking all scopes, bindings, and component boundaries.
   *
   * @param ast - The AST to analyze
   * @returns The built scope tree
   */
  buildScopeTree(ast: t.File): ScopeTree {
    // Initialize scope tree with module scope
    const rootPath = this.getRootPath(ast);
    const rootScope = createScopeInfo({
      type: ScopeType.Module,
      path: rootPath!,
      parent: null,
      depth: 0,
      id: generateId('module'),
    });

    const scopeTree: ScopeTree = {
      root: rootScope,
      scopes: new Map([[rootScope.id, rootScope]]),
      nodeToScope: new WeakMap(),
      bindingsByScope: new Map(),
    };

    // Clear components map for new tree
    this.components.clear();

    // Traverse the AST to build scope tree
    traverse(ast, {
      // Track function declarations
      FunctionDeclaration: (path) => {
        this.processFunctionScope(path, scopeTree);
      },

      // Track function expressions
      FunctionExpression: (path) => {
        this.processFunctionScope(path, scopeTree);
      },

      // Track arrow functions
      ArrowFunctionExpression: (path) => {
        this.processFunctionScope(path, scopeTree);
      },

      // Track block scopes
      BlockStatement: (path) => {
        this.processBlockScope(path, scopeTree);
      },

      // Track for loops
      ForStatement: (path) => {
        this.processLoopScope(path, scopeTree);
      },
      ForInStatement: (path) => {
        this.processLoopScope(path, scopeTree);
      },
      ForOfStatement: (path) => {
        this.processLoopScope(path, scopeTree);
      },
      WhileStatement: (path) => {
        this.processLoopScope(path, scopeTree);
      },
      DoWhileStatement: (path) => {
        this.processLoopScope(path, scopeTree);
      },

      // Track conditionals
      IfStatement: (path) => {
        this.processConditionalScope(path, scopeTree);
      },

      // Track class declarations
      ClassDeclaration: (path) => {
        this.processClassScope(path, scopeTree);
      },

      // Track class expressions
      ClassExpression: (path) => {
        this.processClassScope(path, scopeTree);
      },
    });

    this.scopeTree = scopeTree;
    return scopeTree;
  }

  /**
   * Get the current scope tree
   */
  getScopeTree(): ScopeTree | null {
    return this.scopeTree;
  }

  /**
   * Task 2.2.2: Detect if a function is a React component
   *
   * A function is a React component if:
   * - It starts with an uppercase letter
   * - It returns JSX
   * - It may have a props parameter
   */
  isReactComponent(path: NodePath): boolean {
    const name = this.getFunctionName(path);

    // React components start with uppercase
    if (!name || !/^[A-Z]/.test(name)) {
      return false;
    }

    // Check if it returns JSX
    return this.returnsJSX(path);
  }

  /**
   * Task 2.2.2: Detect component scope from a function
   *
   * Creates a ComponentScope for React components with
   * hook tracking and conditional/loop detection.
   */
  createComponentScopeFromPath(
    path: NodePath,
    parent: ScopeInfo | null,
    scopeTree: ScopeTree
  ): ComponentScope | null {
    if (!this.isReactComponent(path)) {
      return null;
    }

    const name = this.getFunctionName(path) ?? 'Anonymous';
    const isConditional = this.isInsideConditional(path);
    const isLoop = this.isInsideLoop(path);
    const parentComponent = this.findParentComponent(path, scopeTree);
    const hooks = this.detectHooks(path);

    const componentScope = createComponentScope({
      componentName: name,
      path,
      parent,
      parentComponent,
      isConditionallyRendered: isConditional,
      isInsideLoop: isLoop,
      hooks: hooks.map(h => ({
        name: h.name,
        path: h.path,
        dependencies: h.dependencies ?? [],
      })),
    });

    // Store component info
    const componentInfo: ComponentInfo = {
      name,
      type: this.getComponentType(path),
      path,
      isReactComponent: true,
      propsParam: this.getPropsParam(path),
      hooks,
    };
    this.components.set(componentScope.id, componentInfo);

    return componentScope;
  }

  /**
   * Task 2.2.3: Check if a scope is accessible from another scope
   *
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

    // Sibling scopes - needs hoisting to LCA
    return {
      accessible: true,
      scopePath,
      lca: lcaResult.lca,
    };
  }

  /**
   * Task 2.2.4: Compute Lowest Common Ancestor (LCA) of two scopes
   *
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
      if (pathASet.has(pathB[i]!.id)) {
        lca = pathB[i]!;
        lcaIndexB = i;
        break;
      }
    }

    if (!lca) {
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
  findEnclosingComponent(path: NodePath): ComponentScope | null {
    let current: NodePath | null = path;

    while (current) {
      const scope = this.getScopeForNode(current.node);
      if (scope && scope.type === ScopeType.Component) {
        return scope as ComponentScope;
      }
      current = current.parentPath;
    }

    return null;
  }

  /**
   * Get all bindings in a scope
   */
  getBindingsInScope(scope: ScopeInfo): Map<string, BindingInfo> {
    if (!this.scopeTree) return new Map();
    return this.scopeTree.bindingsByScope.get(scope.id) ?? new Map();
  }

  /**
   * Check if a binding is accessible from a given scope
   */
  isBindingAccessible(
    bindingName: string,
    fromScope: ScopeInfo,
    bindingScope: ScopeInfo
  ): boolean {
    const accessibility = this.checkAccessibility(bindingScope, fromScope);
    if (!accessibility.accessible) return false;

    // Check if binding is actually defined in bindingScope
    const bindings = this.getBindingsInScope(bindingScope);
    return bindings.has(bindingName);
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
   * Get the root path for an AST
   */
  private getRootPath(ast: t.File): NodePath | null {
    let rootPath: NodePath | null = null;

    traverse(ast, {
      Program: (path) => {
        rootPath = path;
        path.stop();
      },
    });

    return rootPath;
  }

  /**
   * Process a function scope (FunctionDeclaration, FunctionExpression, ArrowFunction)
   */
  private processFunctionScope(path: NodePath, scopeTree: ScopeTree): void {
    const parentScope = this.findParentScope(path, scopeTree) ?? scopeTree.root;

    // Check if this is a React component
    const componentScope = this.createComponentScopeFromPath(path, parentScope, scopeTree);

    const scope = componentScope ?? createScopeInfo({
      type: ScopeType.Function,
      path,
      parent: parentScope,
    });

    // Add to scope tree
    scopeTree.scopes.set(scope.id, scope);
    scopeTree.nodeToScope.set(path.node, scope);

    // Extract bindings from function parameters and body
    this.extractBindings(path, scope, scopeTree);
  }

  /**
   * Process a block scope
   */
  private processBlockScope(path: NodePath, scopeTree: ScopeTree): void {
    // Skip if this is the body of a function (already handled)
    const parent = path.parentPath;
    if (
      parent &&
      (t.isFunctionDeclaration(parent.node) ||
        t.isFunctionExpression(parent.node) ||
        t.isArrowFunctionExpression(parent.node))
    ) {
      return;
    }

    const parentScope = this.findParentScope(path, scopeTree) ?? scopeTree.root;

    const scope = createScopeInfo({
      type: ScopeType.Block,
      path,
      parent: parentScope,
    });

    scopeTree.scopes.set(scope.id, scope);
    scopeTree.nodeToScope.set(path.node, scope);
  }

  /**
   * Process a loop scope
   */
  private processLoopScope(path: NodePath, scopeTree: ScopeTree): void {
    const parentScope = this.findParentScope(path, scopeTree) ?? scopeTree.root;

    const scope = createScopeInfo({
      type: ScopeType.Loop,
      path,
      parent: parentScope,
    });

    scopeTree.scopes.set(scope.id, scope);
    scopeTree.nodeToScope.set(path.node, scope);
  }

  /**
   * Process a conditional scope
   */
  private processConditionalScope(path: NodePath, scopeTree: ScopeTree): void {
    const parentScope = this.findParentScope(path, scopeTree) ?? scopeTree.root;

    const scope = createScopeInfo({
      type: ScopeType.Conditional,
      path,
      parent: parentScope,
    });

    scopeTree.scopes.set(scope.id, scope);
    scopeTree.nodeToScope.set(path.node, scope);
  }

  /**
   * Process a class scope
   */
  private processClassScope(path: NodePath, scopeTree: ScopeTree): void {
    const parentScope = this.findParentScope(path, scopeTree) ?? scopeTree.root;

    const scope = createScopeInfo({
      type: ScopeType.Function, // Classes are similar to function scopes
      path,
      parent: parentScope,
    });

    scopeTree.scopes.set(scope.id, scope);
    scopeTree.nodeToScope.set(path.node, scope);
  }

  /**
   * Find the parent scope for a path
   */
  private findParentScope(path: NodePath, scopeTree: ScopeTree): ScopeInfo | null {
    let current: NodePath | null = path.parentPath;

    while (current) {
      const scope = scopeTree.nodeToScope.get(current.node);
      if (scope) {
        return scope;
      }
      current = current.parentPath;
    }

    return null;
  }

  /**
   * Extract bindings from a function path
   */
  private extractBindings(
    path: NodePath,
    scope: ScopeInfo,
    scopeTree: ScopeTree
  ): void {
    const bindings = new Map<string, BindingInfo>();

    // Get Babel's scope bindings
    const babelScope = path.scope;
    for (const [name, binding] of Object.entries(babelScope.bindings)) {
      const isHook = this.isHookCall(binding.path);
      const usedInJSX = this.isUsedInJSX(binding);

      bindings.set(name, {
        binding,
        scope,
        isHook,
        usedInJSX,
        references: binding.referencePaths,
      });
    }

    scopeTree.bindingsByScope.set(scope.id, bindings);
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
   * Check if a path is inside a conditional
   */
  private isInsideConditional(path: NodePath): boolean {
    let current: NodePath | null = path.parentPath;

    while (current) {
      if (
        t.isIfStatement(current.node) ||
        t.isConditionalExpression(current.node) ||
        t.isLogicalExpression(current.node)
      ) {
        return true;
      }
      current = current.parentPath;
    }

    return false;
  }

  /**
   * Check if a path is inside a loop
   */
  private isInsideLoop(path: NodePath): boolean {
    let current: NodePath | null = path.parentPath;

    while (current) {
      if (
        t.isForStatement(current.node) ||
        t.isForInStatement(current.node) ||
        t.isForOfStatement(current.node) ||
        t.isWhileStatement(current.node) ||
        t.isDoWhileStatement(current.node)
      ) {
        return true;
      }
      current = current.parentPath;
    }

    return false;
  }

  /**
   * Find the parent component scope
   */
  private findParentComponent(
    path: NodePath,
    scopeTree: ScopeTree
  ): ComponentScope | null {
    let current: NodePath | null = path.parentPath;

    while (current) {
      const scope = scopeTree.nodeToScope.get(current.node);
      if (scope && scope.type === ScopeType.Component) {
        return scope as ComponentScope;
      }
      current = current.parentPath;
    }

    return null;
  }

  /**
   * Detect hooks used in a component
   */
  private detectHooks(path: NodePath): HookInfo[] {
    const hooks: HookInfo[] = [];

    path.traverse({
      CallExpression(callPath) {
        const callee = callPath.node.callee;

        // Check for direct hook calls: useState()
        if (t.isIdentifier(callee) && REACT_HOOKS.has(callee.name)) {
          hooks.push({
            name: callee.name,
            path: callPath,
            returnBindings: getHookReturnBindings(callPath),
            dependencies: getHookDependencies(callPath, callee.name),
          });
        }

        // Check for React.useState() pattern
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object) &&
          callee.object.name === 'React' &&
          t.isIdentifier(callee.property) &&
          REACT_HOOKS.has(callee.property.name)
        ) {
          hooks.push({
            name: callee.property.name,
            path: callPath,
            returnBindings: getHookReturnBindings(callPath),
            dependencies: getHookDependencies(callPath, callee.property.name),
          });
        }

        // Check for custom hooks (useXxx pattern)
        if (
          t.isIdentifier(callee) &&
          /^use[A-Z]/.test(callee.name) &&
          !REACT_HOOKS.has(callee.name)
        ) {
          hooks.push({
            name: callee.name,
            path: callPath,
            returnBindings: getHookReturnBindings(callPath),
            dependencies: [],
          });
        }
      },
    });

    return hooks;
  }

  /**
   * Get component type (function, arrow, class)
   */
  private getComponentType(path: NodePath): 'function' | 'arrow' | 'class' {
    if (t.isArrowFunctionExpression(path.node)) {
      return 'arrow';
    }
    if (t.isClassDeclaration(path.node) || t.isClassExpression(path.node)) {
      return 'class';
    }
    return 'function';
  }

  /**
   * Get the props parameter of a component
   */
  private getPropsParam(path: NodePath): t.Identifier | t.ObjectPattern | undefined {
    const node = path.node;

    if (
      t.isFunctionDeclaration(node) ||
      t.isFunctionExpression(node) ||
      t.isArrowFunctionExpression(node)
    ) {
      const firstParam = node.params[0];
      if (t.isIdentifier(firstParam) || t.isObjectPattern(firstParam)) {
        return firstParam;
      }
    }

    return undefined;
  }

  /**
   * Check if a binding is from a hook call
   */
  private isHookCall(path: NodePath): boolean {
    const parent = path.parentPath;
    if (!parent) return false;

    // Check for const [x, setX] = useState()
    if (t.isVariableDeclarator(parent.node)) {
      const init = parent.node.init;
      if (t.isCallExpression(init)) {
        const callee = init.callee;
        if (t.isIdentifier(callee) && REACT_HOOKS.has(callee.name)) {
          return true;
        }
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.property) &&
          REACT_HOOKS.has(callee.property.name)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a binding is used in JSX
   */
  private isUsedInJSX(binding: Binding): boolean {
    for (const ref of binding.referencePaths) {
      if (this.isInJSXContext(ref)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a path is in a JSX context
   */
  private isInJSXContext(path: NodePath): boolean {
    let current: NodePath | null = path;

    while (current) {
      if (
        t.isJSXElement(current.node) ||
        t.isJSXFragment(current.node) ||
        t.isJSXAttribute(current.node) ||
        t.isJSXExpressionContainer(current.node)
      ) {
        return true;
      }
      current = current.parentPath;
    }

    return false;
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
 * Helper: Get return bindings from a hook call
 */
function getHookReturnBindings(callPath: NodePath): string[] {
  const parent = callPath.parentPath;
  if (!parent) return [];

  // const [state, setState] = useState()
  if (
    t.isVariableDeclarator(parent.node) &&
    t.isArrayPattern(parent.node.id)
  ) {
    return parent.node.id.elements
      .filter((e): e is t.Identifier => t.isIdentifier(e))
      .map((e) => e.name);
  }

  // const ref = useRef()
  if (
    t.isVariableDeclarator(parent.node) &&
    t.isIdentifier(parent.node.id)
  ) {
    return [parent.node.id.name];
  }

  return [];
}

/**
 * Helper: Get dependencies array from hooks like useEffect, useMemo
 */
function getHookDependencies(callPath: NodePath, hookName: string): string[] {
  const node = callPath.node;
  if (!t.isCallExpression(node)) return [];

  // Hooks with dependency arrays: useEffect, useLayoutEffect, useMemo, useCallback
  const hooksWithDeps = ['useEffect', 'useLayoutEffect', 'useMemo', 'useCallback', 'useInsertionEffect'];
  if (!hooksWithDeps.includes(hookName)) return [];

  // Dependencies are in the second argument
  const depsArg = node.arguments[1];
  if (!t.isArrayExpression(depsArg)) return [];

  return depsArg.elements
    .filter((e): e is t.Identifier => t.isIdentifier(e))
    .map((e) => e.name);
}

/**
 * Create a new ScopeManager instance
 */
export function createScopeManager(): ScopeManager {
  return new ScopeManager();
}
