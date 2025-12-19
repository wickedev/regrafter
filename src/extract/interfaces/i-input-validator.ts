/**
 * IInputValidator interface
 *
 * Validates input parameters for extract operations
 */

import type { Result } from '../../result/types.js';
import type { RegraffError } from '../../errors/error-category.js';
import type { FileInput, Selector } from '../../types/public.js';
import type { ExtractOptions, RangeSelector } from '../types.js';

export interface IInputValidator {
  /**
   * Validate input parameters for extract operation
   *
   * @param files - Array of file inputs
   * @param selector - Selector or RangeSelector to select JSX nodes
   * @param options - Extract options
   * @returns Result with void or error
   */
  validate(
    files: FileInput[],
    selector: Selector | RangeSelector,
    options?: ExtractOptions
  ): Result<void, RegraffError>;
}
