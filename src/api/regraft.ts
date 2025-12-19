/**
 * Regraft API Implementation
 *
 * Main entry point for the regraft operation.
 * Performs element relocation with automatic dependency analysis,
 * hoisting, and optional optimization.
 *
 * @module api/regraft
 */

import { validateMoveOperation } from '../analyzer/index.js';
import type { RegraffError } from '../errors/index.js';
import { createValidationError } from '../errors/index.js';
import { err, isErr, type Result } from '../result/index.js';
import { mergeOptions, createCode, createSuggestedFix } from '../types/index.js';
import type { Code, FileInput, Move, Options, Selector, SuggestedFix } from '../types/index.js';

import { analyze } from './analyze.js';
import { moveWithHoisting } from './move.js';
import { optimize } from './optimize.js';
import { createSuccessResult, createErrorFromException } from './result-helpers.js';
import type { TransformedCode } from './types.js';

/**
 * Main entry point for the regraft operation.
 *
 * **BREAKING CHANGE (v2.0.0)**: This function now returns `Result<TransformedCode, RegraffError>` directly
 * instead of the legacy `{ success: boolean, codes: Code[], analysis: MoveAnalysis }` format.
 *
 * Performs element relocation with automatic dependency analysis,
 * hoisting, and optional optimization.
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @param options - Optional configuration
 * @returns Result<TransformedCode, RegraffError> - Ok with transformed code or Err with error details
 *
 * @example
 * **New API (v2.0.0+)**
 * ```typescript
 * import { regraft, Move, isOk } from 'regrafter';
 *
 * const result = regraft(
 *   [{ path: 'App.tsx', content: sourceCode }],
 *   { file: 'App.tsx', line: 10, column: 5 },
 *   { file: 'App.tsx', line: 20, column: 5 },
 *   Move.Inside
 * );
 *
 * if (result.ok) {
 *   console.log('Transformed code:', result.value.codes[0].content);
 *   console.log('Analysis:', result.value.analysis);
 * } else {
 *   console.error('Error:', result.error.message);
 *   console.error('Suggestions:', result.error.suggestions);
 * }
 * ```
 *
 * @example
 * **Using type guards**
 * ```typescript
 * import { regraft, Move, isOk, isErr } from 'regrafter';
 *
 * const result = regraft(files, from, to, Move.Inside);
 *
 * if (isOk(result)) {
 *   // TypeScript knows result.value exists
 *   result.value.codes.forEach(code => console.log(code.file));
 * }
 *
 * if (isErr(result)) {
 *   // TypeScript knows result.error exists
 *   console.error(`[${result.error.code}] ${result.error.message}`);
 * }
 * ```
 *
 * @see {@link ./types.js!TransformedCode} for the return type
 * @see {@link ../errors/index.js!RegraffError} for the error type
 */
export function regraft(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result<TransformedCode, RegraffError> {
  const mergedOptions = mergeOptions(options);

  // Validate the move first
  const validation = validateMoveOperation(files, from, to, mode);

  if (!validation.valid) {
    // Return error result with reason
    return createErrorResult(
      validation.reason ?? 'Move validation failed',
      [],
      getSuggestedFixes(validation.errorCode)
    );
  }

  // If dryRun is enabled, return analysis without transformation
  if (mergedOptions.dryRun) {
    return createDryRunResult(files, from, to, mode);
  }

  // Execute the transformation
  return executeTransformation(files, from, to, mode, mergedOptions, validation);
}

/**
 * Get suggested fixes based on error code
 */
function getSuggestedFixes(errorCode?: string): SuggestedFix[] | undefined {
  // errorCode is string | undefined, so we only need to check for undefined and empty string
  if (errorCode === undefined || errorCode === '') return undefined;

  // Map error codes to suggested fixes
  const fixMap: Record<string, SuggestedFix[]> = {
    'CIRCULAR_MOVE': [
      createSuggestedFix({
        description: 'Move to a different target that is not a descendant of the source',
        action: 'select_different_target',
        automatic: false,
      }),
    ],
    'INVALID_SOURCE': [
      createSuggestedFix({
        description: 'Select a valid JSX element as the source',
        action: 'select_jsx_element',
        automatic: false,
      }),
    ],
    'INVALID_TARGET': [
      createSuggestedFix({
        description: 'Select a valid target location',
        action: 'select_valid_target',
        automatic: false,
      }),
    ],
  };

  return fixMap[errorCode];
}

/**
 * Create a dry run result (analysis only, no transformation)
 */
function createDryRunResult(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): Result<TransformedCode, RegraffError> {
  // Create unchanged code results
  const codes: Code[] = files.map(file =>
    createCode({
      file: file.path,
      content: file.content,
      changed: false,
    })
  );

  // Perform full dependency analysis using the analyze() function
  const analysisResult = analyze(files, from, to, mode);

  // If analysis failed, return error
  if (isErr(analysisResult)) {
    return err(analysisResult.error);
  }

  const analysis = analysisResult.value;

  // Return success with analysis
  return createSuccessResult(codes, analysis);
}

/**
 * Execute the transformation after validation
 */
function executeTransformation(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options: Required<Options>,
  _validation: unknown
): Result<TransformedCode, RegraffError> {
  try {
    // Perform dependency analysis
    const analysisResult = analyze(files, from, to, mode);

    // If analysis failed, return error
    if (isErr(analysisResult)) {
      return err(analysisResult.error);
    }

    const fullAnalysis = analysisResult.value;

    // Use the moveWithHoisting function for transformation with automatic hoisting
    const moveResult = moveWithHoisting(files, from, to, mode, {
      insertIndex: options.insertIndex,
      preserveComments: options.preserveComments,
    });

    if (isErr(moveResult)) {
      return err(moveResult.error);
    }

    let codes = moveResult.value;

    // Optionally run optimization
    if (options.optimize) {
      // Save original changed flags
      const originalChangedFlags = new Map<string, boolean>();
      for (const code of codes) {
        originalChangedFlags.set(code.file, code.changed);
      }

      // Convert codes back to FileInput format for optimizer
      const optimizeInput: FileInput[] = codes.map(code => ({
        path: code.file,
        content: code.content,
      }));

      // Run optimization
      const optimizeResult = optimize(optimizeInput);

      if (isErr(optimizeResult)) {
        return err(optimizeResult.error);
      }

      // Preserve original changed flags if optimizer didn't make changes
      codes = optimizeResult.value.map(code => ({
        ...code,
        changed: code.changed || (originalChangedFlags.get(code.file) ?? false),
      }));
    }

    // Return success with the real analysis
    return createSuccessResult(codes, fullAnalysis);
  } catch (error) {
    return createErrorFromException(error, {
      file: files[0]?.path,
      operation: 'transformation',
    });
  }
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
function createErrorResult(
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
