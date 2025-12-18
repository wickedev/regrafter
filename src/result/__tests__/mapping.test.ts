/**
 * Tests for Result mapping operations
 * Task 2.1, 2.3, 2.5: map(), flatMap(), mapErr()
 */

import { describe, it, expect } from 'vitest';
import { ok, err, type Result } from '../types.js';
import { map, flatMap, mapErr } from '../helpers.js';

describe('Result mapping operations', () => {
  describe('map() - Task 2.1', () => {
    it('should transform Ok value', () => {
      const result: Result<number, string> = ok(2);
      const mapped = map(result, (x) => x * 2);

      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(4);
      }
    });

    it('should pass through Err unchanged', () => {
      const result: Result<number, string> = err('error');
      const mapped = map(result, (x) => x * 2);

      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBe('error');
      }
    });

    it('should maintain type safety of transformed values', () => {
      const result: Result<number, string> = ok(42);
      const mapped: Result<string, string> = map(result, (x) => x.toString());

      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe('42');
        expect(typeof mapped.value).toBe('string');
      }
    });
  });

  describe('flatMap() - Task 2.3', () => {
    it('should chain Ok values', () => {
      const result: Result<number, string> = ok(2);
      const chained = flatMap(result, (x) => ok(x * 2));

      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe(4);
      }
    });

    it('should propagate Err from first argument', () => {
      const result: Result<number, string> = err('error1');
      const chained = flatMap(result, (x) => ok(x * 2));

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe('error1');
      }
    });

    it('should propagate Err from function result', () => {
      const result: Result<number, string> = ok(2);
      const chained = flatMap(result, (x) => err('error2'));

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe('error2');
      }
    });

    it('should maintain type safety across chained operations', () => {
      const result: Result<number, string> = ok(10);
      const chained: Result<string, string> = flatMap(result, (x) =>
        ok(x.toString())
      );

      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe('10');
        expect(typeof chained.value).toBe('string');
      }
    });
  });

  describe('mapErr() - Task 2.5', () => {
    it('should transform Err value', () => {
      const result: Result<number, string> = err('error');
      const mapped = mapErr(result, (e) => e.toUpperCase());

      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBe('ERROR');
      }
    });

    it('should pass through Ok unchanged', () => {
      const result: Result<number, string> = ok(42);
      const mapped = mapErr(result, (e) => e.toUpperCase());

      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(42);
      }
    });

    it('should maintain type safety of error transformations', () => {
      const result: Result<number, string> = err('error');
      const mapped: Result<number, Error> = mapErr(
        result,
        (e) => new Error(e)
      );

      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBeInstanceOf(Error);
        expect(mapped.error.message).toBe('error');
      }
    });
  });
});
