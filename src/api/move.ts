/**
 * Move API Implementation
 *
 * Functions for moving JSX elements with automatic dependency analysis and hoisting.
 *
 * @module api/move
 */

import { DependencyAnalyzer, validateMoveOperation } from '../analyzer/index.js';
import type { RegraffError } from '../errors/index.js';
import { createValidationError } from '../errors/index.js';
import { createCodeGenerator } from '../generator/index.js';
import { err, isErr, type Result } from '../result/index.js';
import { createScopeManager } from '../scope/index.js';
import { createSelectorResolver } from '../selector/index.js';
import { createConfiguredHoistPlanner, createHoistExecutor } from '../strategies/index.js';
import { createJSXTransformer } from '../transformer/index.js';
import type { Code, FileInput, Move, Selector, Options, SuggestedFix } from '../types/index.js';
import { mergeOptions, createCode, createSuggestedFix } from '../types/index.js';

import { analyze } from './analyze.js';
import { createMoveTransformationPipeline } from './move-transformation-pipeline.js';
import { optimize } from './optimize.js';
import { createSuccessResult, createErrorFromException } from './result-helpers.js';
import type { TransformedCode } from './types.js';

/**
 * Check if an element can be moved to the target location.
 *
 * Performs validation without executing the transformation.
 * Use this for quick feedback in IDEs or before expensive operations.
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns true if the move is possible, false otherwise
 */
export function canMove(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): boolean {
  const validation = validateMoveOperation(files, from, to, mode);
  return validation.valid;
}

/**
 * Move a JSX element with automatic dependency management.
 *
 * This is the main API for moving React/JSX elements. It performs:
 * 1. Validation of the move operation
 * 2. Dependency analysis
 * 3. Element relocation with automatic hoisting
 * 4. Optional optimization (sinking over-hoisted dependencies)
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @param options - Optional configuration
 * @returns Result containing transformed code and analysis or error
 *
 * @example
 * ```typescript
 * import { move, Move, isOk } from 'regrafter';
 *
 * const result = move(
 *   [{ path: 'App.tsx', content: sourceCode }],
 *   { file: 'App.tsx', line: 10, column: 5 },
 *   { file: 'App.tsx', line: 20, column: 5 },
 *   Move.Inside
 * );
 *
 * if (result.ok) {
 *   console.log('Moved!', result.value.codes);
 * }
 * ```
 */
export function move(
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
 * Internal function: Move with hoisting integration
 *
 * Performs the complete transformation with dependency hoisting.
 * This is used internally by move() to execute the full pipeline.
 *
 * @internal
 */
function moveWithHoistingInternal(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: { insertIndex?: number; preserveComments?: boolean }
): Result<Code[], RegraffError> {
  // Create shared scope manager
  const scopeManager = createScopeManager();

  // Create pipeline with all dependencies
  const pipeline = createMoveTransformationPipeline(
    createSelectorResolver(),
    scopeManager,
    new DependencyAnalyzer(scopeManager), // Use same scope manager!
    createConfiguredHoistPlanner(),
    createHoistExecutor(),
    createJSXTransformer(),
    createCodeGenerator()
  );

  // Execute the transformation pipeline
  return pipeline.execute({ files, from, to, mode, options });
}

// =============================================================================
// Helper Functions for Main move() API
// =============================================================================

/**
 * Get suggested fixes based on error code
 */
function getSuggestedFixes(errorCode?: string): SuggestedFix[] | undefined {
  if (errorCode === undefined || errorCode === '') return undefined;

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
  const codes: Code[] = files.map(file =>
    createCode({
      file: file.path,
      content: file.content,
      changed: false,
    })
  );

  const analysisResult = analyze(files, from, to, mode);

  if (isErr(analysisResult)) {
    return err(analysisResult.error);
  }

  const analysis = analysisResult.value;

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
    const analysisResult = analyze(files, from, to, mode);

    if (isErr(analysisResult)) {
      return err(analysisResult.error);
    }

    const fullAnalysis = analysisResult.value;

    const moveResult = moveWithHoistingInternal(files, from, to, mode, {
      insertIndex: options.insertIndex,
      preserveComments: options.preserveComments,
    });

    if (isErr(moveResult)) {
      return err(moveResult.error);
    }

    let codes = moveResult.value;

    if (options.optimize) {
      const originalChangedFlags = new Map<string, boolean>();
      for (const code of codes) {
        originalChangedFlags.set(code.file, code.changed);
      }

      const optimizeInput: FileInput[] = codes.map(code => ({
        path: code.file,
        content: code.content,
      }));

      const optimizeResult = optimize(optimizeInput);

      if (isErr(optimizeResult)) {
        return err(optimizeResult.error);
      }

      codes = optimizeResult.value.map(code => ({
        ...code,
        changed: code.changed || (originalChangedFlags.get(code.file) ?? false),
      }));
    }

    return createSuccessResult(codes, fullAnalysis);
  } catch (error) {
    return createErrorFromException(error, {
      file: files[0]?.path,
      operation: 'transformation',
    });
  }
}

/**
 * Create an error result from a message
 */
function createErrorResult(
  message: string,
  codes?: Code[],
  suggestedFixes?: Array<{ description: string; action: string; automatic: boolean }>,
  file?: string
): Result<TransformedCode, RegraffError> {
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
