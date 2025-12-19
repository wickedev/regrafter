/**
 * Inside Move Strategy
 *
 * Implements Move.Inside operation - appendChild semantics.
 * Inserts the source element as a child of the target element.
 */

import {
  createValidationError,
  createTransformError,
  type ValidationErrorType,
  type TransformErrorType,
} from "../../errors/index.js";
import { ok, err, type Result } from "../../result/index.js";
import type { MoveContext, InsertionPoint } from "../types.js";
import { TransformerErrorCodes } from "../types.js";

import type { IMoveStrategy } from "./i-move-strategy.js";
import * as helpers from "./move-helpers.js";

/**
 * Strategy for Move.Inside operations
 */
export class InsideMoveStrategy implements IMoveStrategy {
  /**
   * Execute Move.Inside operation
   *
   * Inserts the source element as a child of the target element.
   * By default, appends to the end of children. Use insertIndex for specific position.
   */
  execute(
    context: MoveContext
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType> {
    const { ast, sourcePath, targetPath, options } = context;

    // Validate source is a JSX element
    if (!helpers.isValidJSXSource(sourcePath)) {
      return err(
        createValidationError({
          code: "V007",
          message:
            "Source must be a JSX element, expression container, or fragment",
          constraint: "jsx_element_required",
          details: "Source node must be a JSX element",
          file: "",
        })
      );
    }

    // Validate target can have children
    if (!helpers.isValidJSXTarget(targetPath)) {
      return err(
        createTransformError({
          code: TransformerErrorCodes.INVALID_TARGET,
          message:
            "Target must be a JSX element or fragment that can contain children",
          operation: "transform",
          file: "",
          suggestions: [],
        })
      );
    }

    // Check for circular moves before proceeding
    if (helpers.isCircularMove(sourcePath, targetPath)) {
      return err(
        createTransformError({
          code: TransformerErrorCodes.CIRCULAR_MOVE,
          message: "Cannot move an element into itself or its descendants",
          operation: "transform",
          file: "",
          suggestions: [],
        })
      );
    }

    // Clone the source node to avoid mutation issues
    const sourceNode = helpers.cloneNode(sourcePath.node);

    // Extract and preserve comments if needed
    if (options.preserveComments) {
      helpers.preserveComments(sourcePath.node, sourceNode);
    }

    // Get target's children container
    const childrenResult = helpers.getChildren(targetPath);

    if (!childrenResult.ok) {
      return childrenResult;
    }

    const children = childrenResult.value;

    // Wrap source in expression container if necessary
    const wrappedSource = helpers.wrapInExpressionContainer(
      sourceNode,
      targetPath
    );

    // Determine insertion index
    const insertIndex =
      options.insertIndex >= 0
        ? Math.min(options.insertIndex, children.length)
        : children.length;

    // Insert the source node at the appropriate position
    children.splice(insertIndex, 0, wrappedSource);

    // Update the target node's children
    helpers.setChildren(targetPath, children);

    // Remove the source from its original location
    helpers.removeSource(sourcePath);

    return ok({
      ast,
      movedNode: sourceNode,
    });
  }
}
