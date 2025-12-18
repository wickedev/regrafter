/**
 * JSXTransformer Result-based Tests
 *
 * Tests for insertion strategies returning Result<InsertionPoint, TransformError>
 * Following the Result pattern for functional error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import traverseFn, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

const traverse = traverseFn as any as typeof traverseFn.default;

import { JSXTransformer, createJSXTransformer } from '../index.js';
import { Move } from '../../types/index.js';
import { isOk, isErr } from '../../result/index.js';

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

describe('JSXTransformer - Result Pattern', () => {
  let transformer: JSXTransformer;

  beforeEach(() => {
    transformer = createJSXTransformer();
  });

  // ===========================================================================
  // moveInside - Success Cases
  // ===========================================================================

  describe('moveInside returning Result', () => {
    it('should return Ok with InsertionPoint when move succeeds', () => {
      const ast = parseCode(simpleJSXCode);
      const footer = findJSXElementByTag(ast, 'footer');
      const main = findJSXElementByTag(ast, 'main');

      expect(footer).not.toBeNull();
      expect(main).not.toBeNull();

      const result = transformer.move(ast, footer!, main!, Move.Inside);

      // Should return Ok result
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // InsertionPoint should contain the transformed AST
        expect(result.value.ast).toBeDefined();
        expect(result.value.movedNode).toBeDefined();
      }
    });

    it('should return Ok with wasNoOp flag when move is no-op', () => {
      const ast = parseCode(simpleJSXCode);
      const header = findJSXElementByTag(ast, 'header');

      const result = transformer.move(ast, header!, header!, Move.Inside);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.wasNoOp).toBe(true);
      }
    });
  });

  // ===========================================================================
  // moveInside - Error Cases
  // ===========================================================================

  describe('moveInside errors', () => {
    it('should return Err with TransformError for invalid source', () => {
      const ast = parseCode(simpleJSXCode);
      const main = findJSXElementByTag(ast, 'main');

      // Create invalid path (FunctionDeclaration is not valid JSX source)
      let invalidPath: NodePath | null = null;
      traverse(ast, {
        FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
          invalidPath = path;
          path.stop();
        },
      });

      expect(invalidPath).not.toBeNull();
      expect(main).not.toBeNull();

      const result = transformer.move(ast, invalidPath!, main!, Move.Inside);

      // Should return Err result
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error._tag).toBe('TransformError');
        expect(result.error.message).toContain('Source must be');
      }
    });

    it('should return Err for circular move', () => {
      const ast = parseCode(nestedJSXCode);
      const section = findJSXElementByTag(ast, 'section');
      const h1 = findJSXElementByTag(ast, 'h1');

      expect(section).not.toBeNull();
      expect(h1).not.toBeNull();

      const result = transformer.move(ast, section!, h1!, Move.Inside);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error._tag).toBe('TransformError');
        expect(result.error.message).toContain('Cannot move an element into itself');
      }
    });
  });

  // ===========================================================================
  // moveBefore - Success Cases
  // ===========================================================================

  describe('moveBefore returning Result', () => {
    it('should return Ok when moving element before target', () => {
      const ast = parseCode(simpleJSXCode);
      const footer = findJSXElementByTag(ast, 'footer');
      const header = findJSXElementByTag(ast, 'header');

      expect(footer).not.toBeNull();
      expect(header).not.toBeNull();

      const result = transformer.move(ast, footer!, header!, Move.Before);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.ast).toBeDefined();
        expect(result.value.movedNode).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // moveBefore - Error Cases
  // ===========================================================================

  describe('moveBefore errors', () => {
    it('should return Err for invalid source', () => {
      const ast = parseCode(simpleJSXCode);
      const header = findJSXElementByTag(ast, 'header');

      let invalidPath: NodePath | null = null;
      traverse(ast, {
        FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
          invalidPath = path;
          path.stop();
        },
      });

      const result = transformer.move(ast, invalidPath!, header!, Move.Before);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error._tag).toBe('TransformError');
      }
    });
  });

  // ===========================================================================
  // moveAfter - Success Cases
  // ===========================================================================

  describe('moveAfter returning Result', () => {
    it('should return Ok when moving element after target', () => {
      const ast = parseCode(simpleJSXCode);
      const header = findJSXElementByTag(ast, 'header');
      const footer = findJSXElementByTag(ast, 'footer');

      expect(header).not.toBeNull();
      expect(footer).not.toBeNull();

      const result = transformer.move(ast, header!, footer!, Move.After);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.ast).toBeDefined();
        expect(result.value.movedNode).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // moveAfter - Error Cases
  // ===========================================================================

  describe('moveAfter errors', () => {
    it('should return Err for invalid source', () => {
      const ast = parseCode(simpleJSXCode);
      const footer = findJSXElementByTag(ast, 'footer');

      let invalidPath: NodePath | null = null;
      traverse(ast, {
        FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
          invalidPath = path;
          path.stop();
        },
      });

      const result = transformer.move(ast, invalidPath!, footer!, Move.After);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error._tag).toBe('TransformError');
      }
    });
  });
});
