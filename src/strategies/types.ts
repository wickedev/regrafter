/**
 * Strategy Types for Dependency Hoisting
 *
 * This module defines the interfaces and types used by the hoisting strategies.
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import type {
  ComponentScope,
  HoistOperation,
  ImportOperation,
  InternalDependency,
  PropThreadOperation,
  ScopeInfo,
} from '../types/internal.js';

// ===============================================================================
// React Hook Constants
// ===============================================================================

/**
 * Built-in React hooks
 */
export const REACT_HOOKS = new Set([
  // State hooks
  'useState',
  'useReducer',

  // Effect hooks
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',

  // Context hooks
  'useContext',

  // Ref hooks
  'useRef',
  'useImperativeHandle',

  // Performance hooks
  'useCallback',
  'useMemo',

  // Other hooks
  'useDebugValue',
  'useDeferredValue',
  'useTransition',
  'useId',
  'useSyncExternalStore',
  'useActionState',
  'useFormStatus',
  'useOptimistic',
  'use',
]);

/**
 * Pattern for detecting custom hooks (useXxx)
 */
export const CUSTOM_HOOK_PATTERN = /^use[A-Z]/;

/**
 * Check if a name is a React hook (built-in or custom)
 */
export function isHookName(name: string): boolean {
  return REACT_HOOKS.has(name) || CUSTOM_HOOK_PATTERN.test(name);
}

// ===============================================================================
// Hoisting Context
// ===============================================================================

/**
 * Context information for hoisting operations
 */
export interface HoistContext {
  /** Source file path */
  sourceFile: string;
  /** Target file path */
  targetFile: string;
  /** Source scope where the element currently resides */
  sourceScope: ScopeInfo;
  /** Target scope where the element will be moved to */
  targetScope: ScopeInfo;
  /** Source component scope (if applicable) */
  sourceComponent: ComponentScope | null;
  /** Target component scope (if applicable) */
  targetComponent: ComponentScope | null;
  /** Whether this is a cross-file move */
  isCrossFile: boolean;
  /** Map of file paths to their ASTs */
  asts: Map<string, t.File>;
}

/**
 * Result of hoist planning for a single dependency
 */
export interface HoistPlanItem {
  /** The dependency being hoisted */
  dependency: InternalDependency;
  /** The hoisting operation to perform */
  operation: HoistOperation;
  /** Additional prop threading if needed */
  propThread?: PropThreadOperation;
  /** Additional import if needed */
  importOp?: ImportOperation;
  /** Whether the original scope still needs access */
  needsBackwardReference: boolean;
  /** Reason if hoisting is not possible */
  reason?: string;
}

/**
 * Complete hoist plan for all dependencies
 */
export interface HoistPlan {
  /** All hoist operations */
  hoistOperations: HoistOperation[];
  /** Prop threading operations */
  propThreadOperations: PropThreadOperation[];
  /** Import operations */
  importOperations: ImportOperation[];
  /** Dependencies that could not be hoisted */
  unhoistable: Array<{ dependency: InternalDependency; reason: string }>;
  /** Validation messages */
  warnings: string[];
  /** Whether the plan is valid (all critical deps can be resolved) */
  valid: boolean;
  /** Reason if plan is invalid */
  invalidReason?: string;
}

// ===============================================================================
// Strategy Interfaces
// ===============================================================================

/**
 * Interface for all hoisting strategies
 */
export interface IHoistStrategy {
  /**
   * Check if this strategy can handle the given dependency type
   */
  canHandle(dependency: InternalDependency): boolean;

  /**
   * Plan the hoisting operation for a dependency
   */
  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null;

  /**
   * Execute the hoisting operation
   */
  execute(
    operation: HoistOperation,
    context: HoistContext
  ): void;
}

/**
 * Interface for the Hook Hoister strategy
 */
export interface IHookHoister extends IHoistStrategy {
  /**
   * Check if a scope is a valid location for React hooks
   */
  isValidHookLocation(scope: ScopeInfo): boolean;

  /**
   * Find the nearest valid hook location from a given scope
   */
  findNearestValidHookScope(scope: ScopeInfo): ScopeInfo | null;
}

/**
 * Interface for the Variable Hoister strategy
 */
export interface IVariableHoister extends IHoistStrategy {
  /**
   * Determine if a variable is pure (no side effects)
   */
  isPure(dependency: InternalDependency): boolean;
}

/**
 * Interface for the Prop Threader strategy
 */
