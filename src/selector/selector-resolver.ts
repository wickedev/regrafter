/**
 * Selector Resolver Component
 *
 * Resolves position-based and path-based selectors to AST nodes.
 * Handles JSX elements, expressions, and atomic units.
 *
 * Based on design.md section 3.5 Selector Resolver Component
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { detectCompoundComponent } from '../analyzer/index.js';
import {
  isPositionSelector,
  isPathSelector,
  createResolveResult,
  createSelectorError,
  createAtomicUnit,
  AtomicUnitType,
} from '../types/index.js';
import type {
  Selector,
  PositionSelector,
  PathSelector,
  ResolveResult,
} from '../types/index.js';
import { loadTraverseFunction } from '../utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

import {
  SelectorErrorCodes,
  type ISelectorResolver,
} from './types.js';

/**
 * Check if a node is a JSX element or expression container
 */
function isJSXNode(node: t.Node): boolean {
  return (
    t.isJSXElement(node) ||
    t.isJSXFragment(node) ||
    t.isJSXExpressionContainer(node) ||
    t.isJSXText(node) ||
    t.isJSXSpreadChild(node)
  );
}

/**
 * Check if a position falls within a node's source location
 */
function positionInNode(
  node: t.Node,
  line: number,
  column: number
): boolean {
  const loc = node.loc;
  if (loc === null || loc === undefined) return false;

  const { start, end } = loc;

  // Before start
  if (line < start.line) return false;
  if (line === start.line && column < start.column) return false;

  // After end
  if (line > end.line) return false;
  if (line === end.line && column > end.column) return false;

  return true;
}

/**
 * Calculate how specific a node match is (smaller nodes are more specific)
 */
function nodeSpecificity(node: t.Node): number {
  const loc = node.loc;
  if (loc === null || loc === undefined) return Infinity;

  const lines = loc.end.line - loc.start.line;
  const chars = loc.end.column - loc.start.column;

  // Combine line and column difference for specificity score
  // Lower score = more specific (smaller node)
  return lines * 1000 + chars;
}

/**
 * Determine the atomic unit type for a JSX node
 */
function determineAtomicUnitType(path: NodePath): AtomicUnitType {
  const node = path.node;
  const parent = path.parent;

  // Check if this is a map expression: {items.map(...)}
  if (
    t.isJSXExpressionContainer(parent) &&
    t.isCallExpression(node) &&
    t.isMemberExpression((node).callee)
  ) {
    const callee = (node).callee;
    if (
      t.isIdentifier(callee.property) &&
      callee.property.name === 'map'
    ) {
      return AtomicUnitType.MapExpression;
    }
  }

  // Check if wrapped in conditional expression: {cond && <E />}
  if (t.isLogicalExpression(parent) && parent.operator === '&&') {
    return AtomicUnitType.Conditional;
  }

  // Check if part of ternary expression: {cond ? <A /> : <B />}
  if (t.isConditionalExpression(parent)) {
    return AtomicUnitType.Ternary;
  }

  // Check if compound component: <Tabs.Panel>
  if (t.isJSXElement(node)) {
    const opening = (node).openingElement;
    if (t.isJSXMemberExpression(opening.name)) {
      return AtomicUnitType.CompoundComponent;
    }
  }

  // Default: single element
  return AtomicUnitType.Element;
}

/**
 * Get all nodes that make up an atomic unit
 */
function getAtomicUnitNodes(path: NodePath): t.Node[] {
  const node = path.node;

  // Check for compound component - use analyzer's logic for consistency
  if (t.isJSXElement(node)) {
    const compoundInfo = detectCompoundComponent(node);
    if (compoundInfo) {
      return compoundInfo.nodes;
    }
  }

  const nodes: t.Node[] = [path.node];

  // For conditional expressions, include the condition
  if (t.isLogicalExpression(path.parent) && path.parent.operator === '&&') {
    nodes.unshift(path.parent);
  }

  // For ternary expressions, include the full expression
  if (t.isConditionalExpression(path.parent)) {
    nodes.unshift(path.parent);
  }

  return nodes;
}

/**
 * Parse an AST path string into segments
 *
 * Supports paths like:
 * - "Program.body[0]"
 * - "Program.body[0].declaration.body.body[2]"
 */
function parseASTPath(pathStr: string): Array<{ key: string; index?: number }> {
  const segments: Array<{ key: string; index?: number }> = [];
  const regex = /(\w+)(?:\[(\d+)\])?/g;

  let match;
  while ((match = regex.exec(pathStr)) !== null) {
    const key = match[1];
    const index = match[2] !== undefined ? parseInt(match[2], 10) : undefined;
    if (key !== undefined && key !== '') {
      segments.push({ key, index });
    }
  }

  return segments;
}

