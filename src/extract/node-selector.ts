/**
 * NodeSelector Component
 *
 * Task 3.2: Basic NodeSelector implementation
 * Selects and validates JSX nodes for extraction
 */

import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { isAnyJSXNode, isJSXNode } from '../core/index.js';
import type { RegraffError } from '../errors/error-category.js';
import { ok, err, type Result } from '../result/index.js';
import { createSelectorResolver } from '../selector/selector-resolver.js';
import type { Selector } from '../types/public.js';
import { loadTraverseFunction } from '../utils/index.js';

import { createExtractError, ExtractErrorCode } from './errors.js';
import type { RangeSelector } from './types.js';

const traverse = loadTraverseFunction(traverseModule);

/**
 * NodeSelector Interface
 *
 * Responsible for:
 * - Selecting JSX nodes using PositionSelector or PathSelector
 * - Validating that selected nodes are extractable
 */
export interface INodeSelector {
  /**
   * Select JSX nodes using a selector
   *
   * @param ast - Parsed AST of the file
   * @param selector - Selector to locate nodes
   * @returns Result with array of NodePath or error
   */
  selectNodes(
    ast: t.File,
    selector: Selector | RangeSelector
  ): Result<NodePath[], RegraffError>;

  /**
   * Validate that nodes are extractable
   *
   * @param nodes - Array of nodes to validate
   * @returns Result with void on success or error
   */
  validateExtractable(nodes: NodePath[]): Result<void, RegraffError>;
}

/**
 * Check if a selector is a RangeSelector
 */
function isRangeSelector(
  selector: Selector | RangeSelector
): selector is RangeSelector {
  if (!('start' in selector) || !('end' in selector)) {
    return false;
  }

  const { start, end } = selector;
  return (
    typeof selector.file === 'string' &&
    typeof start.line === 'number' &&
    typeof start.column === 'number' &&
    typeof end.line === 'number' &&
    typeof end.column === 'number'
  );
}

function rangeToPositionSelector(selector: RangeSelector): Selector {
  return {
    file: selector.file,
    line: selector.start.line,
    column: selector.start.column,
  };
}

// Removed: isJSXNode is now imported from core/ast-guards.js

/**
 * NodeSelector Implementation
 */
export class NodeSelector implements INodeSelector {
  private readonly selectorResolver = createSelectorResolver();

  /**
   * Select JSX nodes using a selector
   *
   * Supports:
   * - PositionSelector: Select a single node at a position
   * - PathSelector: Select a single node by path
   * - RangeSelector: Select multiple nodes within a range (Task 13)
   */
  selectNodes(
    ast: t.File,
    selector: Selector | RangeSelector
  ): Result<NodePath[], RegraffError> {
    // Task 13.2: Support RangeSelector
    if (isRangeSelector(selector)) {
      return this.selectNodesInRange(ast, selector);
    }

    // Use SelectorResolver to find the node
    const resolveResult = this.selectorResolver.resolveResult(selector, ast);

    if (!resolveResult.ok) {
      // Convert SelectorError to ExtractError
      return err(
        createExtractError(ExtractErrorCode.NODE_NOT_FOUND, {
          selector,
          file: selector.file,
          details: resolveResult.error.message,
        })
      );
    }

    const { path } = resolveResult.value;

    // Check if the node is a JSX-related node
    if (!isAnyJSXNode(path.node)) {
      return err(
        createExtractError(ExtractErrorCode.NOT_JSX_NODE, {
          selector,
          file: selector.file,
          details: `Node type "${path.node.type}" is not a JSX node. Only JSXElement and JSXFragment can be extracted.`,
        })
      );
    }

    // If the selected node is JSXText or JSXExpressionContainer, find parent JSXElement
    let extractablePath = path;
    if (!isJSXNode(path.node)) {
      // Navigate up to find nearest JSXElement or JSXFragment
      let current = path.parentPath;
      while (current) {
        if (isJSXNode(current.node)) {
          extractablePath = current;
          break;
        }
        current = current.parentPath;
      }

      // If we couldn't find a JSX parent, this is an error
      if (!isJSXNode(extractablePath.node)) {
        return err(
          createExtractError(ExtractErrorCode.NOT_JSX_NODE, {
            selector,
            file: selector.file,
            details: `Selected node "${path.node.type}" is not inside a JSXElement or JSXFragment.`,
          })
        );
      }
    }

    // Return the extractable JSX element
    return ok([extractablePath]);
  }

  /**
   * Validate that nodes are extractable
   *
   * Checks:
   * - Nodes array is not empty
   * - All nodes are JSX nodes
   * - Nodes are contiguous (for multi-node selection)
   * - Nodes have the same parent
   */
  validateExtractable(nodes: NodePath[]): Result<void, RegraffError> {
    // Check if nodes array is empty
    if (nodes.length === 0) {
      return err(
        createExtractError(ExtractErrorCode.INVALID_SELECTION, {
          details: 'No nodes selected for extraction.',
        })
      );
    }

    // Check that all nodes are JSX nodes
    for (const nodePath of nodes) {
      if (!isAnyJSXNode(nodePath.node)) {
        return err(
          createExtractError(ExtractErrorCode.NOT_JSX_NODE, {
            details: `Node type "${nodePath.node.type}" is not extractable. Only JSXElement, JSXText, and JSXExpressionContainer can be extracted.`,
          })
        );
      }
    }

    // For multi-node selection, check parent and contiguity
    if (nodes.length > 1) {
      const contiguityResult = this.validateContiguity(nodes);
      if (!contiguityResult.ok) {
        return contiguityResult;
      }
    }

    // All validations passed
    return ok(undefined);
  }

