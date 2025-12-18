/**
 * Tests for Result module exports
 *
 * Verifies that all Result functions, types, and utilities are properly exported
 * from the main module index and are accessible to consumers.
 */

import { describe, it, expect } from 'vitest';
import * as ResultModule from '../index.js';

describe('Result module exports', () => {
  describe('type exports', () => {
    it('should export Result type constructor functions', () => {
      expect(ResultModule.ok).toBeDefined();
      expect(ResultModule.err).toBeDefined();
      expect(typeof ResultModule.ok).toBe('function');
      expect(typeof ResultModule.err).toBe('function');
    });

    it('should export type guards', () => {
      expect(ResultModule.isOk).toBeDefined();
      expect(ResultModule.isErr).toBeDefined();
      expect(typeof ResultModule.isOk).toBe('function');
      expect(typeof ResultModule.isErr).toBe('function');
    });
  });

  describe('mapping function exports', () => {
    it('should export map function', () => {
      expect(ResultModule.map).toBeDefined();
      expect(typeof ResultModule.map).toBe('function');
    });

    it('should export flatMap function', () => {
      expect(ResultModule.flatMap).toBeDefined();
      expect(typeof ResultModule.flatMap).toBe('function');
    });

    it('should export mapErr function', () => {
      expect(ResultModule.mapErr).toBeDefined();
      expect(typeof ResultModule.mapErr).toBe('function');
    });
  });

  describe('unwrapping function exports', () => {
    it('should export unwrap function', () => {
      expect(ResultModule.unwrap).toBeDefined();
      expect(typeof ResultModule.unwrap).toBe('function');
    });

    it('should export unwrapOr function', () => {
      expect(ResultModule.unwrapOr).toBeDefined();
      expect(typeof ResultModule.unwrapOr).toBe('function');
    });

    it('should export unwrapOrElse function', () => {
      expect(ResultModule.unwrapOrElse).toBeDefined();
      expect(typeof ResultModule.unwrapOrElse).toBe('function');
    });
  });

  describe('combining function exports', () => {
    it('should export all function', () => {
      expect(ResultModule.all).toBeDefined();
      expect(typeof ResultModule.all).toBe('function');
    });

    it('should export any function', () => {
      expect(ResultModule.any).toBeDefined();
      expect(typeof ResultModule.any).toBe('function');
    });
  });

  describe('exception conversion exports', () => {
    it('should export tryCatch function', () => {
      expect(ResultModule.tryCatch).toBeDefined();
      expect(typeof ResultModule.tryCatch).toBe('function');
    });

    it('should export tryCatchAsync function', () => {
      expect(ResultModule.tryCatchAsync).toBeDefined();
      expect(typeof ResultModule.tryCatchAsync).toBe('function');
    });
  });

  describe('async function exports', () => {
    it('should export mapAsync function', () => {
      expect(ResultModule.mapAsync).toBeDefined();
      expect(typeof ResultModule.mapAsync).toBe('function');
    });

    it('should export flatMapAsync function', () => {
      expect(ResultModule.flatMapAsync).toBeDefined();
      expect(typeof ResultModule.flatMapAsync).toBe('function');
    });
  });

  describe('exported functions work correctly', () => {
    it('should create Ok result using exported ok function', () => {
      const result = ResultModule.ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should create Err result using exported err function', () => {
      const result = ResultModule.err('error');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('error');
      }
    });

    it('should map over Ok result using exported map function', () => {
      const result = ResultModule.ok(2);
      const mapped = ResultModule.map(result, (x) => x * 2);
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(4);
      }
    });

    it('should unwrap Ok result using exported unwrap function', () => {
      const result = ResultModule.ok(42);
      const value = ResultModule.unwrap(result);
      expect(value).toBe(42);
    });

    it('should combine multiple results using exported all function', () => {
      const results = [ResultModule.ok(1), ResultModule.ok(2), ResultModule.ok(3)];
      const combined = ResultModule.all(results);
      expect(combined.ok).toBe(true);
      if (combined.ok) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should wrap throwing function using exported tryCatch function', () => {
      const result = ResultModule.tryCatch(() => {
        throw new Error('test error');
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('test error');
      }
    });

    it('should map async operations using exported mapAsync function', async () => {
      const result = ResultModule.ok(2);
      const mapped = await ResultModule.mapAsync(result, async (x) => x * 2);
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(4);
      }
    });
  });
});
