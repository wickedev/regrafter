/**
 * HoistPlanner - Plans dependency hoisting operations
 *
 * This class analyzes dependencies and determines the appropriate
 * hoisting strategy for each, ensuring compliance with React's Rules of Hooks.
 */

import {
  createHoistOperation,
  createPropThreadOperation,
  generateId,
} from '../types/factories.js';
import { ScopeType, HoistStrategy } from '../types/internal.js';
import type {
  ComponentScope,
  DependencyAnalysis,
  HoistOperation,
  ImportOperation,
  InternalDependency,
  PropThreadOperation,
  ScopeInfo,
} from '../types/internal.js';
import { DependencyType } from '../types/public.js';

import type { HoistContext, HoistPlan, HoistPlanItem } from './types.js';
import { isHookName } from './types.js';

// ===============================================================================
// HoistPlanner Class
// ===============================================================================

/**
 * Plans dependency hoisting operations for element movement.
 *
 * Responsibilities:
 * - Determine which dependencies need hoisting based on target scope
 * - Select appropriate hoisting strategy per dependency type
 * - Validate hook locations per Rules of Hooks
 * - Build complete HoistPlan with all operations
 */
export class HoistPlanner {
  /**
   * Create a hoisting plan for moving an element's dependencies
   *
   * @param analysis - Dependency analysis from DependencyAnalyzer
   * @param context - Hoisting context with source/target information
   * @returns Complete hoisting plan
   */
  plan(analysis: DependencyAnalysis, context: HoistContext): HoistPlan {
    const plan: HoistPlan = {
      hoistOperations: [],
      propThreadOperations: [],
      importOperations: [],
      unhoistable: [],
      warnings: [],
      valid: true,
    };

    // Process each dependency that needs hoisting
    for (const dep of analysis.needsHoisting) {
      const planItem = this.planDependencyHoist(dep, context);

      if (planItem) {
        if (planItem.reason !== undefined && planItem.reason !== '') {
          // Could not hoist
          plan.unhoistable.push({
            dependency: dep,
            reason: planItem.reason,
          });

          // Check if this is a critical dependency
          if (this.isCriticalDependency(dep)) {
            plan.valid = false;
            plan.invalidReason = `Cannot hoist critical dependency '${dep.symbol}': ${planItem.reason}`;
          }
        } else {
          // Add operations to plan
          plan.hoistOperations.push(planItem.operation);

          if (planItem.propThread) {
            plan.propThreadOperations.push(planItem.propThread);
          }

          if (planItem.importOp) {
            plan.importOperations.push(planItem.importOp);
          }
        }
      }
    }

    // Process dependencies that need imports (for cross-file moves)
    for (const dep of analysis.needsImport) {
      const importOp = this.planImportOperation(dep, context);
      if (importOp) {
        plan.importOperations.push(importOp);
      }
    }

    // Process dependencies that need prop threading
    for (const dep of analysis.needsPropThreading) {
      const propThread = this.planPropThread(dep, context);
      if (propThread) {
        plan.propThreadOperations.push(propThread);
      }
    }

    // Validate the overall plan
    this.validatePlan(plan, context);

    return plan;
  }

  /**
   * Plan hoisting for a single dependency
   */
  private planDependencyHoist(
    dep: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    const {
      sourceScope: _sourceScope,
      targetScope: _targetScope,
      targetComponent: _targetComponent,
    } = context;

    // Determine the strategy based on dependency type
    switch (dep.type) {
      case DependencyType.Hook:
        return this.planHookHoist(dep, context);

      case DependencyType.Variable:
        return this.planVariableHoist(dep, context);

      case DependencyType.Context:
        return this.planContextHoist(dep, context);

      case DependencyType.Ref:
        return this.planRefHoist(dep, context);

      case DependencyType.Prop:
        return this.planPropHoist(dep, context);

      case DependencyType.Import:
        // Imports are handled separately
        return null;
      default:
        return {
          dependency: dep,
          operation: this.createDefaultHoistOperation(dep, context),
          needsBackwardReference: false,
          reason: `Unknown dependency type: ${String(dep.type)}`,
        };
    }
  }