  private validateContiguity(nodes: NodePath[]): Result<void, RegraffError> {
    const [firstNode] = nodes;
    if (!firstNode) {
      return err(
        createExtractError(ExtractErrorCode.INVALID_SELECTION, {
          details: 'No nodes selected for extraction.',
        })
      );
    }

    const parent = firstNode.parent;
    if (!this.hasSameParent(nodes, parent)) {
      return err(
        createExtractError(ExtractErrorCode.DIFFERENT_PARENTS, {
          details: 'All selected nodes must have the same parent node.',
        })
      );
    }

    const children = this.getParentChildren(parent);
    if (children === null) {
      return ok(undefined);
    }

    const nodeIndices = nodes.map((node) => {
      const nodeToFind = node.node;
      if (!t.isJSXElement(nodeToFind) && !t.isJSXExpressionContainer(nodeToFind) && !t.isJSXFragment(nodeToFind) && !t.isJSXSpreadChild(nodeToFind) && !t.isJSXText(nodeToFind)) {
        return -1;
      }
      return children.indexOf(nodeToFind);
    });
    if (nodeIndices.some((index) => index < 0)) {
      return err(
        createExtractError(ExtractErrorCode.INVALID_SELECTION, {
          details: 'Selected nodes are not direct children of the same parent.',
        })
      );
    }

    const sortedIndices = [...nodeIndices].sort((a, b) => a - b);
    if (this.hasNonWhitespaceBetween(children, sortedIndices)) {
      return err(
        createExtractError(ExtractErrorCode.NON_CONTIGUOUS_NODES, {
          details: 'Selected nodes must be contiguous (appear consecutively in the parent, ignoring whitespace).',
        })
      );
    }

    return ok(undefined);
  }

  private hasSameParent(
    nodes: NodePath[],
    parent: t.Node | null | undefined
  ): boolean {
    for (const node of nodes.slice(1)) {
      if (node.parent !== parent) {
        return false;
      }
    }
    return true;
  }

  private getParentChildren(
    parent: t.Node | null | undefined
  ): t.JSXElement['children'] | null {
    if (!parent) {
      return null;
    }
    if (t.isJSXElement(parent) || t.isJSXFragment(parent)) {
      return parent.children;
    }
    return null;
  }

  private hasNonWhitespaceBetween(
    children: t.JSXElement['children'],
    sortedIndices: number[]
  ): boolean {
    for (let i = 1; i < sortedIndices.length; i++) {
      const prevIndex = sortedIndices[i - 1];
      const currIndex = sortedIndices[i];

      if (prevIndex === undefined || currIndex === undefined) {
        continue;
      }

      for (let j = prevIndex + 1; j < currIndex; j++) {
        const betweenNode = children[j];
        if (betweenNode === undefined || this.isWhitespaceJSXText(betweenNode)) {
          continue;
        }
        return true;
      }
    }
    return false;
  }

  private isWhitespaceJSXText(
    node: t.JSXElement['children'][number]
  ): boolean {
    return t.isJSXText(node) && node.value.trim().length === 0;
  }

  /**
   * Select nodes within a range (Task 13.2)
   *
   * @param ast - Parsed AST
   * @param selector - RangeSelector with start and end positions
   * @returns Result with array of NodePath or error
   */
  private selectNodesInRange(
    ast: t.File,
    selector: RangeSelector
  ): Result<NodePath[], RegraffError> {
    const selectedNodes: NodePath[] = [];

    // Helper to check if a position is within the range
    const isInRange = (
      line: number | null | undefined,
      column: number | null | undefined
    ): boolean => {
      if (line === null || line === undefined) return false;
      if (column === null || column === undefined) return false;

      const { start, end } = selector;

      // Check if position is after start
      const afterStart =
        line > start.line || (line === start.line && column >= start.column);

      // Check if position is before end
      const beforeEnd =
        line < end.line || (line === end.line && column <= end.column);

      return afterStart && beforeEnd;
    };

    // Traverse AST and collect nodes within range
    traverse(ast, {
      enter(path: NodePath<t.Node>) {
        const { node } = path;
        const { loc } = node;

        // Skip nodes without location
        if (!loc) return;

        // Check if node's start is in range
        const nodeStart = loc.start;
        if (isInRange(nodeStart.line, nodeStart.column)) {
          // Only collect JSX nodes
          if (isAnyJSXNode(node)) {
            // Skip whitespace-only JSXText nodes
            if (node.type === 'JSXText') {
              const textValue = node.value.trim();
              if (textValue.length === 0) {
                return; // Skip whitespace-only text nodes
              }
            }

            selectedNodes.push(path);
          }
        }
      },
    });

    // Filter to keep only top-level nodes (not nested within other selected nodes)
    const topLevelNodes = selectedNodes.filter((node) => {
      // Check if this node is a descendant of any other selected node
      return !selectedNodes.some((otherNode) => {
        if (otherNode === node) return false;

        // Check if node is a descendant of otherNode
        let current = node.parentPath;
        while (current) {
          if (current === otherNode) return true;
          current = current.parentPath;
        }
        return false;
      });
    });

    // If no nodes found, return error
    if (topLevelNodes.length === 0) {
      return err(
        createExtractError(ExtractErrorCode.NODE_NOT_FOUND, {
          selector: rangeToPositionSelector(selector),
          file: selector.file,
          details: 'No JSX nodes found within the specified range.',
        })
      );
    }

    // Validate selected nodes
    const validateResult = this.validateExtractable(topLevelNodes);
    if (!validateResult.ok) {
      return err(validateResult.error);
    }

    return ok(topLevelNodes);
  }
}

/**
 * Create a new NodeSelector instance
 */
export function createNodeSelector(): INodeSelector {
  return new NodeSelector();
}
