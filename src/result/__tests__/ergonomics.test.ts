/**
 * Result Ergonomic Utilities Tests
 *
 * Tests for new ergonomic utilities added for error handling convenience:
 * - unwrapOrReturn: Early return pattern for Result-returning functions
 * - unwrapOrNull: Alias for unwrapResult
 * - andThen: Alias for flatMap (monadic bind)
 * - mapResult: Alias for map
 * - combineResults: Alias for all
 */

import { describe, it, expect } from 'vitest';
import { ok, err, isErr } from '../types.js';
import type { Result } from '../types.js';
import {
  unwrapOrReturn,
  unwrapOrNull,
  andThen,
  mapResult,
  combineResults,
} from '../helpers.js';

describe('unwrapOrReturn() utility', () => {
  describe('with Ok variant', () => {
    it('should return the unwrapped value', () => {
      const result = ok(42);
      const value = unwrapOrReturn(result);

      // Type narrowing: value is number (not Err)
      expect(typeof value).not.toBe('object');
      expect(value).toBe(42);
    });

    it('should return unwrapped string value', () => {
      const result = ok('success');
      const value = unwrapOrReturn(result);

      expect(value).toBe('success');
    });

    it('should return unwrapped object value', () => {
      const result = ok({ id: 1, name: 'test' });
      const value = unwrapOrReturn(result);

      // For objects, we need to check it's not an Err
      if (typeof value === 'object' && value !== null && 'ok' in value) {
        throw new Error('Expected unwrapped value, got Err');
      }
      expect(value).toEqual({ id: 1, name: 'test' });
    });

    it('should return unwrapped null value', () => {
      const result = ok(null);
      const value = unwrapOrReturn(result);

      expect(value).toBe(null);
    });
  });

  describe('with Err variant', () => {
    it('should return Err Result', () => {
      const result = err('error message');
      const value = unwrapOrReturn(result);

      // Type narrowing: value is Err<string>
      if (typeof value === 'object' && value !== null && 'ok' in value) {
        expect(value.ok).toBe(false);
        if (!value.ok) {
          expect(value.error).toBe('error message');
        }
      } else {
        throw new Error('Expected Err Result');
      }
    });

    it('should return Err Result with Error instance', () => {
      const error = new Error('test error');
      const result = err(error);
      const value = unwrapOrReturn(result);

      if (typeof value === 'object' && value !== null && 'ok' in value) {
        expect(value.ok).toBe(false);
        if (!value.ok) {
          expect(value.error).toBe(error);
        }
      } else {
        throw new Error('Expected Err Result');
      }
    });

    it('should return Err Result with custom error type', () => {
      type CustomError = { code: string; message: string };
      const customErr: CustomError = { code: 'E001', message: 'Custom error' };
      const result = err(customErr);
      const value = unwrapOrReturn(result);

      if (typeof value === 'object' && value !== null && 'ok' in value) {
        expect(value.ok).toBe(false);
        if (!value.ok) {
          expect(value.error).toEqual(customErr);
        }
      } else {
        throw new Error('Expected Err Result');
      }
    });
  });

  describe('usage in Result-returning functions', () => {
    function getNumber(): Result<number, string> {
      return ok(10);
    }

    function getError(): Result<number, string> {
      return err('failed');
    }

    it('should enable early return pattern for success case', () => {
      function process(): Result<number, string> {
        const num = unwrapOrReturn(getNumber());
        if (typeof num === 'object' && 'ok' in num) return num;

        return ok(num * 2);
      }

      const result = process();
      expect(isErr(result)).toBe(false);
      if (!isErr(result)) {
        expect(result.value).toBe(20);
      }
    });

    it('should enable early return pattern for error case', () => {
      function process(): Result<number, string> {
        const num = unwrapOrReturn(getError());
        if (typeof num === 'object' && 'ok' in num) return num;

        return ok(num * 2);
      }

      const result = process();
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('failed');
      }
    });

    it('should chain multiple unwrapOrReturn calls', () => {
      function getInput(): Result<string, string> {
        return ok('test');
      }

      function process(): Result<string, string> {
        const input = unwrapOrReturn(getInput());
        if (typeof input === 'object' && 'ok' in input) return input;

        const num = unwrapOrReturn(getNumber());
        if (typeof num === 'object' && 'ok' in num) return num;

        return ok(`${input}-${num}`);
      }

      const result = process();
      expect(isErr(result)).toBe(false);
      if (!isErr(result)) {
        expect(result.value).toBe('test-10');
      }
    });
  });
});

describe('unwrapOrNull() utility', () => {
  it('should return value for Ok variant', () => {
    const result = ok(42);
    const value = unwrapOrNull(result);

    expect(value).toBe(42);
  });

  it('should return null for Err variant', () => {
    const result = err('error');
    const value = unwrapOrNull(result);

    expect(value).toBe(null);
  });

  it('should work with string values', () => {
    const okResult = ok('success');
    const errResult = err('error');

    expect(unwrapOrNull(okResult)).toBe('success');
    expect(unwrapOrNull(errResult)).toBe(null);
  });

  it('should work with object values', () => {
    const obj = { id: 1, name: 'test' };
    const okResult = ok(obj);
    const errResult = err('error');

    expect(unwrapOrNull(okResult)).toBe(obj);
    expect(unwrapOrNull(errResult)).toBe(null);
  });

  it('should handle Ok(null) correctly', () => {
    const result = ok(null);
    const value = unwrapOrNull(result);

    // Ok(null) should return null, same as Err
    expect(value).toBe(null);
  });
});

