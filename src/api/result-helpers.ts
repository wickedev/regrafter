/**
 * API Result Helpers
 *
 * Helper functions for creating Result<T, E> values for the public API.
 *
 * @module api/result-helpers
 */

import type { RegraffError } from '../errors/index.js';
import { createInternalError, createValidationError } from '../errors/index.js';
import { ok, err } from '../result/index.js';
import type { Code, MoveAnalysis } from '../types/index.js';

import type { RegraftResult, TransformedCode } from './types.js';

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
): RegraftResult {
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
): RegraftResult {
  // Create a validation error for general failures
  const error: RegraffError = createValidationError({
    code: 'MOVE_FAILED',
    message,
    rule: 'general',
    constraint: 'Move validation failed',
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
export function createErrorFromRegraffError(error: RegraffError): RegraftResult {
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
): RegraftResult {
  const message = error instanceof Error ? error.message : String(error);

  const internalError: RegraffError = createInternalError({
    code: 'INTERNAL_ERROR',
    message: `Internal error: ${message}`,
    file: context?.file ?? 'unknown',
    actualError: error instanceof Error ? error : new Error(message),
    context: context?.operation ?? 'regraft',
    suggestions: [],
  });

  return err(internalError);
}
