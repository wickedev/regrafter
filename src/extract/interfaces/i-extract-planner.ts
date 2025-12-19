/**
 * IExtractPlanner interface
 *
 * Plans the extraction of JSX nodes into a new component
 */

import type * as t from '@babel/types';
import type { Result } from '../../result/types.js';
import type { RegraffError } from '../../errors/error-category.js';
import type { FileInput, Selector } from '../../types/public.js';
import type { ExtractOptions, ExtractPlan, RangeSelector } from '../types.js';

export interface IExtractPlanner {
  /**
   * Create an extraction plan
   *
   * @param files - File inputs
   * @param asts - Parsed AST map
   * @param selector - Selector to locate JSX nodes
   * @param options - Extract options
   * @returns Result with ExtractPlan or error
   */
  plan(
    files: FileInput[],
    asts: Map<string, t.File>,
    selector: Selector | RangeSelector,
    options: ExtractOptions
  ): Result<ExtractPlan, RegraffError>;
}
