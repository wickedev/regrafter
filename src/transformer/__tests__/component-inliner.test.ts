/**
 * ComponentInliner Integration Tests
 *
 * Tests for inlining React components by replacing component calls
 * with their implementation.
 *
 * Following TDD: Red → Green → Refactor
 * Phase 1: Simple components without props or hooks
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import type * as t from '@babel/types';
import { ComponentInliner } from '../component-inliner.js';

// =============================================================================
// Test Fixtures - Simple React Components
// =============================================================================

const simpleComponentNoProps = `
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
`;

const expectedInlinedNoProps = `
function App() {
  return (
    <div>
      <div>Hello World</div>
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

function normalizeCode(code: string): string {
  const ast = parseCode(code);
  const output = generate(ast, { retainLines: false, compact: false });
  return output.code.trim();
}

// =============================================================================
// Test Suite
// =============================================================================

describe('ComponentInliner - Phase 1: Simple Components', () => {
  describe('Iteration 1: Basic Inlining with No Props', () => {
    it('should inline a simple component with no props', () => {
      // ARRANGE
      const ast = parseCode(simpleComponentNoProps);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'Greeting');

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);

      // Verify the output matches expected
      const output = generate(result.ast, { retainLines: false, compact: false });
      const expected = normalizeCode(expectedInlinedNoProps);
      const actual = normalizeCode(output.code);

      expect(actual).toBe(expected);
    });
  });
});
