/**
 * Selector Validator
 *
 * Validates and resolves selectors (position and path-based) to AST nodes.
 * Handles selector normalization to JSXElement for consistent validation.
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { createResolveResult, createSelectorError } from '../../types/factories.js';
import type { ResolveResult } from '../../types/internal.js';
import type { Selector } from '../../types/public.js';
import { isPositionSelector, isPathSelector } from '../../types/public.js';
import { loadTraverseFunction, type TraverseFunction } from '../../utils/index.js';
import {
  detectAtomicUnit,
  isJSXNode,
} from '../atomic-unit-detector.js';

const traverse: TraverseFunction = loadTraverseFunction(traverseModule);

/**
 * Error codes for selector validation failures
 */
export enum SelectorValidationError {
  /** Invalid selector format */
  INVALID_SELECTOR = 'INVALID_SELECTOR',
  /** Selector could not be resolved to a node */
  NOT_FOUND = 'NOT_FOUND',
}

// ============================================================================
// Selector Resolution
// ============================================================================

/**
 * Resolve a selector to a NodePath in the AST
 */
export function resolveSelector(
  selector: Selector,
  ast: t.File,
  _filename: string
): ResolveResult {
  if (isPositionSelector(selector)) {
    return resolvePositionSelector(selector, ast);
  } else if (isPathSelector(selector)) {
    return resolvePathSelector(selector, ast);
  }

  return createResolveResult({
    node: null,
    path: null,
    atomicUnit: null,
    error: createSelectorError({
      message: 'Invalid selector format',
      code: SelectorValidationError.INVALID_SELECTOR,
    }),
  });
}

/**
 * Resolve a position-based selector (line/column)
 */
function resolvePositionSelector(
  selector: { line: number; column: number },
  ast: t.File
): ResolveResult {
  // Use object wrapper to avoid ESLint unnecessary-condition warning
  const found: { path: NodePath | null } = { path: null };

  traverse(ast, {
    enter(path: NodePath): void {
      const loc = path.node.loc;
      if (!loc) return;

      // Check if selector position is within this node's range
      const startLine = loc.start.line;
      const startCol = loc.start.column + 1; // Convert to 1-based
      const endLine = loc.end.line;
      const endCol = loc.end.column + 1;

      // Check if position is within bounds
      const afterStart =
        selector.line > startLine ||
        (selector.line === startLine && selector.column >= startCol);
      const beforeEnd =
        selector.line < endLine ||
        (selector.line === endLine && selector.column <= endCol);

      if (afterStart && beforeEnd) {
        // Prefer the most specific (deepest) node
        if (found.path === null || isMoreSpecific(path, found.path)) {
          found.path = path;
        }
      }
    },
  });

  // Extract found path from wrapper
  const foundPath = found.path;
  if (foundPath === null) {
    return createResolveResult({
      node: null,
      path: null,
      atomicUnit: null,
      error: createSelectorError({
        message: `No element found at position ${selector.line}:${selector.column}`,
        code: SelectorValidationError.NOT_FOUND,
        location: {
          start: { line: selector.line, column: selector.column },
          end: { line: selector.line, column: selector.column },
        },
      }),
    });
  }

  // Detect atomic unit
  const atomicUnit = detectAtomicUnit(foundPath);

  // Extract node from path - foundPath.node may be typed as any by Babel
  // We verify it's a valid Node using t.isNode
  let node: t.Node | null = null;
  const pathNodeValue: unknown = foundPath.node;
  if (pathNodeValue !== null && pathNodeValue !== undefined && t.isNode(pathNodeValue)) {
    node = pathNodeValue;
  }

  if (node === null) {
    return createResolveResult({
      node: null,
      path: null,
      atomicUnit: null,
      error: createSelectorError({
        message: `Found path does not contain a valid node`,
        code: SelectorValidationError.NOT_FOUND,
      }),
    });
  }

  return createResolveResult({
    node,
    path: foundPath,
    atomicUnit,
  });
}

/**
 * Resolve a path-based selector (AST path)
 */
