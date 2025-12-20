/**
 * Tests for DependencyResolver
 *
 * Task 2.1: Write unit tests for DependencyResolver
 * Following TDD - write tests first before implementation
 */

import { describe, it, expect } from "vitest";
import { createScopeManager, ScopeType } from "../../scope/index.js";
import type { ScopeInfo } from "../../scope/index.js";
import { DependencyType } from "../types.js";
import { createInternalDependency, createDependencyOrigin } from "../../types/factories.js";
import { DependencyResolver } from "../dependency-resolver.js";
import { createParser } from "../../parser/index.js";

/**
 * Helper to parse JSX code and set up scope manager
 */
function setupTest(code: string) {
  const parser = createParser();
  const result = parser.parse(code, "test.tsx");
  if (!result.ok) {
    throw new Error("Failed to parse test code");
  }

  const scopeManager = createScopeManager();
  scopeManager.buildScopeTree(result.value.program, "test.tsx");

  const resolver = new DependencyResolver(scopeManager, scopeManager);

  return { scopeManager, resolver, ast: result.value };
}

/**
 * Helper to find scope by name
 */
function findScope(scopeManager: any, name: string): ScopeInfo | null {
  const scopeTree = scopeManager.getScopeTree();
  if (!scopeTree) return null;

  const findInScope = (scope: ScopeInfo): ScopeInfo | null => {
    // Check if this scope's path is a function with the given name
    if (scope.path && scope.path.isFunctionDeclaration?.()) {
      const id = scope.path.node.id;
      if (id && id.type === "Identifier" && id.name === name) {
        return scope;
      }
    }

    // Search children
    for (const child of scope.children) {
      const found = findInScope(child);
      if (found) return found;
    }

    return null;
  };

  return findInScope(scopeTree.root);
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

      const { scopeManager, resolver, ast } = setupTest(code);

      const componentScope = findScope(scopeManager, "Component");
      expect(componentScope).not.toBeNull();

      const hookDep = createInternalDependency({
        symbol: "useState",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: ast,
          file: "test.tsx",
          location: null,
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

      const { scopeManager, resolver, ast } = setupTest(code);

      const parentScope = findScope(scopeManager, "ParentComponent");
      const childScope = findScope(scopeManager, "ChildComponent");

      expect(parentScope).not.toBeNull();
      expect(childScope).not.toBeNull();

      const variableDep = createInternalDependency({
        symbol: "message",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: ast,
          file: "test.tsx",
          location: null,
        }),
        scope: parentScope!,
      });

      // Variable in parent scope is accessible from child - no error
      const result = resolver.checkResolution([variableDep], childScope);

      expect(result.can).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("succeeds for context dependencies", () => {
      const code = `
        import React, { useContext } from 'react';
        const ThemeContext = React.createContext();

        function Component() {
          const theme = useContext(ThemeContext);
          return <div>Content</div>;
        }
      `;

      const { scopeManager, resolver, ast } = setupTest(code);

      const componentScope = findScope(scopeManager, "Component");
      expect(componentScope).not.toBeNull();

      const contextDep = createInternalDependency({
        symbol: "theme",
        type: DependencyType.Context,
        origin: createDependencyOrigin({
          node: ast,
          file: "test.tsx",
          location: null,
        }),
        scope: componentScope!,
      });

      // Context dependencies currently allowed (future: check provider hierarchy)
      const result = resolver.checkResolution([contextDep], null);

      expect(result.can).toBe(true);
    });

    it("fails when hook is in multiple dependencies list moving to module scope", () => {
      const code = `
        import { useState } from 'react';
        const MODULE_VAR = "global";

        function Component() {
          const [count, setCount] = useState(0);
          return <div>{MODULE_VAR} {count}</div>;
        }
      `;

      const { scopeManager, resolver, ast } = setupTest(code);

      const componentScope = findScope(scopeManager, "Component");
      expect(componentScope).not.toBeNull();

      const hookDep = createInternalDependency({
        symbol: "useState",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: ast,
          file: "test.tsx",
          location: null,
        }),
        scope: componentScope!,
      });

      // Multiple deps, but hook to module scope should fail
      const result = resolver.checkResolution([hookDep], null);

      expect(result.can).toBe(false);
      expect(result.reason).toContain("Hook");
    });

    it("returns true for empty dependency list", () => {
      const { resolver } = setupTest(`function Component() { return <div>Hello</div>; }`);

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

      const { scopeManager, resolver, ast } = setupTest(code);

      const scopeA = findScope(scopeManager, "ComponentA");
      const scopeB = findScope(scopeManager, "ComponentB");

      expect(scopeA).not.toBeNull();
      expect(scopeB).not.toBeNull();

      const variableDep = createInternalDependency({
        symbol: "secretData",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: ast,
          file: "test.tsx",
          location: null,
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

      const { scopeManager, resolver, ast } = setupTest(code);

      const parentScope = findScope(scopeManager, "Parent");
      const childScope = findScope(scopeManager, "Child");

      expect(parentScope).not.toBeNull();
      expect(childScope).not.toBeNull();

      const variableDep = createInternalDependency({
        symbol: "value",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: ast,
          file: "test.tsx",
          location: null,
        }),
        scope: parentScope!,
      });

      // Parent's variable is accessible from child - no hoisting needed
      const result = resolver.needsHoisting(variableDep, childScope);

      expect(result).toBe(false);
    });

    it("returns false for import dependencies", () => {
      const code = `import React from 'react';`;

      const { scopeManager, resolver, ast } = setupTest(code);

      const moduleScope = scopeManager.getScopeTree()?.root;
      expect(moduleScope).not.toBeNull();

      const importDep = createInternalDependency({
        symbol: "React",
        type: DependencyType.Import,
        origin: createDependencyOrigin({
          node: ast,
          file: "test.tsx",
          location: null,
        }),
        scope: moduleScope!,
      });

      // Imports don't need hoisting
      const result = resolver.needsHoisting(importDep, null);

      expect(result).toBe(false);
    });

    it("returns true when moving component-scoped variable to module scope", () => {
      const code = `
        function Component() {
          const local = "data";
          return <div>{local}</div>;
        }
      `;

      const { scopeManager, resolver, ast } = setupTest(code);

      const componentScope = findScope(scopeManager, "Component");
      expect(componentScope).not.toBeNull();

      const variableDep = createInternalDependency({
        symbol: "local",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: ast,
          file: "test.tsx",
          location: null,
        }),
        scope: componentScope!,
      });

      // null target scope = module scope, component variable needs hoisting
      const result = resolver.needsHoisting(variableDep, null);

      expect(result).toBe(true);
    });

    it("returns false when target scope already has the symbol", () => {
      const code = `
        function Component() {
          const value = 1;
          function Inner() {
            const value = 2; // shadows outer value
            return <div>{value}</div>;
          }
          return <Inner />;
        }
      `;

      const { scopeManager, resolver, ast } = setupTest(code);

      const componentScope = findScope(scopeManager, "Component");
      const innerScope = findScope(scopeManager, "Inner");

      expect(componentScope).not.toBeNull();
      expect(innerScope).not.toBeNull();

      const variableDep = createInternalDependency({
        symbol: "value",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: ast,
          file: "test.tsx",
          location: null,
        }),
        scope: componentScope!,
      });

      // Inner scope has its own "value", so outer value doesn't need hoisting
      const result = resolver.needsHoisting(variableDep, innerScope);

      expect(result).toBe(false);
    });
  });
});