export interface IPropThreader {
  /**
   * Calculate the component path from source to target
   */
  calculateComponentPath(
    sourceComponent: ComponentScope,
    targetComponent: ComponentScope
  ): ComponentScope[];

  /**
   * Create prop threading operations for a dependency
   */
  createPropThread(
    dependency: InternalDependency,
    componentPath: ComponentScope[],
    propName?: string
  ): PropThreadOperation[];

  /**
   * Resolve prop name conflicts
   */
  resolveNameConflict(
    propName: string,
    existingProps: Set<string>
  ): string;
}

/**
 * Interface for the Import Manager strategy
 */
export interface IImportManager {
  /**
   * Check if an import already exists in the target file
   */
  hasImport(
    ast: t.File,
    source: string,
    specifier: string
  ): boolean;

  /**
   * Create an import operation for a dependency
   */
  createImportOperation(
    dependency: InternalDependency,
    targetFile: string
  ): ImportOperation | null;

  /**
   * Merge duplicate import operations
   */
  mergeImports(operations: ImportOperation[]): ImportOperation[];
}

/**
 * Interface for the Context Handler strategy
 */
export interface IContextHandler {
  /**
   * Find the Context.Provider for a context dependency
   */
  findProvider(
    dependency: InternalDependency,
    context: HoistContext
  ): NodePath | null;

  /**
   * Check if the target scope is within the provider's scope
   */
  isWithinProvider(
    targetScope: ScopeInfo,
    providerPath: NodePath
  ): boolean;

  /**
   * Create a context-to-props extraction plan
   */
  createContextToPropsExtraction(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null;
}

/**
 * Interface for the Suspense Handler strategy
 */
export interface ISuspenseHandler {
  /**
   * Check if a component is lazy-loaded
   */
  isLazyComponent(path: NodePath): boolean;

  /**
   * Find the parent Suspense boundary
   */
  findSuspenseBoundary(path: NodePath): NodePath | null;

  /**
   * Check if a Suspense boundary is needed at the target
   */
  needsSuspenseBoundary(
    dependency: InternalDependency,
    context: HoistContext
  ): boolean;

  /**
   * Create a Suspense wrapper operation
   */
  createSuspenseWrapper(
    targetPath: NodePath,
    fallback?: t.JSXElement | t.JSXFragment
  ): t.JSXElement;
}

// ===============================================================================
// Utility Types
// ===============================================================================

/**
 * Classification of hook types for different handling
 */
export enum HookCategory {
  /** State hooks: useState, useReducer */
  State = 'state',
  /** Effect hooks: useEffect, useLayoutEffect */
  Effect = 'effect',
  /** Context hook: useContext */
  Context = 'context',
  /** Ref hooks: useRef, useImperativeHandle */
  Ref = 'ref',
  /** Memoization hooks: useCallback, useMemo */
  Memo = 'memo',
  /** Custom hooks */
  Custom = 'custom',
  /** Other built-in hooks */
  Other = 'other',
}

/**
 * Classify a hook by its name
 */
export function classifyHook(hookName: string): HookCategory {
  if (hookName === 'useState' || hookName === 'useReducer') {
    return HookCategory.State;
  }
  if (
    hookName === 'useEffect' ||
    hookName === 'useLayoutEffect' ||
    hookName === 'useInsertionEffect'
  ) {
    return HookCategory.Effect;
  }
  if (hookName === 'useContext') {
    return HookCategory.Context;
  }
  if (hookName === 'useRef' || hookName === 'useImperativeHandle') {
    return HookCategory.Ref;
  }
  if (hookName === 'useCallback' || hookName === 'useMemo') {
    return HookCategory.Memo;
  }
  if (CUSTOM_HOOK_PATTERN.test(hookName)) {
    return HookCategory.Custom;
  }
  return HookCategory.Other;
}

/**
 * Hook return value type (for destructuring patterns)
 */
export interface HookReturnInfo {
  /** Hook name */
  hookName: string;
  /** Category of the hook */
  category: HookCategory;
  /** Names of destructured values (e.g., ['count', 'setCount'] for useState) */
  destructuredNames: string[];
  /** Dependencies array content (for effect/memo hooks) */
  dependencyArray?: string[];
}

/**
 * Variable purity analysis result
 */
export interface PurityAnalysis {
  /** Whether the variable is pure */
  isPure: boolean;
  /** Reason if not pure */
  reason?: string;
  /** Symbols that make it impure */
  impureReferences?: string[];
}
