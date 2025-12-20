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
import { isAnyJSXNode } from '../core/index.js';
import { createSelectorError, type SelectorErrorType } from '../errors/error-category.js';
import { ok, err, type Result } from '../result/index.js';
import {
  isPositionSelector,
  isPathSelector,
  createResolveResult,
  createAtomicUnit,
  AtomicUnitType,
} from '../types/index.js';
import type {
  Selector,
  PositionSelector,
  PathSelector,
  ResolveResult,
  AtomicUnit,
} from '../types/index.js';
import { loadTraverseFunction } from '../utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

import {
  SelectorErrorCodes,
  type ISelectorResolver,
} from './types.js';

/**
 * Element data returned on successful selector resolution
 */
export interface ElementData {
  node: t.Node;
  path: NodePath;
  atomicUnit: AtomicUnit | null;
}

// Removed: isJSXNode is now imported from core/ast-guards.js

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
   * Resolve a selector to an AST node and path (legacy method)
   *
   * Automatically detects selector type and delegates to appropriate resolver.
   *
   * @param selector - Position or path-based selector
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with node, path, and atomic unit
   */
  resolve(selector: Selector, ast: t.File): ResolveResult {
    // Delegate to Result-based methods and convert back to legacy format
    const result = this.resolveResult(selector, ast);

    if (result.ok) {
      return createResolveResult({
        node: result.value.node,
        path: result.value.path,
        computeAtomicUnit: () => result.value.atomicUnit,
      });
    } else {
      // Convert SelectorErrorType to legacy SelectorError
      const error = result.error;
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-assertions */
        error: {
          message: error.message,
          code: error.code,
          location: error.location,
        } as any,
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-assertions */
      });
    }
  }

  /**
   * Resolve a selector to an AST node and path (Result-based)
   *
   * Automatically detects selector type and delegates to appropriate resolver.
   *
   * @param selector - Position or path-based selector
   * @param ast - Parsed AST of the file
   * @returns Result with ElementData or SelectorError
   */
  resolveResult(selector: Selector, ast: t.File): Result<ElementData, SelectorErrorType> {
    if (isPositionSelector(selector)) {
      return this.resolveByPositionResult(selector, ast);
    }

    if (isPathSelector(selector)) {
      return this.resolveByPathResult(selector, ast);
    }

    // Return Result type for invalid selector
    // TypeScript narrows selector to never here, but we cast to Selector for error handling
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const unknownSelector = selector as Selector;
    return err(createSelectorError({
      code: SelectorErrorCodes.INTERNAL_ERROR,
      message: 'Invalid selector type',
      selector: unknownSelector,
      file: unknownSelector.file,
    }));
  }

  /**
   * Finds the most specific (innermost) JSX element at the given position (legacy method).
   * Uses specificity scoring to prefer smaller, more precisely targeted nodes.
   *
   * @param selector - Position selector with line and column
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with resolved node or error
   */
  resolveByPosition(selector: PositionSelector, ast: t.File): ResolveResult {
    // Delegate to Result-based method and convert back to legacy format
    const result = this.resolveByPositionResult(selector, ast);

    if (result.ok) {
      return createResolveResult({
        node: result.value.node,
        path: result.value.path,
        computeAtomicUnit: () => result.value.atomicUnit,
      });
    } else {
      const error = result.error;
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-assertions */
        error: {
          message: error.message,
          code: error.code,
          location: error.location,
        } as any,
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-assertions */
      });
    }
  }

  /**
   * Finds the most specific (innermost) JSX element at the given position (Result-based).
   * Uses specificity scoring to prefer smaller, more precisely targeted nodes.
   *
   * @param selector - Position selector with line and column
   * @param ast - Parsed AST of the file
   * @returns Result with resolved ElementData or SelectorError
   */
  resolveByPositionResult(selector: PositionSelector, ast: t.File): Result<ElementData, SelectorErrorType> {
    const { line, column } = selector;

    // Validate position is positive
    if (line < 1 || column < 0) {
      return err(createSelectorError({
        code: SelectorErrorCodes.POSITION_OUT_OF_BOUNDS,
        message: `Invalid position: line ${line}, column ${column}. Line must be >= 1, column >= 0.`,
        selector,
        file: selector.file,
        location: {
          start: { line, column },
          end: { line, column },
        },
      }));
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
          // For atomic units (LogicalExpression, ConditionalExpression), always select the container
          // This ensures {condition && <Element />} and {cond ? <A /> : <B />} are treated as atomic units
          if (
            t.isLogicalExpression(expression) ||
            t.isConditionalExpression(expression) ||
            t.isJSXElement(expression) ||
            t.isJSXFragment(expression) ||
            t.isCallExpression(expression)
          ) {
            const spec = nodeSpecificity(node);
            if (found.path === null || spec < found.specificity) {
              found.node = node;
              found.path = path;
              found.specificity = spec;
            }
          } else if (!t.isJSXEmptyExpression(expression) && positionInNode(expression, line, column)) {
            // For other expressions, check if position is specifically in the inner expression
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
          }
        }
      },
    });

    // No JSX element found at position
    const matchedNode = found.node;
    const matchedPath = found.path;

    if (matchedNode === null || matchedPath === null) {
      return err(createSelectorError({
        code: SelectorErrorCodes.NO_JSX_AT_POSITION,
        message: `No JSX element found at line ${line}, column ${column}`,
        selector,
        file: selector.file,
        location: {
          start: { line, column },
          end: { line, column },
        },
      }));
    }

    // Compute atomic unit
    const atomicUnitType = determineAtomicUnitType(matchedPath);
    const atomicUnitNodes = getAtomicUnitNodes(matchedPath);
    const atomicUnit = createAtomicUnit({
      type: atomicUnitType,
      path: matchedPath,
      nodes: atomicUnitNodes,
    });

    // Return successful result
    return ok({
      node: matchedNode,
      path: matchedPath,
      atomicUnit,
    });
  }

  /**
   * Navigates the AST using a dot-notation path string (legacy method).
   * Supports array indexing with bracket notation.
   *
   * @param selector - Path selector with AST path
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with resolved node or error
   */
  resolveByPath(selector: PathSelector, ast: t.File): ResolveResult {
    // Delegate to Result-based method and convert back to legacy format
    const result = this.resolveByPathResult(selector, ast);

    if (result.ok) {
      return createResolveResult({
        node: result.value.node,
        path: result.value.path,
        computeAtomicUnit: () => result.value.atomicUnit,
      });
    } else {
      const error = result.error;
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-assertions */
        error: {
          message: error.message,
          code: error.code,
          location: error.location,
        } as any,
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-assertions */
      });
    }
  }

  /**
   * Navigates the AST using a dot-notation path string (Result-based).
   * Supports array indexing with bracket notation.
   *
   * @param selector - Path selector with AST path
   * @param ast - Parsed AST of the file
   * @returns Result with resolved ElementData or SelectorError
   */
  resolveByPathResult(selector: PathSelector, ast: t.File): Result<ElementData, SelectorErrorType> {
    const { path: pathStr } = selector;

    // Validate path format
    if (!pathStr || typeof pathStr !== 'string') {
      return err(createSelectorError({
        code: SelectorErrorCodes.INVALID_PATH_FORMAT,
        message: 'Invalid path format: path must be a non-empty string',
        selector,
        file: selector.file,
      }));
    }

    // Parse the path into segments
    const segments = parseASTPath(pathStr);
    if (segments.length === 0) {
      return err(createSelectorError({
        code: SelectorErrorCodes.INVALID_PATH_FORMAT,
        message: `Invalid path format: "${pathStr}" could not be parsed`,
        selector,
        file: selector.file,
      }));
    }

    // Navigate to the target node and get NodePath in one traversal
    const { node: targetNode, path: nodePath } = navigateToPathWithNodePath(ast, segments);
    if (!targetNode || !nodePath) {
      return err(createSelectorError({
        code: SelectorErrorCodes.PATH_NOT_FOUND,
        message: `Path not found: "${pathStr}" does not exist in the AST`,
        selector,
        file: selector.file,
      }));
    }

    // Verify the node is a JSX element (or related)
    if (!isAnyJSXNode(targetNode) && !t.isJSXElement(targetNode) && !t.isJSXFragment(targetNode)) {
      // For non-JSX nodes, we still allow them but mark as Element type
      // This enables moving expressions and other nodes
    }

    // Compute atomic unit
    const atomicUnitType = determineAtomicUnitType(nodePath);
    const atomicUnitNodes = getAtomicUnitNodes(nodePath);
    const atomicUnit = createAtomicUnit({
      type: atomicUnitType,
      path: nodePath,
      nodes: atomicUnitNodes,
    });

    // Return successful result
    return ok({
      node: targetNode,
      path: nodePath,
      atomicUnit,
    });
  }
}

/**
 * Create a new SelectorResolver instance
 */
export function createSelectorResolver(): SelectorResolver {
  return new SelectorResolver();
}