  /**
   * Plan hoisting for a Hook dependency
   */
  private planHookHoist(
    dep: InternalDependency,
    context: HoistContext
  ): HoistPlanItem {
    const { targetScope, targetComponent: _targetComponent } = context;

    // Find valid hook location
    const validScope = this.findNearestValidHookScope(targetScope);

    if (!validScope) {
      return {
        dependency: dep,
        operation: this.createDefaultHoistOperation(dep, context),
        needsBackwardReference: false,
        reason: 'No valid hook location found in target scope chain',
      };
    }

    // Check if target scope is conditional or in a loop
    if (this.isConditionalOrLoop(targetScope)) {
      // Find the nearest non-conditional/non-loop scope
      const safeScope = this.findNearestSafeScope(targetScope);
      if (!safeScope) {
        return {
          dependency: dep,
          operation: this.createDefaultHoistOperation(dep, context),
          needsBackwardReference: false,
          reason:
            'Cannot hoist hook to conditional or loop scope (Rules of Hooks)',
        };
      }
    }

    // Create hoist operation
    const operation = createHoistOperation({
      dependencyId: dep.id,
      symbol: dep.symbol,
      fromFile: dep.origin.file,
      fromScope: dep.scope.id,
      toFile: context.targetFile,
      toScope: validScope.id,
      strategy: HoistStrategy.Hoist,
    });

    // Check if original scope still needs access
    const needsBackwardReference = this.checkNeedsBackwardReference(
      dep,
      context
    );

    let propThread: PropThreadOperation | undefined;
    if (
      needsBackwardReference &&
      context.sourceComponent &&
      context.targetComponent
    ) {
      propThread = this.createBackwardPropThread(
        dep,
        context.targetComponent,
        context.sourceComponent
      );
    }

    return {
      dependency: dep,
      operation,
      propThread,
      needsBackwardReference,
    };
  }

  /**
   * Plan hoisting for a Variable dependency
   */
  private planVariableHoist(
    dep: InternalDependency,
    context: HoistContext
  ): HoistPlanItem {
    const isPure = this.isVariablePure(dep);

    if (isPure) {
      // Pure variables can be hoisted directly
      const operation = createHoistOperation({
        dependencyId: dep.id,
        symbol: dep.symbol,
        fromFile: dep.origin.file,
        fromScope: dep.scope.id,
        toFile: context.targetFile,
        toScope: context.targetScope.id,
        strategy: HoistStrategy.Hoist,
      });

      return {
        dependency: dep,
        operation,
        needsBackwardReference: false,
      };
    } else {
      // Impure variables need to be passed as props
      const operation = createHoistOperation({
        dependencyId: dep.id,
        symbol: dep.symbol,
        fromFile: dep.origin.file,
        fromScope: dep.scope.id,
        toFile: context.targetFile,
        toScope: context.targetScope.id,
        strategy: HoistStrategy.PassAsProp,
      });

      let propThread: PropThreadOperation | undefined;
      if (context.sourceComponent && context.targetComponent) {
        propThread = createPropThreadOperation({
          propName: dep.symbol,
          valueExpression: dep.symbol,
          fromComponent: context.sourceComponent.componentName,
          toComponent: context.targetComponent.componentName,
          path: this.getComponentPath(
            context.sourceComponent,
            context.targetComponent
          ),
        });
      }

      return {
        dependency: dep,
        operation,
        propThread,
        needsBackwardReference: true,
      };
    }
  }

  /**
   * Plan hoisting for a Context dependency
   */
  private planContextHoist(
    dep: InternalDependency,
    context: HoistContext
  ): HoistPlanItem {
    // For context dependencies, we need to either:
    // 1. Hoist the Provider (if possible)
    // 2. Extract context value to props

    // Default to extracting to props (safer option)
    const operation = createHoistOperation({
      dependencyId: dep.id,
      symbol: dep.symbol,
      fromFile: dep.origin.file,
      fromScope: dep.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy: HoistStrategy.ExtractContext,
    });

    let propThread: PropThreadOperation | undefined;
    if (context.sourceComponent && context.targetComponent) {
      propThread = createPropThreadOperation({
        propName: dep.symbol,
        valueExpression: dep.symbol,
        fromComponent: context.sourceComponent.componentName,
        toComponent: context.targetComponent.componentName,
        path: this.getComponentPath(
          context.sourceComponent,
          context.targetComponent
        ),
      });
    }

    return {
      dependency: dep,
      operation,
      propThread,
      needsBackwardReference: true,
    };
  }

  /**
   * Plan hoisting for a Ref dependency
   */
  private planRefHoist(
    dep: InternalDependency,
    context: HoistContext
  ): HoistPlanItem {
    // Refs are hoisted like hooks
    const validScope = this.findNearestValidHookScope(context.targetScope);

    if (!validScope) {
      return {
        dependency: dep,
        operation: this.createDefaultHoistOperation(dep, context),
        needsBackwardReference: false,
        reason: 'No valid hook location found for ref',
      };
    }

    const operation = createHoistOperation({
      dependencyId: dep.id,
      symbol: dep.symbol,
      fromFile: dep.origin.file,
      fromScope: dep.scope.id,
      toFile: context.targetFile,
      toScope: validScope.id,
      strategy: HoistStrategy.Hoist,
    });

    return {
      dependency: dep,
      operation,
      needsBackwardReference: this.checkNeedsBackwardReference(dep, context),
    };
  }

