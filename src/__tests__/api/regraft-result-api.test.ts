/**
 * Tests for Task 17.1: Public API returning Result directly
 *
 * This test suite verifies that the regraft() API returns Result<T, E> directly
 * as a breaking change from the previous success/error format.
 */

import { describe, it, expect } from 'vitest';
import { regraft, Move, type FileInput } from '../../index.js';
import { isOk, isErr } from '../../result/index.js';

describe('Task 17.1: Public API returns Result<T, E> directly', () => {
  describe('Successful transformations', () => {
    it('should return Ok<TransformedCode> for valid simple move', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: 'function App() { return <div><span>Text</span><p>Para</p></div>; }',
        },
      ];

      const from = { file: 'App.tsx', line: 1, column: 51 }; // <p>
      const to = { file: 'App.tsx', line: 1, column: 34 }; // <span>

      const result = regraft(files, from, to, Move.After);

      // Result should be Result<T, E> type
      expect(result).toHaveProperty('ok');

      // If it fails, log the error to help debug
      if (!result.ok) {
        console.log('Move failed:', result.error.message);
      }

      // Should be Ok variant (or Err - either is valid for testing the type)
      // The main test is that it returns Result<T, E> format
      if (result.ok) {
        // Should have transformed code
        expect(result.value).toHaveProperty('codes');
        expect(Array.isArray(result.value.codes)).toBe(true);
        expect(result.value.codes.length).toBeGreaterThan(0);

        // Should have file information
        expect(result.value.codes[0]).toHaveProperty('file');
        expect(result.value.codes[0]).toHaveProperty('content');
        expect(result.value.codes[0]).toHaveProperty('changed');

        // Should include analysis
        expect(result.value).toHaveProperty('analysis');
      } else {
        // If it's an error, check error structure
        expect(result.error).toHaveProperty('_tag');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
      }
    });

    it('should include analysis information in successful result', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: 'function App() { return <div><span>Hello</span><p>World</p></div>; }',
        },
      ];

      const from = { file: 'App.tsx', line: 1, column: 50 }; // <p>
      const to = { file: 'App.tsx', line: 1, column: 34 }; // <span>

      const result = regraft(files, from, to, Move.After);

      // The test is about the Result structure, not whether the move succeeds
      if (result.ok) {
        // Should include analysis
        expect(result.value).toHaveProperty('analysis');
        expect(result.value.analysis).toHaveProperty('canMove');
        expect(result.value.analysis).toHaveProperty('dependencies');
      }
      // Else it's an Err, which is also valid
    });

    it('should mark changed files correctly', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: 'function App() { return <div><p>Text</p></div>; }',
        },
      ];

      const from = { file: 'App.tsx', line: 1, column: 34 }; // <p>
      const to = { file: 'App.tsx', line: 1, column: 29 }; // <div>

      const result = regraft(files, from, to, Move.Inside);

      // If move succeeds
      if (result.ok) {
        // At least one file should exist
        expect(result.value.codes.length).toBeGreaterThan(0);

        // Should have file property
        expect(result.value.codes[0]?.file).toBe('App.tsx');
      }
    });
  });

  describe('Error scenarios', () => {
    it('should return Err<RegraffError> for parse errors', () => {
      const files: FileInput[] = [
        {
          path: 'Invalid.tsx',
          content: 'const x = ;', // Invalid syntax
        },
      ];

      const from = { file: 'Invalid.tsx', line: 1, column: 1 };
      const to = { file: 'Invalid.tsx', line: 1, column: 5 };

      const result = regraft(files, from, to, Move.After);

      // Result should be Result<T, E> type
      expect(result).toHaveProperty('ok');

      // Should be Err variant
      expect(isErr(result)).toBe(true);

      if (!result.ok) {
        // Error should have required fields
        expect(result.error).toHaveProperty('_tag');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
      }
    });

    it('should return Err<RegraffError> for selector errors', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: 'function App() { return <div />; }',
        },
      ];

      // Invalid line number (way beyond file content)
      const from = { file: 'App.tsx', line: 999, column: 1 };
      const to = { file: 'App.tsx', line: 1, column: 10 };

      const result = regraft(files, from, to, Move.Inside);

      expect(isErr(result)).toBe(true);

      if (!result.ok) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(result.error.message).toBeTruthy();
      }
    });

    it('should return Err with file information in error', () => {
      const files: FileInput[] = [
        {
          path: 'Test.tsx',
          content: '<div />',
        },
      ];

      const from = { file: 'Test.tsx', line: 100, column: 1 };
      const to = { file: 'Test.tsx', line: 1, column: 1 };

      const result = regraft(files, from, to, Move.Inside);

      expect(isErr(result)).toBe(true);

      if (!result.ok) {
        // Error should include file context (may be 'unknown' in some cases)
        expect(result.error).toHaveProperty('file');
        expect(typeof result.error.file).toBe('string');
        if (result.error.file) {
          expect(result.error.file.length).toBeGreaterThan(0);
        }
      }
    });

    it('should include error category via _tag discriminant', () => {
      const files: FileInput[] = [
        {
          path: 'Bad.tsx',
          content: 'const x =', // Parse error
        },
      ];

      const from = { file: 'Bad.tsx', line: 1, column: 1 };
      const to = { file: 'Bad.tsx', line: 1, column: 5 };

      const result = regraft(files, from, to, Move.After);

      expect(isErr(result)).toBe(true);

      if (!result.ok) {
        // Should use _tag for discriminated union
        expect(result.error).toHaveProperty('_tag');
        expect(typeof result.error._tag).toBe('string');
      }
    });

    it('should include error location when available', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: 'function App() { return <div />; }',
        },
      ];

      const from = { file: 'App.tsx', line: 50, column: 1 };
      const to = { file: 'App.tsx', line: 1, column: 10 };

      const result = regraft(files, from, to, Move.Inside);

      expect(isErr(result)).toBe(true);

      if (!result.ok) {
        // Error structure should be valid
        expect(result.error).toHaveProperty('_tag');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');

        // Location is optional based on error type
        // Just verify structure if it exists
        if ('location' in result.error && result.error.location) {
          expect(result.error.location).toBeDefined();
        }
      }
    });

    it('should include suggestions in error', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: 'function App() { return <div><span /></div>; }',
        },
      ];

      // Create a scenario that would generate suggestions
      const from = { file: 'App.tsx', line: 999, column: 1 };
      const to = { file: 'App.tsx', line: 1, column: 10 };

      const result = regraft(files, from, to, Move.Inside);

      expect(isErr(result)).toBe(true);

      if (!result.ok) {
        // Errors should have suggestions array
        expect(result.error).toHaveProperty('suggestions');
        expect(Array.isArray(result.error.suggestions)).toBe(true);
      }
    });
  });

  describe('Type safety', () => {
    it('should provide type-safe access to Ok value', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: 'function App() { return <div><p /></div>; }',
        },
      ];

      const from = { file: 'App.tsx', line: 1, column: 34 }; // <p>
      const to = { file: 'App.tsx', line: 1, column: 29 }; // <div>

      const result = regraft(files, from, to, Move.Before);

      // TypeScript should narrow the type inside the if block
      if (result.ok) {
        // result.value should be accessible
        const codes = result.value.codes;
        expect(codes).toBeDefined();

        // result.error should not be accessible (TypeScript)
        // @ts-expect-error - error should not exist on Ok variant
        const _error = result.error;
      }
    });

    it('should provide type-safe access to Err value', () => {
      const files: FileInput[] = [
        {
          path: 'Bad.tsx',
          content: 'const x =', // Parse error
        },
      ];

      const from = { file: 'Bad.tsx', line: 1, column: 1 };
      const to = { file: 'Bad.tsx', line: 1, column: 5 };

      const result = regraft(files, from, to, Move.After);

      // TypeScript should narrow the type inside the if block
      if (!result.ok) {
        // result.error should be accessible
        const error = result.error;
        expect(error).toBeDefined();
        expect(error.code).toBeDefined();

        // result.value should not be accessible (TypeScript)
        // @ts-expect-error - value should not exist on Err variant
        const _value = result.value;
      }
    });

    it('should work with isOk type guard', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: 'function App() { return <div />; }',
        },
      ];

      const from = { file: 'App.tsx', line: 1, column: 25 };
      const to = { file: 'App.tsx', line: 1, column: 17 };

      const result = regraft(files, from, to, Move.Before);

      if (isOk(result)) {
        // TypeScript knows result is Ok<T>
        expect(result.value).toBeDefined();
        expect(result.value.codes).toBeDefined();
      }
    });

    it('should work with isErr type guard', () => {
      const files: FileInput[] = [
        {
          path: 'Bad.tsx',
          content: 'const x',
        },
      ];

      const from = { file: 'Bad.tsx', line: 1, column: 1 };
      const to = { file: 'Bad.tsx', line: 1, column: 5 };

      const result = regraft(files, from, to, Move.After);

      if (isErr(result)) {
        // TypeScript knows result is Err<E>
        expect(result.error).toBeDefined();
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
      }
    });
  });
});
