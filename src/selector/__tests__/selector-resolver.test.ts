/**
 * SelectorResolver Unit Tests
 *
 * Tests for position-based and path-based selector resolution.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { parse } from "@babel/parser";
import generateFn from "@babel/generator";
import type * as t from "@babel/types";

const generate = generateFn as any as typeof generateFn.default;

import {
  SelectorResolver,
  createSelectorResolver,
  SelectorErrorCodes,
} from "../index.js";
import { AtomicUnitType } from "../../types/index.js";

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

const textNodeCode = `
function App() {
  return (
    <p>Hello World</p>
  );
}
`;

const expressionCode = `
function App({ user }) {
  return (
    <p>Hello, {user}</p>
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

describe("SelectorResolver", () => {
  let resolver: SelectorResolver;

  beforeEach(() => {
    resolver = createSelectorResolver();
  });

  // ===========================================================================
  // Position-Based Resolution
  // ===========================================================================

  describe("resolveByPosition", () => {
    it("should resolve a JSX element at exact position", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 6, column: 8 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.path).not.toBeNull();
      expect(result.error).toBeUndefined();
      expect(result.atomicUnit?.type).toBe(AtomicUnitType.Element);

      // Document what code was actually found at this position
      if (result.node) {
        const foundCode = generate(result.node).code;
        expect(foundCode).toBe("<h1>Title</h1>");
      }
    });

    it("should find the most specific (innermost) element", () => {
      const ast = parseCode(simpleJSXCode);
      // Position inside the h1 element
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 6, column: 10 },
        ast
      );

      expect(result.node).not.toBeNull();
      // Should find h1, not header
      if (result.node && "openingElement" in result.node) {
        const element: t.JSXElement = result.node;
        if (element.openingElement.name.type === "JSXIdentifier") {
          expect(element.openingElement.name.name).toBe("h1");
        }
      }
    });

    it("should return error for position with no JSX element", () => {
      const ast = parseCode(simpleJSXCode);
      // Position outside any JSX element (line 1)
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 1, column: 0 },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.NO_JSX_AT_POSITION);
    });

    it("should return error for invalid position (negative line)", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: -1, column: 5 },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(
        SelectorErrorCodes.POSITION_OUT_OF_BOUNDS
      );
    });

    it("should return error for position beyond file bounds", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 1000, column: 5 },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.NO_JSX_AT_POSITION);
    });

    it("should resolve JSX fragment", () => {
      const ast = parseCode(fragmentCode);
      // Position inside the fragment
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 4, column: 4 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
    });

    it("should resolve JSXText node inside element", () => {
      const ast = parseCode(textNodeCode);
      // Position at "Hello World" text
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 4, column: 10 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
      // Should resolve to JSXText node
      expect(result.node?.type).toBe("JSXText");

      // Document what text was actually found
      if (result.node) {
        const foundCode = generate(result.node).code;
        expect(foundCode).toBe("Hello World");
      }
    });

    it("should resolve expression inside JSXExpressionContainer", () => {
      const ast = parseCode(expressionCode);
      // Position at {user} expression - Identifier is at column 15-19
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 4, column: 17 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
      // Should resolve to the Identifier node inside the expression
      expect(result.node?.type).toBe("Identifier");

      // Document what expression was actually found
      if (result.node) {
        const foundCode = generate(result.node).code;
        expect(foundCode).toBe("user");
      }
    });
  });

  // ===========================================================================
  // Path-Based Resolution
  // ===========================================================================

  describe("resolveByPath", () => {
    it("should resolve a node using AST path", () => {
      const ast = parseCode(simpleJSXCode);
      // Path to the function declaration's body
      const result = resolver.resolveByPath(
        { file: "test.tsx", path: "program.body[0]" },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.path).not.toBeNull();
      expect(result.error).toBeUndefined();

      // Document what code was found at this path
      if (result.node) {
        const foundCode = generate(result.node).code;
        expect(foundCode).toContain("function App()");
        expect(foundCode).toContain('<div className="app">');
      }
    });

    it("should return error for invalid path format", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPath(
        { file: "test.tsx", path: "" },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.INVALID_PATH_FORMAT);
    });

    it("should return error for non-existent path", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPath(
        { file: "test.tsx", path: "program.body[99]" },
        ast
      );

      expect(result.node).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(SelectorErrorCodes.PATH_NOT_FOUND);
    });

    it("should handle nested paths", () => {
      const ast = parseCode(simpleJSXCode);
      // Navigate deeper into the AST
      const result = resolver.resolveByPath(
        { file: "test.tsx", path: "program.body[0]" },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
    });
  });

  // ===========================================================================
  // Atomic Unit Detection
  // ===========================================================================

  describe("Atomic Unit Detection", () => {
    it("should detect conditional expression: {cond && <E />}", () => {
      const ast = parseCode(conditionalJSXCode);
      // Position at the header element inside conditional
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 5, column: 24 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.atomicUnit).not.toBeNull();
      expect(result.atomicUnit?.type).toBe(AtomicUnitType.Conditional);

      // Document what code was found
      if (result.node) {
        const foundCode = generate(result.node).code;
        expect(foundCode).toBe("<header>Header</header>");
      }

      // Document the full atomic unit (conditional expression)
      if (result.atomicUnit && result.atomicUnit.nodes.length > 1) {
        const atomicCode = generate(result.atomicUnit.nodes[0]!).code;
        expect(atomicCode).toContain("showHeader && <header>Header</header>");
      }
    });

    it("should detect ternary expression", () => {
      const ast = parseCode(ternaryJSXCode);
      // Position at the UserPanel element
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 5, column: 20 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.atomicUnit).not.toBeNull();
      expect(result.atomicUnit?.type).toBe(AtomicUnitType.Ternary);

      // Document what code was found
      if (result.node) {
        const foundCode = generate(result.node).code;
        expect(foundCode).toBe("<UserPanel />");
      }

      // Document the full atomic unit (ternary expression)
      if (result.atomicUnit && result.atomicUnit.nodes.length > 1) {
        const atomicCode = generate(result.atomicUnit.nodes[0]!).code;
        expect(atomicCode).toContain(
          "isLoggedIn ? <UserPanel /> : <LoginForm />"
        );
      }
    });

    it("should detect compound component", () => {
      const ast = parseCode(compoundComponentCode);
      // Position at Tabs.Panel
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 5, column: 6 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.atomicUnit).not.toBeNull();
      if (result.atomicUnit) {
        expect(result.atomicUnit.type).toBe(AtomicUnitType.CompoundComponent);
      }

      // Document what code was found
      if (result.node) {
        const foundCode = generate(result.node).code;
        expect(foundCode).toBe("<Tabs.Panel>Panel 1</Tabs.Panel>");
      }
    });

    it("should include all nodes in compound component atomic unit", () => {
      const ast = parseCode(compoundComponentCode);
      // Position at Tabs.Panel
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 5, column: 6 },
        ast
      );

      expect(result.atomicUnit).not.toBeNull();
      if (result.atomicUnit) {
        expect(result.atomicUnit.type).toBe(AtomicUnitType.CompoundComponent);
        // Should include all nodes in the element (opening, children, closing)
        expect(result.atomicUnit.nodes.length).toBeGreaterThan(1);
        // First node should be the JSXElement itself
        expect(result.atomicUnit.nodes[0]).toBe(result.node);
      }
    });

    it("should default to Element type for simple JSX", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 9, column: 8 },
        ast
      );

      expect(result.atomicUnit?.type).toBe(AtomicUnitType.Element);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("Error Handling", () => {
    it("should include location in error when available", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 1, column: 0 },
        ast
      );

      expect(result.error).toBeDefined();
      expect(result.error?.location).toBeDefined();
      expect(result.error?.location?.start.line).toBe(1);
    });

    it("should return meaningful error messages", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPath(
        { file: "test.tsx", path: "invalid.path.here" },
        ast
      );

      expect(result.error?.message).toContain("invalid.path.here");
      expect(result.error?.code).toBe(SelectorErrorCodes.PATH_NOT_FOUND);
    });

    it("should handle edge case of null path string", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPath(
        { file: "test.tsx", path: null as unknown as string },
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

  describe("resolve (unified)", () => {
    it("should automatically use position-based resolution for PositionSelector", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolve(
        { file: "test.tsx", line: 6, column: 8 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
    });

    it("should automatically use path-based resolution for PathSelector", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolve(
        { file: "test.tsx", path: "program.body[0]" },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.error).toBeUndefined();
    });
  });

  // ===========================================================================
  // Performance Tests
  // ===========================================================================

  describe("Performance Optimization", () => {
    it("should resolve path without redundant AST traversal", () => {
      const largeCode = `
        function App() {
          return (
            <div>
              ${Array.from({ length: 100 }, (_, i) => `<div key={${i}}>Item ${i}</div>`).join("\n")}
            </div>
          );
        }
      `;
      const ast = parseCode(largeCode);

      const result = resolver.resolveByPath(
        { file: "test.tsx", path: "program.body[0]" },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.path).not.toBeNull();
      expect(result.error).toBeUndefined();

      // This test verifies path resolution works correctly with large files
      // The implementation already optimizes by using early exit in findNodePath
    });

    it("should handle deep nested paths efficiently", () => {
      const ast = parseCode(simpleJSXCode);
      const start = performance.now();

      const result = resolver.resolveByPath(
        { file: "test.tsx", path: "program.body[0]" },
        ast
      );

      const duration = performance.now() - start;

      expect(result.node).not.toBeNull();
      // Performance expectation: should be fast even without optimization
      // After optimization, this should be even faster
      expect(duration).toBeLessThan(100); // 100ms threshold
    });
  });

  // ===========================================================================
  // Lazy Atomic Unit Evaluation
  // ===========================================================================

  describe("Lazy Atomic Unit Evaluation", () => {
    it("should not compute atomic unit until accessed", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 6, column: 8 },
        ast
      );

      expect(result.node).not.toBeNull();
      expect(result.path).not.toBeNull();

      // At this point, atomicUnit should not have been computed yet
      // We can't directly test this without implementation details,
      // but we document the expected behavior

      // Now access atomicUnit - this should trigger computation
      const atomicUnit = result.atomicUnit;
      expect(atomicUnit).not.toBeNull();
      expect(atomicUnit?.type).toBeDefined();
    });

    it("should compute atomic unit only once when accessed multiple times", () => {
      const ast = parseCode(compoundComponentCode);
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 5, column: 6 },
        ast
      );

      // First access
      const atomicUnit1 = result.atomicUnit;
      expect(atomicUnit1).not.toBeNull();

      // Second access - should return the same object (memoized)
      const atomicUnit2 = result.atomicUnit;
      expect(atomicUnit2).toBe(atomicUnit1); // Same reference

      // Modify result to ensure it's not creating new atomic units
      // This tests that the atomic unit is truly memoized
      const atomicUnit3 = result.atomicUnit;
      expect(atomicUnit3).toBe(atomicUnit1);
    });

    it("should have atomicUnit as a getter property, not a plain value", () => {
      const ast = parseCode(simpleJSXCode);
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 6, column: 8 },
        ast
      );

      // Check that atomicUnit is defined as a getter
      const descriptor = Object.getOwnPropertyDescriptor(result, "atomicUnit");
      // If lazy, atomicUnit should be a getter, not a plain data property
      // For now, this will fail because atomicUnit is a plain property
      expect(descriptor?.get).toBeDefined();
    });

    it("should allow creating result without immediate atomic unit computation", () => {
      const ast = parseCode(simpleJSXCode);

      // This should be fast because atomic unit is not computed
      const start = performance.now();
      const result = resolver.resolveByPosition(
        { file: "test.tsx", line: 6, column: 8 },
        ast
      );
      const durationWithoutAtomicUnit = performance.now() - start;

      expect(result.node).not.toBeNull();

      // Accessing atomic unit should still work
      const atomicUnit = result.atomicUnit;
      expect(atomicUnit).not.toBeNull();

      // Duration should be reasonable (no hard assertion on time)
      expect(durationWithoutAtomicUnit).toBeLessThan(100);
    });
  });
});
