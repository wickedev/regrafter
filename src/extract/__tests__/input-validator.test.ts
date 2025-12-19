/**
 * InputValidator Tests
 *
 * Task 2.1: InputValidator test implementation - Basic validation
 */

import { describe, it, expect } from 'vitest';
import type { FileInput, PositionSelector } from '../../types/public.js';
import type { ExtractOptions, RangeSelector } from '../types.js';
import { InputValidator } from '../input-validator.js';
import { ExtractErrorCode } from '../errors.js';

describe('InputValidator', () => {
  describe('validate', () => {
    it('should fail when validating an empty file list', () => {
      // Arrange
      const validator = new InputValidator();
      const emptyFiles: FileInput[] = [];
      const selector: PositionSelector = {
        file: 'test.tsx',
        line: 1,
        column: 1,
      };
      const options: ExtractOptions = {};

      // Act
      const result = validator.validate(emptyFiles, selector, options);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ExtractErrorCode.EMPTY_INPUT);
      }
    });

    it('should fail when validating an invalid selector', () => {
      // Arrange
      const validator = new InputValidator();
      const files: FileInput[] = [
        {
          path: 'test.tsx',
          content: 'const x = 1;',
        },
      ];
      const invalidSelector = {
        file: 'test.tsx',
        // missing line and column (not a PositionSelector)
        // also missing path (not a PathSelector)
      } as unknown as PositionSelector;
      const options: ExtractOptions = {};

      // Act
      const result = validator.validate(files, invalidSelector, options);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ExtractErrorCode.INVALID_SELECTOR);
      }
    });

    it('should succeed when validating valid input', () => {
      // Arrange
      const validator = new InputValidator();
      const files: FileInput[] = [
        {
          path: 'test.tsx',
          content: 'const x = 1;',
        },
      ];
      const selector: PositionSelector = {
        file: 'test.tsx',
        line: 1,
        column: 1,
      };
      const options: ExtractOptions = {};

      // Act
      const result = validator.validate(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
    });

    it('should succeed when validating valid input with RangeSelector', () => {
      // Arrange
      const validator = new InputValidator();
      const files: FileInput[] = [
        {
          path: 'test.tsx',
          content: 'const x = 1;',
        },
      ];
      const rangeSelector: RangeSelector = {
        file: 'test.tsx',
        start: { line: 1, column: 1 },
        end: { line: 1, column: 10 },
      };
      const options: ExtractOptions = {};

      // Act
      const result = validator.validate(files, rangeSelector, options);

      // Assert
      expect(result.ok).toBe(true);
    });
  });
});
