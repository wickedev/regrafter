/**
 * ContextHandler - Strategy for handling React Context dependencies
 *
 * Handles detection and resolution of Context Provider dependencies when
 * elements are moved across the component tree.
 */

import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import {
  createHoistOperation,
  createPropThreadOperation,
} from '../types/factories.js';
import {
  HoistStrategy,
} from '../types/internal.js';
import type {
  HoistOperation,
  InternalDependency,
  ScopeInfo,
  PropThreadOperation,
} from '../types/internal.js';
import { DependencyType } from '../types/public.js';
import { loadTraverseFunction } from '../utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

import type {
  HoistContext,
  HoistPlanItem,
  IContextHandler,
} from './types.js';

// ===============================================================================
// ContextHandler Class
// ===============================================================================

/**
 * Strategy for handling React Context dependencies.
 *
 * Responsibilities:
 * - Detect Context.Provider in component tree
 * - Check if target is within provider scope
 * - Create context-to-props extraction plans
 * - Handle Provider hoisting when needed
 */
export class ContextHandler implements IContextHandler {
  /**
   * Check if this strategy can handle the given dependency
   */
  canHandle(dependency: InternalDependency): boolean {
    return dependency.type === DependencyType.Context;
  }

  /**
   * Find the Context.Provider for a context dependency
   */
  findProvider(
    dependency: InternalDependency,
    context: HoistContext
  ): NodePath | null {
    const sourceAst = context.asts.get(context.sourceFile);
    if (!sourceAst) {
      return null;
    }

    let providerPath: NodePath | null = null;
    const contextName = this.extractContextName(dependency);

    traverse(sourceAst, {
      JSXElement(path: NodePath<t.JSXElement>) {
        const openingElement = path.node.openingElement;

        // Check for <Context.Provider>
        if (openingElement.name.type === 'JSXMemberExpression') {
          const memberExpr = openingElement.name;
          const object = memberExpr.object;
          const property = memberExpr.property;

          if (
            object.type === 'JSXIdentifier' &&
            property.name === 'Provider'
          ) {
            // Check if this is the context we're looking for
            if (contextName === undefined || object.name === contextName) {
              providerPath = path;
              path.stop();
            }
          }
        }

        // Check for <XxxProvider> pattern (common naming convention)
        if (openingElement.name.type === 'JSXIdentifier') {
          const name = openingElement.name.name;
          if (name.endsWith("Provider")) {
            if (contextName === undefined || name === `${contextName}Provider`) {
              providerPath = path;
              path.stop();
            }
          }
        }
      },
    });

    return providerPath;
  }

  /**
   * Check if the target scope is within the provider's scope
   */
  isWithinProvider(
    targetScope: ScopeInfo,
    providerPath: NodePath
  ): boolean {
    // Walk up from target scope to see if we encounter the provider
    let currentPath: NodePath | null = targetScope.path;

    while (currentPath !== null) {
      // Check if current path is the provider or is inside the provider
      if (currentPath === providerPath) {
        return true;
      }

      // Check if we're inside the provider's children
      if (this.isDescendantOfJSXElement(currentPath, providerPath)) {
        return true;
      }

      currentPath = currentPath.parentPath;
    }

    return false;
  }

  /**
   * Create a context-to-props extraction plan
   */
  createContextToPropsExtraction(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    // Find the provider
    const providerPath = this.findProvider(dependency, context);

    if (!providerPath) {
      return {
        dependency,
        operation: this.createFallbackOperation(dependency, context),
        needsBackwardReference: false,
        reason: 'Context Provider not found in source file',
      };
    }

    // Check if target is within provider
    const targetWithinProvider = this.isWithinProvider(
      context.targetScope,
      providerPath
    );

    if (targetWithinProvider) {
      // Target is already within provider - can use context directly
      return this.createDirectContextUsePlan(dependency, context);
    }

    // Target is outside provider - need to extract to props
    return this.createExtractToPropsplan(dependency, context, providerPath);
  }

