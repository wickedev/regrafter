/**
 * Result Helper Functions Tests
 *
 * Tests for Result helper functions including unwrap operations and tryCatch for exception conversion.
 */

import { describe, it, expect } from 'vitest';
import { ok, err } from '../types.js';
import type { Result } from '../types.js';
import { unwrap, unwrapOr, unwrapOrElse, tryCatch, tryCatchAsync, all, any } from '../helpers.js';

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

describe('unwrapOr() operation', () => {
  it('should extract value from Ok variant', () => {
    const result = ok(42);
    const value = unwrapOr(result, 0);

    expect(value).toBe(42);
  });

  it('should return default value for Err variant', () => {
    const result = err('error');
    const value = unwrapOr(result, 99);

    expect(value).toBe(99);
  });

  it('should work with string values', () => {
    const okResult = ok('success');
    const errResult = err('error');

    expect(unwrapOr(okResult, 'default')).toBe('success');
    expect(unwrapOr(errResult, 'default')).toBe('default');
  });

  it('should work with null values', () => {
    const okResult = ok(null);
    const errResult = err('error');

    expect(unwrapOr(okResult, 'default')).toBe(null);
    expect(unwrapOr(errResult, null)).toBe(null);
  });

  it('should work with undefined values', () => {
    const okResult = ok(undefined);
    const errResult = err('error');

    expect(unwrapOr(okResult, 'default')).toBe(undefined);
    expect(unwrapOr(errResult, undefined)).toBe(undefined);
  });

  it('should work with object values', () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const okResult = ok(obj1);
    const errResult = err('error');

    expect(unwrapOr(okResult, obj2)).toBe(obj1);
    expect(unwrapOr(errResult, obj2)).toBe(obj2);
  });

  it('should maintain type safety of default value', () => {
    const result: Result<number, string> = err('error');
    const value: number = unwrapOr(result, 42);

    expect(value).toBe(42);
  });
});

