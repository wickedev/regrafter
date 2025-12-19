/**
 * Extract Errors Test
 *
 * Tests for extract feature error definitions
 * Task 1.3: 에러 타입 정의
 */

import { describe, it, expect } from 'vitest';
import {
  ExtractErrorCode,
  ERROR_MESSAGES,
  createExtractError,
  isExtractError,
} from '../errors.js';
import { ErrorCategory } from '../../errors/error-category.js';

describe('Extract Errors', () => {
  describe('ExtractErrorCode', () => {
    it('should define EMPTY_INPUT error code', () => {
      expect(ExtractErrorCode.EMPTY_INPUT).toBe('EMPTY_INPUT');
    });

    it('should define INVALID_SELECTOR error code', () => {
      expect(ExtractErrorCode.INVALID_SELECTOR).toBe('INVALID_SELECTOR');
    });

    it('should define FILE_NOT_FOUND error code', () => {
      expect(ExtractErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    });

    it('should define NODE_NOT_FOUND error code', () => {
      expect(ExtractErrorCode.NODE_NOT_FOUND).toBe('NODE_NOT_FOUND');
    });

    it('should define INVALID_SELECTION error code', () => {
      expect(ExtractErrorCode.INVALID_SELECTION).toBe('INVALID_SELECTION');
    });

    it('should define NON_CONTIGUOUS_NODES error code', () => {
      expect(ExtractErrorCode.NON_CONTIGUOUS_NODES).toBe('NON_CONTIGUOUS_NODES');
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have message for EMPTY_INPUT', () => {
      const message = ERROR_MESSAGES[ExtractErrorCode.EMPTY_INPUT];
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should have message for INVALID_SELECTOR', () => {
      const message = ERROR_MESSAGES[ExtractErrorCode.INVALID_SELECTOR];
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('should have message for FILE_NOT_FOUND', () => {
      const message = ERROR_MESSAGES[ExtractErrorCode.FILE_NOT_FOUND];
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('should have message for all error codes', () => {
      const codes = Object.values(ExtractErrorCode);
      codes.forEach(code => {
        expect(ERROR_MESSAGES[code]).toBeDefined();
        expect(typeof ERROR_MESSAGES[code]).toBe('string');
      });
    });
  });

  describe('createExtractError', () => {
    it('should create validation error for EMPTY_INPUT', () => {
      const error = createExtractError(ExtractErrorCode.EMPTY_INPUT, {});

      expect(error).toBeDefined();
      expect(error.code).toBe(ExtractErrorCode.EMPTY_INPUT);
      expect(error.message).toContain('파일 목록이 비어있습니다');
      expect(error.category).toBe(ErrorCategory.Validation);
    });

    it('should create selector error for INVALID_SELECTOR', () => {
      const error = createExtractError(ExtractErrorCode.INVALID_SELECTOR, {
        selector: { file: 'test.tsx', line: 1, column: 1 },
      });

      expect(error).toBeDefined();
      expect(error.code).toBe(ExtractErrorCode.INVALID_SELECTOR);
      expect(error.category).toBe(ErrorCategory.Selector);
    });

    it('should create selector error for NODE_NOT_FOUND', () => {
      const error = createExtractError(ExtractErrorCode.NODE_NOT_FOUND, {
        selector: { file: 'test.tsx', line: 10, column: 5 },
        file: 'test.tsx',
      });

      expect(error).toBeDefined();
      expect(error.code).toBe(ExtractErrorCode.NODE_NOT_FOUND);
      expect(error.message).toBeDefined();
    });

    it('should include suggestions when provided', () => {
      const error = createExtractError(ExtractErrorCode.INVALID_SELECTION, {
        selector: { file: 'test.tsx', line: 1, column: 1 },
        file: 'test.tsx',
        suggestions: [
          {
            description: 'Select a valid JSX element',
            action: 'select_jsx',
            automatic: false,
          },
        ],
      });

      expect(error.suggestions).toBeDefined();
      expect(error.suggestions).toHaveLength(1);
      expect(error.suggestions![0].description).toBe('Select a valid JSX element');
    });
  });

  describe('isExtractError', () => {
    it('should return true for extract error', () => {
      const error = createExtractError(ExtractErrorCode.EMPTY_INPUT, {});
      expect(isExtractError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('test');
      expect(isExtractError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isExtractError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isExtractError(undefined)).toBe(false);
    });
  });
});
