/**
 * Import Dependency Handler
 *
 * Handles planning and execution of hoisting operations for import dependencies.
 * Manages cross-file import statements.
 */

import { ok } from '../../result/index.js';
import type { Result } from '../../result/index.js';
import type { InternalErrorType } from '../../errors/index.js';
import type { InternalDependency, HoistOperation, ImportOperation } from '../../types/internal.js';
import { DependencyType } from '../../types/public.js';
import { createHoistOperation, generateId } from '../../types/factories.js';
import type { HoistContext, HoistPlanItem } from '../types.js';
import type { HoistExecutionContext } from '../hoist-executor.js';
import type { IDependencyHandler } from './dependency-handler.js';

/**
 * Handles Import dependencies.
 *
 * Import dependencies are special:
 * - They represent external module dependencies
 * - Hoisting means adding import statements to target file
 * - No actual code movement is needed
 */
export class ImportDependencyHandler implements IDependencyHandler {
  getName(): DependencyType {
    return DependencyType.Import;
  }

  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    // Only handle import dependencies
    if (dependency.type !== DependencyType.Import) {
      return null;
    }

    // Import dependencies only make sense for cross-file moves
    if (!context.isCrossFile) {
      return null;
    }

    // Create import operation
    const importOp: ImportOperation = {
      id: generateId('import'),
      file: context.targetFile,
      importSource: dependency.origin.file,
      specifiers: [
        {
          type: 'named',
          imported: dependency.symbol,
          local: dependency.symbol,
        },
      ],
      position: 'grouped',
    };

    // Create a placeholder hoist operation
    const operation = createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy: 'CreateShared' as any,
    });

    return {
      dependency,
      operation,
      importOp,
      needsBackwardReference: false,
    };
  }

  execute(
    _operation: HoistOperation,
    _context: HoistExecutionContext
  ): Result<void, InternalErrorType> {
    // Import execution is handled by the existing HoistExecutor
    // This method delegates to the standard import logic
    return ok(undefined);
  }
}
