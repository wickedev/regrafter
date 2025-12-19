/**
 * JSX Transformer Interface
 *
 * Defines the contract for JSX element transformation operations.
 * Implementations handle moving JSX elements within and across AST nodes
 * with support for different move modes (Inside, Before, After).
 *
 * @module interfaces/IJSXTransformer
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import type { TransformErrorType, ValidationErrorType } from '../errors/index.js';
import type { Result } from '../result/index.js';
import type { Move } from '../types/public.js';
import type { MoveOptions, MoveContext, InsertionPoint } from '../transformer/types.js';

/**
 * Interface for JSX transformation operations
 *
 * Implementations must:
 * - Support three move modes: Inside (appendChild), Before (insertBefore), After (insertAfter)
 * - Validate moves for circular references and structural validity
 * - Preserve comments and source locations during transformations
 * - Handle JSX-specific wrapping (expression containers)
 * - Detect and skip no-op moves
 *
 * @example
 * ```typescript
 * const transformer: IJSXTransformer = createJSXTransformer();
 *
 * // Validate the move
 * const validation = transformer.validateMove(sourcePath, targetPath, Move.Inside);
 * if (isErr(validation)) {
 *   console.error('Invalid move:', validation.error.message);
 *   return;
 * }
 *
 * // Execute the move
 * const result = transformer.move(ast, sourcePath, targetPath, Move.Inside);
 * if (isErr(result)) {
 *   console.error('Transform failed:', result.error.message);
 *   return;
 * }
 *
 * console.log('Move completed:', result.value.movedNode);
 * ```
 */
export interface IJSXTransformer {
  /**
   * Check if source and target are the same element
   *
   * Uses both node identity and source location for comparison.
   *
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target element
   * @returns True if source and target are the same element
   *
   * @example
   * ```typescript
   * if (transformer.isSameElement(sourcePath, targetPath)) {
   *   console.log('Source and target are the same, skipping move');
   * }
   * ```
   */
  isSameElement(sourcePath: NodePath, targetPath: NodePath): boolean;

  /**
   * Check if the move is effectively a no-op
   *
   * Detects situations where the move would result in no change:
   * - Move.Before: source is already immediately before target
   * - Move.After: source is already immediately after target
   * - Move.Inside: source is already a child at the expected position
   *
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target element
   * @param mode - Move mode
   * @returns True if the move would result in no change
   *
   * @example
   * ```typescript
   * if (transformer.isNoOpMove(sourcePath, targetPath, Move.Before)) {
   *   console.log('Element is already before target, no action needed');
   * }
   * ```
   */
  isNoOpMove(sourcePath: NodePath, targetPath: NodePath, mode: Move): boolean;

