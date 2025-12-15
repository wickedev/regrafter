/**
 * JSX Transformer
 *
 * Handles JSX element move operations including:
 * - Move.Inside (appendChild)
 * - Move.Before (insertBefore sibling)
 * - Move.After (insertAfter sibling)
 *
 * Task 2.1: Move.Inside operation implementation
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { Move } from '../types/public.js';

import {
  MoveResult,
  MoveOptions,
  MoveContext,
  mergeMoveOptions,
  TransformerErrorCodes,
} from './types.js';


/**
 * Type alias for JSX child elements
 * JSXChild was removed from @babel/types, so we define it here
 */
type JSXChild =
  | t.JSXText
  | t.JSXExpressionContainer
  | t.JSXSpreadChild
  | t.JSXElement
  | t.JSXFragment;

/**
 * JSXTransformer handles all JSX element transformations
 */
export class JSXTransformer {
  /**
   * Task 1.4.3: Source-target identity detection
   *
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

    const sourceIndex = this.getIndexInParent(sourcePath);
    const targetIndex = this.getIndexInParent(targetPath);
    const sameParent = sourcePath.parent === targetPath.parent;

    if (!sameParent) {
      return false;
    }

    // Check based on mode
    switch (mode) {
      case Move.Before:
        // No-op if source is already immediately before target
        return sourceIndex >= 0 && targetIndex >= 0 && sourceIndex === targetIndex - 1;
      case Move.After:
        // No-op if source is already immediately after target
        return sourceIndex >= 0 && targetIndex >= 0 && sourceIndex === targetIndex + 1;
      case Move.Inside:
        // No-op if source is already a child of target (different check needed)
        return sourcePath.parent === targetPath.node;
      default:
        return false;
    }
  }

  /**
   * Execute a move operation based on the mode
   *
   * @param ast - The AST to transform
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target element
   * @param mode - Move mode (Inside, Before, After)
   * @param options - Move options
   * @returns MoveResult with transformed AST
   */
  move(
    ast: t.File,
    sourcePath: NodePath,
    targetPath: NodePath,
    mode: Move,
    options?: MoveOptions
  ): MoveResult {
    const mergedOptions = mergeMoveOptions(options);

    // Task 1.4.3: Check for source-target identity (no-op case)
    if (this.isNoOpMove(sourcePath, targetPath, mode)) {
      return {
        success: true,
        ast,
        wasNoOp: true,
      };
    }

    const context: MoveContext = {
      ast,
      sourcePath,
      targetPath,
      options: mergedOptions,
    };

    switch (mode) {
      case Move.Inside:
        return this.moveInside(context);
      case Move.Before:
        return this.moveBefore(context);
      case Move.After:
        return this.moveAfter(context);
      default:
        return {
          success: false,
          ast,
          error: `Unknown move mode: ${mode}`,
          errorCode: TransformerErrorCodes.INTERNAL_ERROR,
        };
    }
  }

  /**
   * Move.Inside operation - appendChild semantics
   *
   * Task 2.1.1: appendChild operation for Move.Inside mode
   *
   * Inserts the source element as a child of the target element.
   * By default, appends to the end of children. Use insertIndex for specific position.
   *
   * @param context - Move context with source, target, and options
   * @returns MoveResult with transformed AST
   */
  moveInside(context: MoveContext): MoveResult {
    const { ast, sourcePath, targetPath, options } = context;

    // Validate source is a JSX element
    if (!this.isValidJSXSource(sourcePath)) {
      return {
        success: false,
        ast,
        error: 'Source must be a JSX element, expression container, or fragment',
      };
    }

    // Validate target can have children
    if (!this.isValidJSXTarget(targetPath)) {
      return {
        success: false,
        ast,
        error: 'Target must be a JSX element or fragment that can contain children',
      };
    }

    try {
      // Clone the source node to avoid mutation issues
      const sourceNode = this.cloneNode(sourcePath.node);

      // Extract and preserve comments if needed
      if (options.preserveComments) {
        this.preserveComments(sourcePath.node, sourceNode);
      }

      // Get target's children container
      // targetNode is available for future validation needs
      const _targetNode = targetPath.node;
      void _targetNode; // Suppress unused variable warning
      const children = this.getChildren(targetPath);

      if (!children) {
        return {
          success: false,
          ast,
          error: 'Could not access target children',
        };
      }

      // Wrap source in expression container if necessary
      const wrappedSource = this.wrapInExpressionContainer(sourceNode, targetPath);

      // Determine insertion index
      const insertIndex = options.insertIndex >= 0
        ? Math.min(options.insertIndex, children.length)
        : children.length;

      // Insert the source node at the appropriate position
      children.splice(insertIndex, 0, wrappedSource);

      // Update the target node's children
      this.setChildren(targetPath, children);

      // Remove the source from its original location
      this.removeSource(sourcePath);

      return {
        success: true,
        ast,
        movedNode: sourceNode,
      };
    } catch (error) {
      return {
        success: false,
        ast,
        error: error instanceof Error ? error.message : 'Unknown error during move',
      };
    }
  }

