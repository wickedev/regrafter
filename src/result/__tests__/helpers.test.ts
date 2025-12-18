/**
 * Result Helper Functions Tests
 *
 * Tests for Result helper functions including unwrap operations and tryCatch for exception conversion.
 */

import { describe, it, expect } from 'vitest';
import { ok, err } from '../types.js';
import type { Result } from '../types.js';
import { unwrap, unwrapOr, unwrapOrElse, tryCatch, all } from '../helpers.js';

describe('unwrap() operation', () => {
  it('should extract value from Ok variant', () => {
    const result = ok(42);
    const value = unwrap(result);

    expect(value).toBe(42);
  });

  it('should extract string value from Ok variant', () => {
    const result = ok('success');
    const value = unwrap(result);

    expect(value).toBe('success');
  });

  it('should extract null value from Ok variant', () => {
    const result = ok(null);
    const value = unwrap(result);

    expect(value).toBe(null);
  });

  it('should extract undefined value from Ok variant', () => {
    const result = ok(undefined);
    const value = unwrap(result);

    expect(value).toBe(undefined);
  });

  it('should throw error when unwrapping Err variant', () => {
    const result = err('error message');

    expect(() => unwrap(result)).toThrow('Cannot unwrap Err variant');
  });

  it('should throw error with error message when unwrapping Err variant', () => {
    const result = err('custom error');

    expect(() => unwrap(result)).toThrow('Cannot unwrap Err variant: custom error');
  });

  it('should throw error with Error object when unwrapping Err variant', () => {
    const error = new Error('test error');
    const result = err(error);

    expect(() => unwrap(result)).toThrow('Cannot unwrap Err variant');
  });
});

describe('tryCatch() helper', () => {
  describe('successful execution', () => {
    it('should return Ok for successful function execution', () => {
      const result = tryCatch(() => 42);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should return Ok with string value', () => {
      const result = tryCatch(() => 'success');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('success');
      }
    });

    it('should return Ok with object value', () => {
      const obj = { id: 1, name: 'test' };
      const result = tryCatch(() => obj);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(obj);
      }
    });

    it('should return Ok with null value', () => {
      const result = tryCatch(() => null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }
    });

    it('should return Ok with undefined value', () => {
      const result = tryCatch(() => undefined);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(undefined);
      }
    });
  });

  describe('thrown exceptions', () => {
    it('should return Err for thrown Error exception', () => {
      const error = new Error('test error');
      const result = tryCatch(() => {
        throw error;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });

    it('should return Err for thrown string exception', () => {
      const result = tryCatch(() => {
        throw 'string error';
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // When a non-Error is thrown, it should be wrapped in an Error
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('string error');
      }
    });

    it('should return Err for thrown object exception', () => {
      const errorObj = { code: 'E001', message: 'custom error' };
      const result = tryCatch(() => {
        throw errorObj;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // When a non-Error is thrown, it should be wrapped in an Error
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain('E001');
        expect(result.error.message).toContain('custom error');
      }
    });

    it('should return Err for thrown number exception', () => {
      const result = tryCatch(() => {
        throw 42;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('42');
      }
    });

    it('should preserve original error message', () => {
      const errorMessage = 'original error message';
      const result = tryCatch(() => {
        throw new Error(errorMessage);
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe(errorMessage);
      }
    });

    it('should preserve error stack trace', () => {
      const error = new Error('test error');
      const result = tryCatch(() => {
        throw error;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.stack).toBeDefined();
        expect(result.error.stack).toBe(error.stack);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle function that returns Result', () => {
      const innerResult = ok(42);
      const result = tryCatch(() => innerResult);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(innerResult);
      }
    });

    it('should handle function with side effects', () => {
      let sideEffect = 0;
      const result = tryCatch(() => {
        sideEffect = 42;
        return sideEffect;
      });

      expect(result.ok).toBe(true);
      expect(sideEffect).toBe(42);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should handle function that throws after side effects', () => {
      let sideEffect = 0;
      const result = tryCatch(() => {
        sideEffect = 42;
        throw new Error('error after side effect');
      });

      expect(result.ok).toBe(false);
      expect(sideEffect).toBe(42);
    });
  });
});

describe('Result Combining Operations', () => {
  describe('all() operation', () => {
    it('should return Ok with array of values when all Results are Ok', () => {
      const results: Result<number, string>[] = [
        ok(1),
        ok(2),
        ok(3),
      ];

      const combined = all(results);

      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should return first Err when any Result is Err', () => {
      const results: Result<number, string>[] = [
        ok(1),
        err('error in second'),
        ok(3),
        err('error in fourth'),
      ];

      const combined = all(results);

      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        expect(combined.error).toBe('error in second');
      }
    });

    it('should return first Err when first Result is Err', () => {
      const results: Result<number, string>[] = [
        err('first error'),
        ok(2),
        ok(3),
      ];

      const combined = all(results);

      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        expect(combined.error).toBe('first error');
      }
    });

    it('should return first Err when last Result is Err', () => {
      const results: Result<number, string>[] = [
        ok(1),
        ok(2),
        err('last error'),
      ];

      const combined = all(results);

      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        expect(combined.error).toBe('last error');
      }
    });

    it('should handle empty array', () => {
      const results: Result<number, string>[] = [];

      const combined = all(results);

      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toEqual([]);
      }
    });

    it('should handle single Ok result', () => {
      const results: Result<number, string>[] = [ok(42)];

      const combined = all(results);

      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toEqual([42]);
      }
    });

    it('should handle single Err result', () => {
      const results: Result<number, string>[] = [err('single error')];

      const combined = all(results);

      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        expect(combined.error).toBe('single error');
      }
    });

    it('should maintain type safety with different value types', () => {
      type CustomValue = { id: number; name: string };
      type CustomError = { code: string; message: string };

      const results: Result<CustomValue, CustomError>[] = [
        ok({ id: 1, name: 'first' }),
        ok({ id: 2, name: 'second' }),
      ];

      const combined = all(results);

      expect(combined.ok).toBe(true);
      if (combined.ok) {
        const values: CustomValue[] = combined.value;
        expect(values).toHaveLength(2);
        expect(values[0].id).toBe(1);
        expect(values[1].name).toBe('second');
      }
    });

    it('should handle all Results being Err', () => {
      const results: Result<number, string>[] = [
        err('error 1'),
        err('error 2'),
        err('error 3'),
      ];

      const combined = all(results);

      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        // Should return first error
        expect(combined.error).toBe('error 1');
      }
    });
  });
});
