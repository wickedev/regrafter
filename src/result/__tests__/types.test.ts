/**
 * Result Type Tests
 *
 * Tests for the core Result<T, E> type system including Ok, Err, constructors, and type guards.
 */

import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr } from '../types.js';
import type { Result } from '../types.js';

describe('Result Type System', () => {
  describe('ok() constructor', () => {
    it('should create Ok variant with value', () => {
      const result = ok(42);

      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should create Ok variant with string value', () => {
      const result = ok('success');

      expect(result.ok).toBe(true);
      expect(result.value).toBe('success');
    });

    it('should create Ok variant with object value', () => {
      const obj = { id: 1, name: 'test' };
      const result = ok(obj);

      expect(result.ok).toBe(true);
      expect(result.value).toBe(obj);
    });

    it('should create Ok variant with null value', () => {
      const result = ok(null);

      expect(result.ok).toBe(true);
      expect(result.value).toBe(null);
    });

    it('should create Ok variant with undefined value', () => {
      const result = ok(undefined);

      expect(result.ok).toBe(true);
      expect(result.value).toBe(undefined);
    });
  });

  describe('err() constructor', () => {
    it('should create Err variant with error', () => {
      const result = err('error message');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('error message');
    });

    it('should create Err variant with Error object', () => {
      const error = new Error('test error');
      const result = err(error);

      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
    });

    it('should create Err variant with custom error object', () => {
      const error = { code: 'E001', message: 'custom error' };
      const result = err(error);

      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
    });
  });

  describe('isOk() type guard', () => {
    it('should return true for Ok variant', () => {
      const result = ok(42);

      expect(isOk(result)).toBe(true);
    });

    it('should return false for Err variant', () => {
      const result = err('error');

      expect(isOk(result)).toBe(false);
    });

    it('should narrow type to Ok when true', () => {
      const result: Result<number, string> = ok(42);

      if (isOk(result)) {
        // TypeScript should infer result is Ok<number>
        const value: number = result.value;
        expect(value).toBe(42);
      }
    });
  });

  describe('isErr() type guard', () => {
    it('should return true for Err variant', () => {
      const result = err('error');

      expect(isErr(result)).toBe(true);
    });

    it('should return false for Ok variant', () => {
      const result = ok(42);

      expect(isErr(result)).toBe(false);
    });

    it('should narrow type to Err when true', () => {
      const result: Result<number, string> = err('error message');

      if (isErr(result)) {
        // TypeScript should infer result is Err<string>
        const error: string = result.error;
        expect(error).toBe('error message');
      }
    });
  });

  describe('Result type discrimination', () => {
    it('should discriminate Ok and Err using ok field', () => {
      const okResult: Result<number, string> = ok(42);
      const errResult: Result<number, string> = err('error');

      if (okResult.ok) {
        // Should be able to access value
        expect(okResult.value).toBe(42);
      } else {
        // Should not reach here for Ok variant
        expect(true).toBe(false);
      }

      if (!errResult.ok) {
        // Should be able to access error
        expect(errResult.error).toBe('error');
      } else {
        // Should not reach here for Err variant
        expect(true).toBe(false);
      }
    });

    it('should enforce readonly properties', () => {
      const result = ok(42);

      // TypeScript should prevent mutation (compile-time check)
      // @ts-expect-error - ok property is readonly
      result.ok = false;

      // @ts-expect-error - value property is readonly
      result.value = 100;
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety with generic types', () => {
      type CustomError = { code: string; message: string };

      const okResult: Result<number, CustomError> = ok(42);
      const errResult: Result<number, CustomError> = err({ code: 'E001', message: 'error' });

      if (isOk(okResult)) {
        const value: number = okResult.value;
        expect(value).toBe(42);
      }

      if (isErr(errResult)) {
        const error: CustomError = errResult.error;
        expect(error.code).toBe('E001');
        expect(error.message).toBe('error');
      }
    });

    it('should work with union types', () => {
      type Value = string | number;
      type ErrorType = Error | string;

      const result1: Result<Value, ErrorType> = ok('text');
      const result2: Result<Value, ErrorType> = ok(42);
      const result3: Result<Value, ErrorType> = err(new Error('error'));
      const result4: Result<Value, ErrorType> = err('error string');

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);
      expect(isErr(result3)).toBe(true);
      expect(isErr(result4)).toBe(true);
    });
  });
});
