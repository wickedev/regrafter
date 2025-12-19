/**
 * canExtract() function tests
 *
 * Task 21.1: canExtract() function test implementation
 * Requirements:
 * - 10.7: Quickly check if extraction is possible
 */

import { describe, it, expect } from 'vitest';
import { canExtract } from '../extract.js';
import type { FileInput, Selector } from '../../types/public.js';

describe('canExtract', () => {
  describe('Check extraction feasibility', () => {
    it('should return true when a valid JSX node is selected', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              const name = "World";
              return <div>Hello {name}</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 4,
        column: 21,
      };

      const result = canExtract(files, selector);

      expect(result).toBe(true);
    });

    it('should return false when an invalid selector is provided', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              return <div>Hello</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 999,
        column: 999,
      };

      const result = canExtract(files, selector);

      expect(result).toBe(false);
    });

    it('should return false when a non-JSX node is selected', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              const name = "World";
              return <div>Hello</div>;
            }
          `,
        },
      ];

      // selector pointing to a variable declaration
      const selector: Selector = {
        file: 'App.tsx',
        line: 3,
        column: 14,
      };

      const result = canExtract(files, selector);

      expect(result).toBe(false);
    });

    it('should return false when an empty file list is provided', () => {
      const files: FileInput[] = [];

      const selector: Selector = {
        file: 'App.tsx',
        line: 1,
        column: 1,
      };

      const result = canExtract(files, selector);

      expect(result).toBe(false);
    });
  });

  describe('dry-run mode', () => {
    it('should only perform validation without actual transformation', () => {
      const originalContent = `
        function App() {
          const name = "World";
          return <div>Hello {name}</div>;
        }
      `;

      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: originalContent,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 4,
        column: 18,
      };

      // Call canExtract
      canExtract(files, selector);

      // Verify that file content has not changed
      // (In practice, the file system is not modified, but this test is a conceptual verification)
      expect(files[0].content).toBe(originalContent);
    });

    it('should return the same result when called multiple times (idempotency)', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              return <div>Hello</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 3,
        column: 21,
      };

      const result1 = canExtract(files, selector);
      const result2 = canExtract(files, selector);
      const result3 = canExtract(files, selector);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
});
