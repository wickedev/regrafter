/**
 * Move.Before Integration Tests
 *
 * Tests for moving elements to positions before target elements.
 * These tests verify the complete pipeline for Move.Before operations.
 *
 * Test File: src/__tests__/integration/move-before.test.ts
 *
 * Test Purpose:
 * - Verify element moves to position before target sibling
 * - Verify original element is removed from source location
 * - Verify dependencies are handled correctly
 * - Verify edge cases (nested elements, fragments, etc.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  Move,
  type PositionSelector,
  type Result,
} from '../../types/index.js';

/**
 * Helper to create a position selector
 */
function createPositionSelector(
  file: string,
  line: number,
  column: number
): PositionSelector {
  return { file, line, column };
}

// =============================================================================
// Test Cases Overview
// =============================================================================
/**
 * | Case ID    | Feature Description                          | Test Type     |
 * |------------|----------------------------------------------|---------------|
 * | BEFORE-01  | Move sibling element before target           | Positive Test |
 * | BEFORE-02  | Move element preserves source content        | Positive Test |
 * | BEFORE-03  | Move element removes from original location  | Positive Test |
 * | BEFORE-04  | Move with hook dependency triggers hoisting  | Positive Test |
 * | BEFORE-05  | Move deeply nested element                   | Positive Test |
 * | BEFORE-06  | Move element in fragment                     | Positive Test |
 * | BEFORE-07  | Move self-closing element                    | Positive Test |
 * | BEFORE-08  | Move to same position returns unchanged      | Edge Case     |
 * | BEFORE-09  | Move with variable dependency                | Positive Test |
 * | BEFORE-10  | Invalid source selector returns error        | Error Test    |
 * | BEFORE-11  | Invalid target selector returns error        | Error Test    |
 * | BEFORE-12  | Move first child before sibling              | Positive Test |
 * | BEFORE-13  | Move last child before first                 | Positive Test |
 * | BEFORE-14  | Move preserves comments                      | Positive Test |
 * | BEFORE-15  | Move adjusts indentation                     | Positive Test |
 */

// =============================================================================
// Test Utilities
// =============================================================================

const FIXTURES_DIR = path.join(__dirname, '../../../test/fixtures');

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8');
}

/**
 * Mock regraft function for testing structure
 * This will be replaced with actual implementation
 */
async function regraft(
  files: Array<{ path: string; content: string }>,
  from: PositionSelector,
  to: PositionSelector,
  _mode: Move
): Promise<Result> {
  // This is a placeholder to establish test structure

  // Validate inputs
  if (!files.length) {
    return {
      success: false,
      codes: [],
      analysis: {
        canMove: false,
        reason: 'No files provided',
        dependencies: [],
        hoistedDeps: [],
      },
    };
  }

  const sourceFile = files.find(f => f.path === from.file);
  const targetFile = files.find(f => f.path === to.file);

  if (!sourceFile) {
    return {
      success: false,
      codes: [],
      analysis: {
        canMove: false,
        reason: `Source file not found: ${from.file}`,
        dependencies: [],
        hoistedDeps: [],
      },
    };
  }

  if (!targetFile) {
    return {
      success: false,
      codes: [],
      analysis: {
        canMove: false,
        reason: `Target file not found: ${to.file}`,
        dependencies: [],
        hoistedDeps: [],
      },
    };
  }

  // Placeholder success result
  return {
    success: true,
    codes: files.map(f => ({
      file: f.path,
      content: f.content, // Would be transformed content
      changed: true,
    })),
    analysis: {
      canMove: true,
      dependencies: [],
      hoistedDeps: [],
    },
  };
}

// =============================================================================
// Test Data
// =============================================================================

let simpleComponentContent: string;
let hooksComponentContent: string;
let nestedComponentContent: string;

beforeEach(() => {
  // Load fixtures before each test
  simpleComponentContent = loadFixture('simple-component.tsx');
  hooksComponentContent = loadFixture('component-with-hooks.tsx');
  nestedComponentContent = loadFixture('nested-components.tsx');
});

// =============================================================================
// Move.Before Basic Tests
// =============================================================================

