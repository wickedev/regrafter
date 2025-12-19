/**
 * Extract Feature Error Definitions
 *
 * Task 1.3: Error type definition
 * Defines all error codes and error creation utilities for extract feature
 */

import type { Selector, SuggestedFix } from '../types/public.js';
import type { SourceLocation } from '../types/internal.js';
import {
  ErrorCategory,
  ValidationError,
  SelectorError,
  DependencyError,
  TransformError,
  type RegraffError,
} from '../errors/error-category.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Error Codes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract feature specific error codes
 */
export enum ExtractErrorCode {
  // Validation errors
  EMPTY_INPUT = 'EMPTY_INPUT',
  INVALID_SELECTOR = 'INVALID_SELECTOR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  // Selection errors
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  INVALID_SELECTION = 'INVALID_SELECTION',
  NON_CONTIGUOUS_NODES = 'NON_CONTIGUOUS_NODES',
  DIFFERENT_PARENTS = 'DIFFERENT_PARENTS',
  NOT_JSX_NODE = 'NOT_JSX_NODE',

  // Dependency analysis errors
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  UNRESOLVABLE_DEPENDENCY = 'UNRESOLVABLE_DEPENDENCY',
  HOOK_RULE_VIOLATION = 'HOOK_RULE_VIOLATION',

  // Type inference errors
  TYPE_INFERENCE_FAILED = 'TYPE_INFERENCE_FAILED',
  COMPLEX_TYPE_UNSUPPORTED = 'COMPLEX_TYPE_UNSUPPORTED',

  // Name generation errors
  INVALID_COMPONENT_NAME = 'INVALID_COMPONENT_NAME',
  NAME_CONFLICT = 'NAME_CONFLICT',

  // Code generation errors
  COMPONENT_BUILD_FAILED = 'COMPONENT_BUILD_FAILED',
  CODE_GENERATION_FAILED = 'CODE_GENERATION_FAILED',
  INVALID_JSX_STRUCTURE = 'INVALID_JSX_STRUCTURE',

  // File operation errors
  FILE_WRITE_FAILED = 'FILE_WRITE_FAILED',
  FILE_READ_FAILED = 'FILE_READ_FAILED',
}

/**
 * Error code to message mapping
 */