  /**
   * Plan the hoisting operation for a context dependency
   */
  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    return this.createContextToPropsExtraction(dependency, context);
  }

  /**
   * Execute the hoisting operation
   */
  execute(operation: HoistOperation, _context: HoistContext): void {
    if (!operation.dependencyId) {
      throw new Error('Invalid hoist operation: missing dependency ID');
    }
  }

  // ===========================================================================
  // Provider Analysis
  // ===========================================================================

  /**
   * Find the nearest context provider ancestor for a given path
   */
  findNearestProvider(
    path: NodePath,
    contextName?: string
  ): NodePath | null {
    let current: NodePath | null = path.parentPath;

    while (current !== null) {
      if (current.isJSXElement()) {
        const openingElement = current.node.openingElement;

        // Check for <Context.Provider>
        if (openingElement.name.type === 'JSXMemberExpression') {
          const memberExpr = openingElement.name;
          const object = memberExpr.object;
          const property = memberExpr.property;

          if (
            object.type === 'JSXIdentifier' &&
            property.name === 'Provider'
          ) {
            if (contextName === undefined || object.name === contextName) {
              return current;
            }
          }
        }
      }

      current = current.parentPath;
    }

    return null;
  }

  /**
   * Get the value prop from a Provider element
   */
  getProviderValue(providerPath: NodePath<t.JSXElement>): t.Expression | null {
    const openingElement = providerPath.node.openingElement;

    for (const attr of openingElement.attributes) {
      if (
        attr.type === 'JSXAttribute' &&
        attr.name.type === 'JSXIdentifier' &&
        attr.name.name === 'value'
      ) {
        if (attr.value?.type === 'JSXExpressionContainer') {
          const expr = attr.value.expression;
          // JSXEmptyExpression is not a valid Expression
          if (expr.type !== 'JSXEmptyExpression') {
            return expr;
          }
        }
      }
    }

    return null;
  }

  /**
   * Find all useContext calls for a specific context
   */
  findUseContextCalls(
    ast: t.File,
    contextName?: string
  ): Array<{ path: NodePath; variableName: string }> {
    const calls: Array<{ path: NodePath; variableName: string }> = [];

    traverse(ast, {
      VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
        const init = path.node.init;

        if (init?.type === 'CallExpression') {
          const callee = init.callee;
          let isUseContext = false;

          if (callee.type === 'Identifier' && callee.name === 'useContext') {
            isUseContext = true;
          } else if (
            callee.type === 'MemberExpression' &&
            callee.object.type === 'Identifier' &&
            callee.object.name === 'React' &&
            callee.property.type === 'Identifier' &&
            callee.property.name === 'useContext'
          ) {
            isUseContext = true;
          }

          if (isUseContext && init.arguments.length > 0) {
            const arg = init.arguments[0];
            if (arg !== undefined) {
              const argName =
                arg.type === 'Identifier' ? arg.name : undefined;

              if (contextName === undefined || argName === contextName) {
                const id = path.node.id;
                if (id.type === 'Identifier') {
                  calls.push({ path, variableName: id.name });
                }
              }
            }
          }
        }
      },
    });

    return calls;
  }

  // ===========================================================================
  // Planning Helpers
  // ===========================================================================

  /**
   * Create a plan for direct context use (when target is within provider)
   */
  private createDirectContextUsePlan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem {
    // The context can be used directly - just hoist the useContext call
    const operation = createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy: HoistStrategy.Hoist,
    });

    return {
      dependency,
      operation,
      needsBackwardReference: false,
    };
  }

  /**
   * Create a plan to extract context to props
   */
  private createExtractToPropsplan(
    dependency: InternalDependency,
    context: HoistContext,
    _providerPath: NodePath
  ): HoistPlanItem {
    // Context needs to be extracted and passed as props
    const operation = createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy: HoistStrategy.ExtractContext,
    });

    // Create prop thread operation
    let propThread: PropThreadOperation | undefined;
    if (context.sourceComponent && context.targetComponent) {
      propThread = createPropThreadOperation({
        propName: dependency.symbol,
        valueExpression: dependency.symbol,
        fromComponent: context.sourceComponent.componentName,
        toComponent: context.targetComponent.componentName,
        path: this.getComponentPath(context),
      });
    }

    return {
      dependency,
      operation,
      propThread,
      needsBackwardReference: true,
    };
  }

  /**
   * Create fallback operation for error cases
   */
  private createFallbackOperation(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistOperation {
    return createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy: HoistStrategy.PassAsProp,
    });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Extract context name from dependency
   */
  private extractContextName(dependency: InternalDependency): string | undefined {
    const node = dependency.origin.node;

    // Handle null node
    if (node === null) {
      return undefined;
    }

    // Check if this is a useContext call
    if (node.type === 'VariableDeclarator') {
      const init = (node).init;
      if (init?.type === 'CallExpression' && init.arguments.length > 0) {
        const arg = init.arguments[0];
        if (arg !== undefined && arg.type === 'Identifier') {
          return arg.name;
        }
      }
    }

    // Try to extract from symbol name
    // Convention: ThemeContext, UserContext -> Theme, User
    const symbol = dependency.symbol;
    if (symbol.endsWith('Context')) {
      return symbol;
    }

    return undefined;
  }

  /**
   * Check if a path is a descendant of a JSX element
   */
  private isDescendantOfJSXElement(
    path: NodePath,
    jsxElementPath: NodePath
  ): boolean {
    let current: NodePath | null = path;

    while (current !== null) {
      if (current === jsxElementPath) {
        return true;
      }
      current = current.parentPath;
    }

    return false;
  }

  /**
   * Get component path for prop threading
   */
  private getComponentPath(context: HoistContext): string[] {
    const path: string[] = [];

    if (context.sourceComponent) {
      path.push(context.sourceComponent.componentName);
    }

    if (
      context.targetComponent &&
      context.targetComponent !== context.sourceComponent
    ) {
      path.push(context.targetComponent.componentName);
    }

    return path;
  }
}

