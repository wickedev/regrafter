/**
 * JSX Transformer
 *
 * Handles JSX element move operations including:
 * - Move.Inside (appendChild)
 * - Move.Before (insertBefore sibling)
 * - Move.After (insertAfter sibling)
 *
 * Uses Strategy Pattern to delegate move operations to specialized strategy classes.
 */

import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

import {
  createValidationError,
  createTransformError,
  type ValidationErrorType,
  type TransformErrorType,
} from "../errors/index.js";
import { ok, err, isErr, type Result } from "../result/index.js";
import { Move } from "../types/public.js";

import type { MoveOptions, MoveContext, InsertionPoint } from "./types.js";
import { mergeMoveOptions, TransformerErrorCodes } from "./types.js";

import type { IMoveStrategy } from "./strategies/i-move-strategy.js";
import { InsideMoveStrategy } from "./strategies/inside-move-strategy.js";
import { BeforeMoveStrategy } from "./strategies/before-move-strategy.js";
import { AfterMoveStrategy } from "./strategies/after-move-strategy.js";
import * as helpers from "./strategies/move-helpers.js";

/**
 * Type alias for JSX child elements
 */
export type JSXChild = helpers.JSXChild;

/**
 * JSXTransformer handles all JSX element transformations using Strategy Pattern
 */
export class JSXTransformer {
  private strategies: Map<Move, IMoveStrategy>;

  constructor() {
    this.strategies = new Map([
      [Move.Inside, new InsideMoveStrategy()],
      [Move.Before, new BeforeMoveStrategy()],
      [Move.After, new AfterMoveStrategy()],
    ]);
  }
  /**
   * Check if source and target are the same element.
   * Uses node identity and source location for comparison.
   *
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target element
   * @returns true if source and target are the same element
   */
  isSameElement(sourcePath: NodePath, targetPath: NodePath): boolean {
    // Direct node identity check
    if (sourcePath.node === targetPath.node) {
      return true;
    }

    // Check by source location if both have location info
    const sourceLoc = sourcePath.node.loc;
    const targetLoc = targetPath.node.loc;

    if (sourceLoc && targetLoc) {
      return (
        sourceLoc.start.line === targetLoc.start.line &&
        sourceLoc.start.column === targetLoc.start.column &&
        sourceLoc.end.line === targetLoc.end.line &&
        sourceLoc.end.column === targetLoc.end.column
      );
    }

    return false;
  }

  /**
   * Check if the move is effectively a no-op
   *
   * For Move.Before: no-op if source is already immediately before target
   * For Move.After: no-op if source is already immediately after target
   * For Move.Inside: no-op if source is already a child at the expected position
   *
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target element
   * @param mode - Move mode
   * @returns true if the move would result in no change
   */
  isNoOpMove(sourcePath: NodePath, targetPath: NodePath, mode: Move): boolean {
    // Same element is always a no-op
    if (this.isSameElement(sourcePath, targetPath)) {
      return true;
    }

    const sourceIndexResult = this.getIndexInParent(sourcePath);
    const sourceIndex = sourceIndexResult.ok ? sourceIndexResult.value : -1;
    const targetIndexResult = this.getIndexInParent(targetPath);
    const targetIndex = targetIndexResult.ok ? targetIndexResult.value : -1;
    const sameParent = sourcePath.parent === targetPath.parent;

    if (!sameParent) {
      return false;
    }

    // Check based on mode
    switch (mode) {
      case Move.Before:
        // No-op if source is already immediately before target
        return (
          sourceIndex >= 0 &&
          targetIndex >= 0 &&
          sourceIndex === targetIndex - 1
        );
      case Move.After:
        // No-op if source is already immediately after target
        return (
          sourceIndex >= 0 &&
          targetIndex >= 0 &&
          sourceIndex === targetIndex + 1
        );
      case Move.Inside:
        // No-op if source is already a child of target (different check needed)
        return sourcePath.parent === targetPath.node;
      default:
        return false;
    }
  }