export const ERROR_MESSAGES: Record<ExtractErrorCode, string> = {
  [ExtractErrorCode.EMPTY_INPUT]: 'File list is empty',
  [ExtractErrorCode.INVALID_SELECTOR]: 'Invalid selector',
  [ExtractErrorCode.FILE_NOT_FOUND]: 'File not found',
  [ExtractErrorCode.NODE_NOT_FOUND]: 'Node not found at specified location',
  [ExtractErrorCode.INVALID_SELECTION]: 'Selected node is not an extractable JSX node',
  [ExtractErrorCode.NON_CONTIGUOUS_NODES]: 'Selected nodes are not contiguous',
  [ExtractErrorCode.DIFFERENT_PARENTS]: 'Selected nodes have different parents',
  [ExtractErrorCode.NOT_JSX_NODE]: 'Only JSX nodes can be extracted',
  [ExtractErrorCode.CIRCULAR_DEPENDENCY]: 'Circular dependency detected',
  [ExtractErrorCode.UNRESOLVABLE_DEPENDENCY]: 'Unresolvable dependency found',
  [ExtractErrorCode.HOOK_RULE_VIOLATION]: 'React Hook rule violation detected',
  [ExtractErrorCode.TYPE_INFERENCE_FAILED]: 'Type inference failed',
  [ExtractErrorCode.COMPLEX_TYPE_UNSUPPORTED]: 'Unsupported complex type',
  [ExtractErrorCode.INVALID_COMPONENT_NAME]: 'Invalid component name',
  [ExtractErrorCode.NAME_CONFLICT]: 'Component with the same name already exists',
  [ExtractErrorCode.COMPONENT_BUILD_FAILED]: 'Component build failed',
  [ExtractErrorCode.CODE_GENERATION_FAILED]: 'Code generation failed',
  [ExtractErrorCode.INVALID_JSX_STRUCTURE]: 'Invalid JSX structure',
  [ExtractErrorCode.FILE_WRITE_FAILED]: 'File write failed',
  [ExtractErrorCode.FILE_READ_FAILED]: 'File read failed',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Error Creation Parameters
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract error creation parameters
 */
interface ExtractErrorParams {
  selector?: Selector;
  file?: string;
  location?: SourceLocation;
  suggestions?: SuggestedFix[];
  cause?: Error;
  details?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Error Creation Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract error creation function
 */
export function createExtractError(
  code: ExtractErrorCode,
  params: ExtractErrorParams
): RegraffError {
  const message = ERROR_MESSAGES[code];

  // Create error of appropriate category based on error code
  switch (code) {
    // Validation errors
    case ExtractErrorCode.EMPTY_INPUT:
    case ExtractErrorCode.FILE_NOT_FOUND:
      return new ValidationError({
        code,
        message,
        constraint: code,
        details: params.details ?? message,
        file: params.file,
        location: params.location,
        suggestions: params.suggestions,
        recoverable: false,
      });

    // Selection errors
    case ExtractErrorCode.INVALID_SELECTOR:
    case ExtractErrorCode.NODE_NOT_FOUND:
    case ExtractErrorCode.INVALID_SELECTION:
    case ExtractErrorCode.NON_CONTIGUOUS_NODES:
    case ExtractErrorCode.DIFFERENT_PARENTS:
    case ExtractErrorCode.NOT_JSX_NODE:
      return new SelectorError({
        code,
        message,
        selector: params.selector!,
        file: params.file ?? params.selector?.file ?? '',
        location: params.location,
        suggestions: params.suggestions,
      });

    // Dependency analysis errors
    case ExtractErrorCode.CIRCULAR_DEPENDENCY:
    case ExtractErrorCode.UNRESOLVABLE_DEPENDENCY:
    case ExtractErrorCode.HOOK_RULE_VIOLATION:
      return new DependencyError({
        code,
        message,
        unresolvableReason: params.details ?? message,
        file: params.file,
        location: params.location,
        suggestions: params.suggestions,
        recoverable: code !== ExtractErrorCode.HOOK_RULE_VIOLATION,
      });

    // Code generation errors
    case ExtractErrorCode.COMPONENT_BUILD_FAILED:
    case ExtractErrorCode.CODE_GENERATION_FAILED:
    case ExtractErrorCode.INVALID_JSX_STRUCTURE:
    case ExtractErrorCode.FILE_WRITE_FAILED:
    case ExtractErrorCode.FILE_READ_FAILED:
      return new TransformError({
        code,
        message,
        operation: code,
        file: params.file,
        location: params.location,
        suggestions: params.suggestions,
        cause: params.cause,
      });

    // Type inference and name generation errors
    case ExtractErrorCode.TYPE_INFERENCE_FAILED:
    case ExtractErrorCode.COMPLEX_TYPE_UNSUPPORTED:
    case ExtractErrorCode.INVALID_COMPONENT_NAME:
    case ExtractErrorCode.NAME_CONFLICT:
      return new ValidationError({
        code,
        message,
        constraint: code,
        details: params.details ?? message,
        file: params.file,
        location: params.location,
        suggestions: params.suggestions,
        recoverable: code === ExtractErrorCode.NAME_CONFLICT,
      });

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = code;
      return new ValidationError({
        code: _exhaustive,
        message: 'Unknown error',
        constraint: 'UNKNOWN',
        details: 'Unknown error occurred',
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Type Guards
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract error type guard
 */
export function isExtractError(error: unknown): error is RegraffError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as Partial<RegraffError>;
  return (
    'code' in err &&
    'message' in err &&
    'category' in err &&
    Object.values(ExtractErrorCode).includes(err.code as ExtractErrorCode)
  );
}
