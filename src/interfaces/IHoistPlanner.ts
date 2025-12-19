/**
 * Hoist Planner Interface
 *
 * Defines the contract for dependency hoisting planning operations.
 * Implementations analyze dependencies and determine appropriate hoisting
 * strategies while ensuring compliance with React's Rules of Hooks.
 *
 * @module interfaces/IHoistPlanner
 */

import type { HoistContext, HoistPlan } from '../strategies/types.js';
import type {
  DependencyAnalysis,
  ScopeInfo,
} from '../types/internal.js';

/**
 * Interface for hoisting plan generation
 *
 * Implementations must:
 * - Analyze dependencies and select appropriate hoisting strategies
 * - Validate hook locations according to Rules of Hooks
 * - Generate prop threading operations when direct hoisting is not possible
 * - Handle cross-file and cross-component dependency moves
 * - Detect unhoistable dependencies and provide clear reasons
 *
 * @example
 * ```typescript
 * const planner: IHoistPlanner = createHoistPlanner();
 *
 * // Create hoisting context
 * const context: HoistContext = {
 *   sourceScope,
 *   targetScope,
 *   sourceComponent,
 *   targetComponent,
 *   sourceFile: 'App.tsx',
 *   targetFile: 'App.tsx',
 *   isCrossFile: false,
 * };
 *
 * // Generate hoisting plan
 * const plan = planner.plan(dependencyAnalysis, context);
 *
 * if (!plan.valid) {
 *   console.error('Invalid plan:', plan.invalidReason);
 *   return;
 * }
 *
 * console.log('Hoist operations:', plan.hoistOperations.length);
 * console.log('Prop threads:', plan.propThreadOperations.length);
 * console.log('Imports needed:', plan.importOperations.length);
 * ```
 */
export interface IHoistPlanner {
  /**
   * Create a hoisting plan for moving an element's dependencies
   *
   * Analyzes all dependencies identified by DependencyAnalyzer and determines:
   * - Which dependencies need hoisting vs. prop threading
   * - Target scopes for each hoisting operation
   * - Import operations needed for cross-file moves
   * - Prop threading paths through component hierarchy
   *
   * The resulting plan includes:
   * - hoistOperations: Direct variable/hook hoisting
   * - propThreadOperations: Props to thread through components
   * - importOperations: Imports to add/modify
   * - unhoistable: Dependencies that cannot be hoisted with reasons
   * - warnings: Non-critical issues to be aware of
   * - valid: Whether the plan can be safely executed
   *
   * @param analysis - Dependency analysis from DependencyAnalyzer
   * @param context - Hoisting context with source/target information
   * @returns Complete hoisting plan ready for execution
   *
   * @example
   * ```typescript
   * const plan = planner.plan(analysis, context);
   *
   * // Check for unhoistable dependencies
   * if (plan.unhoistable.length > 0) {
   *   console.log('Cannot hoist:');
   *   for (const item of plan.unhoistable) {
   *     console.log(`  - ${item.dependency.symbol}: ${item.reason}`);
   *   }
   * }
   *
   * // Check for warnings
   * if (plan.warnings.length > 0) {
   *   console.warn('Warnings:', plan.warnings);
   * }
   *
   * // Verify plan is valid before execution
   * if (!plan.valid) {
   *   throw new Error(`Invalid plan: ${plan.invalidReason}`);
   * }
   * ```
   */
  plan(analysis: DependencyAnalysis, context: HoistContext): HoistPlan;

  /**
   * Check if a scope is a valid location for React hooks
   *
   * Validates against React's Rules of Hooks:
   * - Valid: Top level of function component
   * - Valid: Top level of custom hook (function named use*)
   * - Invalid: Inside conditionals (if/else)
   * - Invalid: Inside loops (for/while/do)
   * - Invalid: Inside nested functions (unless custom hook)
   * - Invalid: Module level
   * - Invalid: Regular function scope
   *
   * @param scope - Scope to validate
   * @returns True if the scope is valid for hook calls
   *
   * @example
   * ```typescript
   * if (!planner.isValidHookLocation(targetScope)) {
   *   console.error('Cannot hoist hooks to this location');
   *   console.error('Violates Rules of Hooks');
   *   return;
   * }
   *
   * // Safe to hoist hooks to this scope
   * console.log('Valid hook location found');
   * ```
   */
  isValidHookLocation(scope: ScopeInfo): boolean;

  /**
   * Find the nearest valid hook location from a given scope
   *
   * Walks up the scope tree to find the nearest ancestor scope that
   * satisfies React's Rules of Hooks. Returns null if no valid location
   * exists (e.g., hoisting from module-level code).
   *
   * This is used when the target scope itself is invalid for hooks
   * (e.g., inside a conditional) but a parent scope may be valid.
   *
   * @param scope - Starting scope to search from
   * @returns Nearest valid hook scope or null if none found
   *
   * @example
   * ```typescript
   * // Target is inside a conditional - find valid parent
   * const validScope = planner.findNearestValidHookScope(targetScope);
   *
   * if (!validScope) {
   *   console.error('No valid hook location in scope chain');
   *   console.error('Cannot safely hoist this hook');
   *   return;
   * }
   *
   * console.log('Will hoist to:', validScope.id);
   * console.log('Scope type:', validScope.type);
   * ```
   */
  findNearestValidHookScope(scope: ScopeInfo): ScopeInfo | null;
}
