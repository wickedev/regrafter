/**
 * Hook Dependency Handler
 *
 * Handles planning and execution of hoisting operations for React Hook dependencies.
 * Ensures compliance with Rules of Hooks.
 */

import type { InternalErrorType } from '../../errors/index.js';
import { ok } from '../../result/index.js';
import type { Result } from '../../result/index.js';
import { createHoistOperation } from '../../types/factories.js';
import { HoistStrategy } from '../../types/internal.js';
import type { InternalDependency, HoistOperation } from '../../types/internal.js';
import { DependencyType } from '../../types/public.js';
import type { HoistExecutionContext } from '../hoist-executor.js';
import type { IHoistStrategySelector } from '../selectors/hoist-strategy-selector.js';
import type { HoistContext, HoistPlanItem } from '../types.js';

import type { IDependencyHandler } from './dependency-handler.js';

/**
 * Handles Hook dependencies following Rules of Hooks.
 *
 * Hook dependencies must:
 * - Only be called at the top level of a component or custom hook
 * - Not be called conditionally or in loops
 * - Maintain consistent order across renders
 */
export class HookDependencyHandler implements IDependencyHandler {
  constructor(
    private readonly strategySelector: IHoistStrategySelector
  ) {}

  getName(): DependencyType {
    return DependencyType.Hook;
  }

  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    // Only handle hook dependencies
    if (dependency.type !== DependencyType.Hook) {
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
        reason: 'Unable to determine target scope for hook dependency',
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
        reason: selection.reason ?? 'Strategy selection failed for hook',
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
    // Hook execution is handled by the existing HoistExecutor
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
      strategy: HoistStrategy.Hoist,
    });
  }
}
