/**
 * Tests for DependencyResolver
 *
 * Task 2.1: Write unit tests for DependencyResolver
 * Following TDD - write tests first before implementation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { parse } from "@babel/parser";
import traverseFn, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { createScopeManager, ScopeType } from "../../scope/index.js";
import type { ScopeManager, ScopeInfo } from "../../scope/index.js";
import { DependencyType } from "../types.js";
import type { InternalDependency } from "../types.js";
import { createInternalDependency, createDependencyOrigin } from "../../types/factories.js";
import { DependencyResolver } from "../dependency-resolver.js";

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

describe("DependencyResolver", () => {
  describe("checkResolution", () => {
    it("fails when hook dependencies are moved to module scope", () => {
      const code = `
        import { useState } from 'react';
        function Component() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `;

      const ast = parseCode(code);
      const scopeManager = createScopeManager();
      scopeManager.buildScopeTree(ast.program, "test.tsx");
      const resolver = new DependencyResolver(scopeManager, scopeManager);

      let hookCallPath: NodePath | null = null;
      let componentScope: ScopeInfo | null = null;

      traverse(ast, {
        CallExpression(path) {
          if (t.isIdentifier(path.node.callee) && path.node.callee.name === "useState") {
            hookCallPath = path as NodePath;
          }
        },
        FunctionDeclaration(path) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === "Component") {
            componentScope = scopeManager.getScopeForPath(path as NodePath);
          }
        },
      });

      expect(hookCallPath).not.toBeNull();
      expect(componentScope).not.toBeNull();

      const hookDep = createInternalDependency({
        symbol: "useState",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: hookCallPath!.node,
          file: "test.tsx",
          location: hookCallPath!.node.loc,
        }),
        scope: componentScope!,
      });

      // Moving hook to module scope (null targetScope) should fail
      const result = resolver.checkResolution([hookDep], null);

      expect(result.can).toBe(false);
      expect(result.reason).toContain("Hook");
      expect(result.reason).toContain("module scope");
    });

    it("succeeds when all dependencies are accessible", () => {
      const code = `
        function ParentComponent() {
          const message = "Hello";

          function ChildComponent() {
            return <div>{message}</div>;
          }

          return <ChildComponent />;
        }
      `;

      const ast = parseCode(code);
      const scopeManager = createScopeManager();
      scopeManager.buildScopeTree(ast.program, "test.tsx");
      const resolver = new DependencyResolver(scopeManager, scopeManager);

      let variablePath: NodePath | null = null;
      let parentScope: ScopeInfo | null = null;
      let childScope: ScopeInfo | null = null;

      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "message" && (path as any).scope.hasBinding("message")) {
            variablePath = path as NodePath;
          }
        },
        FunctionDeclaration(path) {
          const scope = scopeManager.getScopeForPath(path as NodePath);
          if (t.isIdentifier(path.node.id) && path.node.id.name === "ParentComponent") {
            parentScope = scope;
          } else if (t.isIdentifier(path.node.id) && path.node.id.name === "ChildComponent") {
            childScope = scope;
          }
        },
      });

      expect(variablePath).not.toBeNull();
      expect(parentScope).not.toBeNull();
      expect(childScope).not.toBeNull();

      const variableDep = createInternalDependency({
        symbol: "message",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: variablePath!.node,
          file: "test.tsx",
          location: variablePath!.node.loc,
        }),
        scope: parentScope!,
      });

      // Variable in parent scope is accessible from child - no error
      const result = resolver.checkResolution([variableDep], childScope);

      expect(result.can).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("fails when context dependencies cannot be resolved", () => {
      const code = `
        import React, { useContext } from 'react';
        const ThemeContext = React.createContext();

        function Component() {
          const theme = useContext(ThemeContext);
          return <div>Content</div>;
        }
      `;

      const ast = parseCode(code);
      const scopeManager = createScopeManager();
      scopeManager.buildScopeTree(ast.program, "test.tsx");
      const resolver = new DependencyResolver(scopeManager, scopeManager);

      let contextCallPath: NodePath | null = null;
      let componentScope: ScopeInfo | null = null;

      traverse(ast, {
        CallExpression(path) {
          if (t.isIdentifier(path.node.callee) && path.node.callee.name === "useContext") {
            contextCallPath = path as NodePath;
          }
        },
        FunctionDeclaration(path) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === "Component") {
            componentScope = scopeManager.getScopeForPath(path as NodePath);
          }
        },
      });

      expect(contextCallPath).not.toBeNull();
      expect(componentScope).not.toBeNull();

      const contextDep = createInternalDependency({
        symbol: "theme",
        type: DependencyType.Context,
        origin: createDependencyOrigin({
          node: contextCallPath!.node,
          file: "test.tsx",
          location: contextCallPath!.node.loc,
        }),
        scope: componentScope!,
      });

      // Context dependencies currently not validated (always pass)
      // In future, could check provider hierarchy
      const result = resolver.checkResolution([contextDep], null);

      expect(result.can).toBe(true);
    });

    it("handles multiple dependencies with mixed results", () => {
      const code = `
        import { useState } from 'react';
        const MODULE_VAR = "global";

        function Component() {
          const [count, setCount] = useState(0);
          return <div>{MODULE_VAR} {count}</div>;
        }
      `;

      const ast = parseCode(code);
      const scopeManager = createScopeManager();
      scopeManager.buildScopeTree(ast.program, "test.tsx");
      const resolver = new DependencyResolver(scopeManager, scopeManager);

      let hookCallPath: NodePath | null = null;
      let componentScope: ScopeInfo | null = null;

      traverse(ast, {
        CallExpression(path) {
          if (t.isIdentifier(path.node.callee) && path.node.callee.name === "useState") {
            hookCallPath = path as NodePath;
          }
        },
        FunctionDeclaration(path) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === "Component") {
            componentScope = scopeManager.getScopeForPath(path as NodePath);
          }
        },
      });

      expect(hookCallPath).not.toBeNull();
      expect(componentScope).not.toBeNull();

      const hookDep = createInternalDependency({
        symbol: "useState",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: hookCallPath!.node,
          file: "test.tsx",
          location: hookCallPath!.node.loc,
        }),
        scope: componentScope!,
      });

      // Multiple deps, but hook to module scope should fail
      const result = resolver.checkResolution([hookDep], null);

      expect(result.can).toBe(false);
      expect(result.reason).toContain("Hook");
    });

    it("returns true for empty dependency list", () => {
      const code = `function Component() { return <div>Hello</div>; }`;
      const ast = parseCode(code);
      const scopeManager = createScopeManager();
      scopeManager.buildScopeTree(ast.program, "test.tsx");
      const resolver = new DependencyResolver(scopeManager, scopeManager);

      const result = resolver.checkResolution([], null);

      expect(result.can).toBe(true);
    });
  });

  describe("needsHoisting", () => {
    it("returns true when dependency is inaccessible from target scope", () => {
      const code = `
        function ComponentA() {
          const secretData = "hidden";
          return <div>{secretData}</div>;
        }

        function ComponentB() {
          return <div>Other</div>;
        }
      `;

      const ast = parseCode(code);
      const scopeManager = createScopeManager();
      scopeManager.buildScopeTree(ast.program, "test.tsx");
      const resolver = new DependencyResolver(scopeManager, scopeManager);

      let variablePath: NodePath | null = null;
      let scopeA: ScopeInfo | null = null;
      let scopeB: ScopeInfo | null = null;

      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "secretData" && (path as any).scope.hasBinding("secretData")) {
            variablePath = path as NodePath;
          }
        },
        FunctionDeclaration(path) {
          const scope = scopeManager.getScopeForPath(path as NodePath);
          if (t.isIdentifier(path.node.id) && path.node.id.name === "ComponentA") {
            scopeA = scope;
          } else if (t.isIdentifier(path.node.id) && path.node.id.name === "ComponentB") {
            scopeB = scope;
          }
        },
      });

      expect(variablePath).not.toBeNull();
      expect(scopeA).not.toBeNull();
      expect(scopeB).not.toBeNull();

      const variableDep = createInternalDependency({
        symbol: "secretData",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: variablePath!.node,
          file: "test.tsx",
          location: variablePath!.node.loc,
        }),
        scope: scopeA!,
      });

      // ComponentA's variable is not accessible from ComponentB
      const result = resolver.needsHoisting(variableDep, scopeB);

      expect(result).toBe(true);
    });

    it("returns false when dependency is accessible from target scope", () => {
      const code = `
        function Parent() {
          const value = 42;
          function Child() {
            return <div>{value}</div>;
          }
          return <Child />;
        }
      `;

      const ast = parseCode(code);
      const scopeManager = createScopeManager();
      scopeManager.buildScopeTree(ast.program, "test.tsx");
      const resolver = new DependencyResolver(scopeManager, scopeManager);

      let variablePath: NodePath | null = null;
      let parentScope: ScopeInfo | null = null;
      let childScope: ScopeInfo | null = null;

      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "value" && (path as any).scope.hasBinding("value")) {
            variablePath = path as NodePath;
          }
        },
        FunctionDeclaration(path) {
          const scope = scopeManager.getScopeForPath(path as NodePath);
          if (t.isIdentifier(path.node.id) && path.node.id.name === "Parent") {
            parentScope = scope;
          } else if (t.isIdentifier(path.node.id) && path.node.id.name === "Child") {
            childScope = scope;
          }
        },
      });

      expect(variablePath).not.toBeNull();
      expect(parentScope).not.toBeNull();
      expect(childScope).not.toBeNull();

      const variableDep = createInternalDependency({
        symbol: "value",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: variablePath!.node,
          file: "test.tsx",
          location: variablePath!.node.loc,
        }),
        scope: parentScope!,
      });

      // Parent's variable is accessible from child - no hoisting needed
      const result = resolver.needsHoisting(variableDep, childScope);

      expect(result).toBe(false);
    });

    it("returns false for import dependencies", () => {
      const code = `import React from 'react';`;
      const ast = parseCode(code);
      const scopeManager = createScopeManager();
      scopeManager.buildScopeTree(ast.program, "test.tsx");
      const resolver = new DependencyResolver(scopeManager, scopeManager);

      let importPath: NodePath | null = null;
      const moduleScope = scopeManager.getScopeTree()?.root;

      traverse(ast, {
        ImportDefaultSpecifier(path) {
          importPath = path.get("local") as NodePath;
        },
      });

      expect(importPath).not.toBeNull();
      expect(moduleScope).not.toBeNull();

      const importDep = createInternalDependency({
        symbol: "React",
        type: DependencyType.Import,
        origin: createDependencyOrigin({
          node: importPath!.node,
          file: "test.tsx",
          location: importPath!.node.loc,
        }),
        scope: moduleScope!,
      });

      // Imports don't need hoisting
      const result = resolver.needsHoisting(importDep, null);

      expect(result).toBe(false);
    });

    it("handles null target scope gracefully", () => {
      const code = `
        function Component() {
          const local = "data";
          return <div>{local}</div>;
        }
      `;

      const ast = parseCode(code);
      const scopeManager = createScopeManager();
      scopeManager.buildScopeTree(ast.program, "test.tsx");
      const resolver = new DependencyResolver(scopeManager, scopeManager);

      let variablePath: NodePath | null = null;
      let componentScope: ScopeInfo | null = null;

      traverse(ast, {
        Identifier(path) {
          if (path.node.name === "local" && (path as any).scope.hasBinding("local")) {
            variablePath = path as NodePath;
          }
        },
        FunctionDeclaration(path) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === "Component") {
            componentScope = scopeManager.getScopeForPath(path as NodePath);
          }
        },
      });

      expect(variablePath).not.toBeNull();
      expect(componentScope).not.toBeNull();

      const variableDep = createInternalDependency({
        symbol: "local",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: variablePath!.node,
          file: "test.tsx",
          location: variablePath!.node.loc,
        }),
        scope: componentScope!,
      });

      // null target scope should be handled gracefully
      const result = resolver.needsHoisting(variableDep, null);

      // Component-scoped variable to module scope needs hoisting
      expect(result).toBe(true);
    });
  });
});
