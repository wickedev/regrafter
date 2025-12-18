/**
 * SelectorResolver Unit Tests - Result Return Type
 *
 * Tests for selector resolution with Result<T, E> return type.
 * Following Task 11.1: Write tests for resolveSelector with Result return type
 */

import { describe, it, expect, beforeEach } from "vitest";
import { parse } from "@babel/parser";
import type * as t from "@babel/types";
import type { NodePath } from '@babel/traverse';

import {
  SelectorResolver,
  createSelectorResolver,
} from "../index.js";
import type { Result } from "../../result/index.js";
import { isOk, isErr } from "../../result/index.js";
import type { SelectorErrorType } from "../../errors/error-category.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Element data returned on successful selector resolution
 */
interface ElementData {
  node: t.Node;
  path: NodePath;
  atomicUnit: {
    type: string;
    path: NodePath;
    nodes: t.Node[];
  } | null;
}

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

const nestedJSXCode = `
function App() {
  return (
    <div>
      <nav>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </nav>
    </div>
  );
}
`;

// =============================================================================
// Helper Functions
// =============================================================================

function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("SelectorResolver - Result Return Type (New API)", () => {
  let resolver: SelectorResolver;

  beforeEach(() => {
    resolver = createSelectorResolver();
  });

  // ===========================================================================
  // Task 11.1.1: Test resolveByPosition returns Ok<ElementData> when element is found
  // ===========================================================================

  describe("resolveByPositionResult - Success Cases", () => {
    it("should return Ok<ElementData> when JSX element is found at position", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 6, column: 8 },
        ast
      );

      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.node).not.toBeNull();
        expect(result.value.path).not.toBeNull();
        expect(result.value.node.type).toBe("JSXElement");
      }
    });

    it("should return Ok with node, path, and atomicUnit fields", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 6, column: 8 },
        ast
      );

      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        // Verify all required fields are present
        expect(result.value).toHaveProperty('node');
        expect(result.value).toHaveProperty('path');
        expect(result.value).toHaveProperty('atomicUnit');

        // Verify node is valid AST node
        expect(result.value.node).toBeDefined();
        expect(result.value.node.type).toBeDefined();

        // Verify path is NodePath
        expect(result.value.path).toBeDefined();
        expect(result.value.path.node).toBe(result.value.node);
      }
    });

    it("should return Ok when finding innermost JSX element", () => {
      const ast = parseCode(nestedJSXCode);
      // Position at <li> opening tag
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 6, column: 11 },
        ast
      );

      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        // Should find innermost JSX node (could be JSXElement or JSXText)
        expect(result.value.node).toBeDefined();
        expect(result.value.path).toBeDefined();

        // Verify it's a JSX-related node
        const nodeType = result.value.node.type;
        const isJSXNode = nodeType === "JSXElement" ||
                         nodeType === "JSXText" ||
                         nodeType === "JSXFragment" ||
                         nodeType === "JSXExpressionContainer";
        expect(isJSXNode).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Task 11.1.2: Test resolveByPosition returns Err<SelectorError> when element not found
  // ===========================================================================

  describe("resolveByPositionResult - Error Cases", () => {
    it("should return Err<SelectorError> when no JSX element found at position", () => {
      const ast = parseCode(simpleJSXCode);
      // Position outside any JSX element (line 1)
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 1, column: 0 },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error._tag).toBe('SelectorError');
        expect(result.error.message).toBeDefined();
        expect(result.error.code).toBeDefined();
      }
    });

    it("should return Err when position is out of bounds", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 1000, column: 5 },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error._tag).toBe('SelectorError');
      }
    });

    it("should return Err for invalid position (negative line)", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: -1, column: 5 },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error._tag).toBe('SelectorError');
        expect(result.error.message).toContain('Invalid position');
      }
    });
  });

  // ===========================================================================
  // Task 11.1.3: Test error contains selector information and file path
  // ===========================================================================

  describe("Error Context", () => {
    it("should include selector information in error", () => {
      const ast = parseCode(simpleJSXCode);
      const selector = { file: "test.tsx", line: 1, column: 0 };
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        selector,
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        // Error should contain the selector that failed
        expect(result.error.selector).toEqual(selector);
      }
    });

    it("should include file path in error", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "app.tsx", line: 1, column: 0 },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error.file).toBe("app.tsx");
      }
    });

    it("should include location information when available", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 1, column: 0 },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error.location).toBeDefined();
        expect(result.error.location?.start.line).toBe(1);
        expect(result.error.location?.start.column).toBe(0);
      }
    });
  });

  // ===========================================================================
  // Task 11.1.4: Test error includes nearestMatch when available
  // ===========================================================================

  describe("Error - Nearest Match", () => {
    it("should include nearestMatch in error when element is close but not exact", () => {
      const ast = parseCode(simpleJSXCode);
      // Position near but not exactly on an element
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 1, column: 0 },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        // nearestMatch field should exist (can be undefined if no near match)
        expect(result.error).toHaveProperty('nearestMatch');
      }
    });
  });

  // ===========================================================================
  // Task 11.1.5: Test error includes suggestions
  // ===========================================================================

  describe("Error - Suggestions", () => {
    it("should include suggestions array in error", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 1, column: 0 },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error.suggestions).toBeDefined();
        expect(Array.isArray(result.error.suggestions)).toBe(true);
      }
    });

    it("should provide helpful suggestions for common errors", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 1000, column: 0 },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        // Suggestions should be present even if empty
        expect(result.error.suggestions).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Path-Based Resolution
  // ===========================================================================

  describe("resolveByPathResult - Success Cases", () => {
    it("should return Ok<ElementData> when path is valid", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPathResult(
        { file: "test.tsx", path: "program.body[0]" },
        ast
      );

      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.node).not.toBeNull();
        expect(result.value.path).not.toBeNull();
      }
    });
  });

  describe("resolveByPathResult - Error Cases", () => {
    it("should return Err<SelectorError> when path not found", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPathResult(
        { file: "test.tsx", path: "program.body[99]" },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error._tag).toBe('SelectorError');
        expect(result.error.message).toContain('not found');
      }
    });

    it("should return Err when path format is invalid", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPathResult(
        { file: "test.tsx", path: "" },
        ast
      );

      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error._tag).toBe('SelectorError');
        expect(result.error.message).toContain('Invalid path');
      }
    });
  });

  // ===========================================================================
  // Unified resolve() method
  // ===========================================================================

  describe("resolveResult - Unified Method", () => {
    it("should return Result for position-based selector", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveResult(
        { file: "test.tsx", line: 6, column: 8 },
        ast
      );

      expect(isOk(result)).toBe(true);
    });

    it("should return Result for path-based selector", () => {
      const ast = parseCode(simpleJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveResult(
        { file: "test.tsx", path: "program.body[0]" },
        ast
      );

      expect(isOk(result)).toBe(true);
    });
  });

  // ===========================================================================
  // Atomic Unit Detection with Result
  // ===========================================================================

  describe("Atomic Unit Detection", () => {
    it("should include atomic unit information in Ok result", () => {
      const ast = parseCode(conditionalJSXCode);
      // Position at the header element inside conditional
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 5, column: 24 },
        ast
      );

      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.atomicUnit).not.toBeNull();
        if (result.value.atomicUnit) {
          expect(result.value.atomicUnit.type).toBe('conditional');
        }
      }
    });

    it("should include all nodes in atomic unit", () => {
      const ast = parseCode(conditionalJSXCode);
      const result: Result<ElementData, SelectorErrorType> = resolver.resolveByPositionResult(
        { file: "test.tsx", line: 5, column: 24 },
        ast
      );

      expect(isOk(result)).toBe(true);

      if (isOk(result) && result.value.atomicUnit) {
        expect(result.value.atomicUnit.nodes).toBeDefined();
        expect(Array.isArray(result.value.atomicUnit.nodes)).toBe(true);
        expect(result.value.atomicUnit.nodes.length).toBeGreaterThan(0);
      }
    });
  });
});
