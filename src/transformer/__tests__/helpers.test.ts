/**
 * Transformer Helpers Unit Tests
 *
 * Tests for transformer helper functions that use Result pattern.
 * Task 13.3: Write tests for transformer helpers with Result
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseFn, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

const traverse = traverseFn as any as typeof traverseFn.default;

import { JSXTransformer } from '../jsx-transformer.js';
import { isOk, isErr } from '../../result/index.js';
import { type ValidationErrorType } from '../../errors/index.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const simpleJSXCode = `
function App() {
  return (
    <div>
      <header>Header</header>
      <main>Main</main>
      <footer>Footer</footer>
    </div>
  );
}
`;

const nestedJSXCode = `
function App() {
  return (
    <div>
      <section>
        <h1>Title</h1>
        <p>Paragraph</p>
      </section>
      <aside>Sidebar</aside>
    </div>
  );
}
`;

// =============================================================================
// Helper Functions
// =============================================================================

function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

function findJSXElementByTag(ast: t.File, tagName: string): NodePath | null {
  let found: NodePath | null = null;

  traverse(ast, {
    JSXElement(path: NodePath<t.JSXElement>) {
      const opening = path.node.openingElement;
      if (
        opening.name.type === 'JSXIdentifier' &&
        opening.name.name === tagName
      ) {
        found = path;
        path.stop();
      }
    },
  });

  return found;
}

// =============================================================================
// Tests
// =============================================================================

describe('JSXTransformer Helpers with Result', () => {
  describe('validateMove', () => {
    it('should return Ok for valid move', () => {
      const transformer = new JSXTransformer();
      const ast = parseCode(simpleJSXCode);
      const sourcePath = findJSXElementByTag(ast, 'header');
      const targetPath = findJSXElementByTag(ast, 'main');

      expect(sourcePath).not.toBeNull();
      expect(targetPath).not.toBeNull();

      const result = transformer.validateMove(
        sourcePath!,
        targetPath!,
        'Inside' as any
      );

      expect(isOk(result)).toBe(true);
    });

    it('should return Err<ValidationError> for circular move', () => {
      const transformer = new JSXTransformer();
      const ast = parseCode(nestedJSXCode);
      const sectionPath = findJSXElementByTag(ast, 'section');
      const h1Path = findJSXElementByTag(ast, 'h1');

      expect(sectionPath).not.toBeNull();
      expect(h1Path).not.toBeNull();

      // Try to move section into its own child
      const result = transformer.validateMove(
        sectionPath!,
        h1Path!,
        'Inside' as any
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        const error = result.error as ValidationErrorType;
        expect(error._tag).toBe('ValidationError');
        expect(error.message).toContain('descendants');
      }
    });

    it('should return Err<ValidationError> for invalid source', () => {
      const transformer = new JSXTransformer();
      const ast = parseCode(simpleJSXCode);

      // Create a mock invalid source path (not a JSX element)
      let invalidSourcePath: NodePath | null = null;
      traverse(ast, {
        Identifier(path: NodePath<t.Identifier>) {
          if (path.node.name === 'App') {
            invalidSourcePath = path;
            path.stop();
          }
        },
      });

      const targetPath = findJSXElementByTag(ast, 'main');

      expect(invalidSourcePath).not.toBeNull();
      expect(targetPath).not.toBeNull();

      const result = transformer.validateMove(
        invalidSourcePath!,
        targetPath!,
        'Inside' as any
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        const error = result.error as ValidationErrorType;
        expect(error._tag).toBe('ValidationError');
        expect(error.message).toContain('Source');
      }
    });

  });

  describe('getIndexInParent', () => {
    it('should return Ok<number> for valid node with parent', () => {
      const transformer = new JSXTransformer();
      const ast = parseCode(simpleJSXCode);
      const mainPath = findJSXElementByTag(ast, 'main');

      expect(mainPath).not.toBeNull();

      const result = transformer.getIndexInParent(mainPath!);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // main should be at index 1 (after header)
        expect(result.value).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return Err<ValidationError> when node cannot be found in parent', () => {
      const transformer = new JSXTransformer();

      // Create a simple test case where we have a node whose parent type
      // is not one of the expected container types
      const code = `const x = 42;`;
      const ast = parseCode(code);

      let numericLiteralPath: NodePath | null = null;
      traverse(ast, {
        NumericLiteral(path: NodePath<t.NumericLiteral>) {
          if (path.node.value === 42) {
            numericLiteralPath = path;
            path.stop();
          }
        },
      });

      if (numericLiteralPath) {
        const result = transformer.getIndexInParent(numericLiteralPath);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          const error = result.error as ValidationErrorType;
          expect(error._tag).toBe('ValidationError');
          expect(error.message).toContain('not found');
        }
      }
    });
  });

  describe('getChildren', () => {
    it('should return Ok<JSXChild[]> for JSX element with children', () => {
      const transformer = new JSXTransformer();
      const ast = parseCode(simpleJSXCode);
      const divPath = findJSXElementByTag(ast, 'div');

      expect(divPath).not.toBeNull();

      const result = transformer.getChildren(divPath!);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // div should have 3 children: header, main, footer (plus whitespace text nodes)
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    it('should return Ok<JSXChild[]> for empty JSX element', () => {
      const transformer = new JSXTransformer();
      const emptyCode = `
        function App() {
          return <div></div>;
        }
      `;
      const ast = parseCode(emptyCode);
      const divPath = findJSXElementByTag(ast, 'div');

      expect(divPath).not.toBeNull();

      const result = transformer.getChildren(divPath!);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });

    it('should return Err<ValidationError> for non-JSX element', () => {
      const transformer = new JSXTransformer();
      const ast = parseCode(simpleJSXCode);

      // Find a non-JSX element (e.g., Identifier)
      let identifierPath: NodePath | null = null;
      traverse(ast, {
        Identifier(path: NodePath<t.Identifier>) {
          if (path.node.name === 'App') {
            identifierPath = path;
            path.stop();
          }
        },
      });

      expect(identifierPath).not.toBeNull();

      const result = transformer.getChildren(identifierPath!);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        const error = result.error as ValidationErrorType;
        expect(error._tag).toBe('ValidationError');
        expect(error.message).toContain('children');
      }
    });
  });

  describe('getSiblings', () => {
    it('should return Ok<Node[]> for node with siblings', () => {
      const transformer = new JSXTransformer();
      const ast = parseCode(simpleJSXCode);
      const mainPath = findJSXElementByTag(ast, 'main');

      expect(mainPath).not.toBeNull();

      const result = transformer.getSiblings(mainPath!);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should include header, main, footer (plus whitespace)
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    it('should walk up tree to find valid container for siblings', () => {
      const transformer = new JSXTransformer();

      // Test with a node that needs to walk up the tree to find siblings
      // (e.g., a string literal in an object property should walk up to Program)
      const code = `const obj = { key: "value" };`;
      const ast = parseCode(code);

      let stringLiteralPath: NodePath | null = null;
      traverse(ast, {
        StringLiteral(path: NodePath<t.StringLiteral>) {
          if (path.node.value === 'value') {
            stringLiteralPath = path;
            path.stop();
          }
        },
      });

      if (stringLiteralPath) {
        const result = transformer.getSiblings(stringLiteralPath);

        // Should successfully walk up to find Program node's children
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(Array.isArray(result.value)).toBe(true);
          expect(result.value.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
