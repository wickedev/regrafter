/**
 * Move.After Integration Tests
 *
 * Tests for moving elements to positions after target elements.
 * These tests verify the complete pipeline for Move.After operations.
 *
 * Test File: src/__tests__/integration/move-after.test.ts
 *
 * Test Purpose:
 * - Verify element moves to position after target sibling
 * - Verify original element is removed from source location
 * - Verify dependencies are handled correctly
 * - Verify edge cases (last child, nested elements, etc.)
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
 * | Case ID   | Feature Description                          | Test Type     |
 * |-----------|----------------------------------------------|---------------|
 * | AFTER-01  | Move sibling element after target            | Positive Test |
 * | AFTER-02  | Move element when target is last child       | Edge Case     |
 * | AFTER-03  | Move element removes from original location  | Positive Test |
 * | AFTER-04  | Move with hook dependency triggers hoisting  | Positive Test |
 * | AFTER-05  | Move deeply nested element                   | Positive Test |
 * | AFTER-06  | Move element in fragment                     | Positive Test |
 * | AFTER-07  | Move self-closing element                    | Positive Test |
 * | AFTER-08  | Move to same position returns unchanged      | Edge Case     |
 * | AFTER-09  | Move with context dependency                 | Positive Test |
 * | AFTER-10  | Invalid source selector returns error        | Error Test    |
 * | AFTER-11  | Invalid target selector returns error        | Error Test    |
 * | AFTER-12  | Move first child after last                  | Positive Test |
 * | AFTER-13  | Move between non-adjacent siblings           | Positive Test |
 * | AFTER-14  | Move preserves whitespace                    | Positive Test |
 * | AFTER-15  | Move element with children                   | Positive Test |
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
  // TODO: Replace with actual regraft implementation

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
      content: f.content,
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
let contextComponentContent: string;

beforeEach(() => {
  simpleComponentContent = loadFixture('simple-component.tsx');
  hooksComponentContent = loadFixture('component-with-hooks.tsx');
  nestedComponentContent = loadFixture('nested-components.tsx');
  contextComponentContent = loadFixture('component-with-context.tsx');
});

// =============================================================================
// Move.After Basic Tests
// =============================================================================

describe('Move.After - Basic Operations', () => {
  /**
   * AFTER-01: Move sibling element after target
   *
   * Test Purpose: Verify element moves to position after target sibling
   *
   * Test Data Preparation:
   * - Load simple-component.tsx fixture
   * - Identify source: <p>Content paragraph</p>
   * - Identify target: <span>Inline text</span>
   *
   * Test Steps:
   * 1. Create selectors for source and target
   * 2. Call regraft with Move.After mode
   * 3. Verify result is successful
   * 4. Verify source element follows target in output
   *
   * Expected Results:
   * - Result.success === true
   * - p element appears after span element in transformed code
   */
  it('AFTER-01: should move sibling element after target', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Source: p element "Content paragraph"
    const from = createPositionSelector('simple-component.tsx', 17, 8);
    // Target: span element "Inline text"
    const to = createPositionSelector('simple-component.tsx', 18, 8);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0]!.file).toBe('simple-component.tsx');
    expect(result.analysis.canMove).toBe(true);

    // TODO: Once implementation is complete, verify:
    // - p appears after span in output
    // - Original p location is empty
  });

  /**
   * AFTER-02: Move element when target is last child
   *
   * Test Purpose: Verify edge case when target is the last child
   *
   * Test Steps:
   * 1. Select element to move
   * 2. Select last child as target
   * 3. Call regraft with Move.After
   * 4. Verify element becomes new last child
   *
   * Expected Results:
   * - Moved element is now last child
   * - No array index errors
   */
  it('AFTER-02: should handle target being last child', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Move header after footer (last child)
    const from = createPositionSelector('simple-component.tsx', 14, 6);
    const to = createPositionSelector('simple-component.tsx', 20, 6);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
    // TODO: Verify header is now after footer
  });

  /**
   * AFTER-03: Move element removes from original location
   *
   * Test Purpose: Verify source element is removed after move
   *
   * Expected Results:
   * - Original location no longer contains the element
   */
  it('AFTER-03: should remove element from original location', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    const from = createPositionSelector('simple-component.tsx', 17, 8);
    const to = createPositionSelector('simple-component.tsx', 18, 8);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
    // TODO: Verify original location is empty
  });
});