  /**
   * Move.Before operation - insertBefore sibling semantics
   *
   * Inserts the source element as the previous sibling of the target element.
   *
   * @param context - Move context with source, target, and options
   * @returns MoveResult with transformed AST
   */
  moveBefore(context: MoveContext): MoveResult {
    const { ast, sourcePath, targetPath, options } = context;

    // Validate source is a JSX element
    if (!this.isValidJSXSource(sourcePath)) {
      return {
        success: false,
        ast,
        error: 'Source must be a JSX element, expression container, or fragment',
      };
    }

    try {
      // Clone the source node
      const sourceNode = this.cloneNode(sourcePath.node);

      // Extract and preserve comments if needed
      if (options.preserveComments) {
        this.preserveComments(sourcePath.node, sourceNode);
      }

      // Get target's parent and find target index in siblings
      const parentPath = targetPath.parentPath;
      if (!parentPath) {
        return {
          success: false,
          ast,
          error: 'Target has no parent',
        };
      }

      const siblings = this.getSiblings(targetPath);
      if (!siblings) {
        return {
          success: false,
          ast,
          error: 'Could not access target siblings',
        };
      }

      const targetIndex = this.getIndexInParent(targetPath);
      if (targetIndex < 0) {
        return {
          success: false,
          ast,
          error: 'Could not find target in parent',
        };
      }

      // Wrap source in expression container if necessary
      const wrappedSource = this.wrapInExpressionContainer(sourceNode, parentPath);

      // Insert before target
      siblings.splice(targetIndex, 0, wrappedSource);

      // Update parent's children
      this.setSiblings(targetPath, siblings);

      // Remove the source from its original location
      this.removeSource(sourcePath);

      return {
        success: true,
        ast,
        movedNode: sourceNode,
      };
    } catch (error) {
      return {
        success: false,
        ast,
        error: error instanceof Error ? error.message : 'Unknown error during move',
      };
    }
  }

  /**
   * Move.After operation - insertAfter sibling semantics
   *
   * Inserts the source element as the next sibling of the target element.
   *
   * @param context - Move context with source, target, and options
   * @returns MoveResult with transformed AST
   */
  moveAfter(context: MoveContext): MoveResult {
    const { ast, sourcePath, targetPath, options } = context;

    // Validate source is a JSX element
    if (!this.isValidJSXSource(sourcePath)) {
      return {
        success: false,
        ast,
        error: 'Source must be a JSX element, expression container, or fragment',
      };
    }

    try {
      // Clone the source node
      const sourceNode = this.cloneNode(sourcePath.node);

      // Extract and preserve comments if needed
      if (options.preserveComments) {
        this.preserveComments(sourcePath.node, sourceNode);
      }

      // Get target's parent and find target index in siblings
      const parentPath = targetPath.parentPath;
      if (!parentPath) {
        return {
          success: false,
          ast,
          error: 'Target has no parent',
        };
      }

      const siblings = this.getSiblings(targetPath);
      if (!siblings) {
        return {
          success: false,
          ast,
          error: 'Could not access target siblings',
        };
      }

      const targetIndex = this.getIndexInParent(targetPath);
      if (targetIndex < 0) {
        return {
          success: false,
          ast,
          error: 'Could not find target in parent',
        };
      }

      // Wrap source in expression container if necessary
      const wrappedSource = this.wrapInExpressionContainer(sourceNode, parentPath);

      // Insert after target
      siblings.splice(targetIndex + 1, 0, wrappedSource);

      // Update parent's children
      this.setSiblings(targetPath, siblings);

      // Remove the source from its original location
      this.removeSource(sourcePath);

      return {
        success: true,
        ast,
        movedNode: sourceNode,
      };
    } catch (error) {
      return {
        success: false,
        ast,
        error: error instanceof Error ? error.message : 'Unknown error during move',
      };
    }
  }

