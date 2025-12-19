/**
 * ICodeFormatter interface
 *
 * Formats code according to source file's style
 */

import type * as t from '@babel/types';
import type { Result } from '../../result/types.js';
import type { RegraffError } from '../../errors/error-category.js';

export interface ICodeFormatter {
  /**
   * Format an AST to code string
   *
   * @param ast - AST to format
   * @param originalContent - Original file content for style reference
   * @returns Result with formatted code or error
   */
  format(
    ast: t.File,
    originalContent: string
  ): Result<string, RegraffError>;
}