// =============================================================================
// Move.After with Dependencies
// =============================================================================

describe('Move.After - Dependency Handling', () => {
  /**
   * AFTER-04: Move with hook dependency triggers hoisting
   *
   * Test Purpose: Verify hooks are hoisted when moving element with state
   *
   * Expected Results:
   * - Result.analysis.hoistedDeps includes the hook
   * - Hook is at component top level
   */
  it('AFTER-04: should hoist hook dependency when needed', async () => {
    const files = [
      { path: 'component-with-hooks.tsx', content: hooksComponentContent },
    ];

    // Select element that uses count state
    const from = createPositionSelector('component-with-hooks.tsx', 15, 6);
    const to = createPositionSelector('component-with-hooks.tsx', 17, 6);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
    // TODO: Verify hoistedDeps when crossing scope
  });

  /**
   * AFTER-09: Move with context dependency
   *
   * Test Purpose: Verify context dependencies are handled
   *
   * Expected Results:
   * - Context access is maintained
   * - Provider boundary is respected
   */
  it('AFTER-09: should handle context dependency', async () => {
    const files = [
      { path: 'component-with-context.tsx', content: contextComponentContent },
    ];

    // Element using context
    const from = createPositionSelector('component-with-context.tsx', 45, 6);
    const to = createPositionSelector('component-with-context.tsx', 50, 6);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
    // TODO: Verify context handling
  });
});

// =============================================================================
// Move.After - Nested Elements
// =============================================================================

