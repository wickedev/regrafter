/**
 * Tests for Dependency Resolver
 *
 * Task 2.1: Write unit tests for DependencyResolver
 * Following TDD - write tests first before implementation
 */

import { describe, it, expect } from "vitest";
import { ScopeType } from "../../scope/index.js";
import { createScopeInfo } from "../../types/factories.js";
import { DependencyType } from "../types.js";
import { createInternalDependency, createDependencyOrigin } from "../../types/factories.js";
import { DependencyResolver } from "../dependency-resolver.js";
import type { IScopeAccessibility, IBindingQuery } from "../interfaces.js";
import * as t from "@babel/types";

/**
 * Mock IScopeAccessibility for testing
 */
class MockScopeAccessibility implements IScopeAccessibility {
  checkAccessibility(depScope: any, targetScope: any): { accessible: boolean; reason?: string } {
    // Simplified accessibility check for testing
    if (!targetScope) return { accessible: false };
    if (depScope === targetScope) return { accessible: true };
    // If depScope is parent of targetScope, it's accessible
    if (depScope.type === ScopeType.Module && targetScope.type === ScopeType.Component) {
      return { accessible: true };
    }
    return { accessible: false };
  }
}

/**
 * Mock IBindingQuery for testing
 */
class MockBindingQuery implements IBindingQuery {
  private bindings: Map<string, Set<string>> = new Map();

  addBinding(scopeId: string, symbol: string) {
    if (!this.bindings.has(scopeId)) {
      this.bindings.set(scopeId, new Set());
    }
    this.bindings.get(scopeId)!.add(symbol);
  }

  getBindingsInScope(scope: any): Map<string, any> {
    const scopeId = scope.id || "unknown";
    const symbols = this.bindings.get(scopeId) || new Set();
    const result = new Map();
    symbols.forEach(sym => result.set(sym, {}));
    return result;
  }
}

