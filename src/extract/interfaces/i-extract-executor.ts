/**
 * IExtractExecutor interface
 *
 * Executes an extraction plan
 */

import type * as t from '@babel/types';

import type { RegraffError } from '../../errors/error-category.js';
import type { Result } from '../../result/types.js';
import type { ExtractPlan } from '../types.js';

export interface IExtractExecutor {
  /**
   * Execute an extraction plan
   *
   * @param plan - Extraction plan
   * @param astMap - Map of file paths to ASTs
   * @returns Result with map of updated ASTs or error
   */
  execute(
    plan: ExtractPlan,
    astMap: Map<string, t.File>
  ): Result<Map<string, t.File>, RegraffError>;
}
