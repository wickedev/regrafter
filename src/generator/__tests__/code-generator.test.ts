import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import { CodeGenerator } from '../code-generator.js';
import type { IndentationInfo, GeneratedCode } from '../types.js';
import { unwrap } from '../../result/index.js';

/**
 * Unit tests for CodeGenerator
 */
describe('CodeGenerator', () => {
  let generator: CodeGenerator;

  // Helper function to parse JSX code
  const parseCode = (code: string): t.File => {
    return parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  };

  // Helper to unwrap Result for simpler test assertions
  const generateAndUnwrap = (ast: t.File): GeneratedCode => {
    return unwrap(generator.generate(ast));
  };

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  // ============================================================
  // Basic Code Generation Tests
  // ============================================================
  describe('Basic Code Generation', () => {
    it('should generate code from a simple AST', () => {
      const code = `const x = 1;`;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const x = 1;`);
    });

    it('should generate code from JSX AST', () => {
      const code = `const App = () => <div>Hello</div>;`;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const App = () => <div>Hello</div>;`);
    });

    it('should generate code from complex JSX with attributes', () => {
      const code = `
        const Button = ({ onClick, children }) => (
          <button className="btn" onClick={onClick}>
            {children}
          </button>
        );
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const Button = ({
  onClick,
  children
}) => <button className="btn" onClick={onClick}>
            {children}
          </button>;`);
    });

    it('should generate code from nested JSX elements', () => {
      const code = `
        const Layout = () => (
          <div>
            <header>Header</header>
            <main>
              <article>Content</article>
            </main>
            <footer>Footer</footer>
          </div>
        );
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const Layout = () => <div>
            <header>Header</header>
            <main>
              <article>Content</article>
            </main>
            <footer>Footer</footer>
          </div>;`);
    });

    it('should generate code from JSX fragments', () => {
      const code = `
        const Items = () => (
          <>
            <span>One</span>
            <span>Two</span>
          </>
        );
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const Items = () => <>
            <span>One</span>
            <span>Two</span>
          </>;`);
    });

    it('should generate code from self-closing JSX elements', () => {
      const code = `const Input = () => <input type="text" />;`;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const Input = () => <input type="text" />;`);
    });

    it('should generate code with JSX spread attributes', () => {
      const code = `const El = (props) => <div {...props} />;`;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const El = props => <div {...props} />;`);
    });

    it('should remove trailing whitespace from lines', () => {
      // Simulate code that Babel might generate with trailing whitespace
      const code = `function App() {
  return <div>
      <ul>

      </ul>
    </div>;
}`;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      // Should not contain lines with only whitespace
      const lines = result.code.split('\n');
      for (const line of lines) {
        // If a line has any content, it should be more than just whitespace
        // Or it should be completely empty
        if (line.length > 0) {
          expect(line.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle multiple files via generateMultiple', () => {
      const files = new Map<string, t.File>([
        ['file1.tsx', parseCode('const A = () => <div>A</div>;')],
        ['file2.tsx', parseCode('const B = () => <span>B</span>;')],
      ]);

      const results = unwrap(generator.generateMultiple(files));

      expect(results.size).toBe(2);
      expect(results.get('file1.tsx')?.code).toBe(`const A = () => <div>A</div>;`);
      expect(results.get('file2.tsx')?.code).toBe(`const B = () => <span>B</span>;`);
    });

    it('should generate source map when available', () => {
      const code = `const x = 1;`;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      // Source map should be present
      expect(result.map).toBeDefined();
      expect(result.map?.version).toBe(3);
    });
  });

  // ============================================================
  // Comment Preservation Tests
  // ============================================================
  describe('Comment Preservation', () => {
    it('should preserve single-line comments by default', () => {
      const code = `
        // This is a comment
        const x = 1;
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`// This is a comment
const x = 1;`);
    });

    it('should preserve multi-line comments', () => {
      const code = `
        /**
         * This is a JSDoc comment
         */
        const fn = () => {};
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`/**
 * This is a JSDoc comment
 */
const fn = () => {};`);
    });

    it('should preserve inline comments', () => {
      const code = `
        const x = 1; // inline comment
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const x = 1; // inline comment`);
    });

    it('should preserve JSX comments', () => {
      const code = `
        const El = () => (
          <div>
            {/* JSX comment */}
            <span>Content</span>
          </div>
        );
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const El = () => <div>
            {/* JSX comment */}
            <span>Content</span>
          </div>;`);
    });

    it('should not include comments when preserveComments is false', () => {
      const code = `
        // Comment to remove
        const x = 1;
      `;
      const ast = parseCode(code);
      const result = unwrap(generator.generate(ast, { preserveComments: false }));

      expect(result.code).not.toContain('Comment to remove');
    });

    it('should extract comments from a node', () => {
      const code = `
        // Leading comment
        const x = 1; // Trailing comment
      `;
      const ast = parseCode(code);
      const node = ast.program.body[0];

      if (node) {
        const comments = generator.extractComments(node);

        expect(comments.leadingComments).toBeDefined();
        expect(comments.leadingComments?.length).toBeGreaterThan(0);
      }
    });

    it('should attach comments to a node', () => {
      const code = `const x = 1;`;
      const ast = parseCode(code);
      const node = ast.program.body[0];

      if (node) {
        const comments = {
          leadingComments: [
            { type: 'CommentLine' as const, value: ' New comment' },
          ],
        };

        generator.attachComments(node, comments);

        expect(node.leadingComments).toHaveLength(1);
        expect(node.leadingComments?.[0]?.value).toBe(' New comment');
      }
    });

    it('should transfer comments between nodes', () => {
      const code1 = `
        // Source comment
        const x = 1;
      `;
      const code2 = `const y = 2;`;
      const ast1 = parseCode(code1);
      const ast2 = parseCode(code2);
      
      const sourceNode = ast1.program.body[0];
      const targetNode = ast2.program.body[0];

      if (sourceNode && targetNode) {
        const hadLeadingComments = sourceNode.leadingComments !== undefined;
        
        generator.transferComments(sourceNode, targetNode);

        if (hadLeadingComments) {
          expect(sourceNode.leadingComments).toBeUndefined();
          expect(targetNode.leadingComments).toBeDefined();
        }
      }
    });

    it('should remove comments from a node', () => {
      const code = `
        // Comment
        const x = 1;
      `;
      const ast = parseCode(code);
      const node = ast.program.body[0];

      if (node && node.leadingComments) {
        generator.removeComments(node);
        
        expect(node.leadingComments).toBeUndefined();
        expect(node.trailingComments).toBeUndefined();
        expect(node.innerComments).toBeUndefined();
      }
    });
  });

  // ============================================================
  // Indentation Adjustment Tests
  // ============================================================
  describe('Indentation Adjustment', () => {
    describe('detectIndentation', () => {
      it('should detect 2-space indentation', () => {
        const code = `
function test() {
  const x = 1;
  if (true) {
    return x;
  }
}
`;
        const info = generator.detectIndentation(code, 3);

        expect(info.useTabs).toBe(false);
        expect(info.size).toBe(2);
        expect(info.level).toBe(1);
      });

      it('should detect 4-space indentation', () => {
        const code = `
function test() {
    const x = 1;
    if (true) {
        return x;
    }
}
`;
        const info = generator.detectIndentation(code, 3);

        expect(info.useTabs).toBe(false);
        expect(info.size).toBe(4);
        expect(info.level).toBe(1);
      });

      it('should detect tab indentation', () => {
        const code = `
function test() {
\tconst x = 1;
\tif (true) {
\t\treturn x;
\t}
}
`;
        const info = generator.detectIndentation(code, 3);

        expect(info.useTabs).toBe(true);
        expect(info.level).toBe(1);
      });

      it('should return default for out of range line', () => {
        const code = 'const x = 1;';
        const info = generator.detectIndentation(code, 100);

        expect(info.level).toBe(0);
      });

      it('should handle empty lines', () => {
        const code = `
const x = 1;

const y = 2;
`;
        const info = generator.detectIndentation(code, 2);
        expect(info).toBeDefined();
      });
    });

    describe('adjustIndentation', () => {
      it('should adjust code to match target indentation level', () => {
        const code = `const x = 1;
const y = 2;`;
        
        const targetIndent: IndentationInfo = {
          char: '  ',
          size: 2,
          useTabs: false,
          level: 2,
        };

        const adjusted = generator.adjustIndentation(code, targetIndent);

        const lines = adjusted.split('\n');
        expect(lines[0]).toMatch(/^    const x = 1/);
        expect(lines[1]).toMatch(/^    const y = 2/);
      });

      it('should preserve relative indentation within code', () => {
        const code = `if (true) {
  const x = 1;
}`;
        
        const targetIndent: IndentationInfo = {
          char: '  ',
          size: 2,
          useTabs: false,
          level: 1,
        };

        const adjusted = generator.adjustIndentation(code, targetIndent, true);

        const lines = adjusted.split('\n');
        expect(lines[0]).toMatch(/^  if \(true\)/);
        expect(lines[1]).toMatch(/^    const x = 1/);
        expect(lines[2]).toMatch(/^  }/);
      });

      it('should handle tab indentation', () => {
        const code = `const x = 1;`;
        
        const targetIndent: IndentationInfo = {
          char: '\t',
          size: 1,
          useTabs: true,
          level: 2,
        };

        const adjusted = generator.adjustIndentation(code, targetIndent);

        expect(adjusted).toBe('\t\tconst x = 1;');
      });

      it('should preserve empty lines', () => {
        const code = `const x = 1;

const y = 2;`;
        
        const targetIndent: IndentationInfo = {
          char: '  ',
          size: 2,
          useTabs: false,
          level: 1,
        };

        const adjusted = generator.adjustIndentation(code, targetIndent);

        const lines = adjusted.split('\n');
        expect(lines[0]).toMatch(/^  const x = 1/);
        expect(lines[1]).toBe('');
        expect(lines[2]).toMatch(/^  const y = 2/);
      });

      it('should handle deeply nested code', () => {
        const code = `function outer() {
  function inner() {
    return 1;
  }
}`;
        
        const targetIndent: IndentationInfo = {
          char: '  ',
          size: 2,
          useTabs: false,
          level: 2,
        };

        const adjusted = generator.adjustIndentation(code, targetIndent, true);

        const lines = adjusted.split('\n');
        expect(lines[0]).toMatch(/^    function outer/);
        expect(lines[1]).toMatch(/^      function inner/);
        expect(lines[2]).toMatch(/^        return 1/);
      });
    });

    describe('adjustNodeIndentation', () => {
      it('should adjust node code to match target context', () => {
        const nodeCode = `<span>Content</span>`;
        const targetCode = `
function Component() {
  return (
    <div>
      
    </div>
  );
}
`;
        const adjusted = generator.adjustNodeIndentation(nodeCode, targetCode, 5);

        // Should have indentation matching line 5 (inside <div>)
        expect(adjusted.trim()).toBe('<span>Content</span>');
      });
    });
  });

  // ============================================================
  // Options Tests
  // ============================================================
  describe('Options Handling', () => {
    it('should use default options when none provided', () => {
      const defaultGenerator = new CodeGenerator();
      const options = defaultGenerator.getOptions();

      expect(options.preserveComments).toBe(true);
      expect(options.formatOutput).toBe(true);
      expect(options.indentSize).toBe(2);
      expect(options.useTabs).toBe(false);
    });

    it('should merge custom options with defaults', () => {
      const customGenerator = new CodeGenerator({ indentSize: 4 });
      const options = customGenerator.getOptions();

      expect(options.indentSize).toBe(4);
      expect(options.preserveComments).toBe(true); // default preserved
    });

    it('should allow updating options', () => {
      generator.updateOptions({ indentSize: 8 });
      const options = generator.getOptions();

      expect(options.indentSize).toBe(8);
    });

    it('should override options per-generate call', () => {
      const code = `
        // Comment
        const x = 1;
      `;
      const ast = parseCode(code);

      // Generator has preserveComments: true by default
      const withComments = unwrap(generator.generate(ast));
      expect(withComments.code).toBe(`// Comment
const x = 1;`);

      // Override for single call
      const withoutComments = unwrap(generator.generate(ast, { preserveComments: false }));
      expect(withoutComments.code).not.toContain('Comment');
    });
  });

  // ============================================================
  // Error Handling Tests
  // ============================================================
  describe('Error Handling', () => {
    it('should return Err for invalid AST', () => {
      const invalidAst: t.File = { type: 'Invalid' } as unknown as t.File;
      const result = generator.generate(invalidAst);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe('TransformError');
        expect(result.error.code).toBe('E060');
      }
    });

    it('should include error code in TransformError', () => {
      const invalidAst: t.File = { type: 'Invalid' } as unknown as t.File;
      const result = generator.generate(invalidAst);

      if (!result.ok) {
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toContain('Code generation failed');
      }
    });
  });

  // ============================================================
  // Integration Tests with Real JSX Patterns
  // ============================================================
  describe('Integration: Real JSX Patterns', () => {
    it('should handle conditional rendering', () => {
      const code = `
        const El = ({ show }) => (
          <div>
            {show && <span>Visible</span>}
          </div>
        );
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const El = ({
  show
}) => <div>
            {show && <span>Visible</span>}
          </div>;`);
    });

    it('should handle ternary expressions', () => {
      const code = `
        const El = ({ loading }) => (
          <div>
            {loading ? <span>Loading...</span> : <span>Done</span>}
          </div>
        );
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const El = ({
  loading
}) => <div>
            {loading ? <span>Loading...</span> : <span>Done</span>}
          </div>;`);
    });

    it('should handle map expressions', () => {
      const code = `
        const List = ({ items }) => (
          <ul>
            {items.map(item => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        );
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const List = ({
  items
}) => <ul>
            {items.map(item => <li key={item.id}>{item.name}</li>)}
          </ul>;`);
    });

    it('should handle hooks in components', () => {
      const code = `
        const Counter = () => {
          const [count, setCount] = useState(0);

          return (
            <button onClick={() => setCount(c => c + 1)}>
              Count: {count}
            </button>
          );
        };
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBe(`const Counter = () => {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>
              Count: {count}
            </button>;
};`);
    });

    it('should handle TypeScript generics in JSX', () => {
      const code = `
        const List = <T,>({ items }: { items: T[] }) => (
          <ul>
            {items.map((item, i) => <li key={i}>{String(item)}</li>)}
          </ul>
        );
      `;
      const ast = parseCode(code);
      const result = generateAndUnwrap(ast);

      expect(result.code).toBeDefined();
    });
  });

  // ============================================================
  // Result-Based Code Generation Tests (Task 13.5)
  // ============================================================
  describe('generateCode (Result-based)', () => {
    it('should return Ok<string> for valid AST', async () => {
      const code = `const x = 1;`;
      const ast = parseCode(code);

      // Import the generateCode function
      const { generateCode } = await import('../index.js');

      const result = generateCode(ast);

      // Debug: log the result
      if (!result.ok) {
        console.log('Error:', result.error);
      }

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`const x = 1;`);
      }
    });

    it('should return Ok<string> for valid JSX AST', async () => {
      const code = `const App = () => <div>Hello</div>;`;
      const ast = parseCode(code);

      const { generateCode } = await import('../index.js');

      const result = generateCode(ast);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`const App = () => <div>Hello</div>;`);
      }
    });

    it('should return Err<TransformError> for generation failures', async () => {
      const invalidAst: t.File = { type: 'Invalid' } as unknown as t.File;

      const { generateCode } = await import('../index.js');

      const result = generateCode(invalidAst);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe('TransformError');
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toContain('Code generation failed');
      }
    });

    it('should return Err with proper error details for invalid AST', async () => {
      // Use the same clearly invalid AST structure as the earlier error test
      const invalidAst: t.File = { type: 'Invalid' } as unknown as t.File;

      const { generateCode } = await import('../index.js');

      const result = generateCode(invalidAst);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe('TransformError');
        expect(result.error.message).toBeDefined();
        expect(result.error.code).toBe('E060');
      }
    });

    it('should preserve comments in generated code when successful', async () => {
      const code = `
        // This is a comment
        const x = 1;
      `;
      const ast = parseCode(code);

      const { generateCode } = await import('../index.js');

      const result = generateCode(ast);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('// This is a comment');
      }
    });

    it('should accept optional generator options', async () => {
      const code = `
        // Comment to remove
        const x = 1;
      `;
      const ast = parseCode(code);

      const { generateCode } = await import('../index.js');

      const result = generateCode(ast, { preserveComments: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toContain('Comment to remove');
        expect(result.value).toBe('const x = 1;');
      }
    });

    it('should handle complex nested JSX structures', async () => {
      const code = `
        const Layout = () => (
          <div>
            <header>Header</header>
            <main>
              <article>Content</article>
            </main>
            <footer>Footer</footer>
          </div>
        );
      `;
      const ast = parseCode(code);

      const { generateCode } = await import('../index.js');

      const result = generateCode(ast);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('<header>Header</header>');
        expect(result.value).toContain('<main>');
        expect(result.value).toContain('<footer>Footer</footer>');
      }
    });
  });
});
