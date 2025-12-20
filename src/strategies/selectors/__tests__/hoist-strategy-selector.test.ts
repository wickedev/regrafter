/**
 * Tests for HoistStrategySelector
 *
 * Tests strategy selection logic for different dependency types
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HoistStrategySelector } from "../hoist-strategy-selector.js";
import { HookLocationValidator } from "../../validators/hook-location-validator.js";
import { ScopeType, HoistStrategy } from "../../../types/internal.js";
import { DependencyType } from "../../../types/public.js";
import type {
  ScopeInfo,
  InternalDependency,
  ComponentScope,
} from "../../../types/internal.js";

// Helper to create mock scope
function createMockScope(
  type: ScopeType,
  id = "test-scope",
  parent: ScopeInfo | null = null
): ScopeInfo {
  return {
    id,
    type,
    path: {
      node: { type: "FunctionDeclaration" } as any,
      parentPath: null as any,
    } as any,
    parent,
    bindings: new Map(),
    depth: parent ? parent.depth + 1 : 0,
  };
}

// Helper to create component scope
function createComponentScope(
  id = "component-scope",
  name = "TestComponent",
  parent: ScopeInfo | null = null
): ComponentScope {
  return {
    id,
    type: ScopeType.Component,
    componentName: name,
    path: {
      node: { type: "FunctionDeclaration" } as any,
      parentPath: null as any,
    } as any,
    parent,
    bindings: new Map(),
    depth: parent ? parent.depth + 1 : 0,
    isConditionallyRendered: false,
    isInsideLoop: false,
    parentComponent: null,
    hooks: [],
  };
}

// Helper to create mock dependency
function createMockDependency(
  type: DependencyType,
  symbol = "testDep",
  scope: ScopeInfo
): InternalDependency {
  return {
    id: `dep-${symbol}`,
    symbol,
    type,
    origin: {
      file: "test.tsx",
      node: { type: "Identifier" } as any,
      location: null,
    },
    scope,
    isTransitive: false,
    consumers: [],
  };
}

describe("HoistStrategySelector", () => {
  let selector: HoistStrategySelector;
  let hookValidator: HookLocationValidator;

  beforeEach(() => {
    hookValidator = new HookLocationValidator();
    selector = new HoistStrategySelector(hookValidator);
  });

  describe("selectStrategy - Hook dependencies", () => {
    it("should select Hoist strategy for hook in same file", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Hook,
        "useState",
        sourceScope
      );

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(HoistStrategy.Hoist);
    });

    it("should select PassAsProp strategy for hook with backward reference", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Hook,
        "useState",
        sourceScope
      );
      dep.consumers = ["consumer1"]; // Has consumers

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: true,
      });

      expect(result.strategy).toBe(HoistStrategy.PassAsProp);
      expect(result.needsPropThreading).toBe(true);
    });

    it("should reject hook hoist cross-file to non-ancestor", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Hook,
        "useState",
        sourceScope
      );

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: true,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(null);
      expect(result.reason).toContain("cross file");
    });
  });

  describe("selectStrategy - Variable dependencies", () => {
    it("should select Hoist strategy for pure variable", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Variable,
        "CONSTANT",
        sourceScope
      );
      // Pure variable - literal initializer
      dep.origin.node = {
        type: "VariableDeclarator",
        id: { type: "Identifier", name: "CONSTANT" },
        init: { type: "StringLiteral", value: "test" },
      } as any;

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(HoistStrategy.Hoist);
    });

    it("should select PassAsProp strategy for impure variable", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Variable,
        "dynamicValue",
        sourceScope
      );
      // Impure variable - call expression
      dep.origin.node = {
        type: "VariableDeclarator",
        id: { type: "Identifier", name: "dynamicValue" },
        init: { type: "CallExpression" },
      } as any;

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(HoistStrategy.PassAsProp);
      expect(result.needsPropThreading).toBe(true);
    });
  });

  describe("selectStrategy - Prop dependencies", () => {
    it("should select PassAsProp strategy for props", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Prop,
        "userName",
        sourceScope
      );

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(HoistStrategy.PassAsProp);
      expect(result.needsPropThreading).toBe(true);
    });
  });

  describe("selectStrategy - Context dependencies", () => {
    it("should select ExtractContext strategy for context", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Context,
        "theme",
        sourceScope
      );

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(HoistStrategy.ExtractContext);
      expect(result.needsPropThreading).toBe(true);
    });
  });

  describe("selectStrategy - Ref dependencies", () => {
    it("should select Hoist strategy for refs", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Ref,
        "inputRef",
        sourceScope
      );

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(HoistStrategy.Hoist);
    });
  });

  describe("selectStrategy - Import dependencies", () => {
    it("should return null for import dependencies", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Import,
        "Button",
        sourceScope
      );

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(null);
      expect(result.reason).toContain("handled separately");
    });
  });

  describe("determineTargetScope", () => {
    it("should return target scope for non-hook dependencies", () => {
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Variable,
        "value",
        targetScope
      );

      const result = selector.determineTargetScope(dep, targetScope, false);

      expect(result).toBe(targetScope);
    });

    it("should find nearest valid hook scope for hooks", () => {
      const componentScope = createComponentScope("component", "Component");
      const blockScope = createMockScope(
        ScopeType.Block,
        "block",
        componentScope
      );
      const dep = createMockDependency(
        DependencyType.Hook,
        "useState",
        componentScope
      );

      const result = selector.determineTargetScope(dep, blockScope, false);

      expect(result).toBe(componentScope);
    });

    it("should find nearest valid hook scope for refs", () => {
      const componentScope = createComponentScope("component", "Component");
      const blockScope = createMockScope(
        ScopeType.Block,
        "block",
        componentScope
      );
      const dep = createMockDependency(
        DependencyType.Ref,
        "ref",
        componentScope
      );

      const result = selector.determineTargetScope(dep, blockScope, false);

      expect(result).toBe(componentScope);
    });

    it("should return null when no valid hook scope found", () => {
      const moduleScope = createMockScope(ScopeType.Module);
      const dep = createMockDependency(DependencyType.Hook, "useState", moduleScope);

      const result = selector.determineTargetScope(dep, moduleScope, false);

      expect(result).toBe(null);
    });

    it("should hoist variable dependencies to target scope", () => {
      const moduleScope = createMockScope(ScopeType.Module);
      const component1 = createComponentScope("c1", "C1", moduleScope);
      const component2 = createComponentScope("c2", "C2", moduleScope);
      const dep = createMockDependency(
        DependencyType.Variable,
        "value",
        component1
      );

      const result = selector.determineTargetScope(dep, component2, false);

      // Variables should follow the moved element to the target scope
      expect(result).toBe(component2);
    });
  });

  describe("Edge cases", () => {
    it("should handle unknown dependency type", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        "UNKNOWN" as any,
        "unknown",
        sourceScope
      );

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(null);
      expect(result.reason).toContain("Unknown");
    });

    it("should handle function expressions as pure variables", () => {
      const sourceScope = createComponentScope("source", "Source");
      const targetScope = createComponentScope("target", "Target");
      const dep = createMockDependency(
        DependencyType.Variable,
        "helper",
        sourceScope
      );
      dep.origin.node = {
        type: "VariableDeclarator",
        id: { type: "Identifier", name: "helper" },
        init: { type: "ArrowFunctionExpression" },
      } as any;

      const result = selector.selectStrategy(dep, {
        sourceScope,
        targetScope,
        isCrossFile: false,
        needsBackwardReference: false,
      });

      expect(result.strategy).toBe(HoistStrategy.Hoist);
    });
  });
});