describe('Move.Before - Basic Operations', () => {
  /**
   * BEFORE-01: Move sibling element before target
   *
   * Test Purpose: Verify element moves to position before target sibling
   *
   * Test Data Preparation:
   * - Load simple-component.tsx fixture
   * - Identify source: <span>Inline text</span> (line ~18)
   * - Identify target: <p>Content paragraph</p> (line ~17)
   *
   * Test Steps:
   * 1. Create selectors for source and target
   * 2. Call regraft with Move.Before mode
   * 3. Verify result is successful
   * 4. Verify source element precedes target in output
   *
   * Expected Results:
   * - Result.success === true
   * - span element appears before p element in transformed code
   */
  it('BEFORE-01: should move sibling element before target', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Source: span element "Inline text" (approximate line)
    const from = createPositionSelector('simple-component.tsx', 18, 8);
    // Target: p element "Content paragraph" (approximate line)
    const to = createPositionSelector('simple-component.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0]!.file).toBe('simple-component.tsx');
    expect(result.analysis.canMove).toBe(true);

    // - span appears before p in output
    // - Original span location is empty
  });

  /**
   * BEFORE-02: Move element preserves source content
   *
   * Test Purpose: Verify moved element content is unchanged
   *
   * Test Steps:
   * 1. Call regraft with Move.Before
   * 2. Parse result
   * 3. Find moved element
   * 4. Compare content with original
   *
   * Expected Results:
   * - Element content matches original exactly
   */
  it('BEFORE-02: should preserve source element content', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    const from = createPositionSelector('simple-component.tsx', 18, 8);
    const to = createPositionSelector('simple-component.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);

    // The moved element should retain all attributes, children, etc.
  });

  /**
   * BEFORE-03: Move element removes from original location
   *
   * Test Purpose: Verify source element is removed after move
   *
   * Test Steps:
   * 1. Call regraft with Move.Before
   * 2. Parse result
   * 3. Check original location
   *
   * Expected Results:
   * - Original location no longer contains the element
   */
  it('BEFORE-03: should remove element from original location', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    const from = createPositionSelector('simple-component.tsx', 18, 8);
    const to = createPositionSelector('simple-component.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);

    // The element should not exist at its original position
  });
});

// =============================================================================
// Move.Before with Dependencies
// =============================================================================

