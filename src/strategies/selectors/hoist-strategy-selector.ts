/**
 * HoistStrategySelector - Selects appropriate hoisting strategies
 *
 * This class is responsible for determining which hoisting strategy
 * to use for each dependency type based on purity, cross-file status,
 * and other contextual factors.
 */

import type {
  InternalDependency,
  ScopeInfo,
} from "../../types/internal.js";
import { HoistStrategy } from "../../types/internal.js";
import { DependencyType } from "../../types/public.js";
import type { IHookLocationValidator } from "../validators/hook-location-validator.js";

/**
 * Context for strategy selection
 */
export interface StrategyContext {
  sourceScope: ScopeInfo;
  targetScope: ScopeInfo;
  isCrossFile: boolean;
  needsBackwardReference: boolean;
}

/**
 * Result of strategy selection
 */
export interface StrategySelection {
  strategy: HoistStrategy | null;
  targetScope?: ScopeInfo;
  needsPropThreading: boolean;
  reason?: string;
}

/**
 * Interface for strategy selection
 */
export interface IHoistStrategySelector {
  /**
   * Select appropriate hoisting strategy for a dependency
   */
  selectStrategy(
    dep: InternalDependency,
    context: StrategyContext
  ): StrategySelection;

  /**
   * Determine the target scope for hoisting
   */
  determineTargetScope(
    dep: InternalDependency,
    targetScope: ScopeInfo,
    isCrossFile: boolean
  ): ScopeInfo | null;
}

/**
 * Selects hoisting strategies based on dependency type and context
 */
export class HoistStrategySelector implements IHoistStrategySelector {
  constructor(private readonly hookValidator: IHookLocationValidator) {}

  /**
   * Select appropriate hoisting strategy for a dependency
   */
  selectStrategy(
    dep: InternalDependency,
    context: StrategyContext
  ): StrategySelection {
    switch (dep.type) {
      case DependencyType.Hook:
        return this.selectHookStrategy(dep, context);

      case DependencyType.Variable:
        return this.selectVariableStrategy(dep, context);

      case DependencyType.Context:
        return this.selectContextStrategy(dep, context);

      case DependencyType.Ref:
        return this.selectRefStrategy(dep, context);

      case DependencyType.Prop:
        return this.selectPropStrategy(dep, context);

      case DependencyType.Import:
        return {
          strategy: null,
          needsPropThreading: false,
          reason: "Import dependencies are handled separately",
        };

      default:
        return {
          strategy: null,
          needsPropThreading: false,
          reason: `Unknown dependency type: ${String(dep.type)}`,
        };
    }
  }

  /**
   * Determine the target scope for hoisting a dependency
   */
  determineTargetScope(
    dep: InternalDependency,
    targetScope: ScopeInfo,
    _isCrossFile: boolean
  ): ScopeInfo | null {
    // Hooks and refs need special handling for Rules of Hooks
    if (dep.type === DependencyType.Hook || dep.type === DependencyType.Ref) {
      return this.hookValidator.findNearestValidHookScope(targetScope);
    }

    // For variables and other dependencies in a move operation,
    // hoist to the target scope directly (where the JSX is being moved)
    // rather than computing LCA. This ensures dependencies follow the moved element.
    return targetScope;
  }

  /**
   * Select strategy for hook dependencies
   */
  private selectHookStrategy(
    dep: InternalDependency,
    context: StrategyContext
  ): StrategySelection {
    // Validate hook hoisting
    const validation = this.hookValidator.validateHookHoist(
      context.targetScope,
      context.isCrossFile
    );

    if (!validation.ok) {
      return {
        strategy: null,
        needsPropThreading: false,
        reason: validation.error.message,
      };
    }

    // If backward reference needed, use prop threading
    if (context.needsBackwardReference && dep.consumers.length > 0) {
      return {
        strategy: HoistStrategy.PassAsProp,
        needsPropThreading: true,
      };
    }

    return {
      strategy: HoistStrategy.Hoist,
      needsPropThreading: false,
    };
  }

  /**
   * Select strategy for variable dependencies
   */
  private selectVariableStrategy(
    dep: InternalDependency,
    _context: StrategyContext
  ): StrategySelection {
    const isPure = this.isVariablePure(dep);

    if (isPure) {
      return {
        strategy: HoistStrategy.Hoist,
        needsPropThreading: false,
      };
    } else {
      return {
        strategy: HoistStrategy.PassAsProp,
        needsPropThreading: true,
      };
    }
  }

  /**
   * Select strategy for context dependencies
   */
  private selectContextStrategy(
    _dep: InternalDependency,
    _context: StrategyContext
  ): StrategySelection {
    return {
      strategy: HoistStrategy.ExtractContext,
      needsPropThreading: true,
    };
  }

  /**
   * Select strategy for ref dependencies
   */
  private selectRefStrategy(
    _dep: InternalDependency,
    _context: StrategyContext
  ): StrategySelection {
    return {
      strategy: HoistStrategy.Hoist,
      needsPropThreading: false,
    };
  }

  /**
   * Select strategy for prop dependencies
   */
  private selectPropStrategy(
    _dep: InternalDependency,
    _context: StrategyContext
  ): StrategySelection {
    return {
      strategy: HoistStrategy.PassAsProp,
      needsPropThreading: true,
    };
  }

  /**
   * Check if a variable is pure (no side effects)
   */
  private isVariablePure(dep: InternalDependency): boolean {
    const node = dep.origin.node;

    if (node === null) {
      return false;
    }

    if (node.type === "VariableDeclarator") {
      const init = node.init;
      if (init === undefined || init === null) {
        return true;
      }

      // Literals are pure
      if (
        init.type === "StringLiteral" ||
        init.type === "NumericLiteral" ||
        init.type === "BooleanLiteral" ||
        init.type === "NullLiteral"
      ) {
        return true;
      }

      // Template literals without expressions are pure
      if (init.type === "TemplateLiteral" && init.expressions.length === 0) {
        return true;
      }

      // Object/Array literals are pure (simplified)
      if (init.type === "ObjectExpression" || init.type === "ArrayExpression") {
        return true;
      }

      // Function expressions are pure
      if (
        init.type === "FunctionExpression" ||
        init.type === "ArrowFunctionExpression"
      ) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Create a new HoistStrategySelector instance
 */
export function createHoistStrategySelector(
  hookValidator: IHookLocationValidator
): HoistStrategySelector {
  return new HoistStrategySelector(hookValidator);
}
