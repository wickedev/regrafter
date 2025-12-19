/**
 * Extract Feature Error Definitions
 *
 * Task 1.3: Error type definition
 * Defines all error codes and error creation utilities for extract feature
 */

import {
  createDependencyError,
  createSelectorError,
  createTransformError,
  createValidationError,
  type RegraffError,
} from '../errors/error-category.js';
import type { SourceLocation } from '../types/internal.js';
import type { Selector, SuggestedFix } from '../types/public.js';

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

const VALIDATION_CODES: ExtractErrorCode[] = [
  ExtractErrorCode.EMPTY_INPUT,
  ExtractErrorCode.FILE_NOT_FOUND,
  ExtractErrorCode.TYPE_INFERENCE_FAILED,
  ExtractErrorCode.COMPLEX_TYPE_UNSUPPORTED,
  ExtractErrorCode.INVALID_COMPONENT_NAME,
  ExtractErrorCode.NAME_CONFLICT,
];

const SELECTOR_CODES: ExtractErrorCode[] = [
  ExtractErrorCode.INVALID_SELECTOR,
  ExtractErrorCode.NODE_NOT_FOUND,
  ExtractErrorCode.INVALID_SELECTION,
  ExtractErrorCode.NON_CONTIGUOUS_NODES,
  ExtractErrorCode.DIFFERENT_PARENTS,
  ExtractErrorCode.NOT_JSX_NODE,
];

const DEPENDENCY_CODES: ExtractErrorCode[] = [
  ExtractErrorCode.CIRCULAR_DEPENDENCY,
  ExtractErrorCode.UNRESOLVABLE_DEPENDENCY,
  ExtractErrorCode.HOOK_RULE_VIOLATION,
];

const TRANSFORM_CODES: ExtractErrorCode[] = [
  ExtractErrorCode.COMPONENT_BUILD_FAILED,
  ExtractErrorCode.CODE_GENERATION_FAILED,
  ExtractErrorCode.INVALID_JSX_STRUCTURE,
  ExtractErrorCode.FILE_WRITE_FAILED,
  ExtractErrorCode.FILE_READ_FAILED,
];

const VALIDATION_CODE_SET = new Set(VALIDATION_CODES);
const SELECTOR_CODE_SET = new Set(SELECTOR_CODES);
const DEPENDENCY_CODE_SET = new Set(DEPENDENCY_CODES);
const TRANSFORM_CODE_SET = new Set(TRANSFORM_CODES);
const ERROR_CODE_SET = new Set<string>(Object.values(ExtractErrorCode));

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
function createExtractValidationError(
  code: ExtractErrorCode,
  params: ExtractErrorParams,
  message: string
): RegraffError {
  return createValidationError({
    code,
    message,
    constraint: code,
    details: params.details ?? message,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions ?? [],
    recoverable: code === ExtractErrorCode.NAME_CONFLICT,
  });
}

function createExtractSelectorError(
  code: ExtractErrorCode,
  params: ExtractErrorParams,
  message: string
): RegraffError {
  const selector = params.selector ?? createFallbackSelector(params.file);
  const file = params.file ?? selector.file;

  return createSelectorError({
    code,
    message,
    selector,
    file,
    location: params.location,
    suggestions: params.suggestions,
  });
}

function createExtractDependencyError(
  code: ExtractErrorCode,
  params: ExtractErrorParams,
  message: string
): RegraffError {
  return createDependencyError({
    code,
    message,
    unresolvableReason: params.details ?? message,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions ?? [],
    recoverable: code !== ExtractErrorCode.HOOK_RULE_VIOLATION,
  });
}

function createExtractTransformError(
  code: ExtractErrorCode,
  params: ExtractErrorParams,
  message: string
): RegraffError {
  return createTransformError({
    code,
    message,
    operation: code,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions ?? [],
  });
}

function createFallbackSelector(file?: string): Selector {
  return {
    file: file ?? '',
    line: 1,
    column: 1,
  };
}

export function createExtractError(
  code: ExtractErrorCode,
  params: ExtractErrorParams
): RegraffError {
  const message = ERROR_MESSAGES[code];

  if (SELECTOR_CODE_SET.has(code)) {
    return createExtractSelectorError(code, params, message);
  }
  if (DEPENDENCY_CODE_SET.has(code)) {
    return createExtractDependencyError(code, params, message);
  }
  if (TRANSFORM_CODE_SET.has(code)) {
    return createExtractTransformError(code, params, message);
  }
  if (VALIDATION_CODE_SET.has(code)) {
    return createExtractValidationError(code, params, message);
  }

  return createValidationError({
    code,
    message: 'Unknown error',
    constraint: 'UNKNOWN',
    details: 'Unknown error occurred',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Type Guards
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract error type guard
 */
export function isExtractError(error: unknown): error is RegraffError {
  if (!isRecord(error)) {
    return false;
  }

  const code = error['code'];
  const message = error['message'];
  const category = error['category'];
  return (
    typeof code === 'string' &&
    typeof message === 'string' &&
    typeof category === 'string' &&
    ERROR_CODE_SET.has(code)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
