/**
 * InputValidator Tests
 *
 * Task 2.1: InputValidator 테스트 작성 - 기본 검증
 */

import { describe, it, expect } from 'vitest';
import type { FileInput, PositionSelector } from '../../types/public.js';
import type { ExtractOptions, RangeSelector } from '../types.js';
import { InputValidator } from '../input-validator.js';
import { ExtractErrorCode } from '../errors.js';

describe('InputValidator', () => {
  describe('validate', () => {
    it('빈 파일 목록을 검증하면 실패한다', () => {
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

    it('유효하지 않은 selector를 검증하면 실패한다', () => {
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
        // line과 column이 없음 (PositionSelector가 아님)
        // path도 없음 (PathSelector가 아님)
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

    it('유효한 입력을 검증하면 성공한다', () => {
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

    it('RangeSelector로 유효한 입력을 검증하면 성공한다', () => {
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