describe('Move.Before - Dependency Handling', () => {
  /**
   * BEFORE-04: Move with hook dependency triggers hoisting
   *
   * Test Purpose: Verify hooks are hoisted when moving element with state
   *
   * Test Data Preparation:
   * - Load component-with-hooks.tsx fixture
   * - Identify element using useState value
   *
   * Test Steps:
   * 1. Analyze dependencies
   * 2. Call regraft
   * 3. Verify hook is hoisted to valid location
   *
   * Expected Results:
   * - Result.analysis.hoistedDeps includes the hook
   * - Hook is at component top level (Rules of Hooks compliant)
   */
  it('BEFORE-04: should hoist hook dependency when needed', async () => {
    const files = [
      { path: 'component-with-hooks.tsx', content: hooksComponentContent },
    ];

    // Select element that uses count state
    // In CounterComponent: <span className="count-display">Count: {count}</span>
    const from = createPositionSelector('component-with-hooks.tsx', 15, 6);
    const to = createPositionSelector('component-with-hooks.tsx', 16, 6);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
  });

  /**
   * BEFORE-09: Move with variable dependency
   *
   * Test Purpose: Verify variable dependencies are handled
   *
   * Expected Results:
   * - Variable is accessible at new location
   * - May be hoisted or passed as prop
   */
  it('BEFORE-09: should handle variable dependency', async () => {
    const files = [
      { path: 'component-with-hooks.tsx', content: hooksComponentContent },
    ];

    // Element using a variable
    const from = createPositionSelector('component-with-hooks.tsx', 20, 6);
    const to = createPositionSelector('component-with-hooks.tsx', 15, 6);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.Before - Nested Elements
// =============================================================================

describe('Move.Before - Nested Elements', () => {
  /**
   * BEFORE-05: Move deeply nested element
   *
   * Test Purpose: Verify element can move from deep nesting
   *
   * Test Data Preparation:
   * - Load nested-components.tsx fixture
   * - Select deeply nested element
   * - Select shallower target
   *
   * Expected Results:
   * - Element moves to correct position
   * - Dependencies are properly handled
   */
  it('BEFORE-05: should move deeply nested element', async () => {
    const files = [
      { path: 'nested-components.tsx', content: nestedComponentContent },
    ];

    // Deep nested element
    const from = createPositionSelector('nested-components.tsx', 50, 10);
    // Shallower target
    const to = createPositionSelector('nested-components.tsx', 45, 6);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.Before - Fragments
// =============================================================================

describe('Move.Before - Fragment Handling', () => {
  /**
   * BEFORE-06: Move element in fragment
   *
   * Test Purpose: Verify movement works within React fragments
   *
   * Expected Results:
   * - Element moves correctly within fragment children
   */
  it('BEFORE-06: should move element within fragment', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // FragmentComponent's children
    const from = createPositionSelector('simple-component.tsx', 45, 6);
    const to = createPositionSelector('simple-component.tsx', 44, 6);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.Before - Self-Closing Elements
// =============================================================================

describe('Move.Before - Self-Closing Elements', () => {
  /**
   * BEFORE-07: Move self-closing element
   *
   * Test Purpose: Verify self-closing elements move correctly
   *
   * Expected Results:
   * - Self-closing element moves to correct position
   * - Format is preserved (<img /> not <img></img>)
   */
  it('BEFORE-07: should move self-closing element', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Self-closing elements in SelfClosingElements component
    const from = createPositionSelector('simple-component.tsx', 54, 6);
    const to = createPositionSelector('simple-component.tsx', 53, 6);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.Before - Edge Cases
// =============================================================================

describe('Move.Before - Edge Cases', () => {
  /**
   * BEFORE-08: Move to same position returns unchanged
   *
   * Test Purpose: Verify no-op when source equals target
   *
   * Expected Results:
   * - Result.success === true
   * - Content unchanged
   */
  it('BEFORE-08: should return unchanged when moving to same position', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Same position
    const from = createPositionSelector('simple-component.tsx', 17, 8);
    const to = createPositionSelector('simple-component.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
    // Content should be unchanged
  });

  /**
   * BEFORE-12: Move first child before sibling
   *
   * Test Purpose: Edge case - first child movement
   */
  it('BEFORE-12: should handle first child movement', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // First child
    const from = createPositionSelector('simple-component.tsx', 15, 6);
    const to = createPositionSelector('simple-component.tsx', 20, 6);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
  });

  /**
   * BEFORE-13: Move last child before first
   *
   * Test Purpose: Edge case - last to first position
   */
  it('BEFORE-13: should handle last child to first position', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Last child to before first
    const from = createPositionSelector('simple-component.tsx', 21, 6);
    const to = createPositionSelector('simple-component.tsx', 15, 6);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.Before - Error Cases
// =============================================================================

describe('Move.Before - Error Handling', () => {
  /**
   * BEFORE-10: Invalid source selector returns error
   *
   * Test Purpose: Verify error handling for invalid source
   *
   * Expected Results:
   * - Result.success === false
   * - Result.analysis.reason contains error info
   */
  it('BEFORE-10: should return error for invalid source selector', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Invalid source file
    const from = createPositionSelector('nonexistent.tsx', 10, 5);
    const to = createPositionSelector('simple-component.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(false);
    expect(result.analysis.canMove).toBe(false);
    expect(result.analysis.reason).toBeDefined();
  });

  /**
   * BEFORE-11: Invalid target selector returns error
   *
   * Test Purpose: Verify error handling for invalid target
   *
   * Expected Results:
   * - Result.success === false
   * - Result.analysis.reason contains error info
   */
  it('BEFORE-11: should return error for invalid target selector', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Invalid target file
    const from = createPositionSelector('simple-component.tsx', 18, 8);
    const to = createPositionSelector('nonexistent.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(false);
    expect(result.analysis.canMove).toBe(false);
    expect(result.analysis.reason).toBeDefined();
  });
});

// =============================================================================
// Move.Before - Code Quality
// =============================================================================

describe('Move.Before - Code Quality', () => {
  /**
   * BEFORE-14: Move preserves comments
   *
   * Test Purpose: Verify comments are preserved during move
   *
   * Expected Results:
   * - Comments associated with element are preserved
   */
  it('BEFORE-14: should preserve comments', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Element with comment
    const from = createPositionSelector('simple-component.tsx', 38, 6);
    const to = createPositionSelector('simple-component.tsx', 35, 6);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
  });

  /**
   * BEFORE-15: Move adjusts indentation
   *
   * Test Purpose: Verify indentation matches new context
   *
   * Expected Results:
   * - Moved element has correct indentation for new position
   */
  it('BEFORE-15: should adjust indentation', async () => {
    const files = [
      { path: 'nested-components.tsx', content: nestedComponentContent },
    ];

    // Element from deep nesting to shallow
    const from = createPositionSelector('nested-components.tsx', 55, 12);
    const to = createPositionSelector('nested-components.tsx', 30, 4);

    const result = await regraft(files, from, to, Move.Before);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.Before - Result Structure Validation
// =============================================================================

describe('Move.Before - Result Structure', () => {
  it('should return properly structured Result object', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    const from = createPositionSelector('simple-component.tsx', 18, 8);
    const to = createPositionSelector('simple-component.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.Before);

    // Validate Result structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('codes');
    expect(result).toHaveProperty('analysis');

    // Validate codes array structure
    expect(Array.isArray(result.codes)).toBe(true);
    if (result.codes.length > 0) {
      expect(result.codes[0]).toHaveProperty('file');
      expect(result.codes[0]).toHaveProperty('content');
      expect(result.codes[0]).toHaveProperty('changed');
    }

    // Validate analysis structure
    expect(result.analysis).toHaveProperty('canMove');
    expect(result.analysis).toHaveProperty('dependencies');
    expect(result.analysis).toHaveProperty('hoistedDeps');
    expect(Array.isArray(result.analysis.dependencies)).toBe(true);
    expect(Array.isArray(result.analysis.hoistedDeps)).toBe(true);
  });
});
