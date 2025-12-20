/**
 * Tests for RelatedDependencyDetector
 *
 * Tests the core functionality of detecting related dependencies.
 * Full integration testing is covered by existing DependencyAnalyzer tests.
 */

import { describe, it, expect } from "vitest";
import * as parser from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";

import { createRelatedDependencyDetector } from "../related-dependency-detector.js";

describe("RelatedDependencyDetector", () => {
  describe("referencesAnySymbol", () => {
    it("should detect symbol references", () => {
      const code = `
        const x = count + 1;
      `;

      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      const detector = createRelatedDependencyDetector("/test.ts");
      const symbols = new Set(["count"]);

      let found = false;
      traverse(ast, {
        VariableDeclaration(path) {
          found = detector.referencesAnySymbol(path, symbols);
        },
      });

      expect(found).toBe(true);
    });

    it("should not detect symbols in binding positions", () => {
      const code = `
        const count = 0;
      `;

      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      const detector = createRelatedDependencyDetector("/test.ts");
      const symbols = new Set(["count"]);

      let found = false;
      traverse(ast, {
        VariableDeclaration(path) {
          found = detector.referencesAnySymbol(path, symbols);
        },
      });

      expect(found).toBe(false);
    });

    it("should skip function parameter names", () => {
      const code = `
        const fn = (count) => {};
      `;

      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      const detector = createRelatedDependencyDetector("/test.ts");
      const symbols = new Set(["count"]);

      let found = false;
      traverse(ast, {
        ArrowFunctionExpression(path) {
          found = detector.referencesAnySymbol(path, symbols);
        },
      });

      // Should not detect 'count' as a reference in parameters
      expect(found).toBe(false);
    });

    it("should detect usage after parameter declaration", () => {
      const code = `
        const fn = (x) => count + x;
      `;

      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      const detector = createRelatedDependencyDetector("/test.ts");
      const symbols = new Set(["count"]);

      let found = false;
      traverse(ast, {
        ArrowFunctionExpression(path) {
          found = detector.referencesAnySymbol(path, symbols);
        },
      });

      // Should detect 'count' in the body
      expect(found).toBe(true);
    });

    it("should handle empty symbol set", () => {
      const code = `
        const x = count + 1;
      `;

      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      const detector = createRelatedDependencyDetector("/test.ts");
      const symbols = new Set<string>();

      let found = false;
      traverse(ast, {
        VariableDeclaration(path) {
          found = detector.referencesAnySymbol(path, symbols);
        },
      });

      expect(found).toBe(false);
    });

    it("should detect any of multiple symbols", () => {
      const code = `
        const result = count + theme.color;
      `;

      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      const detector = createRelatedDependencyDetector("/test.ts");
      const symbols = new Set(["count", "theme", "other"]);

      let found = false;
      traverse(ast, {
        VariableDeclaration(path) {
          found = detector.referencesAnySymbol(path, symbols);
        },
      });

      expect(found).toBe(true);
    });

    it("should short-circuit on first match", () => {
      const code = `
        const result = a + b + c + d;
      `;

      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      const detector = createRelatedDependencyDetector("/test.ts");
      const symbols = new Set(["a"]);

      let found = false;
      traverse(ast, {
        VariableDeclaration(path) {
          found = detector.referencesAnySymbol(path, symbols);
        },
      });

      expect(found).toBe(true);
    });
  });

  describe("detectRelatedDependencies", () => {
    it("should return empty array for null element scope", () => {
      const code = `function Component() { return null; }`;

      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      const detector = createRelatedDependencyDetector("/test.ts");

      let elementPath: NodePath | null = null;
      traverse(ast, {
        ReturnStatement(path) {
          elementPath = path;
        },
      });

      if (!elementPath) throw new Error("No return statement found");

      const result = detector.detectRelatedDependencies([], null, elementPath);
      expect(result).toEqual([]);
    });

    it("should return empty array for empty dependencies", () => {
      const code = `function Component() { return null; }`;

      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["typescript"],
      });

      const detector = createRelatedDependencyDetector("/test.ts");

      let elementPath: NodePath | null = null;
      traverse(ast, {
        ReturnStatement(path) {
          elementPath = path;
        },
      });

      if (!elementPath) throw new Error("No return statement found");

      // Create a minimal scope (the actual scope structure doesn't matter for this test)
      const mockScope: any = {
        type: "function",
        node: ast.program.body[0],
      };

      const result = detector.detectRelatedDependencies(
        [],
        mockScope,
        elementPath
      );
      expect(result).toEqual([]);
    });
  });
});
