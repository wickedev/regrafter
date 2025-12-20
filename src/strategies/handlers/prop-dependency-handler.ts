/**
 * Prop Dependency Handler
 *
 * Handles planning and execution of hoisting operations for prop dependencies.
 * Creates prop threading operations to pass props through component boundaries.
 */

import { ok } from '../../result/index.js';
import type { Result } from '../../result/index.js';
import type { InternalErrorType } from '../../errors/index.js';
import type { InternalDependency, HoistOperation, ComponentScope } from '../../types/internal.js';
import { DependencyType } from '../../types/public.js';
import { createHoistOperation, createPropThreadOperation } from '../../types/factories.js';
import type { HoistContext, HoistPlanItem } from '../types.js';
import type { HoistExecutionContext } from '../hoist-executor.js';
import type { IDependencyHandler } from './dependency-handler.js';

/**
 * Handles Prop dependencies.
 *
 * Prop dependencies require special handling:
 * - Props must be passed through component boundaries
 * - Prop threading operations are created
 * - Component hierarchy is analyzed
 */
export class PropDependencyHandler implements IDependencyHandler {
  getName(): DependencyType {
    return DependencyType.Prop;
  }

  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    // Only handle prop dependencies
    if (dependency.type !== DependencyType.Prop) {
      return null;
    }

    // Check if components are available for prop threading
    if (!context.sourceComponent || !context.targetComponent) {
      return {
        dependency,
        operation: this.createDefaultHoistOperation(dependency, context),
        needsBackwardReference: false,
        reason: 'Cannot thread props: missing component information',
      };
    }

    // Create hoist operation
    const operation = createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy: 'PassAsProp' as any,
    });

    // Create prop thread operation
    const propThread = createPropThreadOperation({
      propName: dependency.symbol,
      valueExpression: dependency.symbol,
      fromComponent: context.sourceComponent.componentName,
      toComponent: context.targetComponent.componentName,
      path: this.getComponentPath(context.sourceComponent, context.targetComponent),
    });

    return {
      dependency,
      operation,
      propThread,
      needsBackwardReference: false,
    };
  }

  execute(
    _operation: HoistOperation,
    _context: HoistExecutionContext
  ): Result<void, InternalErrorType> {
    // Prop threading execution is handled by the existing HoistExecutor
    // This method delegates to the standard prop threading logic
    return ok(undefined);
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
      strategy: 'PassAsProp' as any,
    });
  }
}
