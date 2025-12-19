/**
 * Shared helper utilities for move strategies
 *
 * These utilities are used by all move strategies for common operations
 * like validation, cloning, and node manipulation.
 */

import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

import {
  createValidationError,
  createTransformError,
  type ValidationErrorType,
  type TransformErrorType,
} from "../../errors/index.js";
import { ok, err, type Result } from "../../result/index.js";

/**
 * Type alias for JSX child elements
 */
export type JSXChild =
  | t.JSXText
  | t.JSXExpressionContainer
  | t.JSXSpreadChild
  | t.JSXElement
  | t.JSXFragment;

/**
 * Check if a node is a valid JSX source for moving
 */
export function isValidJSXSource(path: NodePath): boolean {
  const node = path.node;
  return (
    t.isJSXElement(node) ||
    t.isJSXFragment(node) ||
    t.isJSXExpressionContainer(node) ||
    t.isJSXText(node) ||
    // Handle expression wrappers
    (t.isExpression(node) && isJSXExpression(node))
  );
}

/**
 * Check if an expression contains JSX
 */
function isJSXExpression(node: t.Node): boolean {
  // Check if the expression itself is JSX
  if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    return true;
  }

  // Check for conditional expressions with JSX
  if (t.isConditionalExpression(node)) {
    return (
      isJSXExpression(node.consequent) || isJSXExpression(node.alternate)
    );
  }

  // Check for logical expressions with JSX
  if (t.isLogicalExpression(node)) {
    return isJSXExpression(node.left) || isJSXExpression(node.right);
  }

  // Check for array expressions (map results)
  if (t.isArrayExpression(node)) {
    return node.elements.some((el) => el !== null && isJSXExpression(el));
  }

  return false;
}

/**
 * Check if a target can have children
 */
export function isValidJSXTarget(path: NodePath): boolean {
  const node = path.node;
  return t.isJSXElement(node) || t.isJSXFragment(node);
}

/**
 * Check if moving would create a circular reference
 */
export function isCircularMove(sourcePath: NodePath, targetPath: NodePath): boolean {
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
 * Clone a node deeply
 */
export function cloneNode<N extends t.Node>(node: N): N {
  return t.cloneNode(node, true);
}

/**
 * Preserve comments from source to cloned node
 */
export function preserveComments(source: t.Node, target: t.Node): void {
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
 */
export function getChildren(path: NodePath): Result<JSXChild[], ValidationErrorType> {
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
export function setChildren(path: NodePath, children: JSXChild[]): void {
  const node = path.node;
  if (t.isJSXElement(node)) {
    node.children = children;
  } else if (t.isJSXFragment(node)) {
    node.children = children;
  }
}

/**
 * Wrap a node in JSXExpressionContainer if needed
 */
export function wrapInExpressionContainer(
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
  if (t.isExpression(node)) {
    return t.jsxExpressionContainer(node);
  }

  // If not an expression, convert to JSXText as last resort
  return t.jsxText(node.type);
}

/**
 * Remove the source node from its original location
 * and clean up any whitespace-only JSXText siblings
 */
export function removeSource(path: NodePath): void {
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
 * Get siblings of a node
 */
export function getSiblings(path: NodePath): Result<t.Node[], TransformErrorType> {
  let currentPath = path;
  let shouldContinue = true;
  const MAX_DEPTH = 100;
  let depth = 0;

  while (shouldContinue && depth < MAX_DEPTH) {
    depth++;
    const parent = currentPath.parent;

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
      shouldContinue = false;
    }

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
      const parentPath = currentPath.parentPath;
      if (!parentPath) {
        shouldContinue = false;
      } else {
        currentPath = parentPath;
      }
    } else {
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
export function setSiblings(path: NodePath, siblings: t.Node[]): void {
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
    const elements: Array<t.Expression | t.SpreadElement | null> = siblings.filter(
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
    const bodyNodes: Array<t.Statement | t.ModuleDeclaration> = siblings.filter(
      (s): s is t.Statement | t.ModuleDeclaration =>
        t.isStatement(s) || t.isModuleDeclaration(s)
    );
    parent.body = bodyNodes;
  }
}

/**
 * Normalize a path to the outermost movable node
 */
export function normalizePathForMove(
  path: NodePath
): Result<NodePath, TransformErrorType> {
  let currentPath = path;
  let shouldContinue = true;
  const MAX_DEPTH = 100;
  let depth = 0;

  while (shouldContinue && depth < MAX_DEPTH) {
    depth++;
    const parent = currentPath.parent;

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
      shouldContinue = false;
    } else if (
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
 * Get the index of a node in its parent's children
 */
export function getIndexInParent(
  path: NodePath
): Result<number, ValidationErrorType> {
  const containerResult = findContainerPath(path);
  if (containerResult.ok === false) {
    return containerResult;
  }

  const { path: currentPath, node: nodeToFind } = containerResult.value;
  const parent = currentPath.parent;
  const children = getChildrenFromParent(parent);

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
 * Walk up the tree to find the appropriate container path
 */
function findContainerPath(
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
    } else if (isContainerNode(parent)) {
      shouldContinue = false;
    } else if (shouldContinueWalkUp(parent)) {
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
function isContainerNode(node: t.Node): boolean {
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
function shouldContinueWalkUp(node: t.Node): boolean {
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
function getChildrenFromParent(parent: t.Node): readonly t.Node[] | null {
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
