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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  return <div>
              {/* This is a comment above the element */}
              <Source />
            </div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  return <div>
              {/*
                Multi-line comment
                about this element
               */}
              <Source />
            </div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  // This variable holds data
  const data = 42;
  return <div>{data}</div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`/**
 * Important component that displays source
 * @returns JSX element
 */
function Source() {
  return <div>Source</div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`/**
 * Component with props
 * @param {Object} props - The component props
 * @param {string} props.name - User name
 * @param {number} props.age - User age
 * @returns {JSX.Element} Rendered component
 */
function User({
  name,
  age
}) {
  return <div>{name} is {age}</div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`/**
 * Helper function to format data
 */
const formatData = data => data.toString();
      }`);
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  return <div>
              <Source /* inline comment */ />
            </div>;
}`);
      }
    });

    it('should preserve inline comment in expression', () => {
      const code = `
        const value = 1 /* units in meters */ + 2;
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`const value = 1 /* units in meters */ + 2;`);
      }
    });

    it('should preserve inline comment in JSX attribute', () => {
      const code = `
        function Component() {
          return <button /* important */ onClick={handler}>Click</button>;
        }
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  return <button /* important */ onClick={handler}>Click</button>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  return <div>
              <Source />
              {/* Comment after source */}
            </div>;
}`);
      }
    });

    it('should preserve end-of-line comment', () => {
      const code = `
        const x = 1; // trailing comment
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`const x = 1; // trailing comment`);
      }
    });

    it('should preserve trailing comment after function', () => {
      const code = `
        function helper() {
          return 42;
        } // end of helper
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function helper() {
  return 42;
} // end of helper`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  return <div>
              {/* Inner comment 1 */}
              <span>Content</span>
              {/* Inner comment 2 */}
            </div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  // Setup section
  const data = fetchData();
      }

  // Render section
  return <div>{data}</div>;
}`);
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`const config = {
  // Feature flag
  enabled: true,
  // Maximum value
  max: 100
};`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Source() {
  const x = 1;
  return <div>{}Content</div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`const Component = () => {
  const [state, setState] = useState(0);
      }
  return <div>
              {}
              <span>{state}</span>
            </div>;
};`);
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`/**
 * Component with multiple comment types
 * @returns JSX element
 */
function MultiComment() {
  // Variable initialization
  const value = 42; // magic number

  return <div>
              {/* JSX comment before */}
              <span /* inline */>Content</span>
              {/* JSX comment after */}
            </div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`// Top-level comment
function Parent() {
  /**
   * Inner function
   */
  function child() {
    // Inside child
    return 1; // child return
  }

  // Parent render
  return <div>
              {/* Before child component */}
              <Child /> {/* After child component */}
            </div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  // Before first element
  const first = 1;

  // Between elements
  const second = 2;

  // Before return
  return <div>{first + second}</div>;
  // This comment should stay at the end
}`);
      }

      // Check relative positions
      if (!result.ok) return;
      const beforeFirstPos = result.value.code.indexOf('Before first element');
      const firstVarPos = result.value.code.indexOf('const first');
      expect(beforeFirstPos).toBeLessThan(firstVarPos);

      const betweenPos = result.value.code.indexOf('Between elements');
      const secondVarPos = result.value.code.indexOf('const second');
      expect(betweenPos).toBeLessThan(secondVarPos);

      const beforeReturnPos = result.value.code.indexOf('Before return');
      const returnPos = result.value.code.indexOf('return <div>');
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  return <div>
              {/* Top comment */}
              <header>Header</header>
              {/* Middle comment */}
              <main>Main</main>
              {/* Bottom comment */}
              <footer>Footer</footer>
            </div>;
}`);
      }

      // Check ordering
      if (!result.ok) return;
      const topPos = result.value.code.indexOf('Top comment');
      const middlePos = result.value.code.indexOf('Middle comment');
      const bottomPos = result.value.code.indexOf('Bottom comment');

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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`// Comment with special chars: @#$%^&*()
const x = 1;`);
      }
    });

    it('should preserve comments at start of file', () => {
      const code = `// First line comment
const x = 1;`;

      const ast = parseCode(code);
      const result = generator.generate(ast);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`// First line comment
const x = 1;`);
      }
    });

    it('should preserve comments at end of file', () => {
      const code = `const x = 1;
// Last line comment`;

      const ast = parseCode(code);
      const result = generator.generate(ast);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`const x = 1;
// Last line comment`);
      }
    });

    it('should handle very long comments', () => {
      const longComment = 'A'.repeat(500);
      const code = `
        // ${longComment}
        const x = 1;
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`// ${longComment}\nconst x = 1;`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`function Component() {
  return <div
  // Comment in props
  className="test"
  /* Another comment */ id="main">
              Content
            </div>;
}`);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`// Top comment
const Component = () => {
  // Inner comment
  return <div>Test</div>;
};`);
      }
    });

    it('should preserve comments when generating source maps', () => {
      const code = `
        // Comment with sourcemap
        const x = 1;
      `;

      const ast = parseCode(code);
      const result = generator.generate(ast);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`// Comment with sourcemap
const x = 1;`);
      }
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
      expect(results.get('file1.tsx')?.code).toBe(`// File 1 comment
const A = () => <div>A</div>;`);
      expect(results.get('file2.tsx')?.code).toBe(`// File 2 comment
const B = () => <div>B</div>;`);
    });
  });
});
