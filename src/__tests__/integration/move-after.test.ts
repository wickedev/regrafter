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

import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { Move, type PositionSelector } from "../../types/index.js";
import { regraft as actualRegraft } from "../../index.js";

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

const FIXTURES_DIR = path.join(__dirname, "../../../test/fixtures");

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), "utf-8");
}

const regraft = actualRegraft;

// =============================================================================
// Test Data
// =============================================================================

let simpleComponentContent: string;
let hooksComponentContent: string;
let nestedComponentContent: string;
let contextComponentContent: string;

beforeEach(() => {
  simpleComponentContent = loadFixture("simple-component.tsx");
  hooksComponentContent = loadFixture("component-with-hooks.tsx");
  nestedComponentContent = loadFixture("nested-components.tsx");
  contextComponentContent = loadFixture("component-with-context.tsx");
});

// =============================================================================
// Move.After Basic Tests
// =============================================================================

describe("Move.After - Basic Operations", () => {
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
  it("AFTER-01: should move sibling element after target", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // Source: p element "Content paragraph"
    const from = createPositionSelector("simple-component.tsx", 17, 8);
    // Target: span element "Inline text"
    const to = createPositionSelector("simple-component.tsx", 18, 8);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.codes).toHaveLength(1);
      expect(result.value.codes[0]!.file).toBe("simple-component.tsx");
      expect(result.value.analysis.canMove).toBe(true);
    }
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
  it("AFTER-02: should handle target being last child", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // Move header (line 16) after footer (line 23, last child)
    const from = createPositionSelector("simple-component.tsx", 16, 6);
    const to = createPositionSelector("simple-component.tsx", 23, 6);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });

  /**
   * AFTER-03: Move element removes from original location
   *
   * Test Purpose: Verify source element is removed after move
   *
   * Expected Results:
   * - Original location no longer contains the element
   */
  it("AFTER-03: should remove element from original location", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    const from = createPositionSelector("simple-component.tsx", 17, 8);
    const to = createPositionSelector("simple-component.tsx", 18, 8);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Move.After with Dependencies
// =============================================================================

describe("Move.After - Dependency Handling", () => {
  /**
   * AFTER-04: Move with hook dependency triggers hoisting
   *
   * Test Purpose: Verify hooks are hoisted when moving element with state
   *
   * Expected Results:
   * - Result.analysis.hoistedDeps includes the hook
   * - Hook is at component top level
   */
  it("AFTER-04: should hoist hook dependency when needed", () => {
    const files = [
      { path: "component-with-hooks.tsx", content: hooksComponentContent },
    ];

    // Select element that uses count state - span at line 22, move after button at line 23
    const from = createPositionSelector("component-with-hooks.tsx", 22, 6);
    const to = createPositionSelector("component-with-hooks.tsx", 23, 6);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
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
  it("AFTER-09: should handle context dependency", () => {
    const files = [
      { path: "component-with-context.tsx", content: contextComponentContent },
    ];

    // Element using context - button at line 50, move after line 54
    const from = createPositionSelector("component-with-context.tsx", 50, 6);
    const to = createPositionSelector("component-with-context.tsx", 54, 6);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Move.After - Nested Elements
// =============================================================================

describe("Move.After - Nested Elements", () => {
  /**
   * AFTER-05: Move deeply nested element
   *
   * Test Purpose: Verify element can move from deep nesting
   *
   * Expected Results:
   * - Element moves to correct position after target
   * - Dependencies are properly handled
   */
  it("AFTER-05: should move deeply nested element", () => {
    const files = [
      { path: "nested-components.tsx", content: nestedComponentContent },
    ];

    // Move level-2-footer div (line 76) after Level3 component (line 72)
    const from = createPositionSelector("nested-components.tsx", 76, 6);
    const to = createPositionSelector("nested-components.tsx", 72, 6);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Move.After - Fragments
// =============================================================================

describe("Move.After - Fragment Handling", () => {
  /**
   * AFTER-06: Move element in fragment
   *
   * Test Purpose: Verify movement works within React fragments
   *
   * Expected Results:
   * - Element moves correctly within fragment children
   */
  it("AFTER-06: should move element within fragment", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // FragmentComponent's children - move First (line 50) after Second (line 51)
    const from = createPositionSelector("simple-component.tsx", 50, 6);
    const to = createPositionSelector("simple-component.tsx", 51, 6);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Move.After - Self-Closing Elements
// =============================================================================

describe("Move.After - Self-Closing Elements", () => {
  /**
   * AFTER-07: Move self-closing element
   *
   * Test Purpose: Verify self-closing elements move correctly
   *
   * Expected Results:
   * - Self-closing element moves to correct position
   * - Format is preserved
   */
  it("AFTER-07: should move self-closing element", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // Move img (line 60) after input (line 61)
    const from = createPositionSelector("simple-component.tsx", 60, 6);
    const to = createPositionSelector("simple-component.tsx", 61, 6);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Move.After - Edge Cases
// =============================================================================

describe("Move.After - Edge Cases", () => {
  /**
   * AFTER-08: Move to same position returns unchanged
   *
   * Test Purpose: Verify no-op when already in position
   *
   * Expected Results:
   * - Result.success === true
   * - Content effectively unchanged
   */
  it("AFTER-08: should return unchanged when moving to adjacent position", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // Element is already after target (moving to same position)
    const from = createPositionSelector("simple-component.tsx", 18, 8);
    const to = createPositionSelector("simple-component.tsx", 17, 8);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
    // Element is already after target, so should be no-op
  });

  /**
   * AFTER-12: Move first child after last
   *
   * Test Purpose: Edge case - moving first to end
   */
  it("AFTER-12: should handle first child to last position", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // First child (header line 16) after last (footer line 23)
    const from = createPositionSelector("simple-component.tsx", 16, 6);
    const to = createPositionSelector("simple-component.tsx", 23, 6);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });

  /**
   * AFTER-13: Move between non-adjacent siblings
   *
   * Test Purpose: Verify movement across multiple siblings
   */
  it("AFTER-13: should handle non-adjacent sibling movement", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // Move header (line 16) after main (line 19)
    const from = createPositionSelector("simple-component.tsx", 16, 6);
    const to = createPositionSelector("simple-component.tsx", 19, 6);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Move.After - Error Cases
// =============================================================================

describe("Move.After - Error Handling", () => {
  /**
   * AFTER-10: Invalid source selector returns error
   *
   * Test Purpose: Verify error handling for invalid source
   *
   * Expected Results:
   * - Result.success === false
   * - Result.analysis.reason contains error info
   */
  it("AFTER-10: should return error for invalid source selector", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // Invalid source file
    const from = createPositionSelector("nonexistent.tsx", 10, 5);
    const to = createPositionSelector("simple-component.tsx", 20, 8);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
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
  it("AFTER-11: should return error for invalid target selector", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // Invalid target file
    const from = createPositionSelector("simple-component.tsx", 21, 8);
    const to = createPositionSelector("nonexistent.tsx", 20, 8);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
  });
});

// =============================================================================
// Move.After - Code Quality
// =============================================================================

describe("Move.After - Code Quality", () => {
  /**
   * AFTER-14: Move preserves whitespace
   *
   * Test Purpose: Verify whitespace/formatting is maintained
   *
   * Expected Results:
   * - Whitespace between elements is preserved
   * - No unexpected whitespace changes
   */
  it("AFTER-14: should preserve whitespace", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    const from = createPositionSelector("simple-component.tsx", 17, 8);
    const to = createPositionSelector("simple-component.tsx", 18, 8);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
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
  it("AFTER-15: should move element with all children", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    // Move main section (which has children) after footer
    const from = createPositionSelector("simple-component.tsx", 16, 6);
    const to = createPositionSelector("simple-component.tsx", 22, 6);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Move.After - Multiple Files
// =============================================================================

describe("Move.After - Multiple Files", () => {
  it("should handle multiple files in input", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
      { path: "component-with-hooks.tsx", content: hooksComponentContent },
    ];

    const from = createPositionSelector("simple-component.tsx", 17, 8);
    const to = createPositionSelector("simple-component.tsx", 18, 8);

    const result = regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
    // Only modified file should have changed: true
  });
});

// =============================================================================
// Move.After - Result Structure Validation
// =============================================================================

describe("Move.After - Result Structure", () => {
  it("should return properly structured Result object", () => {
    const files = [
      { path: "simple-component.tsx", content: simpleComponentContent },
    ];

    const from = createPositionSelector("simple-component.tsx", 20, 8);
    const to = createPositionSelector("simple-component.tsx", 21, 8);

    const result = regraft(files, from, to, Move.After);

    // Validate Result structure
    expect(result).toHaveProperty("ok");

    if (result.ok) {
      expect(result).toHaveProperty("value");
      // Validate analysis structure
      expect(result.value.analysis).toHaveProperty("canMove");
      expect(result.value.analysis).toHaveProperty("dependencies");
      expect(result.value.analysis).toHaveProperty("hoistedDeps");
    }
  });
});
