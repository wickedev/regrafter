/**
 * HookHoister - Strategy for hoisting React hooks
 *
 * Handles hoisting of useState, useEffect, useRef, useCallback, useMemo,
 * and custom hooks while ensuring compliance with Rules of Hooks.
 */

import type * as t from '@babel/types';

import {
  createHoistOperation,
  createPropThreadOperation,
} from '../types/factories.js';
import {
  ScopeType,
  HoistStrategy,
} from '../types/internal.js';
import type {
  HoistOperation,
  InternalDependency,
  ScopeInfo,
} from '../types/internal.js';
import { DependencyType } from '../types/public.js';

import type {
  HoistContext,
  HoistPlanItem,
  IHookHoister,
  HookReturnInfo,
} from './types.js';
import {
  isHookName,
  classifyHook,
  HookCategory,
} from './types.js';

// ===============================================================================
// HookHoister Class
// ===============================================================================

/**
 * Strategy for hoisting React hooks to appropriate scopes.
 *
 * Handles:
 * - useState/useReducer (state management hooks)
 * - useEffect/useLayoutEffect (side effect hooks)
 * - useRef (reference hooks)
 * - useCallback/useMemo (memoization hooks)
 * - Custom hooks (use* pattern)
 *
 * Ensures:
 * - Hooks are only placed at top level of components/custom hooks
 * - Hooks are not placed inside conditionals or loops
 * - Destructured return values are properly handled
 * - Dependency arrays are preserved
 */
export class HookHoister implements IHookHoister {
  /**
   * Check if this strategy can handle the given dependency
   */
  canHandle(dependency: InternalDependency): boolean {
    return (
      dependency.type === DependencyType.Hook ||
      dependency.type === DependencyType.Ref
    );
  }

  /**
   * Plan the hoisting operation for a hook dependency
   */
  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    // Find valid hook location in target scope chain
    const validScope = this.findNearestValidHookScope(context.targetScope);

    if (!validScope) {
      return {
        dependency,
        operation: this.createFallbackOperation(dependency, context),
        needsBackwardReference: false,
        reason: 'No valid hook location found in target scope chain. Hooks must be called at the top level of a function component or custom hook.',
      };
    }

    // Classify the hook to determine specific handling
    const hookInfo = this.analyzeHook(dependency);

    // Create appropriate hoisting operation based on hook category
    let operation: HoistOperation;
    let needsBackwardReference = false;

    switch (hookInfo.category) {
      case HookCategory.State:
        operation = this.createStateHookOperation(dependency, context, validScope);
        needsBackwardReference = this.checkStateHookBackwardRef(dependency, context);
        break;

      case HookCategory.Effect:
        operation = this.createEffectHookOperation(dependency, context, validScope);
        needsBackwardReference = false; // Effects don't need backward refs
        break;

      case HookCategory.Ref:
        operation = this.createRefHookOperation(dependency, context, validScope);
        needsBackwardReference = this.checkRefBackwardRef(dependency, context);
        break;

      case HookCategory.Memo:
        operation = this.createMemoHookOperation(dependency, context, validScope);
        needsBackwardReference = true; // Memo values are typically used
        break;

      case HookCategory.Context:
        operation = this.createContextHookOperation(dependency, context, validScope);
        needsBackwardReference = true;
        break;

      case HookCategory.Custom:
      default:
        operation = this.createCustomHookOperation(dependency, context, validScope);
        needsBackwardReference = hookInfo.destructuredNames.length > 0;
        break;
    }

    // Create prop thread if backward reference is needed
    let propThread;
    if (needsBackwardReference && context.sourceComponent && context.targetComponent) {
      propThread = createPropThreadOperation({
        propName: this.getPropName(dependency, hookInfo),
        valueExpression: this.getValueExpression(dependency, hookInfo),
        fromComponent: context.targetComponent.componentName,
        toComponent: context.sourceComponent.componentName,
        path: this.getComponentPath(context),
      });
    }

