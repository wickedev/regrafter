/**
 * After Move Strategy
 *
 * Implements Move.After operation - insertAfter sibling semantics.
 * Inserts the source element as the next sibling of the target element.
 */

import { error } from "../../errors/error-builder.js";
import type {
  ValidationErrorType,
  TransformErrorType,
} from "../../errors/index.js";
import { ok, err, isErr, type Result } from "../../result/index.js";
import type { MoveContext, InsertionPoint } from "../types.js";
import { TransformerErrorCodes } from "../types.js";

import type { IMoveStrategy } from "./i-move-strategy.js";
import * as helpers from "./move-helpers.js";

/**
 * Strategy for Move.After operations
 */
export class AfterMoveStrategy implements IMoveStrategy {
  /**
   * Execute Move.After operation
   *
   * Inserts the source element as the next sibling of the target element.
   */
  execute(
    context: MoveContext
  ): Result<InsertionPoint, TransformErrorType | ValidationErrorType> {
    const { ast, options } = context;

    // Normalize paths to handle JSXExpressionContainer
    const sourcePathResult = helpers.normalizePathForMove(context.sourcePath);
    if (isErr(sourcePathResult)) return err(sourcePathResult.error);
    const sourcePath = sourcePathResult.value;

    const targetPathResult = helpers.normalizePathForMove(context.targetPath);
    if (isErr(targetPathResult)) return err(targetPathResult.error);
    const targetPath = targetPathResult.value;

    // Validate source is a JSX element
    if (!helpers.isValidJSXSource(sourcePath)) {
      return err(
        error()
          .code("V007")
          .message("Source must be a JSX element, expression container, or fragment")
          .constraint("jsx_element_required")
          .details("Source node must be a JSX element")
          .inFile("")
          .build()
      );
    }

    // Clone the source node
    const sourceNode = helpers.cloneNode(sourcePath.node);

    // Extract and preserve comments if needed
    if (options.preserveComments) {
      helpers.preserveComments(sourcePath.node, sourceNode);
    }

    // Get target's parent and find target index in siblings
    const parentPath = targetPath.parentPath;
    if (!parentPath) {
      return err(
        error()
          .code(TransformerErrorCodes.NO_PARENT)
          .message("Target has no parent")
          .details("Operation: moveAfter")
          .inFile("")
          .build()
      );
    }

    const siblingsResult = helpers.getSiblings(targetPath);
    if (!siblingsResult.ok) {
      return siblingsResult;
    }

    const siblings = siblingsResult.value;

    const targetIndexResult = helpers.getIndexInParent(targetPath);
    if (!targetIndexResult.ok) {
      return err(
        error()
          .code(TransformerErrorCodes.INTERNAL_ERROR)
          .message("Could not find target in parent")
          .details("Operation: moveAfter")
          .inFile("")
          .build()
      );
    }
    const targetIndex = targetIndexResult.value;

    // Check if source and target are in the same parent
    const sourceParentPath = sourcePath.parentPath;
    const sameParent =
      sourceParentPath && sourceParentPath.node === parentPath.node;

    // Wrap source in expression container if necessary
    const wrappedSource = helpers.wrapInExpressionContainer(
      sourceNode,
      parentPath
    );

    if (sameParent === true) {
      // Same parent: remove source first, then insert at adjusted index
      const sourceIndexResult = helpers.getIndexInParent(sourcePath);

      // Remove source from siblings array
      const sourceIndex = sourceIndexResult.ok ? sourceIndexResult.value : -1;
      if (sourceIndex >= 0) {
        siblings.splice(sourceIndex, 1);
      }

      // Adjust target index if source was before target
      const adjustedTargetIndex =
        sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

      // Insert after adjusted target
      siblings.splice(adjustedTargetIndex + 1, 0, wrappedSource);

      // Update parent's children
      helpers.setSiblings(targetPath, siblings);

      // Remove from AST (already removed from siblings)
      helpers.removeSource(sourcePath);
    } else {
      // Different parents: insert first, then remove
      siblings.splice(targetIndex + 1, 0, wrappedSource);
      helpers.setSiblings(targetPath, siblings);
      helpers.removeSource(sourcePath);
    }

    return ok({
      ast,
      movedNode: sourceNode,
    });
  }
}