function resolvePathSelector(
  selector: { path: string },
  ast: t.File
): ResolveResult {
  try {
    const pathParts = parseASTPath(selector.path);
    let current: unknown = ast;

    // Use traverse to get the NodePath for the root
    const programPathWrapper: { path: NodePath | null } = { path: null };
    traverse(ast, {
      Program(path: NodePath<t.Program>): void {
        programPathWrapper.path = path;
      },
    });

    // Program visitor always executes, extract the path
    const currentPath = programPathWrapper.path;
    if (currentPath === null) {
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        error: createSelectorError({
          message: 'Failed to find Program node in AST',
          code: SelectorValidationError.NOT_FOUND,
        }),
      });
    }

    for (const part of pathParts) {
      if (current === null || current === undefined) {
        return createResolveResult({
          node: null,
          path: null,
          atomicUnit: null,
          error: createSelectorError({
            message: `Path segment '${part.key}' not found`,
            code: SelectorValidationError.NOT_FOUND,
          }),
        });
      }

      if (typeof current !== 'object') {
        return createResolveResult({
          node: null,
          path: null,
          atomicUnit: null,
          error: createSelectorError({
            message: `Path segment '${part.key}' does not refer to an object`,
            code: SelectorValidationError.NOT_FOUND,
          }),
        });
      }

      // At this point, current is an object (and not null due to previous check)
      // Use Reflect.get to access properties dynamically without type assertions
      if (part.index !== undefined) {
        // Array access
        if (!(part.key in current)) {
          return createResolveResult({
            node: null,
            path: null,
            atomicUnit: null,
            error: createSelectorError({
              message: `Property '${part.key}' not found`,
              code: SelectorValidationError.NOT_FOUND,
            }),
          });
        }
        const property: unknown = Reflect.get(current, part.key);
        if (!Array.isArray(property)) {
          return createResolveResult({
            node: null,
            path: null,
            atomicUnit: null,
            error: createSelectorError({
              message: `'${part.key}' is not an array`,
              code: SelectorValidationError.NOT_FOUND,
            }),
          });
        }
        current = property[part.index];
      } else {
        // Property access
        if (!(part.key in current)) {
          return createResolveResult({
            node: null,
            path: null,
            atomicUnit: null,
            error: createSelectorError({
              message: `Property '${part.key}' not found`,
              code: SelectorValidationError.NOT_FOUND,
            }),
          });
        }
        current = Reflect.get(current, part.key);
      }
    }

    if (current === null || current === undefined || typeof current !== 'object' || !('type' in current)) {
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        error: createSelectorError({
          message: 'Path does not resolve to an AST node',
          code: SelectorValidationError.NOT_FOUND,
        }),
      });
    }

    if (!t.isNode(current)) {
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        error: createSelectorError({
          message: 'Path does not resolve to a valid AST node',
          code: SelectorValidationError.NOT_FOUND,
        }),
      });
    }

    const node = current;

    // Find the NodePath for this node
    // currentPath is guaranteed to be non-null at this point
    let resolvedPath: NodePath = currentPath;
    traverse(ast, {
      enter(path: NodePath): void {
        if (path.node === node) {
          resolvedPath = path;
          path.stop();
        }
      },
    });

    // resolvedPath is always non-null (initialized to currentPath)
    // Detect atomic unit
    const atomicUnit = detectAtomicUnit(resolvedPath);

    return createResolveResult({
      node,
      path: resolvedPath,
      atomicUnit,
    });
  } catch (error) {
    return createResolveResult({
      node: null,
      path: null,
      atomicUnit: null,
      error: createSelectorError({
        message: `Failed to resolve path: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: SelectorValidationError.NOT_FOUND,
      }),
    });
  }
}

/**
 * Parse an AST path string into parts
 */
function parseASTPath(path: string): Array<{ key: string; index?: number }> {
  const parts: Array<{ key: string; index?: number }> = [];
  const regex = /(\w+)(?:\[(\d+)\])?/g;
  let match;

  while ((match = regex.exec(path)) !== null) {
    const key = match[1];
    if (key === undefined) {
      continue;
    }
    parts.push({
      key,
      index: match[2] !== undefined ? parseInt(match[2], 10) : undefined,
    });
  }

  return parts;
}

/**
 * Check if path1 is more specific (deeper) than path2
 */
function isMoreSpecific(path1: NodePath, path2: NodePath): boolean {
  // A JSX element is more specific than a non-JSX element at the same level
  if (isJSXNode(path1.node) && !isJSXNode(path2.node)) {
    return true;
  }

  // Count depth by walking up to root
  let depth1 = 0;
  let depth2 = 0;

  let current: NodePath | null = path1;
  while (current) {
    depth1++;
    current = current.parentPath;
  }

  current = path2;
  while (current) {
    depth2++;
    current = current.parentPath;
  }

  return depth1 > depth2;
}

/**
 * Normalize a resolved result to its nearest JSXElement ancestor.
 * This ensures validation rules work with consistent node types.
 */
export function normalizeToJSXElement(result: ResolveResult): ResolveResult {
  if (!result.path || !result.node) {
    return result;
  }

  // If already a JSXElement, return as-is
  if (result.node.type === 'JSXElement') {
    return result;
  }

  // Walk up to find nearest JSXElement
  let current: NodePath | null = result.path;
  while (current) {
    if (current.node.type === 'JSXElement') {
      // Update the result to point to the JSXElement
      return createResolveResult({
        node: current.node,
        path: current,
        atomicUnit: result.atomicUnit, // Keep the original atomic unit
        error: result.error,
      });
    }
    current = current.parentPath;
  }

  // No JSXElement ancestor found, return original
  return result;
}
