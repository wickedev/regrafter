/**
 * Scope Tree Builder
 *
 * Responsible for building the hierarchical scope tree from an AST.
 * Traverses the AST and creates scope nodes for each lexical scope,
 * tracking parent-child relationships and scope types.
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { createValidationError, type ValidationErrorType } from '../../errors/index.js';
import { ok, err, type Result } from '../../result/index.js';
import {
  createScopeInfo,
  createComponentScope,
  generateId,
} from '../../types/factories.js';
import type { HookUsage } from '../../types/internal.js';
import {
  loadTraverseFunction,
  type TraverseFunction,
  extractFunctionName,
} from '../../utils/index.js';
import {
  ScopeType,
  type ScopeInfo,
  type ComponentScope,
  type ScopeTree,
  type ComponentInfo,
} from '../types.js';

const traverse: TraverseFunction = loadTraverseFunction(traverseModule);

/**
 * Type guard to check if a ScopeInfo is a ComponentScope
 */
function isComponentScope(scope: ScopeInfo): scope is ComponentScope {
  return scope.type === ScopeType.Component;
}

/**
 * ScopeTreeBuilder builds a hierarchical scope tree from an AST
 */
export class ScopeTreeBuilder {
  private readonly components: Map<string, ComponentInfo> = new Map();

  /**
   * Analyzes the AST and builds a hierarchical scope tree
   * tracking all scopes, bindings, and component boundaries.
   *
   * @param ast - The AST to analyze
   * @param detectHooksFn - Function to detect hooks in a path
   * @param extractBindingsFn - Function to extract bindings from a path
   * @returns Result with the built scope tree or ValidationError
   */
  buildScopeTree(
    ast: t.File,
    detectHooksFn: (path: NodePath) => HookUsage[],
    extractBindingsFn: (path: NodePath, scope: ScopeInfo, scopeTree: ScopeTree) => void
  ): Result<ScopeTree, ValidationErrorType> {
    // Initialize scope tree with module scope
    const rootPath = this.getRootPath(ast);
    if (rootPath === null) {
      return err(createValidationError({
        code: 'V001',
        message: 'Failed to find root Program path in AST',
        constraint: 'program_required',
        details: 'AST must have a root Program node',
        file: '',
      }));
    }
    const rootScope = createScopeInfo({
      type: ScopeType.Module,
      path: rootPath,
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
      FunctionDeclaration: (path: NodePath<t.FunctionDeclaration>) => {
        this.processFunctionScope(path, scopeTree, detectHooksFn, extractBindingsFn);
      },

      // Track function expressions
      FunctionExpression: (path: NodePath<t.FunctionExpression>) => {
        this.processFunctionScope(path, scopeTree, detectHooksFn, extractBindingsFn);
      },

      // Track arrow functions
      ArrowFunctionExpression: (path: NodePath<t.ArrowFunctionExpression>) => {
        this.processFunctionScope(path, scopeTree, detectHooksFn, extractBindingsFn);
      },

      // Track block scopes
      BlockStatement: (path: NodePath<t.BlockStatement>) => {
        this.processBlockScope(path, scopeTree);
      },

      // Track for loops
      ForStatement: (path: NodePath<t.ForStatement>) => {
        this.processLoopScope(path, scopeTree);
      },
      ForInStatement: (path: NodePath<t.ForInStatement>) => {
        this.processLoopScope(path, scopeTree);
      },
      ForOfStatement: (path: NodePath<t.ForOfStatement>) => {
        this.processLoopScope(path, scopeTree);
      },
      WhileStatement: (path: NodePath<t.WhileStatement>) => {
        this.processLoopScope(path, scopeTree);
      },
      DoWhileStatement: (path: NodePath<t.DoWhileStatement>) => {
        this.processLoopScope(path, scopeTree);
      },

      // Track conditionals
      IfStatement: (path: NodePath<t.IfStatement>) => {
        this.processConditionalScope(path, scopeTree);
      },

      // Track class declarations
      ClassDeclaration: (path: NodePath<t.ClassDeclaration>) => {
        this.processClassScope(path, scopeTree);
      },

      // Track class expressions
      ClassExpression: (path: NodePath<t.ClassExpression>) => {
        this.processClassScope(path, scopeTree);
      },
    });

    return ok(scopeTree);
  }