  /**
   * Execute a move operation based on the mode using Strategy Pattern
   *
   * @param ast - The AST to transform
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target element
   * @param mode - Move mode (Inside, Before, After)
   * @param options - Move options
   * @returns InsertionResult with transformed AST or error
   */
  move(
    ast: t.File,
    sourcePath: NodePath,
    targetPath: NodePath,
    mode: Move,
    options?: MoveOptions
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType> {
    const mergedOptions = mergeMoveOptions(options);

    // Check for source-target identity (no-op case)
    if (this.isNoOpMove(sourcePath, targetPath, mode)) {
      return ok({
        ast,
        wasNoOp: true,
      });
    }

    const context: MoveContext = {
      ast,
      sourcePath,
      targetPath,
      options: mergedOptions,
    };

    // Use strategy pattern to delegate to appropriate move strategy
    const strategy = this.strategies.get(mode);
    if (!strategy) {
      return err(
        createTransformError({
          code: TransformerErrorCodes.INTERNAL_ERROR,
          message: `Unknown move mode: ${String(mode)}`,
          operation: "transform",
          file: "",
          suggestions: [],
        })
      );
    }

    return strategy.execute(context);
  }


  /**
   * Check if a node is a valid JSX source for moving
   * @deprecated Delegated to helpers module (used by strategies)
   */
  private isValidJSXSource(path: NodePath): boolean {
    return helpers.isValidJSXSource(path);
  }

  /**
   * Check if a target can have children
   * @deprecated Delegated to helpers module (used by strategies)
   */
  private isValidJSXTarget(path: NodePath): boolean {
    return helpers.isValidJSXTarget(path);
  }

  /**
   * Clone a node deeply
   * @deprecated Delegated to helpers module (used by strategies)
   */
  private cloneNode<N extends t.Node>(node: N): N {
    return helpers.cloneNode(node);
  }

  /**
   * Preserve comments from source to cloned node
   * @deprecated Delegated to helpers module (used by strategies)
   */
  private preserveComments(source: t.Node, target: t.Node): void {
    helpers.preserveComments(source, target);
  }

  /**
   * Get children of a JSX element or fragment
   *
   * @returns Ok with array of children, Err with ValidationError if node cannot have children
   */
  getChildren(path: NodePath): Result<JSXChild[], ValidationErrorType> {
    return helpers.getChildren(path);
  }

  /**
   * Set children of a JSX element or fragment
   * @deprecated Delegated to helpers module (used by strategies)
   */
  private setChildren(path: NodePath, children: JSXChild[]): void {
    helpers.setChildren(path, children);
  }

  /**
   * Normalize a path to the outermost movable node
   * @deprecated Delegated to helpers module (used by strategies)
   */
  private normalizePathForMove(path: NodePath): Result<NodePath, TransformErrorType> {
    return helpers.normalizePathForMove(path);
  }

  /**
   * Get siblings of a node
   */
  getSiblings(path: NodePath): Result<t.Node[], TransformErrorType> {
    return helpers.getSiblings(path);
  }

  /**
   * Set siblings of a node
   * @deprecated Delegated to helpers module (used by strategies)
   */
  private setSiblings(path: NodePath, siblings: t.Node[]): void {
    helpers.setSiblings(path, siblings);
  }

  /**
   * Get the index of a node in its parent's children
   */
  getIndexInParent(path: NodePath): Result<number, ValidationErrorType> {
    return helpers.getIndexInParent(path);
  }

  /**
   * Wrap a node in JSXExpressionContainer if needed
   * @deprecated Delegated to helpers module (used by strategies)
   */
  private wrapInExpressionContainer(
    node: t.Node,
    parentPath: NodePath
  ): JSXChild {
    return helpers.wrapInExpressionContainer(node, parentPath);
  }

  /**
   * Remove the source node from its original location
   * @deprecated Delegated to helpers module (used by strategies)
   */
  private removeSource(path: NodePath): void {
    helpers.removeSource(path);
  }

  /**
   * Check if moving would create a circular reference
   */
  isCircularMove(sourcePath: NodePath, targetPath: NodePath): boolean {
    return helpers.isCircularMove(sourcePath, targetPath);
  }

  /**
   * Validate a move operation before execution
   *
   * @returns Ok if the move is valid, Err with ValidationError otherwise
   */
  validateMove(
    sourcePath: NodePath,
    targetPath: NodePath,
    mode: Move
  ): Result<void, ValidationErrorType> {
    // Check for circular reference
    if (this.isCircularMove(sourcePath, targetPath)) {
      return err(
        createValidationError({
          code: "V001",
          message: "Cannot move an element into itself or its descendants",
          constraint: "circular_reference",
          details:
            "Moving an element into itself or its descendants would create a circular reference",
          file: "",
        })
      );
    }

    // Validate source
    if (!this.isValidJSXSource(sourcePath)) {
      return err(
        createValidationError({
          code: "V002",
          message: "Source must be a valid JSX element or expression",
          constraint: "invalid_source",
          details: "Source must be a valid JSX element or expression",
          file: "",
        })
      );
    }

    // For Move.Inside, target must be able to have children
    if (mode === Move.Inside && !this.isValidJSXTarget(targetPath)) {
      return err(
        createValidationError({
          code: "V003",
          message: "Target must be a JSX element or fragment for Move.Inside",
          constraint: "invalid_target",
          details: "Target must be a JSX element or fragment",
          file: "",
        })
      );
    }

    // For Move.Before/After, target must have a parent
    if (
      (mode === Move.Before || mode === Move.After) &&
      !targetPath.parentPath
    ) {
      return err(
        createValidationError({
          code: "V004",
          message: "Target must have a parent for Move.Before/After",
          constraint: "no_parent",
          details: "Target must have a parent",
          file: "",
        })
      );
    }

    return ok(undefined);
  }

  /**
   * Transform an element using Result-based error handling.
   *
   * This is the Result-based version of the move() method, providing
   * explicit error types in the return signature.
   *
   * @param ast - The AST to transform
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target element
   * @param mode - Move mode (Inside, Before, After)
   * @param options - Move options
   * @returns Result containing InsertionPoint or an error
   */
  transformElement(
    ast: t.File,
    sourcePath: NodePath,
    targetPath: NodePath,
    mode: Move,
    options?: MoveOptions
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType> {
    // Call the existing move method which already returns Result<InsertionPoint, ...>
    return this.move(ast, sourcePath, targetPath, mode, options);
  }
}

/**
 * Create a new JSXTransformer instance
 */
export function createJSXTransformer(): JSXTransformer {
  return new JSXTransformer();
}