  /**
   * Task 2.1.2: Fragment and nested structure handling
   *
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
      return this.isJSXExpression(node.consequent) ||
             this.isJSXExpression(node.alternate);
    }

    // Check for logical expressions with JSX
    if (t.isLogicalExpression(node)) {
      return this.isJSXExpression(node.left) ||
             this.isJSXExpression(node.right);
    }

    // Check for array expressions (map results)
    if (t.isArrayExpression(node)) {
      return node.elements.some(el => el && this.isJSXExpression(el));
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
      target.leadingComments = source.leadingComments.map(c => ({ ...c }));
    }
    if (source.trailingComments) {
      target.trailingComments = source.trailingComments.map(c => ({ ...c }));
    }
    if (source.innerComments) {
      target.innerComments = source.innerComments.map(c => ({ ...c }));
    }
  }

  /**
   * Get children of a JSX element or fragment
   */
  private getChildren(path: NodePath): JSXChild[] | null {
    const node = path.node;
    if (t.isJSXElement(node)) {
      return [...node.children];
    }
    if (t.isJSXFragment(node)) {
      return [...node.children];
    }
    return null;
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
   * Get siblings of a node
   */
  private getSiblings(path: NodePath): t.Node[] | null {
    const parent = path.parent;

    if (t.isJSXElement(parent)) {
      return [...parent.children] as t.Node[];
    }
    if (t.isJSXFragment(parent)) {
      return [...parent.children] as t.Node[];
    }
    if (t.isArrayExpression(parent)) {
      return parent.elements.filter((e): e is t.Expression => e !== null);
    }
    if (t.isBlockStatement(parent)) {
      return [...parent.body];
    }
    if (t.isProgram(parent)) {
      return [...parent.body];
    }

    return null;
  }

  /**
   * Set siblings of a node
   */
  private setSiblings(path: NodePath, siblings: t.Node[]): void {
    const parent = path.parent;

    if (t.isJSXElement(parent)) {
      parent.children = siblings as JSXChild[];
    } else if (t.isJSXFragment(parent)) {
      parent.children = siblings as JSXChild[];
    } else if (t.isArrayExpression(parent)) {
      parent.elements = siblings as (t.Expression | t.SpreadElement | null)[];
    } else if (t.isBlockStatement(parent)) {
      parent.body = siblings as t.Statement[];
    } else if (t.isProgram(parent)) {
      parent.body = siblings as (t.Statement | t.ModuleDeclaration)[];
    }
  }

  /**
   * Get the index of a node in its parent's children
   */
  private getIndexInParent(path: NodePath): number {
    const parent = path.parent;
    const node = path.node;

    let children: t.Node[] | null = null;

    if (t.isJSXElement(parent)) {
      children = parent.children;
    } else if (t.isJSXFragment(parent)) {
      children = parent.children;
    } else if (t.isArrayExpression(parent)) {
      children = parent.elements.filter((e): e is t.Expression => e !== null);
    } else if (t.isBlockStatement(parent)) {
      children = parent.body;
    } else if (t.isProgram(parent)) {
      children = parent.body;
    }

    if (children) {
      return children.indexOf(node as never);
    }

    return -1;
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

    // Return as-is if no wrapping needed (should be a JSXChild at this point)
    return node as unknown as JSXChild;
  }

  /**
   * Remove the source node from its original location
   */
  private removeSource(path: NodePath): void {
    path.remove();
  }

  /**
   * Check if moving would create a circular reference
   * (source is ancestor of target or target is ancestor of source)
   */
  isCircularMove(sourcePath: NodePath, targetPath: NodePath): boolean {
    // Check if source is an ancestor of target
    let current: NodePath | null = targetPath;
    while (current) {
      if (current.node === sourcePath.node) {
        return true;
      }
      current = current.parentPath;
    }

    // Check if target is an ancestor of source
    current = sourcePath;
    while (current) {
      if (current.node === targetPath.node) {
        return true;
      }
      current = current.parentPath;
    }

    return false;
  }

  /**
   * Validate a move operation before execution
   */
  validateMove(
    sourcePath: NodePath,
    targetPath: NodePath,
    mode: Move
  ): { valid: boolean; error?: string } {
    // Check for circular reference
    if (this.isCircularMove(sourcePath, targetPath)) {
      return {
        valid: false,
        error: 'Cannot move an element into itself or its descendants',
      };
    }

    // Validate source
    if (!this.isValidJSXSource(sourcePath)) {
      return {
        valid: false,
        error: 'Source must be a valid JSX element or expression',
      };
    }

    // For Move.Inside, target must be able to have children
    if (mode === Move.Inside && !this.isValidJSXTarget(targetPath)) {
      return {
        valid: false,
        error: 'Target must be a JSX element or fragment for Move.Inside',
      };
    }

    // For Move.Before/After, target must have a parent
    if ((mode === Move.Before || mode === Move.After) && !targetPath.parentPath) {
      return {
        valid: false,
        error: 'Target must have a parent for Move.Before/After',
      };
    }

    return { valid: true };
  }
}

/**
 * Create a new JSXTransformer instance
 */
export function createJSXTransformer(): JSXTransformer {
  return new JSXTransformer();
}
