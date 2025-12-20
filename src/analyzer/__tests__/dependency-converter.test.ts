/**
 * Tests for DependencyConverter
 */

import { describe, it, expect, beforeEach } from "vitest";
import { parse } from "@babel/parser";
import traverseFn, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { createScopeManager } from "../../scope/index.js";
import { DependencyConverter } from "../dependency-converter.js";
import { DependencyType } from "../types.js";
import type { SpecificDependency } from "../types.js";

const traverse = traverseFn as any as typeof traverseFn.default;

/**
 * Helper to parse JSX code
 */
function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
}

describe("DependencyConverter", () => {
  let converter: DependencyConverter;
  let scopeManager: ReturnType<typeof createScopeManager>;

  beforeEach(() => {
    const code = `
      import React, { useState, useEffect } from 'react';

      function MyComponent({ name }) {
        const [count, setCount] = useState(0);
        const doubled = count * 2;

        useEffect(() => {
          console.log(name, count, doubled);
        }, [count]);

        return <div>{name}: {count}</div>;
      }
    `;

    const ast = parseCode(code);
    scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);

    converter = new DependencyConverter(scopeManager, scopeManager);
    converter.setCurrentFile("test.tsx");
  });

  describe("setCurrentFile", () => {
    it("updates the current file being analyzed", () => {
      converter.setCurrentFile("another.tsx");
      // File is updated internally, no direct way to verify but should not throw
      expect(() => converter.setCurrentFile("third.tsx")).not.toThrow();
    });
  });

  describe("deduplicate", () => {
    it("removes duplicate dependencies by symbol name", () => {
      const code = `function Component() { const count = 1; }`;
      const ast = parseCode(code);

      let variablePath: NodePath | null = null;
      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "count" && (path as any).scope.getBinding("count")) {
            variablePath = path as NodePath;
          }
        },
      });

      expect(variablePath).not.toBeNull();

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Variable,
          name: "count",
          path: variablePath!,
          isPure: true,
        },
        {
          type: DependencyType.Variable,
          name: "count",
          path: variablePath!,
          isPure: true,
        },
      ];

      const result = converter.deduplicate(deps);
      expect(result).toHaveLength(1);
      expect((result[0] as any).name).toBe("count");
    });

    it("prefers Hook over Ref when both exist", () => {
      const code = `import { useRef } from 'react'; function Component() { const ref = useRef(null); }`;
      const ast = parseCode(code);

      let refPath: NodePath | null = null;
      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "ref" && (path as any).scope.getBinding("ref")) {
            refPath = path as NodePath;
          }
        },
      });

      expect(refPath).not.toBeNull();

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Ref,
          name: "ref",
          path: refPath!,
        },
        {
          type: DependencyType.Hook,
          hookName: "ref",
          path: refPath!,
        },
      ];

      const result = converter.deduplicate(deps);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(DependencyType.Hook);
    });

    it("keeps first occurrence when Hook comes before Ref", () => {
      const code = `import { useRef } from 'react'; function Component() { const ref = useRef(null); }`;
      const ast = parseCode(code);

      let refPath: NodePath | null = null;
      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "ref" && (path as any).scope.getBinding("ref")) {
            refPath = path as NodePath;
          }
        },
      });

      expect(refPath).not.toBeNull();

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Hook,
          hookName: "ref",
          path: refPath!,
        },
        {
          type: DependencyType.Ref,
          name: "ref",
          path: refPath!,
        },
      ];

      const result = converter.deduplicate(deps);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(DependencyType.Hook);
    });

    it("handles empty dependency list", () => {
      const deps: SpecificDependency[] = [];
      const result = converter.deduplicate(deps);
      expect(result).toEqual([]);
    });

    it("handles dependencies with different types but same name", () => {
      const code = `function Component({ count }) { const state = count; }`;
      const ast = parseCode(code);

      let countPath: NodePath | null = null;
      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "count" && (path as any).scope.hasBinding("count")) {
            countPath = path as NodePath;
          }
        },
      });

      expect(countPath).not.toBeNull();

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Prop,
          name: "count",
          path: countPath!,
        },
        {
          type: DependencyType.Variable,
          name: "count",
          path: countPath!,
          isPure: true,
        },
      ];

      const result = converter.deduplicate(deps);
      // Different types should both be kept
      expect(result).toHaveLength(2);
    });
  });

  describe("buildDependencyPaths", () => {
    it("maps symbol names to their NodePaths", () => {
      const code = `function Component() { const count = 1; const name = "test"; }`;
      const ast = parseCode(code);

      const paths: Map<string, NodePath> = new Map();
      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "count" && (path as any).scope.hasBinding("count")) {
            paths.set("count", path as NodePath);
          }
          if (path.node.name === "name" && (path as any).scope.hasBinding("name")) {
            paths.set("name", path as NodePath);
          }
        },
      });

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Variable,
          name: "count",
          path: paths.get("count")!,
          isPure: true,
        },
        {
          type: DependencyType.Variable,
          name: "name",
          path: paths.get("name")!,
          isPure: true,
        },
      ];

      const result = converter.buildDependencyPaths(deps);
      expect(result.size).toBe(2);
      expect(result.has(`count:${DependencyType.Variable}`)).toBe(true);
      expect(result.has(`name:${DependencyType.Variable}`)).toBe(true);
    });

    it("handles import dependencies with localName", () => {
      const code = `import React from 'react';`;
      const ast = parseCode(code);

      let importPath: NodePath | null = null;
      traverse(ast, {
        ImportDefaultSpecifier(path) {
          importPath = path.get("local") as NodePath;
        },
      });

      expect(importPath).not.toBeNull();

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Import,
          localName: "React",
          importedName: "default",
          source: "react",
          path: importPath!,
        },
      ];

      const result = converter.buildDependencyPaths(deps);
      expect(result.size).toBe(1);
      expect(result.has(`React:${DependencyType.Import}`)).toBe(true);
    });

    it("handles empty dependency list", () => {
      const deps: SpecificDependency[] = [];
      const result = converter.buildDependencyPaths(deps);
      expect(result.size).toBe(0);
    });
  });

  describe("convertToInternal", () => {
    it("converts variable dependencies correctly", () => {
      const code = `function Component() { const count = 1; return <div>{count}</div>; }`;
      const ast = parseCode(code);
      const testScopeManager = createScopeManager();
      testScopeManager.buildScopeTree(ast.program, "test.tsx");
      const testConverter = new DependencyConverter(testScopeManager);
      testConverter.setCurrentFile("test.tsx");

      let variablePath: NodePath | null = null;
      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "count" && (path as any).scope.hasBinding("count")) {
            variablePath = path as NodePath;
          }
        },
      });

      expect(variablePath).not.toBeNull();

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Variable,
          name: "count",
          path: variablePath!,
          isPure: true,
        },
      ];

      const result = testConverter.convertToInternal(deps, null);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe("count");
      expect(result[0].type).toBe(DependencyType.Variable);
      expect(result[0].origin.file).toBe("test.tsx");
      expect(result[0].isTransitive).toBe(false);
    });

    it("converts hook dependencies correctly", () => {
      const code = `import { useState } from 'react'; function Component() { const [count, setCount] = useState(0); }`;
      const ast = parseCode(code);
      const testScopeManager = createScopeManager();
      testScopeManager.buildScopeTree(ast.program, "test.tsx");
      const testConverter = new DependencyConverter(testScopeManager);
      testConverter.setCurrentFile("test.tsx");

      let hookPath: NodePath | null = null;
      traverse(ast, {
        CallExpression(path) {
          if (t.isIdentifier(path.node.callee) && path.node.callee.name === "useState") {
            hookPath = path as NodePath;
          }
        },
      });

      expect(hookPath).not.toBeNull();

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Hook,
          hookName: "useState",
          path: hookPath!,
        },
      ];

      const result = testConverter.convertToInternal(deps, null);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe("useState");
      expect(result[0].type).toBe(DependencyType.Hook);
    });

    it("converts import dependencies correctly", () => {
      const code = `import React from 'react';`;
      const ast = parseCode(code);
      const testScopeManager = createScopeManager();
      testScopeManager.buildScopeTree(ast.program, "test.tsx");
      const testConverter = new DependencyConverter(testScopeManager);
      testConverter.setCurrentFile("test.tsx");

      let importPath: NodePath | null = null;
      traverse(ast, {
        ImportDefaultSpecifier(path) {
          importPath = path.get("local") as NodePath;
        },
      });

      expect(importPath).not.toBeNull();

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Import,
          localName: "React",
          importedName: "default",
          source: "react",
          path: importPath!,
        },
      ];

      const result = testConverter.convertToInternal(deps, null);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe("React");
      expect(result[0].type).toBe(DependencyType.Import);
    });

    it("converts prop dependencies correctly", () => {
      const code = `function Component({ name }) { return <div>{name}</div>; }`;
      const ast = parseCode(code);
      const testScopeManager = createScopeManager();
      testScopeManager.buildScopeTree(ast.program, "test.tsx");
      const testConverter = new DependencyConverter(testScopeManager);
      testConverter.setCurrentFile("test.tsx");

      let propPath: NodePath | null = null;
      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "name" && (path as any).scope.hasBinding("name")) {
            const binding = (path as any).scope.getBinding("name");
            if (binding && binding.kind === "param") {
              propPath = path as NodePath;
            }
          }
        },
      });

      expect(propPath).not.toBeNull();

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Prop,
          name: "name",
          path: propPath!,
        },
      ];

      const result = testConverter.convertToInternal(deps, null);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe("name");
      expect(result[0].type).toBe(DependencyType.Prop);
    });

    it("handles empty dependency list", () => {
      const result = converter.convertToInternal([], null);
      expect(result).toEqual([]);
    });

    it("handles dependency without scope gracefully", () => {
      // Create a mock path without proper scope
      const mockPath: any = {
        node: t.identifier("unknown"),
        scope: {
          getBinding: () => null,
        },
      };

      const deps: SpecificDependency[] = [
        {
          type: DependencyType.Variable,
          name: "unknown",
          path: mockPath,
          isPure: true,
        },
      ];

      // Should return a placeholder dependency with Module scope
      const result = converter.convertToInternal(deps, null);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe("unknown");
    });
  });
});
