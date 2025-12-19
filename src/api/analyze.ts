/**
 * Analyze API Implementation
 *
 * Analyzes dependencies for a proposed move operation without transformation.
 * Useful for understanding what hoisting would be required.
 *
 * @module api/analyze
 */

import { createMoveAnalysisBuilder, validateMoveOperation } from '../analyzer/index.js';
import type { RegraffError } from '../errors/index.js';
import { createValidationError } from '../errors/index.js';
import { parseFile } from '../parser/parse-file.js';
import { err, isErr, ok, type Result } from '../result/index.js';
import { createScopeManager } from '../scope/index.js';
import { createSelectorResolver } from '../selector/index.js';
import type { FileInput, Move, MoveAnalysis, Selector } from '../types/index.js';

/**
 * Analyze dependencies for a proposed move operation.
 *
 * Returns detailed dependency analysis without performing transformation.
 * Useful for understanding what hoisting would be required.
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns Result containing detailed analysis of dependencies and hoisting requirements
 */
export function analyze(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): Result<MoveAnalysis, RegraffError> {
  const validation = validateMoveOperation(files, from, to, mode);

  if (!validation.valid) {
    return err(createValidationError({
      code: validation.errorCode ?? 'VALIDATION_FAILED',
      message: validation.reason ?? 'Move validation failed',
      constraint: 'move_validation',
      details: validation.reason ?? 'Move validation failed',
    }));
  }

  // Create required instances for dependency analysis
  const resolver = createSelectorResolver();

  // Note: HoistPlanner and strategies are available via ./strategies/index.js
  // for full dependency hoisting integration

  // Parse the source file
  const sourceFile = files.find(f => f.path === from.file);
  if (!sourceFile) {
    return err(createValidationError({
      code: 'FILE_NOT_FOUND',
      message: `Source file not found: ${from.file}`,
      constraint: 'file_exists',
      details: `The source file "${from.file}" could not be found in the provided files array`,
    }));
  }

  const parseResult = parseFile(sourceFile.path, sourceFile.content);
  if (isErr(parseResult)) {
    return err(parseResult.error);
  }

  // Resolve selectors
  const sourceResult = resolver.resolveResult(from, parseResult.value);
  if (isErr(sourceResult)) {
    return err(sourceResult.error);
  }

  const targetResult = resolver.resolveResult(to, parseResult.value);
  if (isErr(targetResult)) {
    return err(targetResult.error);
  }

  // Build scope tree and perform dependency analysis
  const scopeManager = createScopeManager();
  const analysisBuilder = createMoveAnalysisBuilder(scopeManager);
  analysisBuilder.setCurrentFile(from.file);

  // Perform full dependency analysis
  const analysis = analysisBuilder.analyze(parseResult.value, sourceResult.value.path, targetResult.value.path);
  return ok(analysis);
}