  /**
   * Execute a move operation based on the mode
   *
   * This is the primary entry point for moving JSX elements.
   * Automatically delegates to moveInside, moveBefore, or moveAfter
   * based on the mode parameter.
   *
   * @param ast - The AST to transform
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target element
   * @param mode - Move mode (Inside, Before, After)
   * @param options - Move options (preserveComments, insertIndex)
   * @returns Result with insertion point or error
   *
   * @example
   * ```typescript
   * const result = transformer.move(
   *   ast,
   *   sourcePath,
   *   targetPath,
   *   Move.Inside,
   *   { preserveComments: true, insertIndex: 0 }
   * );
   *
   * if (isErr(result)) {
   *   console.error('Move failed:', result.error.message);
   *   return;
   * }
   *
   * if (result.value.wasNoOp) {
   *   console.log('Move was a no-op');
   * } else {
   *   console.log('Moved node:', result.value.movedNode);
   * }
   * ```
   */
  move(
    ast: t.File,
    sourcePath: NodePath,
    targetPath: NodePath,
    mode: Move,
    options?: MoveOptions
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType>;

  /**
   * Move.Inside operation - appendChild semantics
   *
   * Inserts the source element as a child of the target element.
   * By default, appends to the end of children. Use insertIndex for specific position.
   *
   * @param context - Move context with source, target, and options
   * @returns Result with insertion point or error
   *
   * @example
   * ```typescript
   * const context = {
   *   ast,
   *   sourcePath,
   *   targetPath,
   *   options: { insertIndex: 0 } // Insert at beginning
   * };
   *
   * const result = transformer.moveInside(context);
   * if (isErr(result)) {
   *   console.error('Failed to move inside:', result.error.message);
   * }
   * ```
   */
  moveInside(
    context: MoveContext
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType>;

  /**
   * Move.Before operation - insertBefore sibling semantics
   *
   * Inserts the source element as the previous sibling of the target element.
   *
   * @param context - Move context with source, target, and options
   * @returns Result with insertion point or error
   *
   * @example
   * ```typescript
   * const context = { ast, sourcePath, targetPath, options: {} };
   * const result = transformer.moveBefore(context);
   * if (isErr(result)) {
   *   console.error('Failed to move before:', result.error.message);
   * }
   * ```
   */
  moveBefore(
    context: MoveContext
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType>;

  /**
   * Move.After operation - insertAfter sibling semantics
   *
   * Inserts the source element as the next sibling of the target element.
   *
   * @param context - Move context with source, target, and options
   * @returns Result with insertion point or error
   *
   * @example
   * ```typescript
   * const context = { ast, sourcePath, targetPath, options: {} };
   * const result = transformer.moveAfter(context);
   * if (isErr(result)) {
   *   console.error('Failed to move after:', result.error.message);
   * }
   * ```
   */
  moveAfter(
    context: MoveContext
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType>;

  /**
   * Get children of a JSX element or fragment
   *
   * Returns a copy of the children array for modification.
   * Only works with JSXElement and JSXFragment nodes.
   *
   * @param path - Path to JSX element or fragment
   * @returns Result with array of children or ValidationError
   *
   * @example
   * ```typescript
   * const result = transformer.getChildren(elementPath);
   * if (isErr(result)) {
   *   console.error('Node does not support children:', result.error.message);
   *   return;
   * }
   * const children = result.value;
   * console.log(`Element has ${children.length} children`);
   * ```
   */
  getChildren(path: NodePath): Result<t.Node[], ValidationErrorType>;

  /**
   * Get siblings of a node
   *
   * Navigates up the tree to find the appropriate container and returns
   * the array of sibling nodes. Handles JSXExpressionContainer wrapping.
   *
   * @param path - Path to the node
   * @returns Result with array of siblings or TransformError
   *
   * @example
   * ```typescript
   * const result = transformer.getSiblings(elementPath);
   * if (isErr(result)) {
   *   console.error('Cannot access siblings:', result.error.message);
   *   return;
   * }
   * const siblings = result.value;
   * console.log(`Node has ${siblings.length - 1} siblings`);
   * ```
   */
  getSiblings(path: NodePath): Result<t.Node[], TransformErrorType>;

  /**
   * Get the index of a node in its parent's children
   *
   * For nodes inside JSXExpressionContainer, returns the index of the container.
   * Useful for relative positioning operations.
   *
   * @param path - Path to the node
   * @returns Result with the index (0-based) or ValidationError
   *
   * @example
   * ```typescript
   * const result = transformer.getIndexInParent(elementPath);
   * if (isErr(result)) {
   *   console.error('Node not found in parent:', result.error.message);
   *   return;
   * }
   * console.log(`Element is at index ${result.value} in parent`);
   * ```
   */
  getIndexInParent(path: NodePath): Result<number, ValidationErrorType>;

  /**
   * Check if moving would create a circular reference
   *
   * Detects if the target is a descendant of the source, which would
   * create an invalid circular structure (moving an element into itself).
   * Moving a descendant into an ancestor is valid and returns false.
   *
   * @param sourcePath - Path to source element
   * @param targetPath - Path to target element
   * @returns True if the move would be circular
   *
   * @example
   * ```typescript
   * if (transformer.isCircularMove(sourcePath, targetPath)) {
   *   console.error('Cannot move element into its own descendant');
   *   return;
   * }
   * ```
   */
  isCircularMove(sourcePath: NodePath, targetPath: NodePath): boolean;

  /**
   * Validate a move operation before execution
   *
   * Performs all validation checks without modifying the AST:
   * - Circular reference check
   * - Source validity (must be JSX)
   * - Target validity (must support children for Move.Inside)
   * - Target parent existence (for Move.Before/After)
   *
   * @param sourcePath - Path to source element
   * @param targetPath - Path to target element
   * @param mode - Move mode
   * @returns Result with void on success, ValidationError on failure
   *
   * @example
   * ```typescript
   * const validation = transformer.validateMove(sourcePath, targetPath, Move.Inside);
   * if (isErr(validation)) {
   *   console.error('Validation failed:', validation.error.message);
   *   console.log('Suggestions:', validation.error.suggestions);
   *   return;
   * }
   * // Safe to proceed with move
   * ```
   */
  validateMove(
    sourcePath: NodePath,
    targetPath: NodePath,
    mode: Move
  ): Result<void, ValidationErrorType>;

  /**
   * Transform an element using Result-based error handling
   *
   * This is an alias for the move() method, providing a more explicit
   * name for the transformation operation. Identical behavior to move().
   *
   * @param ast - The AST to transform
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target element
   * @param mode - Move mode (Inside, Before, After)
   * @param options - Move options
   * @returns Result containing InsertionPoint or an error
   *
   * @example
   * ```typescript
   * const result = transformer.transformElement(
   *   ast,
   *   sourcePath,
   *   targetPath,
   *   Move.After
   * );
   * ```
   */
  transformElement(
    ast: t.File,
    sourcePath: NodePath,
    targetPath: NodePath,
    mode: Move,
    options?: MoveOptions
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType>;
}
