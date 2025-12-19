/**
 * Extract Public API
 *
 * Task 10.3: extract() API function implementation
 *
 * Requirements:
 * - 10.1: Require source file path as mandatory parameter
 * - 10.2: Require selector as mandatory parameter
 * - 10.7: Return generated component info and modified file list
 * - 10.8: Throw specific error object on failure
 */

import type { RegraffError } from '../errors/error-category.js';
import type { Result } from '../result/types.js';
import type { FileInput, Selector } from '../types/public.js';

import { ExtractOrchestrator } from './extract-orchestrator.js';
import type {
  ExtractOptions,
  ExtractResult,
  ExtractAnalysis,
  RangeSelector,
} from './types.js';

/**
 * Extract JSX nodes into a new component
 *
 * @param files - Array of file inputs
 * @param selector - Selector or RangeSelector to select JSX nodes
 * @param options - Extract options
 * @returns Result<ExtractResult, RegraffError>
 *
 * @example
 * // Extract within same file
 * const result = extract(
 *   [{ path: 'App.tsx', content: sourceCode }],
 *   { file: 'App.tsx', line: 10, column: 5 },
 *   { componentName: 'UserProfile' }
 * );
 *
 * @example
 * // Extract to different file
 * const result = extract(
 *   files,
 *   { file: 'App.tsx', line: 10, column: 5 },
 *   {
 *     componentName: 'UserProfile',
 *     targetFile: 'components/UserProfile.tsx'
 *   }
 * );
 *
 * @example
 * // Extract multiple nodes with range selection
 * const result = extract(
 *   files,
 *   {
 *     file: 'App.tsx',
 *     start: { line: 10, column: 5 },
 *     end: { line: 15, column: 20 }
 *   },
 *   { componentName: 'FormSection' }
 * );
 */
export function extract(
  files: FileInput[],
  selector: Selector | RangeSelector,
  options?: ExtractOptions
): Result<ExtractResult, RegraffError> {
  const orchestrator = new ExtractOrchestrator();
  return orchestrator.orchestrate(files, selector, options ?? {});
}

/**
 * Quickly check if extraction is possible (dry-run)
 *
 * Task 21.2: canExtract() function implementation
 *
 * @param files - Array of file inputs
 * @param selector - Selector or RangeSelector to select JSX nodes
 * @returns boolean - Whether extraction is possible
 *
 * Requirements:
 * - 10.7: Perform validation only and skip transformation
 *
 * @example
 * if (canExtract(files, selector)) {
 *   // Perform extraction
 *   const result = extract(files, selector, options);
 * }
 */
export function canExtract(
  files: FileInput[],
  selector: Selector | RangeSelector
): boolean {
  const orchestrator = new ExtractOrchestrator();
  const result = orchestrator.validate(files, selector);
  return result;
}

/**
 * Perform extraction analysis only (without transformation)
 *
 * Task 21.4: analyzeExtract() function implementation
 *
 * @param files - Array of file inputs
 * @param selector - Selector or RangeSelector to select JSX nodes
 * @returns Result<ExtractAnalysis, RegraffError>
 *
 * Requirements:
 * - 2.5: Perform dependency analysis only and skip code transformation
 *
 * @example
 * const analysis = analyzeExtract(files, selector);
 * if (analysis.ok) {
 *   console.log('Dependencies:', analysis.value.dependencies);
 *   console.log('Component name:', analysis.value.componentName);
 * }
 */
export function analyzeExtract(
  files: FileInput[],
  selector: Selector | RangeSelector
): Result<ExtractAnalysis, RegraffError> {
  const orchestrator = new ExtractOrchestrator();
  return orchestrator.analyze(files, selector);
}
