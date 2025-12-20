/**
 * Variable Dependency Handler
 *
 * Handles planning and execution of hoisting operations for variable dependencies.
 * Analyzes variable purity and determines optimal hoisting strategy.
 */

import { ok } from '../../result/index.js';
import type { Result } from '../../result/index.js';
import type { InternalErrorType } from '../../errors/index.js';
import type { InternalDependency, HoistOperation } from '../../types/internal.js';
import { DependencyType } from '../../types/public.js';
import { createHoistOperation } from '../../types/factories.js';
import type { HoistContext, HoistPlanItem } from '../types.js';
import type { HoistExecutionContext } from '../hoist-executor.js';
import type { IHoistStrategySelector } from '../selectors/hoist-strategy-selector.js';
import type { IDependencyHandler } from './dependency-handler.js';

/**
 * Handles Variable dependencies.
 *
 * Variable dependencies include:
 * - const, let, var declarations
 * - Function declarations
 * - Pure computations vs impure variables
 */
export class VariableDependencyHandler implements IDependencyHandler {
  constructor(
    private readonly strategySelector: IHoistStrategySelector
  ) {}

  getName(): DependencyType {
    return DependencyType.Variable;
  }

  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    // Only handle variable dependencies
    if (dependency.type !== DependencyType.Variable) {
      return null;
    }

    // Determine target scope for hoisting
    const targetScope = this.strategySelector.determineTargetScope(
      dependency,
      context.targetScope,
      context.isCrossFile
    );

    if (!targetScope) {
      return {
        dependency,
        operation: this.createDefaultHoistOperation(dependency, context),
        needsBackwardReference: false,
        reason: 'Unable to determine target scope for variable dependency',
      };
    }

    // Check if original scope needs access
    const needsBackwardReference = dependency.consumers.length > 0;

    // Select strategy
    const selection = this.strategySelector.selectStrategy(dependency, {
      sourceScope: dependency.scope,
      targetScope,
      isCrossFile: context.isCrossFile,
      needsBackwardReference,
    });

    // Handle failed strategy selection
    if (selection.strategy === null) {
      return {
        dependency,
        operation: this.createDefaultHoistOperation(dependency, context),
        needsBackwardReference,
        reason: selection.reason ?? 'Strategy selection failed for variable',
      };
    }

    // Create hoist operation
    const operation = createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: targetScope.id,
      strategy: selection.strategy,
    });

    return {
      dependency,
      operation,
      needsBackwardReference,
    };
  }

  execute(
    _operation: HoistOperation,
    _context: HoistExecutionContext
  ): Result<void, InternalErrorType> {
    // Variable execution is handled by the existing HoistExecutor
    // This method delegates to the standard hoisting logic
    return ok(undefined);
  }

  /**
   * Create a default hoist operation (fallback)
   */
  private createDefaultHoistOperation(
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
      strategy: 'Hoist' as any,
    });
  }
}
