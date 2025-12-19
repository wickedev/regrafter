/**
 * Hoist Executor Interface
 *
 * Defines the contract for executing hoisting operations on AST.
 * Implementations take a HoistPlan from the HoistPlanner and apply
 * all transformations to the AST (hoisting, import additions, prop threading).
 *
 * @module interfaces/IHoistExecutor
 */

import type { InternalErrorType } from '../errors/index.js';
import type { Result } from '../result/index.js';
import type { HoistExecutionContext } from '../strategies/hoist-executor.js';
import type { HoistPlan } from '../strategies/types.js';

/**
 * Interface for hoisting plan execution
 *
 * Implementations must:
 * - Execute hoisting operations in correct order
 * - Add import declarations for cross-file dependencies
 * - Thread props through component hierarchy
 * - Maintain declaration order within scopes
 * - Preserve function validity (avoid empty function bodies)
 * - Track insertion indices to maintain relative order
 *
 * @example
 * ```typescript
 * const executor: IHoistExecutor = createHoistExecutor();
 *
 * // Build execution context
 * const context: HoistExecutionContext = {
 *   ast,
 *   dependencyPaths: new Map([
 *     ['dep-1', countPath],
 *     ['dep-2', handleClickPath],
 *   ]),
 *   scopePaths: new Map([
 *     ['scope-1', componentPath],
 *     ['scope-2', targetPath],
 *   ]),
 * };
 *
 * // Execute the hoisting plan
 * const result = executor.execute(plan, context);
 *
 * if (isErr(result)) {
 *   console.error('Execution failed:', result.error.message);
 *   return;
 * }
 *
 * console.log('Hoisting completed successfully');
 * // AST has been modified in place
 * ```
 */
export interface IHoistExecutor {
  /**
   * Execute a complete hoisting plan
   *
   * Applies all operations from a HoistPlan to the AST:
   * 1. Hoisting operations - Move declarations to target scopes
   * 2. Import operations - Add/modify import statements
   * 3. Prop threading operations - Add props to component parameters and JSX
   *
   * Operations are executed in order to ensure:
   * - Dependencies are available before use
   * - Declarations maintain relative order
   * - Function bodies remain valid (no empty functions)
   *
   * The AST is modified in place. If execution fails partway through,
   * the AST may be in an inconsistent state.
   *
   * @param plan - Hoisting plan from HoistPlanner
   * @param context - Execution context with AST and path mappings
   * @returns Result with void on success, InternalError on failure
   *
   * @example
   * ```typescript
   * // Validate plan before execution
   * if (!plan.valid) {
   *   console.error('Invalid plan:', plan.invalidReason);
   *   return;
   * }
   *
   * // Execute the plan
   * const result = executor.execute(plan, context);
   *
   * if (isErr(result)) {
   *   console.error('Execution error:', result.error.message);
   *   console.error('AST may be in inconsistent state');
   *   return;
   * }
   *
   * // Success - AST has been modified
   * console.log('Executed operations:');
   * console.log(`  - ${plan.hoistOperations.length} hoisting operations`);
   * console.log(`  - ${plan.importOperations.length} import operations`);
   * console.log(`  - ${plan.propThreadOperations.length} prop threads`);
   * ```
   */
  execute(plan: HoistPlan, context: HoistExecutionContext): Result<void, InternalErrorType>;
}
