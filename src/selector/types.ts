/**
 * Selector Module Types
 *
 * Type definitions for selector resolution and error handling.
 */

import type * as t from '@babel/types';
import type {
  Selector,
  PositionSelector,
  PathSelector,
  AtomicUnit,
  SelectorError,
  ResolveResult,
} from '../types/index.js';

/**
 * Error codes for selector resolution errors
 */
export const SelectorErrorCodes = {
  /** File not found in provided files */
  FILE_NOT_FOUND: 'S001',
  /** No JSX element at the specified position */
  NO_JSX_AT_POSITION: 'S002',
  /** Invalid AST path format */
  INVALID_PATH_FORMAT: 'S003',
  /** AST path does not exist */
  PATH_NOT_FOUND: 'S004',
  /** Node at path is not a JSX element */
  NOT_JSX_ELEMENT: 'S005',
  /** Position is outside file bounds */
  POSITION_OUT_OF_BOUNDS: 'S006',
  /** Parse error prevented resolution */
  PARSE_ERROR: 'S007',
  /** Internal resolution error */
  INTERNAL_ERROR: 'S099',
} as const;

export type SelectorErrorCode = (typeof SelectorErrorCodes)[keyof typeof SelectorErrorCodes];

/**
 * Interface for the Selector Resolver
 */
export interface ISelectorResolver {
  /**
   * Resolve a selector to an AST node and path
   * @param selector - Position or path-based selector
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with node, path, and atomic unit
   */
  resolve(selector: Selector, ast: t.File): ResolveResult;

  /**
   * Resolve using position (line/column)
   * @param selector - Position selector with line and column
   * @param ast - Parsed AST of the file
   * @returns ResolveResult
   */
  resolveByPosition(selector: PositionSelector, ast: t.File): ResolveResult;

  /**
   * Resolve using AST path string
   * @param selector - Path selector with AST path
   * @param ast - Parsed AST of the file
   * @returns ResolveResult
   */
  resolveByPath(selector: PathSelector, ast: t.File): ResolveResult;
}

/**
 * Re-export types from main types module
 */
export type {
  Selector,
  PositionSelector,
  PathSelector,
  AtomicUnit,
  SelectorError,
  ResolveResult,
};