/**
 * Create a new ContextHandler instance
 */
export function createContextHandler(): ContextHandler {
  return new ContextHandler();
}

// ===============================================================================
// Utility Functions
// ===============================================================================

/**
 * Check if a node is a createContext call
 */
export function isCreateContextCall(node: t.Node): boolean {
  if (node.type !== 'CallExpression') {
    return false;
  }

  const callee = (node).callee;

  if (callee.type === 'Identifier') {
    return callee.name === 'createContext';
  }

  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'React' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'createContext'
  ) {
    return true;
  }

  return false;
}

/**
 * Check if a JSX element is a Context Provider
 */
export function isContextProvider(element: t.JSXElement): boolean {
  const name = element.openingElement.name;

  // <Context.Provider>
  if (name.type === 'JSXMemberExpression') {
    const property = name.property;
    if (property.name === 'Provider') {
      return true;
    }
  }

  // <XxxProvider> naming convention
  if (name.type === 'JSXIdentifier') {
    return name.name.endsWith("Provider");
  }

  return false;
}

/**
 * Check if a JSX element is a Context Consumer
 */
export function isContextConsumer(element: t.JSXElement): boolean {
  const name = element.openingElement.name;

  // <Context.Consumer>
  if (name.type === 'JSXMemberExpression') {
    const property = name.property;
    if (property.name === 'Consumer') {
      return true;
    }
  }

  // <XxxConsumer> naming convention
  if (name.type === 'JSXIdentifier') {
    return name.name.endsWith("Consumer");
  }

  return false;
}

/**
 * Find all Context definitions in a file
 */
export function findContextDefinitions(
  ast: t.File
): Array<{ name: string; node: t.Node }> {
  const contexts: Array<{ name: string; node: t.Node }> = [];

  traverse(ast, {
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      const init = path.node.init;
      if (init && isCreateContextCall(init)) {
        const id = path.node.id;
        if (id.type === 'Identifier') {
          contexts.push({ name: id.name, node: path.node });
        }
      }
    },
  });

  return contexts;
}

/**
 * Find all Provider instances for a specific context
 */
export function findProviderInstances(
  ast: t.File,
  contextName: string
): NodePath[] {
  const providers: NodePath[] = [];

  traverse(ast, {
    JSXElement(path: NodePath<t.JSXElement>) {
      const openingElement = path.node.openingElement;

      // <Context.Provider>
      if (openingElement.name.type === 'JSXMemberExpression') {
        const memberExpr = openingElement.name;
        const object = memberExpr.object;
        const property = memberExpr.property;

        if (
          object.type === 'JSXIdentifier' &&
          object.name === contextName &&
          property.name === 'Provider'
        ) {
          providers.push(path);
        }
      }
    },
  });

  return providers;
}