  /**
   * Get the root path for an AST
   */
  private getRootPath(ast: t.File): NodePath | null {
    let rootPath: NodePath | null = null;

    traverse(ast, {
      Program: (path: NodePath<t.Program>) => {
        rootPath = path;
        path.stop();
      },
    });

    return rootPath;
  }

  /**
   * Process a function scope (FunctionDeclaration, FunctionExpression, ArrowFunction)
   */
  private processFunctionScope(
    path: NodePath,
    scopeTree: ScopeTree,
    detectHooksFn: (path: NodePath) => HookUsage[],
    extractBindingsFn: (path: NodePath, scope: ScopeInfo, scopeTree: ScopeTree) => void
  ): void {
    const parentScope = this.findParentScope(path, scopeTree) ?? scopeTree.root;

    // Check if this is a React component
    const componentScope = this.createComponentScopeFromPath(path, parentScope, scopeTree, detectHooksFn);

    const scope = componentScope ?? createScopeInfo({
      type: ScopeType.Function,
      path,
      parent: parentScope,
    });

    // Add to scope tree
    scopeTree.scopes.set(scope.id, scope);
    scopeTree.nodeToScope.set(path.node, scope);

    // Extract bindings from function parameters and body
    extractBindingsFn(path, scope, scopeTree);
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
   * A function is a React component if:
   * - It starts with an uppercase letter
   * - It returns JSX
   * - It may have a props parameter
   */
  private isReactComponent(path: NodePath): boolean {
    const name = extractFunctionName(path);

    // React components start with uppercase
    if (name === null || !/^[A-Z]/.test(name)) {
      return false;
    }

    // Check if it returns JSX
    return this.returnsJSX(path);
  }

  /**
   * Creates a ComponentScope for React components with
   * hook tracking and conditional/loop detection.
   */
  private createComponentScopeFromPath(
    path: NodePath,
    parent: ScopeInfo | null,
    scopeTree: ScopeTree,
    detectHooksFn: (path: NodePath) => HookUsage[]
  ): ComponentScope | null {
    if (!this.isReactComponent(path)) {
      return null;
    }

    const name = extractFunctionName(path) ?? 'Anonymous';
    const isConditional = this.isInsideConditional(path);
    const isLoop = this.isInsideLoop(path);
    const parentComponent = this.findParentComponent(path, scopeTree);
    const hooks = detectHooksFn(path);

    const componentScope = createComponentScope({
      componentName: name,
      path,
      parent,
      parentComponent,
      isConditionallyRendered: isConditional,
      isInsideLoop: isLoop,
      hooks,
    });

    // Store component info
    const componentInfo: ComponentInfo = {
      name,
      type: this.getComponentType(path),
      path,
      isReactComponent: true,
      propsParam: this.getPropsParam(path),
      hooks: hooks.map(h => ({
        name: h.name,
        path: h.path,
        returnBindings: [],
        dependencies: h.dependencies,
      })),
    };
    this.components.set(componentScope.id, componentInfo);

    return componentScope;
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

    while (current !== null) {
      const scope = scopeTree.nodeToScope.get(current.node);
      if (scope !== undefined && isComponentScope(scope)) {
        return scope;
      }
      current = current.parentPath;
    }

    return null;
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
   * Get components map (for coordinator access)
   */
  getComponents(): Map<string, ComponentInfo> {
    return this.components;
  }
}

/**
 * Create a new ScopeTreeBuilder instance
 */
export function createScopeTreeBuilder(): ScopeTreeBuilder {
  return new ScopeTreeBuilder();
}
