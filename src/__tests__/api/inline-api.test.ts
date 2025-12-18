/**
 * Tests for the public inline() API
 *
 * Tests the inline() function exported from the main index.ts file.
 * Verifies Result pattern, error handling, and integration.
 */

import { describe, it, expect } from 'vitest';
import { inline } from '../../index.js';

describe('inline() API', () => {
  describe('Success Cases', () => {
    it('should inline a simple component without props', () => {
      // ARRANGE
      const files = [
        {
          path: 'App.tsx',
          content: `
            function Greeting() {
              return <div>Hello World</div>;
            }

            function App() {
              return (
                <div>
                  <Greeting />
                </div>
              );
            }
          `,
        },
      ];

      // ACT
      const result = inline(files, 'Greeting');

      // ASSERT
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.codes).toHaveLength(1);
        expect(result.value.inlinedCount).toBe(1);
        expect(result.value.codes[0]).toBeDefined();
        expect(result.value.codes[0]!.changed).toBe(true);
        expect(result.value.codes[0]!.content).toContain('Hello World');
        expect(result.value.codes[0]!.content).not.toContain('function Greeting');
      }
    });

    it('should inline a component with props', () => {
      // ARRANGE
      const files = [
        {
          path: 'App.tsx',
          content: `
            function Greeting({ name }) {
              return <div>Hello {name}</div>;
            }

            function App() {
              return (
                <div>
                  <Greeting name="World" />
                </div>
              );
            }
          `,
        },
      ];

      // ACT
      const result = inline(files, 'Greeting');

      // ASSERT
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.inlinedCount).toBe(1);
        expect(result.value.codes[0]).toBeDefined();
        expect(result.value.codes[0]!.content).toContain('Hello');
        expect(result.value.codes[0]!.content).not.toContain('function Greeting');
      }
    });

    it('should inline multiple usages of the same component', () => {
      // ARRANGE
      const files = [
        {
          path: 'App.tsx',
          content: `
            function Button() {
              return <button>Click me</button>;
            }

            function App() {
              return (
                <div>
                  <Button />
                  <Button />
                  <Button />
                </div>
              );
            }
          `,
        },
      ];

      // ACT
      const result = inline(files, 'Button');

      // ASSERT
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.inlinedCount).toBe(3);
        expect(result.value.codes[0]).toBeDefined();
        expect(result.value.codes[0]!.changed).toBe(true);
      }
    });

    it('should handle multiple files (component in first file)', () => {
      // ARRANGE
      const files = [
        {
          path: 'App.tsx',
          content: `
            function Greeting() {
              return <div>Hello</div>;
            }

            function App() {
              return <Greeting />;
            }
          `,
        },
        {
          path: 'Other.tsx',
          content: `
            function Other() {
              return <div>Other</div>;
            }
          `,
        },
      ];

      // ACT
      const result = inline(files, 'Greeting');

      // ASSERT
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.codes).toHaveLength(2);
        expect(result.value.codes[0]).toBeDefined();
        expect(result.value.codes[0]!.changed).toBe(true);
        expect(result.value.codes[1]).toBeDefined();
        expect(result.value.codes[1]!.changed).toBe(false);
      }
    });
  });

  describe('Error Cases', () => {
    it('should return error for empty files array', () => {
      // ACT
      const result = inline([], 'Greeting');

      // ASSERT
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMPTY_INPUT');
        expect(result.error.message).toContain('No files provided');
      }
    });

    it('should return error for empty component name', () => {
      // ARRANGE
      const files = [{ path: 'App.tsx', content: 'function App() { return <div />; }' }];

      // ACT
      const result = inline(files, '');

      // ASSERT
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMPTY_INPUT');
        expect(result.error.message).toContain('Component name cannot be empty');
      }
    });

    it('should return error for component not found', () => {
      // ARRANGE
      const files = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              return <div>Hello</div>;
            }
          `,
        },
      ];

      // ACT
      const result = inline(files, 'NonExistent');

      // ASSERT
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('ELEMENT_NOT_FOUND');
        expect(result.error.message).toContain("Component 'NonExistent' not found");
      }
    });

    it('should return error for invalid syntax', () => {
      // ARRANGE
      const files = [
        {
          path: 'App.tsx',
          content: 'function App() { return <div> }', // Missing closing tag
        },
      ];

      // ACT
      const result = inline(files, 'App');

      // ASSERT
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe('ParseError');
      }
    });
  });

  describe('Result Pattern Integration', () => {
    it('should use ok/err Result pattern', () => {
      // ARRANGE
      const files = [{ path: 'App.tsx', content: 'function Greeting() { return <div />; } function App() { return <Greeting />; }' }];

      // ACT
      const result = inline(files, 'Greeting');

      // ASSERT
      expect(result).toHaveProperty('ok');
      if (result.ok) {
        expect(result).toHaveProperty('value');
        expect(result.value).toHaveProperty('codes');
        expect(result.value).toHaveProperty('inlinedCount');
      }
    });

    it('should return detailed error with RegraffError structure', () => {
      // ARRANGE
      const files = [{ path: 'App.tsx', content: 'function App() {}' }];

      // ACT
      const result = inline(files, 'Missing');

      // ASSERT
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toHaveProperty('_tag');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(result.error).toHaveProperty('file');
      }
    });
  });

  describe('Changed Flag Behavior', () => {
    it('should mark file as changed when component is inlined', () => {
      // ARRANGE
      const files = [
        {
          path: 'App.tsx',
          content: 'function Button() { return <button />; } function App() { return <Button />; }',
        },
      ];

      // ACT
      const result = inline(files, 'Button');

      // ASSERT
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.codes[0]).toBeDefined();
        expect(result.value.codes[0]!.changed).toBe(true);
      }
    });

    it('should not mark file as changed when component is in different file', () => {
      // ARRANGE
      const files = [
        {
          path: 'Button.tsx',
          content: 'function Button() { return <button />; } export function App() { return <Button />; }',
        },
        {
          path: 'Other.tsx',
          content: 'function Other() { return <div />; }',
        },
      ];

      // ACT
      const result = inline(files, 'Button');

      // ASSERT
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.codes[0]).toBeDefined();
        expect(result.value.codes[0]!.changed).toBe(true); // Button.tsx changed
        expect(result.value.codes[1]).toBeDefined();
        expect(result.value.codes[1]!.changed).toBe(false); // Other.tsx not changed
      }
    });
  });

  describe('Phase 3: Cross-File Inlining', () => {
    it('should inline a component from another file', () => {
      // RED: This test should fail - cross-file support not implemented yet
      const files = [
        {
          path: 'Button.tsx',
          content: `
            export function Button({ label }) {
              return <button>{label}</button>;
            }
          `,
        },
        {
          path: 'App.tsx',
          content: `
            import { Button } from './Button';

            function App() {
              return <Button label="Click me" />;
            }
          `,
        },
      ];

      // ACT
      const result = inline(files, 'Button');

      // ASSERT
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.inlinedCount).toBe(1);

        // Button.tsx should be marked as changed (component removed)
        const buttonFile = result.value.codes.find(c => c.file === 'Button.tsx');
        expect(buttonFile).toBeDefined();
        expect(buttonFile?.changed).toBe(true);
        expect(buttonFile?.content).not.toContain('function Button');

        // App.tsx should be marked as changed (component inlined)
        const appFile = result.value.codes.find(c => c.file === 'App.tsx');
        expect(appFile).toBeDefined();
        expect(appFile?.changed).toBe(true);
        expect(appFile?.content).toContain('<button>');
        expect(appFile?.content).not.toContain('<Button');
        expect(appFile?.content).not.toContain('import { Button }');
      }
    });

    it('should copy transitive imports when inlining cross-file component', () => {
      // Component that imports other dependencies
      const files = [
        {
          path: 'Icon.tsx',
          content: `
            export function Icon() {
              return <svg>Icon</svg>;
            }
          `,
        },
        {
          path: 'Button.tsx',
          content: `
            import { Icon } from './Icon';

            export function Button({ label }) {
              return <button><Icon /> {label}</button>;
            }
          `,
        },
        {
          path: 'App.tsx',
          content: `
            import { Button } from './Button';

            function App() {
              return <Button label="Click me" />;
            }
          `,
        },
      ];

      // ACT
      const result = inline(files, 'Button');

      // ASSERT
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.inlinedCount).toBe(1);

        // App.tsx should have the Icon import copied over
        const appFile = result.value.codes.find(c => c.file === 'App.tsx');
        expect(appFile).toBeDefined();
        expect(appFile?.changed).toBe(true);
        expect(appFile?.content).toContain('import { Icon } from \'./Icon\'');
        expect(appFile?.content).not.toContain('import { Button }');
        expect(appFile?.content).not.toContain('<Button');
        expect(appFile?.content).toContain('<Icon />');
      }
    });
  });

  describe('fromFile Option', () => {
    it('should return error when duplicate component names exist without fromFile option', () => {
      // ARRANGE - Two files with same component name "Greeting"
      const files = [
        {
          path: 'components/Greeting.tsx',
          content: `
            export function Greeting() {
              return <div>Hello from components</div>;
            }
          `,
        },
        {
          path: 'shared/Greeting.tsx',
          content: `
            export function Greeting() {
              return <div>Hello from shared</div>;
            }
          `,
        },
        {
          path: 'App.tsx',
          content: `
            import { Greeting } from './components/Greeting';

            function App() {
              return <Greeting />;
            }
          `,
        },
      ];

      // ACT - Try to inline without specifying fromFile
      const result = inline(files, 'Greeting');

      // ASSERT
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AMBIGUOUS_COMPONENT');
        expect(result.error.message).toContain("Component 'Greeting' found in multiple files");
        expect(result.error.message).toContain('components/Greeting.tsx');
        expect(result.error.message).toContain('shared/Greeting.tsx');
      }
    });

    it('should inline component from specified file when duplicate names exist', () => {
      // ARRANGE - Two files with same component name "Greeting"
      const files = [
        {
          path: 'components/Greeting.tsx',
          content: `
            export function Greeting() {
              return <div>Hello from components</div>;
            }
          `,
        },
        {
          path: 'shared/Greeting.tsx',
          content: `
            export function Greeting() {
              return <div>Hello from shared</div>;
            }
          `,
        },
        {
          path: 'App.tsx',
          content: `
            import { Greeting } from './components/Greeting';

            function App() {
              return <Greeting />;
            }
          `,
        },
      ];

      // ACT - Specify to inline from 'components/Greeting.tsx'
      const result = inline(files, 'Greeting', { fromFile: 'components/Greeting.tsx' });

      // ASSERT
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.inlinedCount).toBe(1);

        // App.tsx should have the component from components/Greeting.tsx inlined
        const appFile = result.value.codes.find(c => c.file === 'App.tsx');
        expect(appFile).toBeDefined();
        expect(appFile?.changed).toBe(true);
        expect(appFile?.content).toContain('Hello from components');
        expect(appFile?.content).not.toContain('Hello from shared');
        expect(appFile?.content).not.toContain('import { Greeting }');

        // components/Greeting.tsx should be marked as changed (component removed)
        const componentsFile = result.value.codes.find(c => c.file === 'components/Greeting.tsx');
        expect(componentsFile).toBeDefined();
        expect(componentsFile?.changed).toBe(true);
        expect(componentsFile?.content).not.toContain('function Greeting');

        // shared/Greeting.tsx should remain unchanged
        const sharedFile = result.value.codes.find(c => c.file === 'shared/Greeting.tsx');
        expect(sharedFile).toBeDefined();
        expect(sharedFile?.changed).toBe(false);
        expect(sharedFile?.content).toContain('function Greeting');
      }
    });

    it('should return error when fromFile is specified but component not found in that file', () => {
      // ARRANGE
      const files = [
        {
          path: 'components/Button.tsx',
          content: `
            export function Button() {
              return <button>Click</button>;
            }
          `,
        },
        {
          path: 'App.tsx',
          content: `
            import { Button } from './components/Button';

            function App() {
              return <Button />;
            }
          `,
        },
      ];

      // ACT - Try to inline from wrong file
      const result = inline(files, 'Button', { fromFile: 'other/Button.tsx' });

      // ASSERT
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('ELEMENT_NOT_FOUND');
        expect(result.error.message).toContain("Component 'Button' not found in file 'other/Button.tsx'");
      }
    });
  });
});
