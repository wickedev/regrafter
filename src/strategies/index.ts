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
  IImportManager,
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

// HoistPlanner - Main planning orchestrator
export { HoistPlanner, createHoistPlanner } from './HoistPlanner.js';

// HookHoister - React hooks hoisting strategy
export { HookHoister, createHookHoister } from './HookHoister.js';

// VariableHoister - Variable/expression hoisting strategy
export { VariableHoister, createVariableHoister } from './VariableHoister.js';

// PropThreader - Prop threading through component tree
export {
  PropThreader,
  createPropThreader,
  hasCommonAncestor,
  findLowestCommonAncestor,
  getComponentDepth,
} from './PropThreader.js';

// ImportManager - Import statement management
export {
  ImportManager,
  createImportManager,
  isRelativeImport,
  isNodeModule,
  sortImports,
  removeUnusedImports,
} from './ImportManager.js';

// ContextHandler - React Context handling
export {
  ContextHandler,
  createContextHandler,
  isCreateContextCall,
  isContextProvider,
  isContextConsumer,
  findContextDefinitions,
  findProviderInstances,
} from './ContextHandler.js';

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
} from './SuspenseHandler.js';

// ===============================================================================
// Strategy Factory
// ===============================================================================

import { HoistPlanner } from './HoistPlanner.js';
import { HookHoister } from './HookHoister.js';
import { VariableHoister } from './VariableHoister.js';
import { PropThreader } from './PropThreader.js';
import { ImportManager } from './ImportManager.js';
import { ContextHandler } from './ContextHandler.js';
import { SuspenseHandler } from './SuspenseHandler.js';

import type { IHoistStrategy } from './types.js';

/**
 * Strategy registry for dependency hoisting
 */
export interface StrategyRegistry {
  hookHoister: HookHoister;
  variableHoister: VariableHoister;
  propThreader: PropThreader;
  importManager: ImportManager;
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
    importManager: new ImportManager(),
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
 * Create a fully configured HoistPlanner with all strategies
 */
export function createConfiguredHoistPlanner(): HoistPlanner {
  // HoistPlanner has all strategies built-in, no registration needed
  return new HoistPlanner();
}
