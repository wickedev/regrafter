/**
 * API Result Helpers
 *
 * Helper functions for creating Result<T, E> values for the public API.
 *
 * @module api/result-helpers
 */

import type { RegraffError } from '../errors/index.js';
import { createInternalError, createValidationError } from '../errors/index.js';
import { ok, err, type Result } from '../result/index.js';
import type { Code, MoveAnalysis } from '../types/index.js';

import type { TransformedCode } from './types.js';

/**
 * Create a successful regraft result.
 *
 * @param codes - Array of transformed file codes
 * @param analysis - Move analysis information
 * @returns Ok<TransformedCode>
 */
export function createSuccessResult(
  codes: Code[],
  analysis: MoveAnalysis
): Result<TransformedCode, RegraffError> {
  const transformed: TransformedCode = {
    codes,
    analysis,
  };
  return ok(transformed);
}

/**
 * Create an error result from a message.
 *
 * @param message - Error message
 * @param codes - Codes array (usually empty for errors)
 * @param suggestedFixes - Optional suggested fixes
 * @param file - Optional file override
 * @returns Err<RegraffError>
 */
export function createErrorResult(
  message: string,
  codes?: Code[],
  suggestedFixes?: Array<{ description: string; action: string; automatic: boolean }>,
  file?: string
): Result<TransformedCode, RegraffError> {
  // Create a validation error for general failures
  const error: RegraffError = createValidationError({
    code: 'MOVE_FAILED',
    message,
    constraint: 'general',
    details: 'Move validation failed',
    file: file ?? codes?.[0]?.file ?? 'unknown',
    suggestions: suggestedFixes ?? [],
  });

  return err(error);
}

/**
 * Create an error result from a RegraffError.
 *
 * @param error - RegraffError instance
 * @returns Err<RegraffError>
 */
export function createErrorFromRegraffError(error: RegraffError): Result<TransformedCode, RegraffError> {
  return err(error);
}

/**
 * Create an error result from a caught exception.
 *
 * @param error - Caught exception
 * @param context - Optional context information
 * @returns Err<RegraffError>
 */
export function createErrorFromException(
  error: unknown,
  context?: { file?: string; operation?: string }
): Result<TransformedCode, RegraffError> {
  const message = error instanceof Error ? error.message : String(error);

  const internalError: RegraffError = createInternalError({
    code: 'INTERNAL_ERROR',
    message: `Internal error: ${message}`,
    file: context?.file ?? 'unknown',
    cause: error instanceof Error ? error : new Error(message),
  });

  return err(internalError);
}
