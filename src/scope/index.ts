/**
 * Scope Module
 *
 * Exports scope tracking and analysis components.
 */

export { ScopeManager, createScopeManager } from './scope-manager.js';
export {
  ScopeType,
  type ScopeInfo,
  type ComponentScope,
  type AccessibilityResult,
  type LCAResult,
  type BindingInfo,
  type ComponentInfo,
  type HookInfo,
  type ScopeTree,
} from './types.js';

// Scope helper utilities
export {
  getScopeWithFallback,
  getEnclosingComponentOrNull,
  buildScopePath,
  findCommonAncestor,
  isAncestorOf,
  findNearestAncestor,
  computeScopeDistance,
} from './scope-helpers.js';
