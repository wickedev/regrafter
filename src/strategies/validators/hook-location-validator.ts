/**
 * HookLocationValidator - Validates hook locations per Rules of Hooks
 *
 * This class is responsible for ensuring that React hooks are only placed
 * in valid locations according to the Rules of Hooks:
 * - Top level of function components
 * - Top level of custom hooks (functions starting with "use")
 * - NOT inside conditionals, loops, or nested functions
 */

import type { RegraffError } from "../../errors/error-category.js";
import { createValidationError } from "../../errors/index.js";
import type { Result } from "../../result/index.js";
import { ok, err } from "../../result/index.js";
import type { ScopeInfo } from "../../types/internal.js";
import { ScopeType } from "../../types/internal.js";
import { isHookName } from "../types.js";

/**
 * Interface for hook location validation
 */
export interface IHookLocationValidator {
  /**
   * Check if a scope is a valid location for React hooks
   */
  isValidHookLocation(scope: ScopeInfo): boolean;

  /**
   * Find the nearest valid hook location from a given scope
   */
  findNearestValidHookScope(scope: ScopeInfo): ScopeInfo | null;

  /**
   * Validate that a hook can be hoisted to the target scope
   */
  validateHookHoist(
    targetScope: ScopeInfo,
    isCrossFile: boolean
  ): Result<void, RegraffError>;
}

/**
 * Validates hook locations according to React's Rules of Hooks
 */
export class HookLocationValidator implements IHookLocationValidator {
  /**
   * Check if a scope is a valid location for React hooks
   *
   * Valid locations:
   * - Top level of a function component
   * - Top level of a custom hook
   *
   * Invalid locations:
   * - Inside conditionals (if/else)
   * - Inside loops (for/while/do)
   * - Inside nested functions (unless custom hook)
   * - Module level
   * - Regular function scope
   */
  isValidHookLocation(scope: ScopeInfo): boolean {
    // Module scope is never valid for hooks
    if (scope.type === ScopeType.Module) {
      return false;
    }

    // Block, loop, and conditional scopes are invalid
    if (
      scope.type === ScopeType.Block ||
      scope.type === ScopeType.Loop ||
      scope.type === ScopeType.Conditional
    ) {
      return false;
    }

    // Component scope at top level is valid
    if (scope.type === ScopeType.Component) {
      return this.isTopLevelOfComponent(scope);
    }

    // Function scope is the only remaining type - valid only if it's a custom hook
    return this.isCustomHookScope(scope);
  }

  /**
   * Find the nearest valid hook location from a given scope
   */
  findNearestValidHookScope(scope: ScopeInfo): ScopeInfo | null {
    let current: ScopeInfo | null = scope;

    while (current !== null) {
      if (this.isValidHookLocation(current)) {
        return current;
      }
      current = current.parent;
    }

    return null;
  }

  /**
   * Validate that a hook can be hoisted to the target scope
   *
   * @param targetScope - The scope to hoist the hook to
   * @param isCrossFile - Whether this is a cross-file hoist
   * @returns Result with void on success, error on failure
   */
  validateHookHoist(
    targetScope: ScopeInfo,
    isCrossFile: boolean
  ): Result<void, RegraffError> {
    // Check if target scope is conditional or in a loop
    if (this.isConditionalOrLoop(targetScope)) {
      return err(
        createValidationError({
          code: "HOOK_VALIDATION_FAILED",
          message: "Cannot hoist hook to conditional or loop scope (Rules of Hooks)",
          constraint: "Rules of Hooks",
          details: `Target scope type is ${targetScope.type}`,
        })
      );
    }

    // Find valid hook location
    const validScope = this.findNearestValidHookScope(targetScope);

    if (!validScope) {
      return err(
        createValidationError({
          code: "HOOK_VALIDATION_FAILED",
          message: "No valid hook location found in target scope chain",
          constraint: "Rules of Hooks",
          details: "Unable to find a component or custom hook scope",
        })
      );
    }

    // Cross-file hoisting to non-ancestor components is not allowed
    if (isCrossFile && validScope.type === ScopeType.Component) {
      return err(
        createValidationError({
          code: "HOOK_VALIDATION_FAILED",
          message: "Cannot hoist hook results across files to non-ancestor components",
          constraint: "Cross-file hook hoisting",
          details: "Hooks can only be hoisted across files to ancestor components",
        })
      );
    }

    return ok(undefined);
  }

  /**
   * Check if a scope is at the top level of its containing component
   */
  private isTopLevelOfComponent(scope: ScopeInfo): boolean {
    // The scope should not have any intermediate scopes between it and
    // its parent component scope
    if (scope.type !== ScopeType.Component) {
      return false;
    }

    // Check that there are no block/conditional/loop scopes as ancestors
    // before reaching another component or module
    let parent = scope.parent;
    while (parent !== null) {
      if (
        parent.type === ScopeType.Block ||
        parent.type === ScopeType.Loop ||
        parent.type === ScopeType.Conditional
      ) {
        return false;
      }
      if (
        parent.type === ScopeType.Component ||
        parent.type === ScopeType.Module
      ) {
        break;
      }
      parent = parent.parent;
    }

    return true;
  }

  /**
   * Check if a scope is a custom hook (function named use*)
   */
  private isCustomHookScope(scope: ScopeInfo): boolean {
    // Get the function name from the scope
    const path = scope.path;

    // Check various function types
    const node = path.node;
    let functionName: string | undefined;

    // Function declaration
    if (
      node.type === "FunctionDeclaration" &&
      node.id !== undefined &&
      node.id !== null
    ) {
      functionName = node.id.name;
    }
    // Arrow function or function expression assigned to variable
    else if (
      (node.type === "ArrowFunctionExpression" ||
        node.type === "FunctionExpression") &&
      path.parentPath?.isVariableDeclarator() === true
    ) {
      const id = path.parentPath.node.id;
      if (id.type === "Identifier") {
        functionName = id.name;
      }
    }

    if (functionName !== undefined) {
      return isHookName(functionName);
    }

    return false;
  }

  /**
   * Check if scope is conditional or loop
   */
  private isConditionalOrLoop(scope: ScopeInfo): boolean {
    return (
      scope.type === ScopeType.Conditional || scope.type === ScopeType.Loop
    );
  }
}

/**
 * Create a new HookLocationValidator instance
 */
export function createHookLocationValidator(): HookLocationValidator {
  return new HookLocationValidator();
}
