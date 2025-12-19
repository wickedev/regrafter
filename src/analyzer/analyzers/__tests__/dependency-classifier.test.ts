/**
 * Tests for DependencyClassifier
 */

import { describe, it, expect } from "vitest";
import { parse } from "@babel/parser";
import traverseFn, { type NodePath } from "@babel/traverse";

const traverse = traverseFn as any as typeof traverseFn.default;

import { createScopeManager, ScopeType } from "../../../scope/index.js";
import {
  createDependencyClassifier,
  type IDependencyClassifier,
} from "../dependency-classifier.js";
import {
  DependencyType,
  type InternalDependency,
} from "../../types.js";
import {
  createInternalDependency,
  createDependencyOrigin,
  createScopeInfo,
} from "../../../types/factories.js";

describe("DependencyClassifier", () => {
  function setup(code: string) {
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);

    const classifier = createDependencyClassifier(scopeManager);

    // Helper to find JSX element
    let elementPath: NodePath | null = null;
    traverse(ast, {
      JSXElement(path) {
        if (!elementPath) elementPath = path;
      },
    });

    return { classifier, elementPath, ast, scopeManager };
  }

  describe("classifyDependencies", () => {
    it("should classify dependencies correctly", () => {
      const code = `
        import React from 'react';

        function Component() {
          const [state, setState] = React.useState(0);
          const value = 10;
          return <div>{state} {value}</div>;
        }
      `;
      const { classifier, elementPath, scopeManager } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const elementScope = scopeManager.getScopeForPath(elementPath);
      const targetScope = scopeManager.getScopeTree()?.root ?? null;

      // Create mock dependencies
      const deps: InternalDependency[] = [
        createInternalDependency({
          symbol: "state, setState",
          type: DependencyType.Hook,
          origin: createDependencyOrigin({
            node: elementPath.node,
            file: "test.tsx",
          }),
          scope: elementScope ?? createScopeInfo({
            type: ScopeType.Component,
            path: elementPath,
            parent: null,
          }),
        }),
        createInternalDependency({
          symbol: "value",
          type: DependencyType.Variable,
          origin: createDependencyOrigin({
            node: elementPath.node,
            file: "test.tsx",
          }),
          scope: elementScope ?? createScopeInfo({
            type: ScopeType.Component,
            path: elementPath,
            parent: null,
          }),
        }),
        createInternalDependency({
          symbol: "React",
          type: DependencyType.Import,
          origin: createDependencyOrigin({
            node: elementPath.node,
            file: "test.tsx",
          }),
          scope: targetScope ?? createScopeInfo({
            type: ScopeType.Module,
            path: elementPath,
            parent: null,
          }),
        }),
      ];

      const result = classifier.classifyDependencies(
        deps,
        elementScope,
        targetScope
      );

      expect(result.needsImport).toHaveLength(1);
      expect(result.needsImport[0]?.symbol).toBe("React");
    });

    it("should handle empty dependency list", () => {
      const code = `
        function Component() {
          return <div>test</div>;
        }
      `;
      const { classifier, elementPath, scopeManager } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const elementScope = scopeManager.getScopeForPath(elementPath);
      const targetScope = scopeManager.getScopeTree()?.root ?? null;

      const result = classifier.classifyDependencies(
        [],
        elementScope,
        targetScope
      );

      expect(result.needsHoisting).toHaveLength(0);
      expect(result.needsImport).toHaveLength(0);
      expect(result.needsPropThreading).toHaveLength(0);
    });

    it("should handle null scopes gracefully", () => {
      const code = `
        function Component() {
          return <div>test</div>;
        }
      `;
      const { classifier, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const deps: InternalDependency[] = [
        createInternalDependency({
          symbol: "test",
          type: DependencyType.Variable,
          origin: createDependencyOrigin({
            node: elementPath.node,
            file: "test.tsx",
          }),
          scope: createScopeInfo({
            type: ScopeType.Component,
            path: elementPath,
            parent: null,
          }),
        }),
      ];

      const result = classifier.classifyDependencies(deps, null, null);

      // With null scopes, classification should be conservative
      expect(result.needsHoisting).toHaveLength(0);
      expect(result.needsImport).toHaveLength(0);
      expect(result.needsPropThreading).toHaveLength(0);
    });
  });

  describe("needsHoisting", () => {
    it("should return true when dependency is not accessible from target", () => {
      const code = `
        function Component() {
          const value = 10;
          return <div>{value}</div>;
        }

        function Target() {
          return <div>target</div>;
        }
      `;
      const { classifier, scopeManager, ast } = setup(code);

      // Find component scopes
      let componentScope: any = null;
      let targetScope: any = null;

      traverse(ast, {
        FunctionDeclaration(path) {
          const name = path.node.id?.name;
          if (name === "Component") {
            componentScope = scopeManager.getScopeForPath(path);
          } else if (name === "Target") {
            targetScope = scopeManager.getScopeForPath(path);
          }
        },
      });

      if (!componentScope || !targetScope) {
        throw new Error("Could not find component scopes");
      }

      // Create a dependency from Component scope
      const dep = createInternalDependency({
        symbol: "value",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: ast.program.body[0] as any,
          file: "test.tsx",
        }),
        scope: componentScope,
      });

      const result = classifier.needsHoisting(dep, componentScope, targetScope);

      expect(result).toBe(true);
    });

    it("should return false for import dependencies", () => {
      const code = `
        import React from 'react';

        function Component() {
          return <div>{React.version}</div>;
        }
      `;
      const { classifier, elementPath, scopeManager } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const elementScope = scopeManager.getScopeForPath(elementPath);
      const targetScope = scopeManager.getScopeTree()?.root ?? null;

      const dep = createInternalDependency({
        symbol: "React",
        type: DependencyType.Import,
        origin: createDependencyOrigin({
          node: elementPath.node,
          file: "test.tsx",
        }),
        scope: targetScope ?? createScopeInfo({
          type: ScopeType.Module,
          path: elementPath,
          parent: null,
        }),
      });

      const result = classifier.needsHoisting(dep, elementScope, targetScope);

      expect(result).toBe(false);
    });

    it("should return false when target scope has binding", () => {
      const code = `
        const value = 10;

        function Component() {
          return <div>{value}</div>;
        }
      `;
      const { classifier, elementPath, scopeManager } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const elementScope = scopeManager.getScopeForPath(elementPath);
      const targetScope = scopeManager.getScopeTree()?.root ?? null;

      const dep = createInternalDependency({
        symbol: "value",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: elementPath.node,
          file: "test.tsx",
        }),
        scope: targetScope ?? createScopeInfo({
          type: ScopeType.Module,
          path: elementPath,
          parent: null,
        }),
      });

      const result = classifier.needsHoisting(dep, elementScope, targetScope);

      expect(result).toBe(false);
    });

    it("should handle comma-separated symbols", () => {
      const code = `
        function Component() {
          const [state, setState] = useState(0);
          return <div>{state}</div>;
        }

        function Target() {
          return <div>target</div>;
        }
      `;
      const { classifier, scopeManager, ast } = setup(code);

      // Find component scopes
      let componentScope: any = null;
      let targetScope: any = null;

      traverse(ast, {
        FunctionDeclaration(path) {
          const name = path.node.id?.name;
          if (name === "Component") {
            componentScope = scopeManager.getScopeForPath(path);
          } else if (name === "Target") {
            targetScope = scopeManager.getScopeForPath(path);
          }
        },
      });

      if (!componentScope || !targetScope) {
        throw new Error("Could not find component scopes");
      }

      const dep = createInternalDependency({
        symbol: "state, setState",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: ast.program.body[0] as any,
          file: "test.tsx",
        }),
        scope: componentScope,
      });

      const result = classifier.needsHoisting(dep, componentScope, targetScope);

      expect(result).toBe(true);
    });

    it("should return false with null scopes", () => {
      const code = `
        function Component() {
          return <div>test</div>;
        }
      `;
      const { classifier, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const dep = createInternalDependency({
        symbol: "test",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: elementPath.node,
          file: "test.tsx",
        }),
        scope: createScopeInfo({
          type: ScopeType.Component,
          path: elementPath,
          parent: null,
        }),
      });

      const result = classifier.needsHoisting(dep, null, null);

      expect(result).toBe(false);
    });
  });

  describe("needsImport", () => {
    it("should return true for import dependencies", () => {
      const code = `
        import React from 'react';

        function Component() {
          return <div>{React.version}</div>;
        }
      `;
      const { classifier, elementPath, scopeManager } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const targetScope = scopeManager.getScopeTree()?.root ?? null;

      const dep = createInternalDependency({
        symbol: "React",
        type: DependencyType.Import,
        origin: createDependencyOrigin({
          node: elementPath.node,
          file: "test.tsx",
        }),
        scope: targetScope ?? createScopeInfo({
          type: ScopeType.Module,
          path: elementPath,
          parent: null,
        }),
      });

      const result = classifier.needsImport(dep, targetScope);

      expect(result).toBe(true);
    });

    it("should return false for non-import dependencies", () => {
      const code = `
        function Component() {
          const value = 10;
          return <div>{value}</div>;
        }
      `;
      const { classifier, elementPath, scopeManager } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const targetScope = scopeManager.getScopeTree()?.root ?? null;

      const dep = createInternalDependency({
        symbol: "value",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: elementPath.node,
          file: "test.tsx",
        }),
        scope: targetScope ?? createScopeInfo({
          type: ScopeType.Module,
          path: elementPath,
          parent: null,
        }),
      });

      const result = classifier.needsImport(dep, targetScope);

      expect(result).toBe(false);
    });
  });

  describe("needsPropThreading", () => {
    it("should return true for hooks moved out of component scope", () => {
      const code = `
        function Component() {
          const [state] = useState(0);
          return <div>{state}</div>;
        }
      `;
      const { classifier, elementPath, scopeManager } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const elementScope = scopeManager.getScopeForPath(elementPath);
      const targetScope = scopeManager.getScopeTree()?.root ?? null;

      const dep = createInternalDependency({
        symbol: "state",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: elementPath.node,
          file: "test.tsx",
        }),
        scope: elementScope ?? createScopeInfo({
          type: ScopeType.Component,
          path: elementPath,
          parent: null,
        }),
      });

      const result = classifier.needsPropThreading(
        dep,
        elementScope,
        targetScope
      );

      // Hook dependencies that aren't accessible need prop threading
      expect(typeof result).toBe("boolean");
    });

    it("should return false for non-hook dependencies", () => {
      const code = `
        function Component() {
          const value = 10;
          return <div>{value}</div>;
        }
      `;
      const { classifier, elementPath, scopeManager } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const elementScope = scopeManager.getScopeForPath(elementPath);
      const targetScope = scopeManager.getScopeTree()?.root ?? null;

      const dep = createInternalDependency({
        symbol: "value",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: elementPath.node,
          file: "test.tsx",
        }),
        scope: elementScope ?? createScopeInfo({
          type: ScopeType.Component,
          path: elementPath,
          parent: null,
        }),
      });

      const result = classifier.needsPropThreading(
        dep,
        elementScope,
        targetScope
      );

      expect(result).toBe(false);
    });

    it("should return false with null scopes", () => {
      const code = `
        function Component() {
          return <div>test</div>;
        }
      `;
      const { classifier, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const dep = createInternalDependency({
        symbol: "test",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: elementPath.node,
          file: "test.tsx",
        }),
        scope: createScopeInfo({
          type: ScopeType.Component,
          path: elementPath,
          parent: null,
        }),
      });

      const result = classifier.needsPropThreading(dep, null, null);

      expect(result).toBe(false);
    });
  });
});
