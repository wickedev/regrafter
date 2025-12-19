/**
 * InputValidator
 *
 * Task 2.2: Basic InputValidator implementation
 * Responsible for input parameter validation
 */

import type { FileInput, Selector } from '../types/public.js';
import type { ExtractOptions, RangeSelector } from './types.js';
import type { Result } from '../result/types.js';
import type { RegraffError } from '../errors/error-category.js';
import type { IInputValidator } from './interfaces/i-input-validator.js';
import { ok, err } from '../result/types.js';
import { ExtractErrorCode, createExtractError } from './errors.js';

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
    options: ExtractOptions
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
    if (!this.isValidSelector(selector)) {
      return err(
        createExtractError(ExtractErrorCode.INVALID_SELECTOR, {
          selector: selector as Selector,
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
  private isValidSelector(selector: Selector | RangeSelector): boolean {
    if (!selector || typeof selector !== 'object') {
      return false;
    }

    // file property is required
    if (!('file' in selector) || typeof selector.file !== 'string') {
      return false;
    }

    // Check PositionSelector
    if ('line' in selector && 'column' in selector) {
      return (
        typeof selector.line === 'number' && typeof selector.column === 'number'
      );
    }

    // Check PathSelector
    if ('path' in selector) {
      return typeof selector.path === 'string';
    }

    // Check RangeSelector
    if ('start' in selector && 'end' in selector) {
      const rangeSelector = selector as RangeSelector;
      return (
        rangeSelector.start &&
        typeof rangeSelector.start.line === 'number' &&
        typeof rangeSelector.start.column === 'number' &&
        rangeSelector.end &&
        typeof rangeSelector.end.line === 'number' &&
        typeof rangeSelector.end.column === 'number'
      );
    }

    return false;
  }
}
