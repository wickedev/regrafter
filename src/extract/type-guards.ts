/**
 * Type Guards for Extract Feature
 *
 * Task 22.2: Type guard implementation
 * Provides type guards for RangeSelector and ExtractResult
 */

import type { RegraffError } from '../errors/error-category.js';
import { isOk, type Ok, type Result } from '../result/index.js';

import type { ExtractResult, RangeSelector } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Type Guard: isRangeSelector
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type guard to check if a selector is a RangeSelector.
 *
 * A RangeSelector has the structure:
 * {
 *   file: string,
 *   start: { line: number, column: number },
 *   end: { line: number, column: number }
 * }
 *
 * This is different from PositionSelector (file, line, column)
 * and PathSelector (file, path).
 *
 * @param selector - The selector to check
 * @returns true if the selector is a RangeSelector
 *
 * @example
 * ```typescript
 * const rangeSelector = {
 *   file: 'test.tsx',
 *   start: { line: 1, column: 0 },
 *   end: { line: 5, column: 10 }
 * };
 *
 * if (isRangeSelector(rangeSelector)) {
 *   // TypeScript knows rangeSelector is RangeSelector
 *   console.log(rangeSelector.start.line);
 * }
 * ```
 */
export function isRangeSelector(
  selector: unknown
): selector is RangeSelector {
  // Check if selector is an object
  if (!isRecord(selector)) {
    return false;
  }

  // Must have 'file', 'start', and 'end' properties
  if (
    typeof selector.file !== 'string' ||
    !('start' in selector) ||
    !('end' in selector)
  ) {
    return false;
  }

  // Check start property structure
  const start = selector.start;
  if (!isRecord(start)) {
    return false;
  }

  if (
    !('line' in start) ||
    !('column' in start) ||
    typeof start.line !== 'number' ||
    typeof start.column !== 'number'
  ) {
    return false;
  }

  // Check end property structure
  const end = selector.end;
  if (!isRecord(end)) {
    return false;
  }

  if (
    !('line' in end) ||
    !('column' in end) ||
    typeof end.line !== 'number' ||
    typeof end.column !== 'number'
  ) {
    return false;
  }

  // All checks passed
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Type Guard: isExtractSuccess
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type guard to check if an extract result is successful.
 *
 * This is a convenience wrapper around the Result type's isOk guard,
 * specifically typed for ExtractResult.
 *
 * @param result - The Result to check
 * @returns true if the Result is Ok<ExtractResult>
 *
 * @example
 * ```typescript
 * const result = extract(files, selector, options);
 *
 * if (isExtractSuccess(result)) {
 *   // TypeScript knows result.value exists
 *   console.log(result.value.component.name);
 *   console.log(result.value.stats.nodesExtracted);
 * } else {
 *   // TypeScript knows result.error exists
 *   console.error(result.error.message);
 * }
 * ```
 */
export function isExtractSuccess(
  result: Result<ExtractResult, RegraffError>
): result is Ok<ExtractResult> {
  return isOk(result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
