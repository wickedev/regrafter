/**
 * Dependency Handler Interface
 *
 * This module defines the interface for dependency-type-specific handlers
 * following the Strategy Pattern and Open/Closed Principle.
 *
 * Each dependency type (Hook, Variable, Prop, Import) has its own handler
 * that knows how to plan and execute hoisting operations for that type.
 */

import type { InternalErrorType } from '../../errors/index.js';
import type { Result } from '../../result/index.js';
import type { InternalDependency, HoistOperation } from '../../types/internal.js';
import type { DependencyType } from '../../types/public.js';
import type { HoistExecutionContext } from '../hoist-executor.js';
import type { HoistContext, HoistPlanItem } from '../types.js';

/**
 * Interface for dependency type handlers.
 *
 * Each handler is responsible for:
 * - Identifying its dependency type
 * - Planning hoisting operations for that type
 * - Executing hoisting operations for that type
 *
 * This follows the Open/Closed Principle: new dependency types can be added
 * by creating new handlers without modifying existing code.
 */
export interface IDependencyHandler {
  /**
   * Get the name of the dependency type this handler manages.
   *
   * @returns The dependency type name (e.g., "Hook", "Variable", "Prop")
   */
  getName(): DependencyType;

  /**
   * Plan hoisting operations for a dependency of this type.
   *
   * This method analyzes the dependency and hoisting context to determine:
   * - Target scope for hoisting
   * - Hoisting strategy to use
   * - Any additional operations needed (prop threading, imports, etc.)
   *
   * @param dependency - The dependency to plan hoisting for
   * @param context - The hoisting context containing source/target information
   * @returns A HoistPlanItem if planning succeeds, null if this handler cannot handle the dependency
   */
  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null;

  /**
   * Execute a hoisting operation for a dependency of this type.
   *
   * This method performs the actual AST transformations to hoist the dependency.
   * It should be idempotent and should not throw errors (use Result type).
   *
   * @param operation - The hoisting operation to execute
   * @param context - The execution context containing AST and scope information
   * @returns Result indicating success or failure
   */
  execute(
    operation: HoistOperation,
    context: HoistExecutionContext
  ): Result<void, InternalErrorType>;
}