describe('unwrapOrElse() operation', () => {
  it('should extract value from Ok variant', () => {
    const result = ok(42);
    const value = unwrapOrElse(result, () => 0);

    expect(value).toBe(42);
  });

  it('should call function for Err variant', () => {
    const result = err('error');
    const value = unwrapOrElse(result, () => 99);

    expect(value).toBe(99);
  });

  it('should pass error to function', () => {
    const result = err('custom error');
    const value = unwrapOrElse(result, (e) => `Error: ${e}`);

    expect(value).toBe('Error: custom error');
  });

  it('should work with different error types', () => {
    const errorResult = err({ code: 'E001', message: 'test error' });
    const value = unwrapOrElse(errorResult, (e) => `Error ${e.code}: ${e.message}`);

    expect(value).toBe('Error E001: test error');
  });

  it('should not call function for Ok variant', () => {
    let called = false;
    const result = ok(42);

    unwrapOrElse(result, () => {
      called = true;
      return 0;
    });

    expect(called).toBe(false);
  });

  it('should handle complex transformations', () => {
    type AppError = { code: string; severity: number };
    const result: Result<number, AppError> = err({ code: 'E001', severity: 5 });

    const value = unwrapOrElse(result, (error) => {
      // Complex fallback logic based on error
      if (error.severity > 3) {
        return -1;
      }
      return 0;
    });

    expect(value).toBe(-1);
  });

  it('should work with null and undefined', () => {
    const okResult = ok(null);
    const errResult = err('error');

    expect(unwrapOrElse(okResult, () => 'default')).toBe(null);
    expect(unwrapOrElse(errResult, () => undefined)).toBe(undefined);
  });

  it('should maintain type safety', () => {
    const result: Result<number, string> = err('error');
    const value: number = unwrapOrElse(result, () => 42);

    expect(value).toBe(42);
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

describe('tryCatchAsync() helper', () => {
  describe('successful async execution', () => {
    it('should return Promise<Ok> for successful async operation', async () => {
      const result = await tryCatchAsync(async () => 42);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should return Promise<Ok> with string value', async () => {
      const result = await tryCatchAsync(async () => 'success');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('success');
      }
    });

    it('should return Promise<Ok> with object value', async () => {
      const obj = { id: 1, name: 'test' };
      const result = await tryCatchAsync(async () => obj);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(obj);
      }
    });

    it('should return Promise<Ok> with null value', async () => {
      const result = await tryCatchAsync(async () => null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }
    });

    it('should return Promise<Ok> with undefined value', async () => {
      const result = await tryCatchAsync(async () => undefined);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(undefined);
      }
    });

    it('should handle async operations with delays', async () => {
      const result = await tryCatchAsync(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'delayed result';
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('delayed result');
      }
    });
  });

  describe('rejected promises', () => {
    it('should return Promise<Err> for rejected promise with Error', async () => {
      const error = new Error('async error');
      const result = await tryCatchAsync(async () => {
        return Promise.reject(error);
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expect(result.error.message).toBe('async error');
      }
    });

    it('should return Promise<Err> for rejected promise with string', async () => {
      const result = await tryCatchAsync(async () => {
        return Promise.reject('string error');
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('string error');
      }
    });

    it('should return Promise<Err> for rejected promise with object', async () => {
      const errorObj = { code: 'E001', message: 'custom error' };
      const result = await tryCatchAsync(async () => {
        return Promise.reject(errorObj);
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain('E001');
        expect(result.error.message).toContain('custom error');
      }
    });

    it('should return Promise<Err> for rejected promise with number', async () => {
      const result = await tryCatchAsync(async () => {
        return Promise.reject(42);
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('42');
      }
    });
  });

  describe('thrown exceptions in async code', () => {
    it('should return Promise<Err> for thrown Error in async function', async () => {
      const error = new Error('thrown error');
      const result = await tryCatchAsync(async () => {
        throw error;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expect(result.error.message).toBe('thrown error');
      }
    });

    it('should return Promise<Err> for thrown string in async function', async () => {
      const result = await tryCatchAsync(async () => {
        throw 'string error';
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('string error');
      }
    });

    it('should return Promise<Err> for thrown object in async function', async () => {
      const errorObj = { code: 'E002', message: 'thrown object' };
      const result = await tryCatchAsync(async () => {
        throw errorObj;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain('E002');
        expect(result.error.message).toContain('thrown object');
      }
    });

    it('should handle errors thrown after async operations', async () => {
      const result = await tryCatchAsync(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('delayed error');
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('delayed error');
      }
    });
  });

  describe('error context preservation', () => {
    it('should preserve original error message', async () => {
      const errorMessage = 'original async error message';
      const result = await tryCatchAsync(async () => {
        throw new Error(errorMessage);
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe(errorMessage);
      }
    });

    it('should preserve error stack trace', async () => {
      const error = new Error('async error with stack');
      const result = await tryCatchAsync(async () => {
        throw error;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.stack).toBeDefined();
        expect(result.error.stack).toBe(error.stack);
      }
    });

    it('should preserve error properties for custom error types', async () => {
      class CustomError extends Error {
        code: string;
        constructor(message: string, code: string) {
          super(message);
          this.code = code;
          this.name = 'CustomError';
        }
      }

      const customError = new CustomError('custom message', 'E001');
      const result = await tryCatchAsync(async () => {
        throw customError;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(customError);
        expect(result.error).toBeInstanceOf(CustomError);
        if (result.error instanceof CustomError) {
          expect(result.error.code).toBe('E001');
          expect(result.error.message).toBe('custom message');
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle async function returning Result', async () => {
      const innerResult = ok(42);
      const result = await tryCatchAsync(async () => innerResult);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(innerResult);
      }
    });

    it('should handle async function with side effects', async () => {
      let sideEffect = 0;
      const result = await tryCatchAsync(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        sideEffect = 42;
        return sideEffect;
      });

      expect(result.ok).toBe(true);
      expect(sideEffect).toBe(42);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should handle async function that throws after side effects', async () => {
      let sideEffect = 0;
      const result = await tryCatchAsync(async () => {
        sideEffect = 42;
        throw new Error('error after side effect');
      });

      expect(result.ok).toBe(false);
      expect(sideEffect).toBe(42);
    });

    it('should handle chained promise operations', async () => {
      const result = await tryCatchAsync(async () => {
        return Promise.resolve(1)
          .then(x => x + 1)
          .then(x => x * 2);
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(4);
      }
    });

    it('should handle errors in promise chains', async () => {
      const result = await tryCatchAsync(async () => {
        return Promise.resolve(1)
          .then(x => x + 1)
          .then(() => {
            throw new Error('error in chain');
          });
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('error in chain');
      }
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
        expect(values[0]?.id).toBe(1);
        expect(values[1]?.name).toBe('second');
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

  describe('any() operation', () => {
    it('should return first Ok when any Result is Ok', () => {
      const results: Result<number, string>[] = [
        err('error 1'),
        ok(42),
        err('error 2'),
      ];

      const combined = any(results);

      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toBe(42);
      }
    });

    it('should return first Ok when first Result is Ok', () => {
      const results: Result<number, string>[] = [
        ok(1),
        ok(2),
        ok(3),
      ];

      const combined = any(results);

      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toBe(1);
      }
    });

    it('should return first Ok when last Result is Ok', () => {
      const results: Result<number, string>[] = [
        err('error 1'),
        err('error 2'),
        ok(99),
      ];

      const combined = any(results);

      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toBe(99);
      }
    });

    it('should return Err with array of errors when all Results are Err', () => {
      const results: Result<number, string>[] = [
        err('error 1'),
        err('error 2'),
        err('error 3'),
      ];

      const combined = any(results);

      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        expect(combined.error).toEqual(['error 1', 'error 2', 'error 3']);
      }
    });

    it('should handle empty array', () => {
      const results: Result<number, string>[] = [];

      const combined = any(results);

      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        expect(combined.error).toEqual([]);
      }
    });

    it('should handle single Ok result', () => {
      const results: Result<number, string>[] = [ok(42)];

      const combined = any(results);

      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toBe(42);
      }
    });

    it('should handle single Err result', () => {
      const results: Result<number, string>[] = [err('single error')];

      const combined = any(results);

      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        expect(combined.error).toEqual(['single error']);
      }
    });

    it('should maintain type safety with different value types', () => {
      type CustomValue = { id: number; name: string };
      type CustomError = { code: string; message: string };

      const error1: CustomError = { code: 'E001', message: 'error 1' };
      const error2: CustomError = { code: 'E002', message: 'error 2' };
      const value: CustomValue = { id: 1, name: 'success' };

      const results: Result<CustomValue, CustomError>[] = [
        err(error1),
        ok(value),
        err(error2),
      ];

      const combined = any(results);

      expect(combined.ok).toBe(true);
      if (combined.ok) {
        const result: CustomValue = combined.value;
        expect(result.id).toBe(1);
        expect(result.name).toBe('success');
      }
    });

    it('should collect all errors when all Results are Err', () => {
      type CustomError = { code: string; message: string };

      const error1: CustomError = { code: 'E001', message: 'error 1' };
      const error2: CustomError = { code: 'E002', message: 'error 2' };
      const error3: CustomError = { code: 'E003', message: 'error 3' };

      const results: Result<number, CustomError>[] = [
        err(error1),
        err(error2),
        err(error3),
      ];

      const combined = any(results);

      expect(combined.ok).toBe(false);
      if (!combined.ok) {
        const errors: CustomError[] = combined.error;
        expect(errors).toHaveLength(3);
        expect(errors[0]?.code).toBe('E001');
        expect(errors[1]?.code).toBe('E002');
        expect(errors[2]?.code).toBe('E003');
      }
    });
  });
});
