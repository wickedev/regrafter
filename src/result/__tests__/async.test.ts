/**
 * Result Async Operations Tests
 *
 * Tests for async Result operations including mapAsync and flatMapAsync.
 */

import { describe, it, expect } from 'vitest';
import { ok, err } from '../types.js';
import type { Result } from '../types.js';

// Import functions that will be implemented
import { mapAsync, flatMapAsync } from '../async.js';

describe('mapAsync() operation', () => {
  describe('transforming Ok values asynchronously', () => {
    it('should transform Ok value asynchronously', async () => {
      const result = ok(2);
      const transformed = await mapAsync(result, async (x) => x * 2);

      expect(transformed.ok).toBe(true);
      if (transformed.ok) {
        expect(transformed.value).toBe(4);
      }
    });

    it('should transform Ok value with async operation', async () => {
      const result = ok('hello');
      const transformed = await mapAsync(result, async (str) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return str.toUpperCase();
      });

      expect(transformed.ok).toBe(true);
      if (transformed.ok) {
        expect(transformed.value).toBe('HELLO');
      }
    });

    it('should transform Ok value with different types', async () => {
      const result = ok(42);
      const transformed = await mapAsync(result, async (num) => {
        return `Number: ${num}`;
      });

      expect(transformed.ok).toBe(true);
      if (transformed.ok) {
        expect(transformed.value).toBe('Number: 42');
      }
    });

    it('should transform Ok value with complex async operation', async () => {
      const result = ok({ id: 1, name: 'test' });
      const transformed = await mapAsync(result, async (obj) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ...obj, processed: true };
      });

      expect(transformed.ok).toBe(true);
      if (transformed.ok) {
        expect(transformed.value).toEqual({ id: 1, name: 'test', processed: true });
      }
    });
  });

  describe('passing through Err unchanged', () => {
    it('should pass through Err unchanged', async () => {
      const result = err('error message');
      const transformed = await mapAsync(result, async (x: number) => x * 2);

      expect(transformed.ok).toBe(false);
      if (!transformed.ok) {
        expect(transformed.error).toBe('error message');
      }
    });

    it('should not call function for Err variant', async () => {
      let functionCalled = false;
      const result = err('error');

      await mapAsync(result, async (x: number) => {
        functionCalled = true;
        return x * 2;
      });

      expect(functionCalled).toBe(false);
    });

    it('should pass through Err with complex error type', async () => {
      type CustomError = { code: string; message: string };
      const error: CustomError = { code: 'E001', message: 'test error' };
      const result: Result<number, CustomError> = err(error);

      const transformed = await mapAsync(result, async (x: number) => x * 2);

      expect(transformed.ok).toBe(false);
      if (!transformed.ok) {
        expect(transformed.error).toEqual(error);
      }
    });
  });

  describe('error handling in async transformation', () => {
    it('should handle errors thrown in async function', async () => {
      const result = ok(42);

      // The function throws, so mapAsync should catch it and return Err
      // However, based on the design, mapAsync should NOT catch errors
      // It should let them propagate (like map() doesn't catch sync errors)
      // So this test verifies that errors are NOT caught
      await expect(async () => {
        await mapAsync(result, async () => {
          throw new Error('async error');
        });
      }).rejects.toThrow('async error');
    });

    it('should handle rejected promises in async function', async () => {
      const result = ok(42);

      await expect(async () => {
        await mapAsync(result, async () => {
          return Promise.reject(new Error('rejected promise'));
        });
      }).rejects.toThrow('rejected promise');
    });
  });

  describe('type safety', () => {
    it('should maintain type safety across transformations', async () => {
      const result: Result<number, string> = ok(42);
      const transformed: Promise<Result<string, string>> = mapAsync(
        result,
        async (num) => `Value: ${num}`
      );

      const finalResult = await transformed;
      expect(finalResult.ok).toBe(true);
      if (finalResult.ok) {
        expect(finalResult.value).toBe('Value: 42');
      }
    });
  });
});

