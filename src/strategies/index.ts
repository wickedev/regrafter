/**
 * Strategies Module - Dependency Hoisting Strategies
 *
 * This module exports all hoisting strategies used by the transformation pipeline
 * to resolve dependencies when moving React elements across the component tree.
 */

// Type exports
export type {
  HoistContext,
  HoistPlanItem,
  HoistPlan,
  IHoistStrategy,
  IHookHoister,
  IVariableHoister,
  IPropThreader,
  IContextHandler,
  ISuspenseHandler,
  HookReturnInfo,
  PurityAnalysis,
} from './types.js';

export {
  REACT_HOOKS,
  CUSTOM_HOOK_PATTERN,
  isHookName,
  HookCategory,
  classifyHook,
} from './types.js';

// HoistPlanBuilder - Main planning orchestrator
export { HoistPlanBuilder, createHoistPlanBuilder } from './hoist-plan-builder.js';

// Backward compatibility export
export { HoistPlanBuilder as HoistPlanner } from './hoist-plan-builder.js';

// Validators
export { HookLocationValidator, createHookLocationValidator } from './validators/hook-location-validator.js';
export type { IHookLocationValidator } from './validators/hook-location-validator.js';

// Selectors
export { HoistStrategySelector, createHoistStrategySelector } from './selectors/hoist-strategy-selector.js';
export type { IHoistStrategySelector, StrategyContext, StrategySelection } from './selectors/hoist-strategy-selector.js';

// HoistExecutor - Executes hoisting operations on AST
export { HoistExecutor, createHoistExecutor } from './hoist-executor.js';
export type { HoistExecutionContext } from './hoist-executor.js';

// HookHoister - React hooks hoisting strategy
export { HookHoister, createHookHoister } from './hook-hoister.js';

// VariableHoister - Variable/expression hoisting strategy
export { VariableHoister, createVariableHoister } from './variable-hoister.js';

// PropThreader - Prop threading through component tree
export {
  PropThreader,
  createPropThreader,
  hasCommonAncestor,
  findLowestCommonAncestor,
  getComponentDepth,
} from './prop-threader.js';

// ImportManager - Import statement management (re-exported from core)
import { ImportManager as CoreImportManager } from '../core/index.js';
export { ImportManager } from '../core/index.js';

// Utility functions for import management
export {
  isRelativeImport,
  isNodeModule,
  sortImports,
  removeUnusedImports,
} from './import-utils.js';

// Factory function for backward compatibility
export function createImportManager(): CoreImportManager {
  return new CoreImportManager();
}

// ContextHandler - React Context handling
export {
  ContextHandler,
  createContextHandler,
  isCreateContextCall,
  isContextProvider,
  isContextConsumer,
  findContextDefinitions,
  findProviderInstances,
} from './context-handler.js';

// SuspenseHandler - React Suspense boundary handling
export {
  SuspenseHandler,
  createSuspenseHandler,
  isReactLazy,
  isDynamicImport,
  findLazyComponents,
  findSuspenseBoundaries,
  hasParentSuspense,
  createSuspenseElement,
} from './suspense-handler.js';

// ===============================================================================
// Strategy Factory
// ===============================================================================

import { ContextHandler } from './context-handler.js';
import { HoistPlanBuilder } from './hoist-plan-builder.js';
import { HookHoister } from './hook-hoister.js';
import { PropThreader } from './prop-threader.js';
import { HoistStrategySelector } from './selectors/hoist-strategy-selector.js';
import { SuspenseHandler } from './suspense-handler.js';
import type { IHoistStrategy } from './types.js';
import { HookLocationValidator } from './validators/hook-location-validator.js';
import { VariableHoister } from './variable-hoister.js';

/**
 * Strategy registry for dependency hoisting
 */
export interface StrategyRegistry {
  hookHoister: HookHoister;
  variableHoister: VariableHoister;
  propThreader: PropThreader;
  importManager: CoreImportManager;
  contextHandler: ContextHandler;
  suspenseHandler: SuspenseHandler;
}

/**
 * Create all strategies
 */
export function createStrategies(): StrategyRegistry {
  return {
    hookHoister: new HookHoister(),
    variableHoister: new VariableHoister(),
    propThreader: new PropThreader(),
    importManager: new CoreImportManager(),
    contextHandler: new ContextHandler(),
    suspenseHandler: new SuspenseHandler(),
  };
}

/**
 * Get all hoist strategies as an array
 */
export function getAllHoistStrategies(): IHoistStrategy[] {
  return [
    new HookHoister(),
    new VariableHoister(),
    new ContextHandler(),
    new SuspenseHandler(),
  ];
}

/**
 * Create a fully configured HoistPlanBuilder with all dependencies
 */
export function createConfiguredHoistPlanBuilder(): HoistPlanBuilder {
  const hookValidator = new HookLocationValidator();
  const strategySelector = new HoistStrategySelector(hookValidator);
  return new HoistPlanBuilder(hookValidator, strategySelector);
}

/**
 * Create a fully configured HoistPlanner (backward compatibility)
 * @deprecated Use createConfiguredHoistPlanBuilder instead
 */
export function createConfiguredHoistPlanner(): HoistPlanBuilder {
  return createConfiguredHoistPlanBuilder();
}

/**
 * Create a basic HoistPlanner (backward compatibility)
 * @deprecated Use createConfiguredHoistPlanBuilder instead
 */
export function createHoistPlanner(): HoistPlanBuilder {
  return createConfiguredHoistPlanBuilder();
}