    return {
      dependency,
      operation,
      propThread,
      needsBackwardReference,
    };
  }

  /**
   * Execute the hoisting operation (AST mutation)
   */
  execute(operation: HoistOperation, _context: HoistContext): void {
    // This will be implemented in the transformation pipeline integration
    // For now, this is a placeholder that validates the operation
    if (!operation.dependencyId) {
      throw new Error('Invalid hoist operation: missing dependency ID');
    }

    if (operation.strategy !== HoistStrategy.Hoist) {
      throw new Error(`HookHoister cannot execute strategy: ${operation.strategy}`);
    }
  }

  // ===========================================================================
  // Hook Location Validation
  // ===========================================================================

  /**
   * Check if a scope is a valid location for React hooks
   */
  isValidHookLocation(scope: ScopeInfo): boolean {
    // Module scope is never valid
    if (scope.type === ScopeType.Module) {
      return false;
    }

    // Block, loop, and conditional scopes are invalid (Rules of Hooks)
    if (
      scope.type === ScopeType.Block ||
      scope.type === ScopeType.Loop ||
      scope.type === ScopeType.Conditional
    ) {
      return false;
    }

    // Component scope at top level is valid
    if (scope.type === ScopeType.Component) {
      return this.isTopLevelOfComponent(scope);
    }

    // Function scope is valid only if it's a custom hook
    // At this point, the remaining scope type must be Function
    return this.isCustomHookScope(scope);
  }

  /**
   * Find the nearest valid hook location from a given scope
   */
  findNearestValidHookScope(scope: ScopeInfo): ScopeInfo | null {
    let current: ScopeInfo | null = scope;

    while (current !== null) {
      if (this.isValidHookLocation(current)) {
        return current;
      }
      current = current.parent;
    }

    return null;
  }

  // ===========================================================================
  // Hook Category Specific Operations
  // ===========================================================================

  /**
   * Create hoist operation for useState/useReducer
   */
  private createStateHookOperation(
    dependency: InternalDependency,
    context: HoistContext,
    targetScope: ScopeInfo
  ): HoistOperation {
    return createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: targetScope.id,
      strategy: HoistStrategy.Hoist,
    });
  }

  /**
   * Create hoist operation for useEffect/useLayoutEffect
   */
  private createEffectHookOperation(
    dependency: InternalDependency,
    context: HoistContext,
    targetScope: ScopeInfo
  ): HoistOperation {
    // Effects need special handling to preserve their dependency arrays
    return createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: targetScope.id,
      strategy: HoistStrategy.Hoist,
    });
  }

  /**
   * Create hoist operation for useRef
   */
  private createRefHookOperation(
    dependency: InternalDependency,
    context: HoistContext,
    targetScope: ScopeInfo
  ): HoistOperation {
    return createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: targetScope.id,
      strategy: HoistStrategy.Hoist,
    });
  }

  /**
   * Create hoist operation for useCallback/useMemo
   */
  private createMemoHookOperation(
    dependency: InternalDependency,
    context: HoistContext,
    targetScope: ScopeInfo
  ): HoistOperation {
    return createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: targetScope.id,
      strategy: HoistStrategy.Hoist,
    });
  }

  /**
   * Create hoist operation for useContext
   */
  private createContextHookOperation(
    dependency: InternalDependency,
    context: HoistContext,
    targetScope: ScopeInfo
  ): HoistOperation {
    return createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: targetScope.id,
      strategy: HoistStrategy.Hoist,
    });
  }

  /**
   * Create hoist operation for custom hooks
   */
  private createCustomHookOperation(
    dependency: InternalDependency,
    context: HoistContext,
    targetScope: ScopeInfo
  ): HoistOperation {
    return createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: targetScope.id,
      strategy: HoistStrategy.Hoist,
    });
  }

  // ===========================================================================
  // Hook Analysis
  // ===========================================================================

  /**
   * Analyze a hook dependency to extract information
   */
  private analyzeHook(dependency: InternalDependency): HookReturnInfo {
    const node = dependency.origin.node;
    let hookName = dependency.symbol;
    const destructuredNames: string[] = [];
    let dependencyArray: string[] | undefined;

    // Handle null node
    if (node === null) {
      return {
        hookName,
        category: classifyHook(hookName),
        destructuredNames,
        dependencyArray,
      };
    }

    // Try to determine the hook name from the call expression
    if (node.type === 'VariableDeclarator') {
      const init = (node).init;
      if (init?.type === 'CallExpression') {
        const callee = init.callee;
        if (callee.type === 'Identifier') {
          hookName = callee.name;
        } else if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier'
        ) {
          hookName = callee.property.name;
        }

        // Check for dependency array (second argument for useEffect, useMemo, etc.)
        if (init.arguments.length >= 2) {
          const depsArg = init.arguments[1];
          if (depsArg?.type === 'ArrayExpression') {
            dependencyArray = depsArg.elements
              .filter((el): el is t.Identifier => el?.type === 'Identifier')
              .map((el) => el.name);
          }
        }
      }

      // Handle destructured return values
      const id = (node).id;
      if (id.type === 'ArrayPattern') {
        destructuredNames.push(
          ...id.elements
            .filter((el): el is t.Identifier => el?.type === 'Identifier')
            .map((el) => el.name)
        );
      } else if (id.type === 'ObjectPattern') {
        destructuredNames.push(
          ...id.properties
            .filter(
              (prop): prop is t.ObjectProperty =>
                prop.type === 'ObjectProperty' && prop.value.type === 'Identifier'
            )
            .map((prop) => {
              if (prop.value.type === 'Identifier') {
                return prop.value.name;
              }
              return '';
            })
            .filter((name) => name !== '')
        );
      } else if (id.type === 'Identifier') {
        destructuredNames.push(id.name);
      }
    }

    return {
      hookName,
      category: classifyHook(hookName),
      destructuredNames,
      dependencyArray,
    };
  }

  /**
   * Check if state hook value is still needed in source scope
   */
  private checkStateHookBackwardRef(
    dependency: InternalDependency,
    _context: HoistContext
  ): boolean {
    // State hooks typically need backward reference if the source
    // component still uses the state value
    return dependency.consumers.length > 0;
  }

  /**
   * Check if ref needs backward reference
   */
  private checkRefBackwardRef(
    dependency: InternalDependency,
    _context: HoistContext
  ): boolean {
    // Refs often need to be passed down to access .current
    return dependency.consumers.length > 0;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Check if scope is at top level of component
   */
  private isTopLevelOfComponent(scope: ScopeInfo): boolean {
    if (scope.type !== ScopeType.Component) {
      return false;
    }

    // Walk up to check for intermediate block/conditional/loop scopes
    let parent = scope.parent;
    while (parent !== null) {
      if (
        parent.type === ScopeType.Block ||
        parent.type === ScopeType.Loop ||
        parent.type === ScopeType.Conditional
      ) {
        return false;
      }
      if (
        parent.type === ScopeType.Component ||
        parent.type === ScopeType.Module
      ) {
        break;
      }
      parent = parent.parent;
    }

    return true;
  }

  /**
   * Check if scope is a custom hook
   */
  private isCustomHookScope(scope: ScopeInfo): boolean {
    const path = scope.path;
    const node = path.node;
    let functionName: string | undefined;

    if (node.type === 'FunctionDeclaration' && node.id) {
      functionName = node.id.name;
    } else if (
      (node.type === 'ArrowFunctionExpression' ||
        node.type === 'FunctionExpression') &&
      path.parentPath?.isVariableDeclarator() === true
    ) {
      const id = (path.parentPath.node).id;
      if (id.type === 'Identifier') {
        functionName = id.name;
      }
    }

    return functionName !== undefined && isHookName(functionName);
  }

  /**
   * Get prop name for threading
   */
  private getPropName(
    dependency: InternalDependency,
    hookInfo: HookReturnInfo
  ): string {
    // For state hooks, use the first destructured name (the state value)
    if (
      hookInfo.category === HookCategory.State &&
      hookInfo.destructuredNames.length > 0
    ) {
      return hookInfo.destructuredNames[0] ?? dependency.symbol;
    }

    return dependency.symbol;
  }

  /**
   * Get value expression for prop threading
   */
  private getValueExpression(
    dependency: InternalDependency,
    hookInfo: HookReturnInfo
  ): string {
    if (hookInfo.destructuredNames.length > 0) {
      return hookInfo.destructuredNames[0] ?? dependency.symbol;
    }
    return dependency.symbol;
  }

  /**
   * Get component path from context
   */
  private getComponentPath(context: HoistContext): string[] {
    const path: string[] = [];

    if (context.targetComponent) {
      path.push(context.targetComponent.componentName);
    }

    if (context.sourceComponent && context.sourceComponent !== context.targetComponent) {
      path.push(context.sourceComponent.componentName);
    }

    return path;
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
      strategy: HoistStrategy.Hoist,
    });
  }
}

/**
 * Create a new HookHoister instance
 */
export function createHookHoister(): HookHoister {
  return new HookHoister();
}
