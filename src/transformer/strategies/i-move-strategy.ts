/**
 * Move Strategy Interface
 *
 * Defines the contract for JSX element move strategies.
 * Each strategy implements a specific move operation (Inside, Before, After).
 */

import type {
  TransformErrorType,
  ValidationErrorType,
} from "../../errors/index.js";
import type { Result } from "../../result/index.js";
import type { MoveContext, InsertionPoint } from "../types.js";

/**
 * Strategy interface for JSX element move operations
 */
export interface IMoveStrategy {
  /**
   * Execute the move operation
   *
   * @param context - Move context containing AST, source, target, and options
   * @returns Result with InsertionPoint or error
   */
  execute(
    context: MoveContext
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType>;
}
