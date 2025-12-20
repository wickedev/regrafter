/**
 * Tests for HookLocationValidator
 *
 * Tests Rules of Hooks validation and hook location finding
 */

import { describe, it, expect } from "vitest";
import { HookLocationValidator } from "../hook-location-validator.js";
import { ScopeType } from "../../../types/internal.js";
import type { ScopeInfo } from "../../../types/internal.js";
import { ok } from "../../../result/index.js";

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
    depth: parent ? parent.depth + 1 : 0,
  };
}

// Helper to create component scope
function createComponentScope(
  id = "component-scope",
  parent: ScopeInfo | null = null
): ScopeInfo {
  return createMockScope(ScopeType.Component, id, parent);
}

describe("HookLocationValidator", () => {
  describe("isValidHookLocation", () => {
    it("should return true for component top-level scope", () => {
      const validator = new HookLocationValidator();
      const componentScope = createComponentScope();

      const result = validator.isValidHookLocation(componentScope);

      expect(result).toBe(true);
    });

    it("should return false for module scope", () => {
      const validator = new HookLocationValidator();
      const moduleScope = createMockScope(ScopeType.Module);

      const result = validator.isValidHookLocation(moduleScope);

      expect(result).toBe(false);
    });

    it("should return false for block scope", () => {
      const validator = new HookLocationValidator();
      const componentScope = createComponentScope();
      const blockScope = createMockScope(
        ScopeType.Block,
        "block",
        componentScope
      );

      const result = validator.isValidHookLocation(blockScope);

      expect(result).toBe(false);
    });

    it("should return false for conditional scope", () => {
      const validator = new HookLocationValidator();
      const componentScope = createComponentScope();
      const conditionalScope = createMockScope(
        ScopeType.Conditional,
        "conditional",
        componentScope
      );

      const result = validator.isValidHookLocation(conditionalScope);

      expect(result).toBe(false);
    });

    it("should return false for loop scope", () => {
      const validator = new HookLocationValidator();
      const componentScope = createComponentScope();
      const loopScope = createMockScope(ScopeType.Loop, "loop", componentScope);

      const result = validator.isValidHookLocation(loopScope);

      expect(result).toBe(false);
    });

    it("should return true for custom hook scope (function named with use prefix)", () => {
      const validator = new HookLocationValidator();
      const hookScope: ScopeInfo = {
        id: "custom-hook",
        type: ScopeType.Function,
        path: {
          node: {
            type: "FunctionDeclaration",
            id: { type: "Identifier", name: "useCustomHook" },
          } as any,
          parentPath: null as any,
        } as any,
        parent: null,
        depth: 0,
      };

      const result = validator.isValidHookLocation(hookScope);

      expect(result).toBe(true);
    });

    it("should return false for regular function scope", () => {
      const validator = new HookLocationValidator();
      const functionScope: ScopeInfo = {
        id: "regular-function",
        type: ScopeType.Function,
        path: {
          node: {
            type: "FunctionDeclaration",
            id: { type: "Identifier", name: "regularFunction" },
          } as any,
          parentPath: null as any,
        } as any,
        parent: null,
        depth: 0,
      };

      const result = validator.isValidHookLocation(functionScope);

      expect(result).toBe(false);
    });

    it("should return false for component nested in conditional", () => {
      const validator = new HookLocationValidator();
      const moduleScope = createMockScope(ScopeType.Module);
      const conditionalScope = createMockScope(
        ScopeType.Conditional,
        "conditional",
        moduleScope
      );
      const componentScope = createComponentScope(
        "nested-component",
        conditionalScope
      );

      const result = validator.isValidHookLocation(componentScope);

      expect(result).toBe(false);
    });
  });

  describe("findNearestValidHookScope", () => {
    it("should return the scope itself if it's valid", () => {
      const validator = new HookLocationValidator();
      const componentScope = createComponentScope();

      const result = validator.findNearestValidHookScope(componentScope);

      expect(result).toBe(componentScope);
    });

    it("should walk up to find valid component scope from block scope", () => {
      const validator = new HookLocationValidator();
      const componentScope = createComponentScope();
      const blockScope = createMockScope(
        ScopeType.Block,
        "block",
        componentScope
      );

      const result = validator.findNearestValidHookScope(blockScope);

      expect(result).toBe(componentScope);
    });

    it("should walk up past conditionals to find valid scope", () => {
      const validator = new HookLocationValidator();
      const componentScope = createComponentScope();
      const conditionalScope = createMockScope(
        ScopeType.Conditional,
        "conditional",
        componentScope
      );
      const innerBlockScope = createMockScope(
        ScopeType.Block,
        "block",
        conditionalScope
      );

      const result = validator.findNearestValidHookScope(innerBlockScope);

      expect(result).toBe(componentScope);
    });

    it("should return null if no valid scope found", () => {
      const validator = new HookLocationValidator();
      const moduleScope = createMockScope(ScopeType.Module);
      const blockScope = createMockScope(ScopeType.Block, "block", moduleScope);

      const result = validator.findNearestValidHookScope(blockScope);

      expect(result).toBe(null);
    });

    it("should find custom hook scope", () => {
      const validator = new HookLocationValidator();
      const hookScope: ScopeInfo = {
        id: "custom-hook",
        type: ScopeType.Function,
        path: {
          node: {
            type: "FunctionDeclaration",
            id: { type: "Identifier", name: "useCustomHook" },
          } as any,
          parentPath: null as any,
        } as any,
        parent: null,
        depth: 0,
      };
      const blockScope = createMockScope(ScopeType.Block, "block", hookScope);

      const result = validator.findNearestValidHookScope(blockScope);

      expect(result).toBe(hookScope);
    });
  });

  describe("validateHookHoist", () => {
    it("should return ok for valid hook hoist to component scope", () => {
      const validator = new HookLocationValidator();
      const targetScope = createComponentScope();

      const result = validator.validateHookHoist(targetScope, false);

      expect(result).toEqual(ok(undefined));
    });

    it("should return error when no valid hook location found", () => {
      const validator = new HookLocationValidator();
      const moduleScope = createMockScope(ScopeType.Module);

      const result = validator.validateHookHoist(moduleScope, false);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          "No valid hook location found in target scope chain"
        );
      }
    });

    it("should return error for conditional scope target", () => {
      const validator = new HookLocationValidator();
      const componentScope = createComponentScope();
      const conditionalScope = createMockScope(
        ScopeType.Conditional,
        "conditional",
        componentScope
      );

      const result = validator.validateHookHoist(conditionalScope, false);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          "Cannot hoist hook to conditional or loop scope"
        );
      }
    });

    it("should return error for loop scope target", () => {
      const validator = new HookLocationValidator();
      const componentScope = createComponentScope();
      const loopScope = createMockScope(ScopeType.Loop, "loop", componentScope);

      const result = validator.validateHookHoist(loopScope, false);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          "Cannot hoist hook to conditional or loop scope"
        );
      }
    });

    it("should return error for cross-file non-ancestor component hoist", () => {
      const validator = new HookLocationValidator();
      const targetScope = createComponentScope("target");

      const result = validator.validateHookHoist(targetScope, true);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          "Cannot hoist hook results across files"
        );
      }
    });

    it("should return ok for same-file component hoist", () => {
      const validator = new HookLocationValidator();
      const targetScope = createComponentScope();

      const result = validator.validateHookHoist(targetScope, false);

      expect(result).toEqual(ok(undefined));
    });
  });

  describe("Edge cases", () => {
    it("should handle arrow function custom hook", () => {
      const validator = new HookLocationValidator();
      const hookScope: ScopeInfo = {
        id: "arrow-hook",
        type: ScopeType.Function,
        path: {
          node: { type: "ArrowFunctionExpression" } as any,
          parentPath: {
            isVariableDeclarator: () => true,
            node: {
              id: { type: "Identifier", name: "useArrowHook" },
            },
          } as any,
        } as any,
        parent: null,
        depth: 0,
      };

      const result = validator.isValidHookLocation(hookScope);

      expect(result).toBe(true);
    });

    it("should handle nested components", () => {
      const validator = new HookLocationValidator();
      const outerComponent = createComponentScope("outer");
      const innerComponent = createComponentScope("inner", outerComponent);

      const result = validator.isValidHookLocation(innerComponent);

      expect(result).toBe(true);
    });

    it("should reject class components", () => {
      const validator = new HookLocationValidator();
      const classScope: ScopeInfo = {
        id: "class-component",
        type: ScopeType.Function,
        path: {
          node: {
            type: "ClassMethod",
            key: { type: "Identifier", name: "render" },
          } as any,
          parentPath: null as any,
        } as any,
        parent: null,
        depth: 0,
      };

      const result = validator.isValidHookLocation(classScope);

      expect(result).toBe(false);
    });
  });
});