/**
 * Type guard to check if an unknown value is a valid AST node
 */
function isASTNode(value: unknown): value is t.Node {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

/**
 * Navigate to a node using an AST path
 */
function navigateToPath(
  ast: t.File,
  pathSegments: Array<{ key: string; index?: number }>
): t.Node | null {
  // Start with the File node
  let current: unknown = ast;

  for (const segment of pathSegments) {
    if (current === null || current === undefined) {
      return null;
    }

    // Type guard: check if current is an object
    if (typeof current !== 'object') {
      return null;
    }

    // Access the property safely using Reflect API
    // After the typeof check, we know current is an object
    let next: unknown = Reflect.get(current, segment.key);

    // If index is specified, access array element
    if (segment.index !== undefined) {
      if (!Array.isArray(next)) {
        return null;
      }
      next = next[segment.index];
    }

    current = next;
  }

  // Use type guard to validate that current is a valid AST node
  if (!isASTNode(current)) {
    return null;
  }

  return current;
}

/**
 * Find NodePath for a given node in the AST
 */
function findNodePath(ast: t.File, targetNode: t.Node): NodePath | null {
  let foundPath: NodePath | null = null;

  traverse(ast, {
    enter(path: NodePath) {
      if (path.node === targetNode) {
        foundPath = path;
        path.stop();
      }
    },
  });

  return foundPath;
}

/**
 * Navigate to a node using an AST path and return both node and NodePath
 * Optimized to use property-based navigation first, then single traversal
 */
function navigateToPathWithNodePath(
  ast: t.File,
  pathSegments: Array<{ key: string; index?: number }>
): { node: t.Node | null; path: NodePath | null } {
  // Step 1: Fast property-based navigation to find the target node
  const targetNode = navigateToPath(ast, pathSegments);

  if (!targetNode) {
    return { node: null, path: null };
  }

  // Step 2: Single traversal to find NodePath
  // Optimization: use early exit when found
  const nodePath = findNodePath(ast, targetNode);

  return {
    node: targetNode,
    path: nodePath,
  };
}

/**
 * SelectorResolver class
 *
 * Resolves position-based and path-based selectors to AST nodes.
 *
 * Features:
 * - Position resolution: finds the most specific JSX element at line/column
 * - Path resolution: navigates AST using dot notation paths
 * - Atomic unit detection: identifies conditionals, maps, ternaries
 * - Comprehensive error handling with error codes
 */
export class SelectorResolver implements ISelectorResolver {
  /**
   * Resolve a selector to an AST node and path
   *
   * Automatically detects selector type and delegates to appropriate resolver.
   *
   * @param selector - Position or path-based selector
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with node, path, and atomic unit
   */
  resolve(selector: Selector, ast: t.File): ResolveResult {
    if (isPositionSelector(selector)) {
      return this.resolveByPosition(selector, ast);
    }

    if (isPathSelector(selector)) {
      return this.resolveByPath(selector, ast);
    }

    // Should never happen if types are correct
    return createResolveResult({
      node: null,
      path: null,
      atomicUnit: null,
      error: createSelectorError({
        message: 'Invalid selector type',
        code: SelectorErrorCodes.INTERNAL_ERROR,
      }),
    });
  }

  /**
   * Finds the most specific (innermost) JSX element at the given position.
   * Uses specificity scoring to prefer smaller, more precisely targeted nodes.
   *
   * @param selector - Position selector with line and column
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with resolved node or error
   */
  resolveByPosition(selector: PositionSelector, ast: t.File): ResolveResult {
    const { line, column } = selector;

    // Validate position is positive
    if (line < 1 || column < 0) {
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        error: createSelectorError({
          message: `Invalid position: line ${line}, column ${column}. Line must be >= 1, column >= 0.`,
          code: SelectorErrorCodes.POSITION_OUT_OF_BOUNDS,
          location: {
            start: { line, column },
            end: { line, column },
          },
        }),
      });
    }

    // Track the best matching JSX element or child node
    // Use specific NodePath types to avoid any type issues
    const found: {
      node: t.Node | null;
      path: NodePath | null;
      specificity: number;
    } = {
      node: null,
      path: null,
      specificity: Infinity,
    };

    // Traverse AST to find JSX elements at the position
    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        const node = path.node;
        if (positionInNode(node, line, column)) {
          const spec = nodeSpecificity(node);
          if (found.path === null || spec < found.specificity) {
            found.node = node;
            found.path = path;
            found.specificity = spec;
          }
        }
      },
      JSXFragment(path: NodePath<t.JSXFragment>) {
        const node = path.node;
        if (positionInNode(node, line, column)) {
          const spec = nodeSpecificity(node);
          if (found.path === null || spec < found.specificity) {
            found.node = node;
            found.path = path;
            found.specificity = spec;
          }
        }
      },
      JSXText(path: NodePath<t.JSXText>) {
        const node = path.node;
        if (positionInNode(node, line, column)) {
          const spec = nodeSpecificity(node);
          if (found.path === null || spec < found.specificity) {
            found.node = node;
            found.path = path;
            found.specificity = spec;
          }
        }
      },
      JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
        const node = path.node;
        const expression = node.expression;

        // Check if position is within the expression container
        if (positionInNode(node, line, column)) {
          // First, check if position is specifically in the inner expression
          if (!t.isJSXEmptyExpression(expression) && positionInNode(expression, line, column)) {
            const spec = nodeSpecificity(expression);
            if (found.path === null || spec < found.specificity) {
              // Find NodePath for the expression
              path.traverse({
                enter(innerPath: NodePath) {
                  if (innerPath.node === expression) {
                    found.node = expression;
                    found.path = innerPath;
                    found.specificity = spec;
                    innerPath.stop();
                  }
                }
              });
            }
          } else if (
            // Otherwise, match the container itself if it contains JSX-related expressions
            t.isJSXElement(expression) ||
            t.isJSXFragment(expression) ||
            t.isCallExpression(expression) ||
            t.isLogicalExpression(expression) ||  // For {condition && <Element />}
            t.isConditionalExpression(expression) // For {condition ? <A /> : <B />}
          ) {
            const spec = nodeSpecificity(node);
            if (found.path === null || spec < found.specificity) {
              found.node = node;
              found.path = path;
              found.specificity = spec;
            }
          }
        }
      },
    });

    // No JSX element found at position
    const matchedNode = found.node;
    const matchedPath = found.path;

    if (matchedNode === null || matchedPath === null) {
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        error: createSelectorError({
          message: `No JSX element found at line ${line}, column ${column}`,
          code: SelectorErrorCodes.NO_JSX_AT_POSITION,
          location: {
            start: { line, column },
            end: { line, column },
          },
        }),
      });
    }

    // Return result with lazy atomic unit computation
    return createResolveResult({
      node: matchedNode,
      path: matchedPath,
      computeAtomicUnit: () => {
        const atomicUnitType = determineAtomicUnitType(matchedPath);
        const atomicUnitNodes = getAtomicUnitNodes(matchedPath);
        return createAtomicUnit({
          type: atomicUnitType,
          path: matchedPath,
          nodes: atomicUnitNodes,
        });
      },
    });
  }

  /**
   * Navigates the AST using a dot-notation path string.
   * Supports array indexing with bracket notation.
   *
   * @param selector - Path selector with AST path
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with resolved node or error
   */
  resolveByPath(selector: PathSelector, ast: t.File): ResolveResult {
    const { path: pathStr } = selector;

    // Validate path format
    if (!pathStr || typeof pathStr !== 'string') {
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        error: createSelectorError({
          message: 'Invalid path format: path must be a non-empty string',
          code: SelectorErrorCodes.INVALID_PATH_FORMAT,
        }),
      });
    }

    // Parse the path into segments
    const segments = parseASTPath(pathStr);
    if (segments.length === 0) {
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        error: createSelectorError({
          message: `Invalid path format: "${pathStr}" could not be parsed`,
          code: SelectorErrorCodes.INVALID_PATH_FORMAT,
        }),
      });
    }

    // Navigate to the target node and get NodePath in one traversal
    const { node: targetNode, path: nodePath } = navigateToPathWithNodePath(ast, segments);
    if (!targetNode || !nodePath) {
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        error: createSelectorError({
          message: `Path not found: "${pathStr}" does not exist in the AST`,
          code: SelectorErrorCodes.PATH_NOT_FOUND,
        }),
      });
    }

    // Verify the node is a JSX element (or related)
    if (!isJSXNode(targetNode) && !t.isJSXElement(targetNode) && !t.isJSXFragment(targetNode)) {
      // For non-JSX nodes, we still allow them but mark as Element type
      // This enables moving expressions and other nodes
    }

    // Return result with lazy atomic unit computation
    return createResolveResult({
      node: targetNode,
      path: nodePath,
      computeAtomicUnit: () => {
        const atomicUnitType = determineAtomicUnitType(nodePath);
        const atomicUnitNodes = getAtomicUnitNodes(nodePath);
        return createAtomicUnit({
          type: atomicUnitType,
          path: nodePath,
          nodes: atomicUnitNodes,
        });
      },
    });
  }
}

/**
 * Create a new SelectorResolver instance
 */
export function createSelectorResolver(): SelectorResolver {
  return new SelectorResolver();
}
