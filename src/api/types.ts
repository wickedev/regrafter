/**
 * API Types for Result-based Public API
 *
 * This module defines the types returned by the public API after migration
 * to the Result<T, E> pattern (Task 17.2).
 *
 * @module api/types
 */

import type { RegraffError } from '../errors/index.js';
import type { Result } from '../result/index.js';
import type { Code, MoveAnalysis } from '../types/index.js';

/**
 * Successful transformation result containing transformed code and analysis.
 *
 * This is the success value (T) in Result<T, E> for the regraft API.
 *
 * @example
 * ```typescript
 * const result = regraft(files, from, to, Move.Inside);
 *
 * if (result.ok) {
 *   const transformed: TransformedCode = result.value;
 *   console.log('Transformed files:', transformed.codes);
 *   console.log('Analysis:', transformed.analysis);
 * }
 * ```
 */
export interface TransformedCode {
  /** Array of file contents (all input files + any new files) */
  codes: Code[];
  /** Detailed analysis of the move operation */
  analysis: MoveAnalysis;
}

/**
 * Result type returned by the regraft API.
 *
 * **BREAKING CHANGE**: The public API now returns Result<T, E> directly
 * instead of the legacy { success: boolean, ... } format.
 *
 * - **Ok<TransformedCode>**: Successful transformation with codes and analysis
 * - **Err<RegraffError>**: Error with detailed error information
 *
 * ## Migration Guide
 *
 * ### Before (Legacy API)
 * ```typescript
 * const result = regraft(files, from, to, Move.Inside);
 *
 * if (result.success) {
 *   console.log('Codes:', result.codes);
 *   console.log('Analysis:', result.analysis);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 *
 * ### After (New API)
 * ```typescript
 * const result = regraft(files, from, to, Move.Inside);
 *
 * if (result.ok) {
 *   console.log('Codes:', result.value.codes);
 *   console.log('Analysis:', result.value.analysis);
 * } else {
 *   console.error('Error:', result.error.message);
 *   console.error('Code:', result.error.code);
 *   console.error('Suggestions:', result.error.suggestions);
 * }
 * ```
 *
 * ## Type-Safe Access
 *
 * The Result type provides type-safe access through discriminated unions:
 *
 * ```typescript
 * import { isOk, isErr } from 'regrafter';
 *
 * const result = regraft(files, from, to, Move.Inside);
 *
 * // Using type guards
 * if (isOk(result)) {
 *   // TypeScript knows result.value exists
 *   result.value.codes.forEach(code => console.log(code.file));
 * }
 *
 * if (isErr(result)) {
 *   // TypeScript knows result.error exists
 *   console.error(result.error.message);
 * }
 * ```
 *
 * ## Error Handling
 *
 * Errors include comprehensive debugging information:
 *
 * ```typescript
 * if (!result.ok) {
 *   const error = result.error;
 *
 *   // Error type (discriminated via _tag)
 *   console.log('Type:', error._tag); // 'ParseError' | 'SelectorError' | ...
 *
 *   // Error code
 *   console.log('Code:', error.code); // 'E001', 'E002', etc.
 *
 *   // Human-readable message
 *   console.log('Message:', error.message);
 *
 *   // File context
 *   console.log('File:', error.file);
 *
 *   // Location (if available)
 *   if (error.location) {
 *     console.log('Line:', error.location.start.line);
 *   }
 *
 *   // Suggested fixes
 *   error.suggestions.forEach(fix => {
 *     console.log('Suggestion:', fix.description);
 *   });
 * }
 * ```
 *
 * @see {@link TransformedCode} for the success value type
 * @see {@link ../errors/index.js!RegraffError} for the error type
 * @see {@link ../result/index.js!Result} for the Result type definition
 */
