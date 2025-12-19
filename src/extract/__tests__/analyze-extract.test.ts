/**
 * analyzeExtract() function tests
 *
 * Task 21.3: analyzeExtract() function tests implementation
 * Requirements:
 * - 2.5: Perform dependency analysis only and skip transformation
 */

import { describe, it, expect } from 'vitest';
import { analyzeExtract } from '../extract.js';
import type { FileInput, Selector } from '../../types/public.js';

describe('analyzeExtract', () => {
  describe('Dependency analysis', () => {
    it('should analyze and return variable dependencies', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.variables).toContain('name');
        expect(result.value.selectedNodesCount).toBeGreaterThan(0);
      }
    });

    it('should analyze and return function dependencies', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              const handleClick = () => console.log('clicked');
              return <button onClick={handleClick}>Click</button>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 4,
        column: 21,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.functions).toContain('handleClick');
      }
    });

    it('should analyze and return state dependencies', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            import { useState } from 'react';

            function App() {
              const [count, setCount] = useState(0);
              return <div>{count}</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 6,
        column: 21,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.states).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              stateName: 'count',
              setterName: 'setCount',
            }),
          ])
        );
      }
    });

    it('should simultaneously analyze multiple types of dependencies', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            import { useState } from 'react';

            function App() {
              const [count, setCount] = useState(0);
              const name = "World";
              const handleClick = () => setCount(count + 1);

              return (
                <div>
                  <p>Hello {name}</p>
                  <p>Count: {count}</p>
                  <button onClick={handleClick}>Increment</button>
                </div>
              );
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 10,
        column: 17,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const { dependencies } = result.value;

        // Verify variable dependencies
        expect(dependencies.variables).toContain('name');

        // Verify state dependencies
        expect(dependencies.states).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              stateName: 'count',
              setterName: 'setCount',
            }),
          ])
        );

        // Verify function dependencies
        expect(dependencies.functions).toContain('handleClick');
      }
    });
  });

  describe('Component information analysis', () => {
    it('should include the name of the component to be generated', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.componentName).toBeTruthy();
        expect(result.value.componentName).toMatch(/^[A-Z]/); // PascalCase
      }
    });

    it('should include whether extraction is within the same file', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isSameFile).toBe(true);
        expect(result.value.targetFile).toBe('App.tsx');
      }
    });

    it('should include Props type information', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              const message = "Hello";
              return <div>{message}</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 4,
        column: 21,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.propTypes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'message',
              optional: false,
            }),
          ])
        );
      }
    });
  });

  describe('Error handling', () => {
    it('should return error for invalid selector', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(false);
    });

    it('should return error for empty file list', () => {
      const files: FileInput[] = [];

      const selector: Selector = {
        file: 'App.tsx',
        line: 1,
        column: 1,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(false);
    });

    it('should return error for non-JSX node', () => {
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

      // Selector pointing to variable declaration
      const selector: Selector = {
        file: 'App.tsx',
        line: 3,
        column: 14,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(false);
    });
  });

  describe('Perform analysis only without transformation', () => {
    it('should not perform actual transformation', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);

      // Verify file content has not changed
      const [file] = files;
      if (!file) {
        throw new Error('Expected App.tsx file input');
      }
      expect(file.content).toBe(originalContent);
    });

    it('should return same results when called multiple times (idempotency)', () => {
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

      const result1 = analyzeExtract(files, selector);
      const result2 = analyzeExtract(files, selector);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      if (result1.ok && result2.ok) {
        expect(result1.value).toEqual(result2.value);
      }
    });
  });
});