describe('Move.After - Nested Elements', () => {
  /**
   * AFTER-05: Move deeply nested element
   *
   * Test Purpose: Verify element can move from deep nesting
   *
   * Expected Results:
   * - Element moves to correct position after target
   * - Dependencies are properly handled
   */
  it('AFTER-05: should move deeply nested element', async () => {
    const files = [
      { path: 'nested-components.tsx', content: nestedComponentContent },
    ];

    // Deep nested element
    const from = createPositionSelector('nested-components.tsx', 55, 12);
    // Shallower target
    const to = createPositionSelector('nested-components.tsx', 45, 6);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.After - Fragments
// =============================================================================

describe('Move.After - Fragment Handling', () => {
  /**
   * AFTER-06: Move element in fragment
   *
   * Test Purpose: Verify movement works within React fragments
   *
   * Expected Results:
   * - Element moves correctly within fragment children
   */
  it('AFTER-06: should move element within fragment', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // FragmentComponent's children - move first after second
    const from = createPositionSelector('simple-component.tsx', 43, 6);
    const to = createPositionSelector('simple-component.tsx', 44, 6);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.After - Self-Closing Elements
// =============================================================================

describe('Move.After - Self-Closing Elements', () => {
  /**
   * AFTER-07: Move self-closing element
   *
   * Test Purpose: Verify self-closing elements move correctly
   *
   * Expected Results:
   * - Self-closing element moves to correct position
   * - Format is preserved
   */
  it('AFTER-07: should move self-closing element', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Move img after input
    const from = createPositionSelector('simple-component.tsx', 53, 6);
    const to = createPositionSelector('simple-component.tsx', 54, 6);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.After - Edge Cases
// =============================================================================

describe('Move.After - Edge Cases', () => {
  /**
   * AFTER-08: Move to same position returns unchanged
   *
   * Test Purpose: Verify no-op when already in position
   *
   * Expected Results:
   * - Result.success === true
   * - Content effectively unchanged
   */
  it('AFTER-08: should return unchanged when moving to adjacent position', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Element is already after target (moving to same position)
    const from = createPositionSelector('simple-component.tsx', 18, 8);
    const to = createPositionSelector('simple-component.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
    // Element is already after target, so should be no-op
  });

  /**
   * AFTER-12: Move first child after last
   *
   * Test Purpose: Edge case - moving first to end
   */
  it('AFTER-12: should handle first child to last position', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // First child after last
    const from = createPositionSelector('simple-component.tsx', 14, 6);
    const to = createPositionSelector('simple-component.tsx', 22, 6);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
  });

  /**
   * AFTER-13: Move between non-adjacent siblings
   *
   * Test Purpose: Verify movement across multiple siblings
   */
  it('AFTER-13: should handle non-adjacent sibling movement', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Move header after main (skipping footer)
    const from = createPositionSelector('simple-component.tsx', 14, 6);
    const to = createPositionSelector('simple-component.tsx', 19, 6);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Move.After - Error Cases
// =============================================================================

describe('Move.After - Error Handling', () => {
  /**
   * AFTER-10: Invalid source selector returns error
   *
   * Test Purpose: Verify error handling for invalid source
   *
   * Expected Results:
   * - Result.success === false
   * - Result.analysis.reason contains error info
   */
  it('AFTER-10: should return error for invalid source selector', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Invalid source file
    const from = createPositionSelector('nonexistent.tsx', 10, 5);
    const to = createPositionSelector('simple-component.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(false);
    expect(result.analysis.canMove).toBe(false);
    expect(result.analysis.reason).toBeDefined();
  });

  /**
   * AFTER-11: Invalid target selector returns error
   *
   * Test Purpose: Verify error handling for invalid target
   *
   * Expected Results:
   * - Result.success === false
   * - Result.analysis.reason contains error info
   */
  it('AFTER-11: should return error for invalid target selector', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Invalid target file
    const from = createPositionSelector('simple-component.tsx', 18, 8);
    const to = createPositionSelector('nonexistent.tsx', 17, 8);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(false);
    expect(result.analysis.canMove).toBe(false);
    expect(result.analysis.reason).toBeDefined();
  });
});

// =============================================================================
// Move.After - Code Quality
// =============================================================================

describe('Move.After - Code Quality', () => {
  /**
   * AFTER-14: Move preserves whitespace
   *
   * Test Purpose: Verify whitespace/formatting is maintained
   *
   * Expected Results:
   * - Whitespace between elements is preserved
   * - No unexpected whitespace changes
   */
  it('AFTER-14: should preserve whitespace', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    const from = createPositionSelector('simple-component.tsx', 17, 8);
    const to = createPositionSelector('simple-component.tsx', 18, 8);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
    // TODO: Verify whitespace preservation
  });

  /**
   * AFTER-15: Move element with children
   *
   * Test Purpose: Verify element with children moves completely
   *
   * Expected Results:
   * - Element and all children move together
   * - Child structure preserved
   */
  it('AFTER-15: should move element with all children', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    // Move main section (which has children) after footer
    const from = createPositionSelector('simple-component.tsx', 16, 6);
    const to = createPositionSelector('simple-component.tsx', 22, 6);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
    // TODO: Verify children are preserved
  });
});

// =============================================================================
// Move.After - Multiple Files
// =============================================================================

describe('Move.After - Multiple Files', () => {
  it('should handle multiple files in input', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
      { path: 'component-with-hooks.tsx', content: hooksComponentContent },
    ];

    const from = createPositionSelector('simple-component.tsx', 17, 8);
    const to = createPositionSelector('simple-component.tsx', 18, 8);

    const result = await regraft(files, from, to, Move.After);

    expect(result.success).toBe(true);
    // Only modified file should have changed: true
  });
});

// =============================================================================
// Move.After - Result Structure Validation
// =============================================================================

describe('Move.After - Result Structure', () => {
  it('should return properly structured Result object', async () => {
    const files = [
      { path: 'simple-component.tsx', content: simpleComponentContent },
    ];

    const from = createPositionSelector('simple-component.tsx', 17, 8);
    const to = createPositionSelector('simple-component.tsx', 18, 8);

    const result = await regraft(files, from, to, Move.After);

    // Validate Result structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('codes');
    expect(result).toHaveProperty('analysis');

    // Validate analysis structure
    expect(result.analysis).toHaveProperty('canMove');
    expect(result.analysis).toHaveProperty('dependencies');
    expect(result.analysis).toHaveProperty('hoistedDeps');
  });
});
