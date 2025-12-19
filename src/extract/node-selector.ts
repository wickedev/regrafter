/**
 * NodeSelector Component
 *
 * Task 3.2: Basic NodeSelector implementation
 * Selects and validates JSX nodes for extraction
 */

import type { NodePath } from '@babel/traverse';
import traverse from '@babel/traverse';
import type * as t from '@babel/types';
import { createSelectorResolver } from '../selector/selector-resolver.js';
import { ok, err, type Result } from '../result/index.js';
import type { Selector, PositionSelector, PathSelector } from '../types/public.js';
import type { RangeSelector } from './types.js';
import type { RegraffError } from '../errors/error-category.js';
import { createExtractError, ExtractErrorCode } from './errors.js';

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
  return 'start' in selector && 'end' in selector;
}

/**
 * Check if a node is a JSX-related node
 */
function isJSXNode(node: t.Node): boolean {
  return (
    node.type === 'JSXElement' ||
    node.type === 'JSXText' ||
    node.type === 'JSXExpressionContainer' ||
    node.type === 'JSXFragment' ||
    node.type === 'JSXSpreadChild'
  );
}

/**
 * NodeSelector Implementation
 */
export class NodeSelector implements INodeSelector {
  private selectorResolver = createSelectorResolver();

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
    const resolveResult = this.selectorResolver.resolveResult(
      selector as Selector,
      ast
    );

    if (!resolveResult.ok) {
      // Convert SelectorError to ExtractError
      return err(
        createExtractError(ExtractErrorCode.NODE_NOT_FOUND, {
          selector: selector as Selector,
          file: selector.file,
          details: resolveResult.error.message,
        })
      );
    }

    const { path } = resolveResult.value;

    // Check if the node is a JSX node
    if (!isJSXNode(path.node)) {
      return err(
        createExtractError(ExtractErrorCode.NOT_JSX_NODE, {
          selector: selector as Selector,
          file: selector.file,
          details: `Node type "${path.node.type}" is not a JSX node. Only JSXElement, JSXText, and JSXExpressionContainer are supported.`,
        })
      );
    }

    // Return single node as array
    return ok([path]);
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
      if (!isJSXNode(nodePath.node)) {
        return err(
          createExtractError(ExtractErrorCode.NOT_JSX_NODE, {
            details: `Node type "${nodePath.node.type}" is not extractable. Only JSXElement, JSXText, and JSXExpressionContainer can be extracted.`,
          })
        );
      }
    }

    // For multi-node selection, check parent and contiguity
    if (nodes.length > 1) {
      const firstParent = nodes[0].parent;

      // Check all nodes have the same parent
      for (let i = 1; i < nodes.length; i++) {
        if (nodes[i].parent !== firstParent) {
          return err(
            createExtractError(ExtractErrorCode.DIFFERENT_PARENTS, {
              details: 'All selected nodes must have the same parent node.',
            })
          );
        }
      }

      // Check nodes are contiguous (appear consecutively in parent's children)
      // Allow whitespace-only JSXText nodes between selected nodes
      const parent = firstParent;
      if (parent && 'children' in parent) {
        const children = (parent as { children: unknown[] }).children;
        const nodeIndices = nodes.map((n) => children.indexOf(n.node));

        // Sort indices to check for gaps
        const sortedIndices = [...nodeIndices].sort((a, b) => a - b);

        // Check if there are non-whitespace nodes between selected nodes
        for (let i = 1; i < sortedIndices.length; i++) {
          const prevIndex = sortedIndices[i - 1];
          const currIndex = sortedIndices[i];

          // Check all nodes between prevIndex and currIndex
          for (let j = prevIndex + 1; j < currIndex; j++) {
            const betweenNode = children[j];

            // If it's a JSXText with only whitespace, skip it
            if (
              betweenNode &&
              typeof betweenNode === 'object' &&
              'type' in betweenNode &&
              betweenNode.type === 'JSXText' &&
              'value' in betweenNode &&
              typeof betweenNode.value === 'string'
            ) {
              const textValue = betweenNode.value.trim();
              if (textValue.length === 0) {
                continue; // Skip whitespace nodes
              }
            }

            // Found a non-whitespace node between selected nodes
            return err(
              createExtractError(ExtractErrorCode.NON_CONTIGUOUS_NODES, {
                details: 'Selected nodes must be contiguous (appear consecutively in the parent, ignoring whitespace).',
              })
            );
          }
        }
      }
    }

    // All validations passed
    return ok(undefined);
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
      enter(path) {
        const { node } = path;
        const { loc } = node;

        // Skip nodes without location
        if (!loc) return;

        // Check if node's start is in range
        const nodeStart = loc.start;
        if (isInRange(nodeStart.line, nodeStart.column)) {
          // Only collect JSX nodes
          if (isJSXNode(node)) {
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
          selector: selector as unknown as Selector,
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
