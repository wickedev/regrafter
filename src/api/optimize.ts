/**
 * Optimize API Implementation
 *
 * Optimizes files by sinking over-hoisted dependencies.
 * Analyzes dependency usage and moves declarations to their
 * optimal locations, removing unnecessary prop threading.
 *
 * @module api/optimize
 */

import type { RegraffError } from '../errors/index.js';
import { createOptimizer } from '../optimizer/optimizer.js';
import type { OptimizeOptions } from '../optimizer/types.js';
import type { Result } from '../result/index.js';
import type { Code, FileInput } from '../types/index.js';

/**
 * Optimize files by sinking over-hoisted dependencies.
 *
 * Analyzes dependency usage and moves declarations to their
 * optimal locations, removing unnecessary prop threading.
 *
 * @param files - Array of file inputs with path and content
 * @param options - Optional optimization options
 * @returns Result containing array of optimized file contents or error
 */
export function optimize(
  files: FileInput[],
  options?: OptimizeOptions
): Result<Code[], RegraffError> {
  const optimizer = createOptimizer();
  return optimizer.optimize(files, options);
}
