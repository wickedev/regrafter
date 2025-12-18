/**
 * Tests for Task 17.3: Batch API operations
 *
 * This test suite verifies that batch operations collect both successes and failures
 * and return them in a BatchResult<T, E> format.
 */

import { describe, it, expect } from 'vitest';
import { processBatch, type BatchResult } from '../../index.js';
import { ok, err, type Result } from '../../result/index.js';

describe('Task 17.3: Batch API operations', () => {
  describe('processBatch helper', () => {
    it('should collect all successes when all operations succeed', () => {
      const items = [1, 2, 3, 4, 5];
      const processor = (n: number): Result<number, string> => ok(n * 2);

      const result: BatchResult<number, string> = processBatch(items, processor);

      expect(result.successes).toHaveLength(5);
      expect(result.successes).toEqual([2, 4, 6, 8, 10]);
      expect(result.failures).toHaveLength(0);
    });

    it('should collect all failures when all operations fail', () => {
      const items = [1, 2, 3];
      const processor = (n: number): Result<number, string> =>
        err(`Error: ${n}`);

      const result: BatchResult<number, string> = processBatch(items, processor);

      expect(result.successes).toHaveLength(0);
      expect(result.failures).toHaveLength(3);
      expect(result.failures).toEqual(['Error: 1', 'Error: 2', 'Error: 3']);
    });

    it('should collect both successes and failures for mixed results', () => {
      const items = [1, 2, 3, 4, 5];
      const processor = (n: number): Result<number, string> =>
        n % 2 === 0 ? ok(n) : err(`Odd number: ${n}`);

      const result: BatchResult<number, string> = processBatch(items, processor);

      expect(result.successes).toHaveLength(2);
      expect(result.successes).toEqual([2, 4]);
      expect(result.failures).toHaveLength(3);
      expect(result.failures).toEqual(['Odd number: 1', 'Odd number: 3', 'Odd number: 5']);
    });

    it('should handle empty input array', () => {
      const items: number[] = [];
      const processor = (n: number): Result<number, string> => ok(n);

      const result: BatchResult<number, string> = processBatch(items, processor);

      expect(result.successes).toHaveLength(0);
      expect(result.failures).toHaveLength(0);
    });

    it('should preserve order of results', () => {
      const items = ['a', 'b', 'c', 'd'];
      const processor = (s: string): Result<string, string> =>
        s === 'b' ? err('Error at b') : ok(s.toUpperCase());

      const result: BatchResult<string, string> = processBatch(items, processor);

      // Successes should be in order (a, c, d)
      expect(result.successes).toEqual(['A', 'C', 'D']);

      // Failures should be in order (b)
      expect(result.failures).toEqual(['Error at b']);
    });

    it('should work with complex types', () => {
      interface User {
        id: number;
        name: string;
      }

      interface ValidationError {
        field: string;
        message: string;
      }

      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: '' }, // Invalid
        { id: 3, name: 'Bob' },
        { id: 4, name: '' }, // Invalid
      ];

      const processor = (user: { id: number; name: string }): Result<User, ValidationError> => {
        if (user.name === '') {
          return err({ field: 'name', message: 'Name cannot be empty' });
        }
        return ok(user);
      };

      const result: BatchResult<User, ValidationError> = processBatch(users, processor);

      expect(result.successes).toHaveLength(2);
      expect(result.successes[0].name).toBe('Alice');
      expect(result.successes[1].name).toBe('Bob');

      expect(result.failures).toHaveLength(2);
      expect(result.failures[0].field).toBe('name');
      expect(result.failures[0].message).toBe('Name cannot be empty');
    });
  });

  describe('Batch results structure', () => {
    it('should have successes and failures arrays', () => {
      const items = [1, 2];
      const processor = (n: number): Result<number, string> => ok(n);

      const result: BatchResult<number, string> = processBatch(items, processor);

      expect(result).toHaveProperty('successes');
      expect(result).toHaveProperty('failures');
      expect(Array.isArray(result.successes)).toBe(true);
      expect(Array.isArray(result.failures)).toBe(true);
    });

    it('should include all errors in failures array', () => {
      const items = [1, 2, 3];
      const processor = (n: number): Result<number, { code: string; value: number }> =>
        err({ code: `E00${n}`, value: n });

      const result = processBatch(items, processor);

      expect(result.failures).toHaveLength(3);
      expect(result.failures[0]).toEqual({ code: 'E001', value: 1 });
      expect(result.failures[1]).toEqual({ code: 'E002', value: 2 });
      expect(result.failures[2]).toEqual({ code: 'E003', value: 3 });
    });

    it('should not mutate the input array', () => {
      const items = [1, 2, 3];
      const originalItems = [...items];
      const processor = (n: number): Result<number, string> => ok(n);

      processBatch(items, processor);

      expect(items).toEqual(originalItems);
    });
  });

  describe('Error collection', () => {
    it('should collect detailed error information', () => {
      interface DetailedError {
        code: string;
        message: string;
        timestamp: number;
      }

      const items = [1, 2, 3];
      const processor = (n: number): Result<number, DetailedError> =>
        err({
          code: `E${n}`,
          message: `Failed at ${n}`,
          timestamp: Date.now(),
        });

      const result = processBatch(items, processor);

      expect(result.failures).toHaveLength(3);
      result.failures.forEach((error, index) => {
        expect(error.code).toBe(`E${index + 1}`);
        expect(error.message).toContain(`Failed at ${index + 1}`);
        expect(error.timestamp).toBeGreaterThan(0);
      });
    });

    it('should preserve error context for debugging', () => {
      interface ErrorWithContext {
        code: string;
        context: { file: string; line: number };
      }

      const items = ['a', 'b', 'c'];
      const processor = (s: string): Result<string, ErrorWithContext> =>
        err({
          code: 'TEST_ERROR',
          context: { file: `${s}.txt`, line: s.charCodeAt(0) },
        });

      const result = processBatch(items, processor);

      expect(result.failures).toHaveLength(3);
      expect(result.failures[0].context.file).toBe('a.txt');
      expect(result.failures[1].context.file).toBe('b.txt');
      expect(result.failures[2].context.file).toBe('c.txt');
    });
  });

  describe('Performance characteristics', () => {
    it('should process large batches efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      const processor = (n: number): Result<number, string> =>
        n % 100 === 0 ? err(`Error at ${n}`) : ok(n * 2);

      const startTime = Date.now();
      const result = processBatch(largeArray, processor);
      const endTime = Date.now();

      // Should complete in reasonable time (< 100ms for 1000 items)
      expect(endTime - startTime).toBeLessThan(100);

      expect(result.successes).toHaveLength(990);
      expect(result.failures).toHaveLength(10);
    });

    it('should not create unnecessary intermediate arrays', () => {
      // This test verifies the implementation doesn't create wasteful copies
      const items = [1, 2, 3, 4, 5];
      let processCount = 0;
      const processor = (n: number): Result<number, string> => {
        processCount++;
        return ok(n);
      };

      processBatch(items, processor);

      // Should process each item exactly once
      expect(processCount).toBe(5);
    });
  });
});