describe('flatMapAsync() operation', () => {
  describe('chaining Ok values asynchronously', () => {
    it('should chain Ok values asynchronously', async () => {
      const result = ok(2);
      const chained = await flatMapAsync(result, async (x) => ok(x * 2));

      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe(4);
      }
    });

    it('should chain Ok values with async operation', async () => {
      const result = ok('hello');
      const chained = await flatMapAsync(result, async (str) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return ok(str.toUpperCase());
      });

      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe('HELLO');
      }
    });

    it('should chain Ok values with type transformation', async () => {
      const result = ok(42);
      const chained = await flatMapAsync(result, async (num) => {
        return ok(`Number: ${num}`);
      });

      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe('Number: 42');
      }
    });

    it('should chain multiple async operations', async () => {
      const result = ok(2);
      const chained = await flatMapAsync(result, async (x) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        const doubled = x * 2;
        return await flatMapAsync(ok(doubled), async (y) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return ok(y + 1);
        });
      });

      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe(5); // (2 * 2) + 1
      }
    });

    it('should handle complex async validation logic', async () => {
      type User = { id: number; name: string };
      const result = ok(42);

      const chained = await flatMapAsync(result, async (id) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (id > 0) {
          const user: User = { id, name: 'Test User' };
          return ok(user);
        } else {
          return err('Invalid ID');
        }
      });

      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toEqual({ id: 42, name: 'Test User' });
      }
    });
  });

  describe('propagating Err from first argument', () => {
    it('should propagate Err from first Result', async () => {
      const result = err('initial error');
      const chained = await flatMapAsync(result, async (x: number) => ok(x * 2));

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe('initial error');
      }
    });

    it('should not call function for Err variant', async () => {
      let functionCalled = false;
      const result = err('error');

      await flatMapAsync(result, async (x: number) => {
        functionCalled = true;
        return ok(x * 2);
      });

      expect(functionCalled).toBe(false);
    });

    it('should propagate Err with complex error type', async () => {
      type CustomError = { code: string; message: string };
      const error: CustomError = { code: 'E001', message: 'test error' };
      const result: Result<number, CustomError> = err(error);

      const chained = await flatMapAsync(result, async (x: number) => ok(x * 2));

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toEqual(error);
      }
    });
  });

  describe('propagating Err from function result', () => {
    it('should propagate Err from function result', async () => {
      const result = ok(42);
      const chained = await flatMapAsync(result, async (x) => {
        if (x > 40) {
          return err('value too large');
        }
        return ok(x * 2);
      });

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe('value too large');
      }
    });

    it('should propagate Err from async validation', async () => {
      const result = ok(-5);
      const chained = await flatMapAsync(result, async (num) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (num < 0) {
          return err('negative number not allowed');
        }
        return ok(num * 2);
      });

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe('negative number not allowed');
      }
    });

    it('should propagate Err in chain of operations', async () => {
      const result = ok(10);

      const chained = await flatMapAsync(result, async (x) => {
        const step1 = await flatMapAsync(ok(x), async (y) => {
          if (y > 5) {
            return err('step1: value too large');
          }
          return ok(y * 2);
        });
        return step1;
      });

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe('step1: value too large');
      }
    });
  });

  describe('error handling in async chaining', () => {
    it('should propagate errors thrown in async function', async () => {
      const result = ok(42);

      // Like mapAsync, flatMapAsync should NOT catch errors
      // It should let them propagate
      await expect(async () => {
        await flatMapAsync(result, async () => {
          throw new Error('async error in flatMap');
        });
      }).rejects.toThrow('async error in flatMap');
    });

    it('should propagate rejected promises in async function', async () => {
      const result = ok(42);

      await expect(async () => {
        await flatMapAsync(result, async () => {
          return Promise.reject(new Error('rejected in flatMap'));
        });
      }).rejects.toThrow('rejected in flatMap');
    });
  });

  describe('type safety', () => {
    it('should maintain type safety across async chains', async () => {
      const result: Result<number, string> = ok(42);
      const chained: Promise<Result<string, string>> = flatMapAsync(
        result,
        async (num) => ok(`Value: ${num}`)
      );

      const finalResult = await chained;
      expect(finalResult.ok).toBe(true);
      if (finalResult.ok) {
        expect(finalResult.value).toBe('Value: 42');
      }
    });

    it('should handle error type transformations', async () => {
      type ErrorA = { type: 'A'; message: string };

      const result: Result<number, ErrorA> = ok(42);

      // Note: This would require mapErr to change error types
      // For now, we test that the error type is maintained
      const chained = await flatMapAsync(result, async (num) => {
        if (num > 40) {
          const error: ErrorA = { type: 'A', message: 'too large' };
          return err(error);
        }
        return ok(num * 2);
      });

      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error.type).toBe('A');
        expect(chained.error.message).toBe('too large');
      }
    });
  });
});
