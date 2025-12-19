/**
 * InputValidator
 *
 * Task 2.2: Basic InputValidator implementation
 * Responsible for input parameter validation
 */

import type { RegraffError } from '../errors/error-category.js';
import { ok, err, type Result } from '../result/types.js';
import type { FileInput, Selector } from '../types/public.js';

import { ExtractErrorCode, createExtractError } from './errors.js';
import type { IInputValidator } from './interfaces/i-input-validator.js';
import type { ExtractOptions, RangeSelector } from './types.js';

/**
 * InputValidator implementation
 */
export class InputValidator implements IInputValidator {
  /**
   * Validate input parameters
   *
   * @param files - Array of file inputs
   * @param selector - Selector or RangeSelector
   * @param options - Extract options
   * @returns Result<void, RegraffError>
   */
  validate(
    files: FileInput[],
    selector: Selector | RangeSelector,
    _options?: ExtractOptions
  ): Result<void, RegraffError> {
    // 1. Validate empty file list
    if (files.length === 0) {
      return err(
        createExtractError(ExtractErrorCode.EMPTY_INPUT, {
          details: 'File list is empty',
        })
      );
    }

    // 2. Validate selector validity
    if (!this.isValidSelection(selector)) {
      return err(
        createExtractError(ExtractErrorCode.INVALID_SELECTOR, {
          selector: this.buildErrorSelector(selector),
          details: 'Invalid selector',
        })
      );
    }

    // 3. All validations passed
    return ok(undefined);
  }

  /**
   * Validate selector validity
   *
   * @param selector - selector to validate
   * @returns boolean - Whether valid
   */
  private isValidSelection(selector: Selector | RangeSelector): boolean {
    return (
      this.isPositionSelector(selector) ||
      this.isPathSelector(selector) ||
      this.isRangeSelector(selector)
    );
  }

  private isPositionSelector(
    selector: Selector | RangeSelector
  ): selector is Selector {
    return (
      'line' in selector &&
      'column' in selector &&
      typeof selector.file === 'string' &&
      typeof selector.line === 'number' &&
      typeof selector.column === 'number'
    );
  }

  private isPathSelector(
    selector: Selector | RangeSelector
  ): selector is Selector {
    return (
      'path' in selector &&
      typeof selector.file === 'string' &&
      typeof selector.path === 'string'
    );
  }

  private isRangeSelector(
    selector: Selector | RangeSelector
  ): selector is RangeSelector {
    if (!('start' in selector) || !('end' in selector)) {
      return false;
    }
    const start = selector.start;
    const end = selector.end;
    return (
      typeof selector.file === 'string' &&
      typeof start.line === 'number' &&
      typeof start.column === 'number' &&
      typeof end.line === 'number' &&
      typeof end.column === 'number'
    );
  }

  private buildErrorSelector(selector: Selector | RangeSelector): Selector {
    if (this.isPositionSelector(selector) || this.isPathSelector(selector)) {
      return selector;
    }
    if (this.isRangeSelector(selector)) {
      return {
        file: selector.file,
        line: selector.start.line,
        column: selector.start.column,
      };
    }
    return { file: '', line: 1, column: 1 };
  }
}