describe("DependencyResolver", () => {
  describe("checkResolution", () => {
    it("fails when hook dependencies are moved to module scope", () => {
      const scopeAccessibility = new MockScopeAccessibility();
      const bindingQuery = new MockBindingQuery();
      const resolver = new DependencyResolver(scopeAccessibility, bindingQuery);

      const componentScope = createScopeInfo({
        type: ScopeType.Component,
        path: null as any,
        parent: null,
      });

      const hookDep = createInternalDependency({
        symbol: "useState",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: t.identifier("useState"),
          file: "test.tsx",
          location: null,
        }),
        scope: componentScope,
      });

      // Moving hook to module scope (null targetScope) should fail
      const result = resolver.checkResolution([hookDep], null);

      expect(result.can).toBe(false);
      expect(result.reason).toContain("Hook");
      expect(result.reason).toContain("module scope");
    });

    it("fails when hook is moved to module-level scope", () => {
      const scopeAccessibility = new MockScopeAccessibility();
      const bindingQuery = new MockBindingQuery();
      const resolver = new DependencyResolver(scopeAccessibility, bindingQuery);

      const componentScope = createScopeInfo({
        type: ScopeType.Component,
        path: null as any,
        parent: null,
      });

      const moduleScope = createScopeInfo({
        type: ScopeType.Module,
        path: null as any,
        parent: null,
      });

      const hookDep = createInternalDependency({
        symbol: "useState",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: t.identifier("useState"),
          file: "test.tsx",
          location: null,
        }),
        scope: componentScope,
      });

      // Moving hook to module scope should fail
      const result = resolver.checkResolution([hookDep], moduleScope);

      expect(result.can).toBe(false);
      expect(result.reason).toContain("Hook");
    });

    it("succeeds when all dependencies are accessible", () => {
      const scopeAccessibility = new MockScopeAccessibility();
      const bindingQuery = new MockBindingQuery();
      const resolver = new DependencyResolver(scopeAccessibility, bindingQuery);

      const moduleScope = createScopeInfo({
        type: ScopeType.Module,
        path: null as any,
        parent: null,
      });

      const variableDep = createInternalDependency({
        symbol: "message",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: t.identifier("message"),
          file: "test.tsx",
          location: null,
        }),
        scope: moduleScope,
      });

      // Variable dependencies can generally be resolved
      const result = resolver.checkResolution([variableDep], moduleScope);

      expect(result.can).toBe(true);
    });

    it("succeeds for context dependencies", () => {
      const scopeAccessibility = new MockScopeAccessibility();
      const bindingQuery = new MockBindingQuery();
      const resolver = new DependencyResolver(scopeAccessibility, bindingQuery);

      const componentScope = createScopeInfo({
        type: ScopeType.Component,
        path: null as any,
        parent: null,
      });

      const contextDep = createInternalDependency({
        symbol: "theme",
        type: DependencyType.Context,
        origin: createDependencyOrigin({
          node: t.identifier("theme"),
          file: "test.tsx",
          location: null,
        }),
        scope: componentScope,
      });

      // Context dependencies currently allowed (future: check provider hierarchy)
      const result = resolver.checkResolution([contextDep], null);

      expect(result.can).toBe(true);
    });

    it("returns true for empty dependency list", () => {
      const scopeAccessibility = new MockScopeAccessibility();
      const bindingQuery = new MockBindingQuery();
      const resolver = new DependencyResolver(scopeAccessibility, bindingQuery);

      const result = resolver.checkResolution([], null);

      expect(result.can).toBe(true);
    });
  });

  describe("needsHoisting", () => {
    it("returns false for import dependencies", () => {
      const scopeAccessibility = new MockScopeAccessibility();
      const bindingQuery = new MockBindingQuery();
      const resolver = new DependencyResolver(scopeAccessibility, bindingQuery);

      const moduleScope = createScopeInfo({
        type: ScopeType.Module,
        path: null as any,
        parent: null,
      });

      const importDep = createInternalDependency({
        symbol: "React",
        type: DependencyType.Import,
        origin: createDependencyOrigin({
          node: t.identifier("React"),
          file: "test.tsx",
          location: null,
        }),
        scope: moduleScope,
      });

      // Imports don't need hoisting
      const result = resolver.needsHoisting(importDep, null);

      expect(result).toBe(false);
    });

    it("returns true when moving to null target scope", () => {
      const scopeAccessibility = new MockScopeAccessibility();
      const bindingQuery = new MockBindingQuery();
      const resolver = new DependencyResolver(scopeAccessibility, bindingQuery);

      const componentScope = createScopeInfo({
        type: ScopeType.Component,
        path: null as any,
        parent: null,
      });

      const variableDep = createInternalDependency({
        symbol: "local",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: t.identifier("local"),
          file: "test.tsx",
          location: null,
        }),
        scope: componentScope,
      });

      // null target scope = module scope, component variable needs hoisting
      const result = resolver.needsHoisting(variableDep, null);

      expect(result).toBe(true);
    });

    it("returns false when target scope already has the symbol", () => {
      const scopeAccessibility = new MockScopeAccessibility();
      const bindingQuery = new MockBindingQuery();
      const resolver = new DependencyResolver(scopeAccessibility, bindingQuery);

      const outerScope = createScopeInfo({
        type: ScopeType.Component,
        path: null as any,
        parent: null,
      });
      outerScope.id = "outer";

      const innerScope = createScopeInfo({
        type: ScopeType.Component,
        path: null as any,
        parent: outerScope,
      });
      innerScope.id = "inner";

      // Inner scope has its own "value"
      bindingQuery.addBinding("inner", "value");

      const variableDep = createInternalDependency({
        symbol: "value",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: t.identifier("value"),
          file: "test.tsx",
          location: null,
        }),
        scope: outerScope,
      });

      // Inner scope has its own "value", so outer value doesn't need hoisting
      const result = resolver.needsHoisting(variableDep, innerScope);

      expect(result).toBe(false);
    });

    it("returns true when dependency is inaccessible from target scope", () => {
      const scopeAccessibility = new MockScopeAccessibility();
      const bindingQuery = new MockBindingQuery();
      const resolver = new DependencyResolver(scopeAccessibility, bindingQuery);

      const scopeA = createScopeInfo({
        type: ScopeType.Component,
        path: null as any,
        parent: null,
      });

      const scopeB = createScopeInfo({
        type: ScopeType.Component,
        path: null as any,
        parent: null,
      });

      const variableDep = createInternalDependency({
        symbol: "secretData",
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: t.identifier("secretData"),
          file: "test.tsx",
          location: null,
        }),
        scope: scopeA,
      });

      // scopeA and scopeB are siblings, not accessible
      const result = resolver.needsHoisting(variableDep, scopeB);

      expect(result).toBe(true);
    });
  });
});