  /**
   * Plan hoisting for a Prop dependency
   */
  private planPropHoist(
    dep: InternalDependency,
    context: HoistContext
  ): HoistPlanItem {
    // Props need to be threaded through the component tree
    const operation = createHoistOperation({
      dependencyId: dep.id,
      symbol: dep.symbol,
      fromFile: dep.origin.file,
      fromScope: dep.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy: HoistStrategy.PassAsProp,
    });

    let propThread: PropThreadOperation | undefined;
    if (context.sourceComponent && context.targetComponent) {
      propThread = createPropThreadOperation({
        propName: dep.symbol,
        valueExpression: dep.symbol,
        fromComponent: context.sourceComponent.componentName,
        toComponent: context.targetComponent.componentName,
        path: this.getComponentPath(
          context.sourceComponent,
          context.targetComponent
        ),
      });
    }

    return {
      dependency: dep,
      operation,
      propThread,
      needsBackwardReference: true,
    };
  }

  /**
   * Plan an import operation for cross-file moves
   */
  private planImportOperation(
    dep: InternalDependency,
    context: HoistContext
  ): ImportOperation | null {
    if (!context.isCrossFile) {
      return null;
    }

    return {
      id: generateId('import'),
      file: context.targetFile,
      importSource: dep.origin.file,
      specifiers: [
        {
          type: 'named',
          imported: dep.symbol,
          local: dep.symbol,
        },
      ],
      position: 'grouped',
    };
  }

  /**
   * Plan prop threading for a dependency
   */
  private planPropThread(
    dep: InternalDependency,
    context: HoistContext
  ): PropThreadOperation | null {
    if (!context.sourceComponent || !context.targetComponent) {
      return null;
    }

    return createPropThreadOperation({
      propName: dep.symbol,
      valueExpression: dep.symbol,
      fromComponent: context.sourceComponent.componentName,
      toComponent: context.targetComponent.componentName,
      path: this.getComponentPath(
        context.sourceComponent,
        context.targetComponent
      ),
    });
  }

  // ===========================================================================
  // Hook Location Validation (Rules of Hooks)
  // ===========================================================================

