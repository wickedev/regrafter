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
   */
  private isValidJSXSource(path: NodePath): boolean {
    const node = path.node;
    return (
      t.isJSXElement(node) ||
      t.isJSXFragment(node) ||
      t.isJSXExpressionContainer(node) ||
      t.isJSXText(node) ||
      // Handle expression wrappers
      (t.isExpression(node) && this.isJSXExpression(node))
    );
  }

  /**
   * Check if an expression contains JSX
   */
  private isJSXExpression(node: t.Node): boolean {
    // Check if the expression itself is JSX
    if (t.isJSXElement(node) || t.isJSXFragment(node)) {
      return true;
    }

    // Check for conditional expressions with JSX
    if (t.isConditionalExpression(node)) {
      return (
        this.isJSXExpression(node.consequent) ||
        this.isJSXExpression(node.alternate)
      );
    }

    // Check for logical expressions with JSX
    if (t.isLogicalExpression(node)) {
      return (
        this.isJSXExpression(node.left) || this.isJSXExpression(node.right)
      );
    }

    // Check for array expressions (map results)
    if (t.isArrayExpression(node)) {
      return node.elements.some((el) => el !== null && this.isJSXExpression(el));
    }

    return false;
  }

  /**
   * Check if a target can have children
   */
  private isValidJSXTarget(path: NodePath): boolean {
    const node = path.node;
    // JSX elements and fragments can have children
    return t.isJSXElement(node) || t.isJSXFragment(node);
  }

  /**
   * Clone a node deeply
   */
  private cloneNode<N extends t.Node>(node: N): N {
    return t.cloneNode(node, true);
  }

  /**
   * Preserve comments from source to cloned node
   */
  private preserveComments(source: t.Node, target: t.Node): void {
    if (source.leadingComments) {
      target.leadingComments = source.leadingComments.map((c) => ({ ...c }));
    }
    if (source.trailingComments) {
      target.trailingComments = source.trailingComments.map((c) => ({ ...c }));
    }
    if (source.innerComments) {
      target.innerComments = source.innerComments.map((c) => ({ ...c }));
    }
  }

  /**
   * Get children of a JSX element or fragment
   *
   * @returns Ok with array of children, Err with ValidationError if node cannot have children
   */
  getChildren(path: NodePath): Result<JSXChild[], ValidationErrorType> {
    const node = path.node;
    if (t.isJSXElement(node)) {
      return ok([...node.children]);
    }
    if (t.isJSXFragment(node)) {
      return ok([...node.children]);
    }
    return err(
      createValidationError({
        code: "V006",
        message: "Node does not support children",
        constraint: "no_children_support",
        details: "Node does not support children",
        file: "",
      })
    );
  }

  /**
   * Set children of a JSX element or fragment
   */
  private setChildren(path: NodePath, children: JSXChild[]): void {
    const node = path.node;
    if (t.isJSXElement(node)) {
      node.children = children;
    } else if (t.isJSXFragment(node)) {
      node.children = children;
    }
  }

  /**
   * Normalize a path to the outermost movable node
   *
   * If a path points to a node inside a JSXExpressionContainer (like the LogicalExpression
   * in {condition && <Element/>}), we need to normalize it to point to the
   * JSXExpressionContainer itself, since that's what we actually want to move.
   */
  private normalizePathForMove(path: NodePath): Result<NodePath, TransformErrorType> {
    let currentPath = path;
    let shouldContinue = true;
    const MAX_DEPTH = 100;
    let depth = 0;

    while (shouldContinue && depth < MAX_DEPTH) {
      depth++;
      const parent = currentPath.parent;
      // If parent is JSXExpressionContainer, that's what we should move
      if (t.isJSXExpressionContainer(parent)) {
        const parentPath = currentPath.parentPath;
        if (parentPath) {
          return ok(parentPath);
        }
        shouldContinue = false;
      } else if (
        t.isJSXElement(parent) ||
        t.isJSXFragment(parent) ||
        t.isArrayExpression(parent) ||
        t.isBlockStatement(parent) ||
        t.isProgram(parent)
      ) {
        // If parent is already a JSX container, we're done
        shouldContinue = false;
      } else if (
        // Walk up through expressions
        t.isLogicalExpression(parent) ||
        t.isConditionalExpression(parent) ||
        t.isCallExpression(parent) ||
        t.isMemberExpression(parent) ||
        t.isArrowFunctionExpression(parent) ||
        t.isFunctionExpression(parent)
      ) {
        const parentPath = currentPath.parentPath;
        if (!parentPath) {
          shouldContinue = false;
        } else {
          currentPath = parentPath;
        }
      } else {
        shouldContinue = false;
      }
    }

    if (depth >= MAX_DEPTH) {
      return err(
        createTransformError({
          code: "E030",
          message: `Maximum tree depth (${MAX_DEPTH}) exceeded while finding JSX container`,
          operation: "normalizePathForMove",
          file: "",
        })
      );
    }

    return ok(currentPath);
  }

  /**
   * Get siblings of a node
   *
   * For nodes inside JSXExpressionContainer (like {condition && <Element/>}),
   * we need to get the siblings of the container itself, not the expression inside.
   *
   * @returns Ok with array of siblings, Err with TransformError if siblings cannot be accessed
   */
  getSiblings(path: NodePath): Result<t.Node[], TransformErrorType> {
    let currentPath = path;
    let shouldContinue = true;
    const MAX_DEPTH = 100;
    let depth = 0;

    // If parent is an expression (LogicalExpression, ConditionalExpression, CallExpression, etc.),
    // we need to walk up to find the JSXExpressionContainer, then get its siblings
    while (shouldContinue && depth < MAX_DEPTH) {
      depth++;
      const parent = currentPath.parent;
      // If we found a JSXExpressionContainer, move up one more level to get its siblings
      if (t.isJSXExpressionContainer(parent)) {
        const parentPath = currentPath.parentPath;
        if (parentPath === null) {
          return err(
            createTransformError({
              code: "T011",
              message: "Unexpected null parent path for JSXExpressionContainer",
              operation: "getSiblings",
              file: "",
            })
          );
        }
        currentPath = parentPath;
        // Continue to the sibling-getting logic below
        shouldContinue = false;
      }

      // If parent is a JSX container (Element/Fragment) or other sibling-having container, use it
      if (
        t.isJSXElement(parent) ||
        t.isJSXFragment(parent) ||
        t.isArrayExpression(parent) ||
        t.isBlockStatement(parent) ||
        t.isProgram(parent)
      ) {
        shouldContinue = false;
      } else if (
        t.isLogicalExpression(parent) ||
        t.isConditionalExpression(parent) ||
        t.isCallExpression(parent) ||
        t.isMemberExpression(parent) ||
        t.isArrowFunctionExpression(parent) ||
        t.isFunctionExpression(parent)
      ) {
        // Walk up the tree for expression contexts
        const parentPath = currentPath.parentPath;
        if (!parentPath) {
          shouldContinue = false;
        } else {
          currentPath = parentPath;
        }
      } else {
        // For other parent types (e.g., ReturnStatement, ExpressionStatement),
        // continue walking up to find a valid container
        const parentPath = currentPath.parentPath;
        if (!parentPath) {
          shouldContinue = false;
        } else {
          currentPath = parentPath;
        }
      }
    }

    if (depth >= MAX_DEPTH) {
      return err(
        createTransformError({
          code: "E030",
          message: `Maximum tree depth (${MAX_DEPTH}) exceeded while finding siblings`,
          operation: "getSiblings",
          file: "",
        })
      );
    }

    // Now get siblings from the appropriate container
    const parent = currentPath.parent;
    if (t.isJSXElement(parent)) {
      const siblings: t.Node[] = [...parent.children];
      return ok(siblings);
    }
    if (t.isJSXFragment(parent)) {
      const siblings: t.Node[] = [...parent.children];
      return ok(siblings);
    }
    if (t.isArrayExpression(parent)) {
      return ok(parent.elements.filter((e): e is t.Expression => e !== null));
    }
    if (t.isBlockStatement(parent)) {
      return ok([...parent.body]);
    }
    if (t.isProgram(parent)) {
      return ok([...parent.body]);
    }

    return err(
      createTransformError({
        code: "T010",
        message: "Cannot access siblings for this node type",
        operation: "transform",
        file: "",
      })
    );
  }

  /**
   * Set siblings of a node
   */
  private setSiblings(path: NodePath, siblings: t.Node[]): void {
    const parent = path.parent;

    if (t.isJSXElement(parent)) {
      const jsxChildren: JSXChild[] = siblings.filter(
        (s): s is JSXChild =>
          t.isJSXElement(s) ||
          t.isJSXFragment(s) ||
          t.isJSXText(s) ||
          t.isJSXExpressionContainer(s) ||
          t.isJSXSpreadChild(s)
      );
      parent.children = jsxChildren;
    } else if (t.isJSXFragment(parent)) {
      const jsxChildren: JSXChild[] = siblings.filter(
        (s): s is JSXChild =>
          t.isJSXElement(s) ||
          t.isJSXFragment(s) ||
          t.isJSXText(s) ||
          t.isJSXExpressionContainer(s) ||
          t.isJSXSpreadChild(s)
      );
      parent.children = jsxChildren;
    } else if (t.isArrayExpression(parent)) {
      const elements: Array<t.Expression | t.SpreadElement | null> =
        siblings.filter(
          (s): s is t.Expression | t.SpreadElement =>
            t.isExpression(s) || t.isSpreadElement(s)
        );
      parent.elements = elements;
    } else if (t.isBlockStatement(parent)) {
      const statements: t.Statement[] = siblings.filter((s): s is t.Statement =>
        t.isStatement(s)
      );
      parent.body = statements;
    } else if (t.isProgram(parent)) {
      const bodyNodes: Array<t.Statement | t.ModuleDeclaration> =
        siblings.filter(
          (s): s is t.Statement | t.ModuleDeclaration =>
            t.isStatement(s) || t.isModuleDeclaration(s)
        );
      parent.body = bodyNodes;
    }
  }

  /**
   * Walk up the tree to find the appropriate container path
   * @returns Result with container info or error
   */
  private findContainerPath(
    path: NodePath
  ): Result<{ path: NodePath; node: t.Node }, ValidationErrorType> {
    let currentPath = path;
    let nodeToFind = currentPath.node;
    let shouldContinue = true;
    const MAX_DEPTH = 100;
    let depth = 0;

    while (shouldContinue && depth < MAX_DEPTH) {
      depth++;
      const parent = currentPath.parent;

      if (t.isJSXExpressionContainer(parent)) {
        nodeToFind = parent;
        const parentPath = currentPath.parentPath;
        if (parentPath === null) {
          return err(
            createValidationError({
              code: "V008",
              message: "Unexpected null parent path for JSXExpressionContainer",
              constraint: "valid_parent_path",
              details: "Parent path should not be null for JSXExpressionContainer",
              file: "",
            })
          );
        }
        currentPath = parentPath;
        shouldContinue = false;
      } else if (this.isContainerNode(parent)) {
        shouldContinue = false;
      } else if (this.shouldContinueWalkUp(parent)) {
        const parentPath = currentPath.parentPath;
        if (!parentPath) {
          shouldContinue = false;
        } else {
          nodeToFind = currentPath.node;
          currentPath = parentPath;
        }
      } else {
        const parentPath = currentPath.parentPath;
        if (!parentPath) {
          shouldContinue = false;
        } else {
          nodeToFind = currentPath.node;
          currentPath = parentPath;
        }
      }
    }

    if (depth >= MAX_DEPTH) {
      return err(
        createValidationError({
          code: "E120",
          message: `Maximum tree depth (${MAX_DEPTH}) exceeded while finding index in parent`,
          constraint: "Maximum tree depth",
          details: `Exceeded ${MAX_DEPTH} levels while traversing tree`,
          file: "",
        })
      );
    }

    return ok({ path: currentPath, node: nodeToFind });
  }

  /**
   * Check if a node is a container that holds children
   */
  private isContainerNode(node: t.Node): boolean {
    return (
      t.isJSXElement(node) ||
      t.isJSXFragment(node) ||
      t.isArrayExpression(node) ||
      t.isBlockStatement(node) ||
      t.isProgram(node)
    );
  }

  /**
   * Check if we should continue walking up for these parent types
   */
  private shouldContinueWalkUp(node: t.Node): boolean {
    return (
      t.isLogicalExpression(node) ||
      t.isConditionalExpression(node) ||
      t.isCallExpression(node) ||
      t.isMemberExpression(node) ||
      t.isArrowFunctionExpression(node) ||
      t.isFunctionExpression(node)
    );
  }

  /**
   * Get children array from a parent node
   */
  private getChildrenFromParent(parent: t.Node): readonly t.Node[] | null {
    if (t.isJSXElement(parent) || t.isJSXFragment(parent)) {
      return parent.children;
    }
    if (t.isArrayExpression(parent)) {
      return parent.elements.filter((e): e is t.Expression => e !== null);
    }
    if (t.isBlockStatement(parent) || t.isProgram(parent)) {
      return parent.body;
    }
    return null;
  }

  /**
   * Get the index of a node in its parent's children
   *
   * For nodes inside JSXExpressionContainer, returns the index of the container.
   *
   * @returns Ok with the index if found, Err with ValidationError if not found
   */
  getIndexInParent(path: NodePath): Result<number, ValidationErrorType> {
    const containerResult = this.findContainerPath(path);
    if (isErr(containerResult)) {
      return containerResult;
    }

    const { path: currentPath, node: nodeToFind } = containerResult.value;
    const parent = currentPath.parent;
    const children = this.getChildrenFromParent(parent);

    if (children) {
      const index = children.findIndex((child) => child === nodeToFind);
      if (index >= 0) {
        return ok(index);
      }
    }

    return err(
      createValidationError({
        code: "V005",
        message: "Node not found in parent",
        constraint: "node_not_found",
        details: "Node not found in parent",
        file: "",
      })
    );
  }

  /**
   * Wrap a node in JSXExpressionContainer if needed
   */
  private wrapInExpressionContainer(
    node: t.Node,
    parentPath: NodePath
  ): JSXChild {
    // If already a JSX child type, return as is
    if (
      t.isJSXElement(node) ||
      t.isJSXFragment(node) ||
      t.isJSXText(node) ||
      t.isJSXExpressionContainer(node) ||
      t.isJSXSpreadChild(node)
    ) {
      return node;
    }

    // Check if parent expects JSX children
    const parent = parentPath.node;
    if (t.isJSXElement(parent) || t.isJSXFragment(parent)) {
      // Wrap expression in container
      if (t.isExpression(node)) {
        return t.jsxExpressionContainer(node);
      }
    }

    // Fallback: wrap any other node in an expression container
    // This handles edge cases where the node type isn't recognized
    if (t.isExpression(node)) {
      return t.jsxExpressionContainer(node);
    }

    // If not an expression, convert to JSXText as last resort
    // Use node.type to avoid Object.toString() issues
    return t.jsxText(node.type);
  }

  /**
   * Remove the source node from its original location
   * and clean up any whitespace-only JSXText siblings
   */
  private removeSource(path: NodePath): void {
    const parent = path.parentPath;
    path.remove();

    // Clean up whitespace-only JSXText nodes in JSX parent
    if (
      parent &&
      (t.isJSXElement(parent.node) || t.isJSXFragment(parent.node))
    ) {
      const parentNode = parent.node;
      if ("children" in parentNode && Array.isArray(parentNode.children)) {
        parentNode.children = parentNode.children.filter((child) => {
          // Keep non-JSXText nodes
          if (!t.isJSXText(child)) {
            return true;
          }
          // Keep JSXText nodes that have non-whitespace content
          return child.value.trim().length > 0;
        });
      }
    }
  }

  /**
   * Check if moving would create a circular reference
   * (source is ancestor of target or target is ancestor of source)
   */
  isCircularMove(sourcePath: NodePath, targetPath: NodePath): boolean {
    // Only check if target is a descendant of source
    // (trying to move an element into its own child)
    // Moving a descendant into an ancestor is valid
    let current: NodePath | null = targetPath;
    while (current) {
      if (current.node === sourcePath.node) {
        return true;
      }
      current = current.parentPath;
    }

    return false;
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
