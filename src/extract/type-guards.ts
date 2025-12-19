/**
 * Type Guards for Extract Feature
 *
 * Task 22.2: 타입 가드 구현
 * Provides type guards for RangeSelector and ExtractResult
 */

import type { Selector } from '../types/public.js';
import type { RangeSelector, ExtractResult } from './types.js';
import { isOk, type Result, type Ok } from '../result/index.js';
import type { RegraffError } from '../errors/error-category.js';

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
  selector: Selector | RangeSelector | unknown
): selector is RangeSelector {
  // Check if selector is an object
  if (typeof selector !== 'object' || selector === null) {
    return false;
  }

  const obj = selector as Record<string, unknown>;

  // Must have 'file', 'start', and 'end' properties
  if (!('file' in obj) || !('start' in obj) || !('end' in obj)) {
    return false;
  }

  // Check start property structure
  const start = obj.start;
  if (typeof start !== 'object' || start === null) {
    return false;
  }

  const startObj = start as Record<string, unknown>;
  if (
    !('line' in startObj) ||
    !('column' in startObj) ||
    typeof startObj.line !== 'number' ||
    typeof startObj.column !== 'number'
  ) {
    return false;
  }

  // Check end property structure
  const end = obj.end;
  if (typeof end !== 'object' || end === null) {
    return false;
  }

  const endObj = end as Record<string, unknown>;
  if (
    !('line' in endObj) ||
    !('column' in endObj) ||
    typeof endObj.line !== 'number' ||
    typeof endObj.column !== 'number'
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