  /**
   * Check if a scope is a valid location for React hooks
   *
   * Valid locations:
   * - Top level of a function component
   * - Top level of a custom hook
   *
   * Invalid locations:
   * - Inside conditionals (if/else)
   * - Inside loops (for/while/do)
   * - Inside nested functions (unless custom hook)
   * - Module level
   * - Regular function scope
   */
  isValidHookLocation(scope: ScopeInfo): boolean {
    // Module scope is never valid for hooks
    if (scope.type === ScopeType.Module) {
      return false;
    }

    // Block, loop, and conditional scopes are invalid
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

    // Function scope is the only remaining type - valid only if it's a custom hook
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

  /**
   * Find the nearest safe scope (not conditional or loop)
   */
  private findNearestSafeScope(scope: ScopeInfo): ScopeInfo | null {
    let current: ScopeInfo | null = scope;

    while (current !== null) {
      if (!this.isConditionalOrLoop(current)) {
        return current;
      }
      current = current.parent;
    }

    return null;
  }

  /**
   * Check if a scope is at the top level of its containing component
   */
  private isTopLevelOfComponent(scope: ScopeInfo): boolean {
    // The scope should not have any intermediate scopes between it and
    // its parent component scope
    if (scope.type !== ScopeType.Component) {
      return false;
    }

    // Check that there are no block/conditional/loop scopes as ancestors
    // before reaching another component or module
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
   * Check if a scope is a custom hook (function named use*)
   */
  private isCustomHookScope(scope: ScopeInfo): boolean {
    // Get the function name from the scope
    const path = scope.path;

    // Check various function types
    const node = path.node;
    let functionName: string | undefined;

    // Function declaration
    if (node.type === 'FunctionDeclaration' && node.id !== undefined && node.id !== null) {
      functionName = node.id.name;
    }
    // Arrow function or function expression assigned to variable
    else if (
      (node.type === 'ArrowFunctionExpression' ||
        node.type === 'FunctionExpression') &&
      path.parentPath !== null &&
      path.parentPath.isVariableDeclarator()
    ) {
      const id = path.parentPath.node.id;
      if (id.type === 'Identifier') {
        functionName = id.name;
      }
    }

    if (functionName !== undefined) {
      return isHookName(functionName);
    }

    return false;
  }

  /**
   * Check if scope is conditional or loop
   */
  private isConditionalOrLoop(scope: ScopeInfo): boolean {
    return (
      scope.type === ScopeType.Conditional || scope.type === ScopeType.Loop
    );
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Check if a variable is pure (no side effects)
   */
  private isVariablePure(dep: InternalDependency): boolean {
    // For now, use a simple heuristic:
    // - Variables initialized with literals are pure
    // - Variables that depend on hooks/state are not pure
    // - Variables that depend on impure functions are not pure

    // This is a simplified check - a full implementation would
    // analyze the initializer expression
    const node = dep.origin.node;

    // Handle null node
    if (node === null) {
      return false; // Cannot determine purity if node is null
    }

    // If it's a variable declarator, check the init
    if (node.type === 'VariableDeclarator') {
      const init = node.init;
      if (init === undefined || init === null) {
        return true; // Uninitialized is considered pure
      }

      // Literals are pure
      if (
        init.type === 'StringLiteral' ||
        init.type === 'NumericLiteral' ||
        init.type === 'BooleanLiteral' ||
        init.type === 'NullLiteral'
      ) {
        return true;
      }

      // Template literals without expressions are pure
      if (init.type === 'TemplateLiteral' && init.expressions.length === 0) {
        return true;
      }

      // Object/Array literals may be pure (simplified check)
      if (init.type === 'ObjectExpression' || init.type === 'ArrayExpression') {
        return true; // Simplified - should recursively check
      }
    }

    // Default to not pure for safety
    return false;
  }

  /**
   * Check if the original scope still needs access to a hoisted dependency
   */
  private checkNeedsBackwardReference(
    dep: InternalDependency,
    _context: HoistContext
  ): boolean {
    // Check if the dependency has consumers in the source scope
    return dep.consumers.length > 0;
  }

  /**
   * Create a backward prop thread operation
   */
  private createBackwardPropThread(
    dep: InternalDependency,
    fromComponent: ComponentScope,
    toComponent: ComponentScope
  ): PropThreadOperation {
    return createPropThreadOperation({
      propName: dep.symbol,
      valueExpression: dep.symbol,
      fromComponent: fromComponent.componentName,
      toComponent: toComponent.componentName,
      path: this.getComponentPath(fromComponent, toComponent),
    });
  }

  /**
   * Get the component path from source to target
   */
  private getComponentPath(from: ComponentScope, to: ComponentScope): string[] {
    const path: string[] = [];

    // Build path by walking up from target to common ancestor, then down to source
    // For simplicity, we'll just return direct path
    let current: ComponentScope | null = to;
    while (current !== null && current.id !== from.id) {
      path.unshift(current.componentName);
      current = current.parentComponent;
    }

    if (from.id !== to.id) {
      path.unshift(from.componentName);
    }

    return path;
  }

  /**
   * Create a default hoist operation (fallback)
   */
  private createDefaultHoistOperation(
    dep: InternalDependency,
    context: HoistContext
  ): HoistOperation {
    return createHoistOperation({
      dependencyId: dep.id,
      symbol: dep.symbol,
      fromFile: dep.origin.file,
      fromScope: dep.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy: HoistStrategy.Hoist,
    });
  }

  /**
   * Check if a dependency is critical (blocks the move if not resolvable)
   */
  private isCriticalDependency(dep: InternalDependency): boolean {
    // Hooks are always critical - they must be resolvable
    if (dep.type === DependencyType.Hook) {
      return true;
    }

    // Context dependencies are critical if they're required
    if (dep.type === DependencyType.Context) {
      return true;
    }

    // Other dependencies may be less critical
    return false;
  }

  /**
   * Validate the overall hoisting plan
   */
  private validatePlan(plan: HoistPlan, _context: HoistContext): void {
    // Check for hook rule violations
    for (const op of plan.hoistOperations) {
      if (op.strategy === HoistStrategy.Hoist) {
        // Verify target scope is valid for hooks if applicable
        // This would require looking up the scope info from op.toScope
      }
    }

    // Check for duplicate prop names
    const propNames = new Set<string>();
    for (const thread of plan.propThreadOperations) {
      if (propNames.has(thread.propName)) {
        plan.warnings.push(
          `Duplicate prop name '${thread.propName}' in prop threading`
        );
      }
      propNames.add(thread.propName);
    }

    // Check for circular dependencies in prop threading
    // This is a simplified check
    const componentGraph = new Map<string, Set<string>>();
    for (const thread of plan.propThreadOperations) {
      if (!componentGraph.has(thread.fromComponent)) {
        componentGraph.set(thread.fromComponent, new Set());
      }
      const fromGraph = componentGraph.get(thread.fromComponent);
      if (fromGraph !== undefined) {
        fromGraph.add(thread.toComponent);
      }
    }

    // Simple cycle detection (would need DFS for full detection)
    for (const [from, toSet] of componentGraph) {
      for (const to of toSet) {
        const toGraph = componentGraph.get(to);
        if (toGraph !== undefined && toGraph.has(from)) {
          plan.warnings.push(
            `Potential circular prop dependency between ${from} and ${to}`
          );
        }
      }
    }
  }
}

/**
 * Create a new HoistPlanner instance
 */
export function createHoistPlanner(): HoistPlanner {
  return new HoistPlanner();
}