describe('andThen() utility', () => {
  describe('with Ok variant', () => {
    it('should apply function and return its Result', () => {
      const result = ok(5);
      const chained = andThen(result, (n) => ok(n * 2));

      expect(isErr(chained)).toBe(false);
      if (!isErr(chained)) {
        expect(chained.value).toBe(10);
      }
    });

    it('should propagate error from chained function', () => {
      const result = ok(5);
      const chained = andThen(result, (_n) => err('failed'));

      expect(isErr(chained)).toBe(true);
      if (isErr(chained)) {
        expect(chained.error).toBe('failed');
      }
    });

    it('should chain multiple operations', () => {
      const result = ok(5);
      const chained = andThen(
        result,
        (n) => andThen(ok(n * 2), (n2) => ok(n2 + 1))
      );

      expect(isErr(chained)).toBe(false);
      if (!isErr(chained)) {
        expect(chained.value).toBe(11);
      }
    });
  });

  describe('with Err variant', () => {
    it('should pass through error without calling function', () => {
      const result = err('original error');
      let called = false;
      const chained = andThen(result, (_n: number) => {
        called = true;
        return ok(10);
      });

      expect(called).toBe(false);
      expect(isErr(chained)).toBe(true);
      if (isErr(chained)) {
        expect(chained.error).toBe('original error');
      }
    });
  });

  describe('practical usage', () => {
    function divide(a: number, b: number): Result<number, string> {
      return b === 0 ? err('Division by zero') : ok(a / b);
    }

    it('should chain division operations', () => {
      const result = andThen(divide(10, 2), (n) => divide(n, 2));

      expect(isErr(result)).toBe(false);
      if (!isErr(result)) {
        expect(result.value).toBe(2.5);
      }
    });

    it('should stop at first error in chain', () => {
      const result = andThen(divide(10, 0), (n) => divide(n, 2));

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('Division by zero');
      }
    });
  });
});

describe('mapResult() utility', () => {
  describe('with Ok variant', () => {
    it('should transform value', () => {
      const result = ok(5);
      const mapped = mapResult(result, (n) => n * 2);

      expect(isErr(mapped)).toBe(false);
      if (!isErr(mapped)) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should transform to different type', () => {
      const result = ok(42);
      const mapped = mapResult(result, (n) => `number: ${n}`);

      expect(isErr(mapped)).toBe(false);
      if (!isErr(mapped)) {
        expect(mapped.value).toBe('number: 42');
      }
    });

    it('should chain multiple maps', () => {
      const result = ok(5);
      const mapped = mapResult(
        mapResult(result, (n) => n * 2),
        (n) => n + 1
      );

      expect(isErr(mapped)).toBe(false);
      if (!isErr(mapped)) {
        expect(mapped.value).toBe(11);
      }
    });
  });

  describe('with Err variant', () => {
    it('should pass through error', () => {
      const result = err('error');
      let called = false;
      const mapped = mapResult(result, (_n: number) => {
        called = true;
        return 10;
      });

      expect(called).toBe(false);
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBe('error');
      }
    });
  });
});

describe('combineResults() utility', () => {
  describe('with all Ok results', () => {
    it('should combine into Ok with array of values', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combineResults(results);

      expect(isErr(combined)).toBe(false);
      if (!isErr(combined)) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should handle different types', () => {
      const results = [ok('a'), ok('b'), ok('c')];
      const combined = combineResults(results);

      expect(isErr(combined)).toBe(false);
      if (!isErr(combined)) {
        expect(combined.value).toEqual(['a', 'b', 'c']);
      }
    });

    it('should handle empty array', () => {
      const results: Result<number, string>[] = [];
      const combined = combineResults(results);

      expect(isErr(combined)).toBe(false);
      if (!isErr(combined)) {
        expect(combined.value).toEqual([]);
      }
    });
  });

  describe('with any Err results', () => {
    it('should return first error', () => {
      const results = [ok(1), err('error'), ok(3)];
      const combined = combineResults(results);

      expect(isErr(combined)).toBe(true);
      if (isErr(combined)) {
        expect(combined.error).toBe('error');
      }
    });

    it('should return first error when multiple errors', () => {
      const results = [ok(1), err('error1'), err('error2')];
      const combined = combineResults(results);

      expect(isErr(combined)).toBe(true);
      if (isErr(combined)) {
        expect(combined.error).toBe('error1');
      }
    });

    it('should return error when first result is error', () => {
      const results = [err('first'), ok(2), ok(3)];
      const combined = combineResults(results);

      expect(isErr(combined)).toBe(true);
      if (isErr(combined)) {
        expect(combined.error).toBe('first');
      }
    });
  });

  describe('practical usage', () => {
    function parseNumber(s: string): Result<number, string> {
      const num = parseInt(s, 10);
      return isNaN(num) ? err(`Invalid number: ${s}`) : ok(num);
    }

    it('should combine multiple parsing operations', () => {
      const results = combineResults([
        parseNumber('1'),
        parseNumber('2'),
        parseNumber('3'),
      ]);

      expect(isErr(results)).toBe(false);
      if (!isErr(results)) {
        expect(results.value).toEqual([1, 2, 3]);
      }
    });

    it('should fail fast on first parse error', () => {
      const results = combineResults([
        parseNumber('1'),
        parseNumber('invalid'),
        parseNumber('3'),
      ]);

      expect(isErr(results)).toBe(true);
      if (isErr(results)) {
        expect(results.error).toBe('Invalid number: invalid');
      }
    });
  });
});
