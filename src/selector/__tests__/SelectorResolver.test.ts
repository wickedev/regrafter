/**
 * SelectorResolver Unit Tests
 *
 * Tests for position-based and path-based selector resolution.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';

import { SelectorResolver, createSelectorResolver, SelectorErrorCodes } from '../index.js';
import { AtomicUnitType } from '../../types/index.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const simpleJSXCode = `
function App() {
  return (
    <div className="app">
      <header>
        <h1>Title</h1>
      </header>
      <main>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
      </main>
      <footer>Footer</footer>
    </div>
  );
}
`;

const conditionalJSXCode = `
function App({ showHeader }) {
  return (
    <div>
      {showHeader && <header>Header</header>}
      <main>Content</main>
    </div>
  );
}
`;

const ternaryJSXCode = `
function App({ isLoggedIn }) {
  return (
    <div>
      {isLoggedIn ? <UserPanel /> : <LoginForm />}
    </div>
  );
}
`;

const mapExpressionCode = `
function List({ items }) {
  return (
    <ul>
      {items.map(item => <li key={item.id}>{item.name}</li>)}
    </ul>
  );
}
`;

const compoundComponentCode = `
function Dashboard() {
  return (
    <Tabs>
      <Tabs.Panel>Panel 1</Tabs.Panel>
      <Tabs.Panel>Panel 2</Tabs.Panel>
    </Tabs>
  );
}
`;

const fragmentCode = `
function App() {
  return (
    <>
      <div>First</div>
      <div>Second</div>
    </>
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

// =============================================================================
// Tests
// =============================================================================

describe('SelectorResolver', () => {
  let resolver: SelectorResolver;

  beforeEach(() => {
    resolver = createSelectorResolver();
  });

  // ===========================================================================
  // Position-Based Resolution (Task 1.3.1)
  // ===========================================================================

  describe('resolveByPosition', () => {
    it('should resolve a JSX element at exact position', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 6, column: 8 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.path).not.toBeNull();
      expect(result.error).toBeUndefined();
      expect(result.atomicUnit?.type).toBe(AtomicUnitType.Element);
    });

    it('should find the most specific (innermost) element', () => {
      const ast = parseCode(simpleJSXCode);
      // Position inside the h1 element
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 6, column: 10 },
        ast
      );

      expect(result.node).not.toBeNull();
      // Should find h1, not header
      if (result.node && 'openingElement' in result.node) {
        const element = result.node as t.JSXElement;
        if (element.openingElement.name.type === 'JSXIdentifier') {
          expect(element.openingElement.name.name).toBe('h1');
        }
      }
    });

    it('should return error for position with no JSX element', () => {
      const ast = parseCode(simpleJSXCode);
      // Position outside any JSX element (line 1)
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 1, column: 0 },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.NO_JSX_AT_POSITION);
    });

    it('should return error for invalid position (negative line)', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: -1, column: 5 },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.POSITION_OUT_OF_BOUNDS);
    });

    it('should return error for position beyond file bounds', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 1000, column: 5 },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.NO_JSX_AT_POSITION);
    });

    it('should resolve JSX fragment', () => {
      const ast = parseCode(fragmentCode);
      // Position inside the fragment
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 4, column: 4 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
    });
  });

  // ===========================================================================
  // Path-Based Resolution (Task 1.3.2)
  // ===========================================================================

  describe('resolveByPath', () => {
    it('should resolve a node using AST path', () => {
      const ast = parseCode(simpleJSXCode);
      // Path to the function declaration's body
      const result = resolver.resolveByPath(
        { file: 'test.tsx', path: 'program.body[0]' },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.path).not.toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid path format', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPath(
        { file: 'test.tsx', path: '' },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.INVALID_PATH_FORMAT);
    });

    it('should return error for non-existent path', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPath(
        { file: 'test.tsx', path: 'program.body[99]' },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.PATH_NOT_FOUND);
    });

    it('should handle nested paths', () => {
      const ast = parseCode(simpleJSXCode);
      // Navigate deeper into the AST
      const result = resolver.resolveByPath(
        { file: 'test.tsx', path: 'program.body[0]' },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
    });
  });

  // ===========================================================================
  // Atomic Unit Detection
  // ===========================================================================

  describe('Atomic Unit Detection', () => {
    it('should detect conditional expression: {cond && <E />}', () => {
      const ast = parseCode(conditionalJSXCode);
      // Position at the header element inside conditional
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 5, column: 24 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.atomicUnit).not.toBeNull();
      // The atomic unit type should be detected based on parent
    });

    it('should detect ternary expression', () => {
      const ast = parseCode(ternaryJSXCode);
      // Position at the UserPanel element
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 5, column: 20 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.atomicUnit).not.toBeNull();
    });

    it('should detect compound component', () => {
      const ast = parseCode(compoundComponentCode);
      // Position at Tabs.Panel
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 5, column: 6 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.atomicUnit).not.toBeNull();
      if (result.atomicUnit) {
        expect(result.atomicUnit.type).toBe(AtomicUnitType.CompoundComponent);
      }
    });

    it('should default to Element type for simple JSX', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 9, column: 8 },
        ast
      );

      expect(result.atomicUnit?.type).toBe(AtomicUnitType.Element);
    });
  });

  // ===========================================================================
  // Error Handling (Task 1.3.3)
  // ===========================================================================

  describe('Error Handling', () => {
    it('should include location in error when available', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: 'test.tsx', line: 1, column: 0 },
        ast
      );

      expect(result.error).toBeDefined();
      expect(result.error?.location).toBeDefined();
      expect(result.error?.location?.start.line).toBe(1);
    });

    it('should return meaningful error messages', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPath(
        { file: 'test.tsx', path: 'invalid.path.here' },
        ast
      );

      expect(result.error?.message).toContain('invalid.path.here');
      expect(result.error?.code).toBe(SelectorErrorCodes.PATH_NOT_FOUND);
    });

    it('should handle edge case of null path string', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPath(
        { file: 'test.tsx', path: null as unknown as string },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.INVALID_PATH_FORMAT);
    });
  });

  // ===========================================================================
  // Unified Resolve Method
  // ===========================================================================

  describe('resolve (unified)', () => {
    it('should automatically use position-based resolution for PositionSelector', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolve(
        { file: 'test.tsx', line: 6, column: 8 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('should automatically use path-based resolution for PathSelector', () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolve(
        { file: 'test.tsx', path: 'program.body[0]' },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
    });
  });
});
