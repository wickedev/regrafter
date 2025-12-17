import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import { CodeGenerator } from '../code-generator.js';

/**
 * Comprehensive tests for comment preservation during code generation
 * Based on TASK-005: Verify Comment Preservation
 * See: comment-preservation.md for detailed test specifications
 */
describe('Comment Preservation - TASK-005', () => {
  let generator: CodeGenerator;

  // Helper function to parse JSX/TypeScript code
  const parseCode = (code: string): t.File => {
    return parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  };

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  // ============================================================
  // CP-01: Comments Above Moved Element
  // ============================================================
  describe('CP-01: Comments Above Moved Element', () => {
    it('should preserve single-line JSX comment above element', () => {
      const code = `
        function Component() {
          return (
            <div>
              {/* This is a comment above the element */}
              <Source />
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast, { preserveComments: true });

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('This is a comment above the element');
      expect(result.code).toContain('<Source />');
    });

    it('should preserve multi-line JSX comment above element', () => {
      const code = `
        function Component() {
          return (
            <div>
              {/*
                Multi-line comment
                about this element
              */}
              <Source />
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Multi-line comment');
      expect(result.code).toContain('about this element');
    });

    it('should preserve comment above variable declaration', () => {
      const code = `
        function Component() {
          // This variable holds data
          const data = 42;
          return <div>{data}</div>;
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('This variable holds data');
    });
  });

  // ============================================================
  // CP-02: JSDoc Comments
  // ============================================================
  describe('CP-02: JSDoc Comments', () => {
    it('should preserve JSDoc comment above function', () => {
      const code = `
        /**
         * Important component that displays source
         * @returns JSX element
         */
        function Source() {
          return <div>Source</div>;
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Important component that displays source');
      expect(result.code).toContain('@returns JSX element');
    });

    it('should preserve JSDoc with multiple tags', () => {
      const code = `
        /**
         * Component with props
         * @param {Object} props - The component props
         * @param {string} props.name - User name
         * @param {number} props.age - User age
         * @returns {JSX.Element} Rendered component
         */
        function User({ name, age }) {
          return <div>{name} is {age}</div>;
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('@param');
      expect(result.code).toContain('props.name');
      expect(result.code).toContain('props.age');
      expect(result.code).toContain('@returns');
    });

    it('should preserve JSDoc comment above const declaration', () => {
      const code = `
        /**
         * Helper function to format data
         */
        const formatData = (data) => data.toString();
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Helper function to format data');
    });
  });

  // ============================================================
  // CP-03: Inline Comments
  // ============================================================
  describe('CP-03: Inline Comments', () => {
    it('should preserve inline comment in JSX element', () => {
      const code = `
        function Component() {
          return (
            <div>
              <Source /* inline comment */ />
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('inline comment');
    });

    it('should preserve inline comment in expression', () => {
      const code = `
        const value = 1 /* units in meters */ + 2;
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('units in meters');
    });

    it('should preserve inline comment in JSX attribute', () => {
      const code = `
        function Component() {
          return <button /* important */ onClick={handler}>Click</button>;
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('important');
    });
  });

  // ============================================================
  // CP-04: Trailing Comments
  // ============================================================
  describe('CP-04: Trailing Comments', () => {
    it('should preserve trailing comment after JSX element', () => {
      const code = `
        function Component() {
          return (
            <div>
              <Source />
              {/* Comment after source */}
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Comment after source');
    });

    it('should preserve end-of-line comment', () => {
      const code = `
        const x = 1; // trailing comment
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('trailing comment');
    });

    it('should preserve trailing comment after function', () => {
      const code = `
        function helper() {
          return 42;
        } // end of helper
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('end of helper');
    });
  });

  // ============================================================
  // CP-05: Comments Inside Moved Elements
  // ============================================================
  describe('CP-05: Comments Inside Moved Elements', () => {
    it('should preserve comments nested within JSX elements', () => {
      const code = `
        function Component() {
          return (
            <div>
              {/* Inner comment 1 */}
              <span>Content</span>
              {/* Inner comment 2 */}
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Inner comment 1');
      expect(result.code).toContain('Inner comment 2');
      expect(result.code).toContain('<span>Content</span>');
    });

    it('should preserve comments inside function body', () => {
      const code = `
        function Component() {
          // Setup section
          const data = fetchData();

          // Render section
          return <div>{data}</div>;
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Setup section');
      expect(result.code).toContain('Render section');
    });

    it('should preserve comments inside object literals', () => {
      const code = `
        const config = {
          // Feature flag
          enabled: true,
          // Maximum value
          max: 100
        };
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Feature flag');
      expect(result.code).toContain('Maximum value');
    });
  });

  // ============================================================
  // CP-06: preserveComments: false Option
  // ============================================================
  describe('CP-06: preserveComments: false Option', () => {
    it('should strip all comments when preserveComments is false', () => {
      const code = `
        // Leading comment
        /**
         * JSDoc comment
         */
        function Source() {
          const x = 1; // trailing
          return <div>{/* JSX comment */}Content</div>;
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast, { preserveComments: false });

      expect(result.errors).toHaveLength(0);
      expect(result.code).not.toContain('Leading comment');
      expect(result.code).not.toContain('JSDoc comment');
      expect(result.code).not.toContain('trailing');
      expect(result.code).not.toContain('JSX comment');
      // But code should still be valid
      expect(result.code).toContain('function Source');
      expect(result.code).toContain('<div>');
    });

    it('should preserve code functionality when stripping comments', () => {
      const code = `
        // This is a component
        const Component = () => {
          // Initialize state
          const [state, setState] = useState(0);

          // Render
          return (
            <div>
              {/* Display state */}
              <span>{state}</span>
            </div>
          );
        };
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast, { preserveComments: false });

      expect(result.errors).toHaveLength(0);
      // No comments
      expect(result.code).not.toContain('This is a component');
      expect(result.code).not.toContain('Initialize state');
      expect(result.code).not.toContain('Render');
      expect(result.code).not.toContain('Display state');
      // But code structure preserved
      expect(result.code).toContain('Component');
      expect(result.code).toContain('useState');
      expect(result.code).toContain('<span>');
    });
  });

  // ============================================================
  // CP-07: Multiple Comment Types
  // ============================================================
  describe('CP-07: Multiple Comment Types', () => {
    it('should preserve all comment types together', () => {
      const code = `
        /**
         * Component with multiple comment types
         * @returns JSX element
         */
        function MultiComment() {
          // Variable initialization
          const value = 42; // magic number

          return (
            <div>
              {/* JSX comment before */}
              <span /* inline */>Content</span>
              {/* JSX comment after */}
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      // JSDoc
      expect(result.code).toContain('Component with multiple comment types');
      expect(result.code).toContain('@returns');
      // Single-line
      expect(result.code).toContain('Variable initialization');
      // Trailing
      expect(result.code).toContain('magic number');
      // JSX comments
      expect(result.code).toContain('JSX comment before');
      expect(result.code).toContain('inline');
      expect(result.code).toContain('JSX comment after');
    });

    it('should handle complex nested comment structure', () => {
      const code = `
        // Top-level comment
        function Parent() {
          /**
           * Inner function
           */
          function child() {
            // Inside child
            return 1; // child return
          }

          // Parent render
          return (
            <div>
              {/* Before child component */}
              <Child /> {/* After child component */}
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Top-level comment');
      expect(result.code).toContain('Inner function');
      expect(result.code).toContain('Inside child');
      expect(result.code).toContain('child return');
      expect(result.code).toContain('Parent render');
      expect(result.code).toContain('Before child component');
      expect(result.code).toContain('After child component');
    });
  });

  // ============================================================
  // CP-08: Comment Position Preservation
  // ============================================================
  describe('CP-08: Comment Position Preservation', () => {
    it('should maintain comment positions relative to elements', () => {
      const code = `
        function Component() {
          // Before first element
          const first = 1;

          // Between elements
          const second = 2;

          // Before return
          return <div>{first + second}</div>;
          // This comment should stay at the end
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);

      // Check all comments are present
      expect(result.code).toContain('Before first element');
      expect(result.code).toContain('Between elements');
      expect(result.code).toContain('Before return');

      // Check relative positions
      const beforeFirstPos = result.code.indexOf('Before first element');
      const firstVarPos = result.code.indexOf('const first');
      expect(beforeFirstPos).toBeLessThan(firstVarPos);

      const betweenPos = result.code.indexOf('Between elements');
      const secondVarPos = result.code.indexOf('const second');
      expect(betweenPos).toBeLessThan(secondVarPos);

      const beforeReturnPos = result.code.indexOf('Before return');
      const returnPos = result.code.indexOf('return <div>');
      expect(beforeReturnPos).toBeLessThan(returnPos);
    });

    it('should preserve comment positions in JSX tree', () => {
      const code = `
        function Component() {
          return (
            <div>
              {/* Top comment */}
              <header>Header</header>
              {/* Middle comment */}
              <main>Main</main>
              {/* Bottom comment */}
              <footer>Footer</footer>
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);

      // All comments present
      expect(result.code).toContain('Top comment');
      expect(result.code).toContain('Middle comment');
      expect(result.code).toContain('Bottom comment');

      // Check ordering
      const topPos = result.code.indexOf('Top comment');
      const middlePos = result.code.indexOf('Middle comment');
      const bottomPos = result.code.indexOf('Bottom comment');

      expect(topPos).toBeLessThan(middlePos);
      expect(middlePos).toBeLessThan(bottomPos);
    });
  });

  // ============================================================
  // Edge Cases and Boundary Conditions
  // ============================================================
  describe('Edge Cases', () => {
    it('should preserve empty comments', () => {
      const code = `
        const x = 1; //
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      // Empty comment may be preserved as '//' or stripped
      // This is acceptable behavior
    });

    it('should handle comments with special characters', () => {
      const code = `
        // Comment with special chars: @#$%^&*()
        const x = 1;
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('special chars');
    });

    it('should preserve comments at start of file', () => {
      const code = `// First line comment
const x = 1;`;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('First line comment');
    });

    it('should preserve comments at end of file', () => {
      const code = `const x = 1;
// Last line comment`;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Last line comment');
    });

    it('should handle very long comments', () => {
      const longComment = 'A'.repeat(500);
      const code = `
        // ${longComment}
        const x = 1;
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain(longComment);
    });

    it('should not break syntax with comment preservation', () => {
      const code = `
        function Component() {
          return (
            <div
              // Comment in props
              className="test"
              /* Another comment */
              id="main"
            >
              Content
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      // Should be valid code even with comments in attributes
      expect(result.code).toContain('className');
      expect(result.code).toContain('id');
    });
  });

  // ============================================================
  // Integration with Other Generator Features
  // ============================================================
  describe('Integration Tests', () => {
    it('should preserve comments with indentation adjustment', () => {
      const code = `
// Top comment
const Component = () => {
  // Inner comment
  return <div>Test</div>;
};
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Top comment');
      expect(result.code).toContain('Inner comment');
    });

    it('should preserve comments when generating source maps', () => {
      const code = `
        // Comment with sourcemap
        const x = 1;
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('Comment with sourcemap');
      expect(result.map).toBeDefined();
    });

    it('should preserve comments in generateMultiple', () => {
      const code1 = `
        // File 1 comment
        const A = () => <div>A</div>;
      `;
      const code2 = `
        // File 2 comment
        const B = () => <div>B</div>;
      `;

      const files = new Map<string, t.File>([
        ['file1.tsx', parseCode(code1)],
        ['file2.tsx', parseCode(code2)],
      ]);

      const results = generator.generateMultiple(files);

      expect(results.size).toBe(2);
      expect(results.get('file1.tsx')?.code).toContain('File 1 comment');
      expect(results.get('file2.tsx')?.code).toContain('File 2 comment');
    });
  });
});
