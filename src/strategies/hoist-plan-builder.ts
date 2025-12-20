/**
 * HoistPlanBuilder - Plans dependency hoisting operations
 *
 * This class orchestrates the creation of hoisting plans by coordinating
 * the HookLocationValidator and HoistStrategySelector to determine how
 * to hoist each dependency.
 */

import {
  createHoistOperation,
  createPropThreadOperation,
  generateId,
} from "../types/factories.js";
import { HoistStrategy } from "../types/internal.js";
import type {
  ComponentScope,
  DependencyAnalysis,
  HoistOperation,
  ImportOperation,
  InternalDependency,
  PropThreadOperation,
  ScopeInfo,
} from "../types/internal.js";
import { DependencyType } from "../types/public.js";

import type { IHoistStrategySelector } from "./selectors/hoist-strategy-selector.js";
import type { HoistContext, HoistPlan, HoistPlanItem } from "./types.js";
import type { IHookLocationValidator } from "./validators/hook-location-validator.js";

/**
 * Plans dependency hoisting operations for element movement.
 *
 * Responsibilities:
 * - Coordinate validation and strategy selection
 * - Build complete HoistPlan with all operations
 * - Validate the overall plan
 *
 * Implements IHoistPlanner interface for backward compatibility.
 */
export class HoistPlanBuilder {
  constructor(
    private readonly hookValidator: IHookLocationValidator,
    private readonly strategySelector: IHoistStrategySelector
  ) {}

  /**
   * Check if a scope is a valid location for React hooks
   * (Delegates to HookLocationValidator)
   */
  isValidHookLocation(scope: ScopeInfo): boolean {
    return this.hookValidator.isValidHookLocation(scope);
  }

  /**
   * Find the nearest valid hook location from a given scope
   * (Delegates to HookLocationValidator)
   */
  findNearestValidHookScope(scope: ScopeInfo): ScopeInfo | null {
    return this.hookValidator.findNearestValidHookScope(scope);
  }

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

    // Sort dependencies by source line number to maintain declaration order
    const sortedDeps = [...analysis.needsHoisting].sort((a, b) => {
      const aLine = a.origin.location?.start.line ?? 0;
      const bLine = b.origin.location?.start.line ?? 0;
      return aLine - bLine;
    });

    // Process each dependency that needs hoisting
    for (const dep of sortedDeps) {
      const planItem = this.planDependencyHoist(dep, context);

      if (planItem) {
        if (planItem.reason !== undefined && planItem.reason !== "") {
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
   * Plan hoisting for a single dependency using strategy selector
   */
  private planDependencyHoist(
    dep: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    // Import dependencies are handled separately
    if (dep.type === DependencyType.Import) {
      return null;
    }

    // Determine target scope for this dependency
    const targetScope = this.strategySelector.determineTargetScope(
      dep,
      context.targetScope,
      context.isCrossFile
    );

    if (!targetScope) {
      return {
        dependency: dep,
        operation: this.createDefaultHoistOperation(dep, context),
        needsBackwardReference: false,
        reason: "Unable to determine target scope for dependency",
      };
    }

    // Check if original scope still needs access
    const needsBackwardReference = this.checkNeedsBackwardReference(dep);

    // Select strategy using strategy selector
    const selection = this.strategySelector.selectStrategy(dep, {
      sourceScope: dep.scope,
      targetScope: targetScope,
      isCrossFile: context.isCrossFile,
      needsBackwardReference,
    });

    // Handle failed strategy selection
    if (selection.strategy === null) {
      return {
        dependency: dep,
        operation: this.createDefaultHoistOperation(dep, context),
        needsBackwardReference,
        reason: selection.reason ?? "Strategy selection failed",
      };
    }

    // Create hoist operation
    const operation = createHoistOperation({
      dependencyId: dep.id,
      symbol: dep.symbol,
      fromFile: dep.origin.file,
      fromScope: dep.scope.id,
      toFile: context.targetFile,
      toScope: targetScope.id,
      strategy: selection.strategy,
    });

    // Create prop thread operation if needed
    let propThread: PropThreadOperation | undefined;
    if (
      selection.needsPropThreading &&
      context.sourceComponent &&
      context.targetComponent
    ) {
      propThread = this.createPropThread(
        dep,
        context.sourceComponent,
        context.targetComponent
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
      id: generateId("import"),
      file: context.targetFile,
      importSource: dep.origin.file,
      specifiers: [
        {
          type: "named",
          imported: dep.symbol,
          local: dep.symbol,
        },
      ],
      position: "grouped",
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

    return this.createPropThread(
      dep,
      context.sourceComponent,
      context.targetComponent
    );
  }

  /**
   * Create a prop thread operation
   */
  private createPropThread(
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
   * Check if the original scope still needs access to a hoisted dependency
   */
  private checkNeedsBackwardReference(dep: InternalDependency): boolean {
    return dep.consumers.length > 0;
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
    // Hooks are always critical
    if (dep.type === DependencyType.Hook) {
      return true;
    }

    // Context dependencies are critical
    if (dep.type === DependencyType.Context) {
      return true;
    }

    return false;
  }

  /**
   * Validate the overall hoisting plan
   */
  private validatePlan(plan: HoistPlan, _context: HoistContext): void {
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

    // Simple cycle detection
    for (const [from, toSet] of componentGraph) {
      for (const to of toSet) {
        const toGraph = componentGraph.get(to);
        if (toGraph?.has(from) === true) {
          plan.warnings.push(
            `Potential circular prop dependency between ${from} and ${to}`
          );
        }
      }
    }
  }
}

/**
 * Create a new HoistPlanBuilder instance
 */
export function createHoistPlanBuilder(
  hookValidator: IHookLocationValidator,
  strategySelector: IHoistStrategySelector
): HoistPlanBuilder {
  return new HoistPlanBuilder(hookValidator, strategySelector);
}
