/**
 * Transformer Types
 *
 * Type definitions for the AST transformation operations.
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

/**
 * Error codes for transformer errors
 */
export const TransformerErrorCodes = {
  /** Source and target are the same element */
  SAME_ELEMENT: 'T001',
  /** Cannot move element into itself (would create circular structure) */
  CIRCULAR_MOVE: 'T002',
  /** Target does not support child elements */
  INVALID_TARGET: 'T003',
  /** Source element not found in AST */
  SOURCE_NOT_FOUND: 'T004',
  /** Target element not found in AST */
  TARGET_NOT_FOUND: 'T005',
  /** Cannot move outside valid JSX context */
  INVALID_CONTEXT: 'T006',
  /** Move would violate JSX structure rules */
  INVALID_JSX_STRUCTURE: 'T007',
  /** Source is not a valid JSX element */
  INVALID_SOURCE: 'T008',
  /** Target has no parent for sibling operations */
  NO_PARENT: 'T009',
  /** Internal transformation error */
  INTERNAL_ERROR: 'T099',
} as const;

export type TransformerErrorCode = (typeof TransformerErrorCodes)[keyof typeof TransformerErrorCodes];

/**
 * Result of a move operation
 */
export interface MoveResult {
  /** Whether the move was successful */
  success: boolean;
  /** The modified AST */
  ast: t.File;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  errorCode?: TransformerErrorCode;
  /** The moved node */
  movedNode?: t.Node;
  /** The new location of the moved node */
  newPath?: NodePath;
  /** Whether this was a no-op (source and target are same) */
  wasNoOp?: boolean;
}

/**
 * Options for move operations
 */
export interface MoveOptions {
  /** Whether to preserve comments on the moved node */
  preserveComments?: boolean;
  /** Position index for Move.Inside (default: append to end) */
  insertIndex?: number;
}

/**
 * Context for move operations
 */
export interface MoveContext {
  /** The AST being modified */
  ast: t.File;
  /** Source node path */
  sourcePath: NodePath;
  /** Target node path */
  targetPath: NodePath;
  /** Move options */
  options: Required<MoveOptions>;
}

/**
 * Default move options
 */
export const DEFAULT_MOVE_OPTIONS: Required<MoveOptions> = {
  preserveComments: true,
  insertIndex: -1, // -1 means append to end
};

/**
 * Merge move options with defaults
 */
export function mergeMoveOptions(options?: MoveOptions): Required<MoveOptions> {
  return {
    ...DEFAULT_MOVE_OPTIONS,
    ...options,
  };
}
