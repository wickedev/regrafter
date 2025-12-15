/**
 * Scope Types
 *
 * Type definitions for scope tracking and analysis.
 */

import type { NodePath, Binding } from '@babel/traverse';
import type * as t from '@babel/types';

import { ScopeType, type ScopeInfo, type ComponentScope } from '../types/internal.js';

/**
 * Re-export scope types from internal
 */
export { ScopeType, type ScopeInfo, type ComponentScope };

/**
 * Result of scope accessibility check
 */
export interface AccessibilityResult {
  /** Whether the target scope is accessible from the source scope */
  accessible: boolean;
  /** List of scopes in the path from source to target */
  scopePath: ScopeInfo[];
  /** The lowest common ancestor scope, if any */
  lca: ScopeInfo | null;
  /** Reason if not accessible */
  reason?: string;
}

/**
 * Result of LCA (Lowest Common Ancestor) computation
 */
export interface LCAResult {
  /** The lowest common ancestor scope */
  lca: ScopeInfo | null;
  /** Distance from first scope to LCA */
  distanceA: number;
  /** Distance from second scope to LCA */
  distanceB: number;
  /** Path from first scope to LCA */
  pathA: ScopeInfo[];
  /** Path from second scope to LCA */
  pathB: ScopeInfo[];
}

/**
 * Binding information for scope analysis
 */
export interface BindingInfo {
  /** The binding object from Babel */
  binding: Binding;
  /** The scope where this binding is defined */
  scope: ScopeInfo;
  /** Whether this is a hook binding */
  isHook: boolean;
  /** Whether this binding is used in JSX */
  usedInJSX: boolean;
  /** All references to this binding */
  references: NodePath[];
}

/**
 * Component detection result
 */
export interface ComponentInfo {
  /** Name of the component */
  name: string;
  /** Type of component (function, arrow, class) */
  type: 'function' | 'arrow' | 'class';
  /** NodePath to the component */
  path: NodePath;
  /** Whether this is a React component (returns JSX) */
  isReactComponent: boolean;
  /** Props parameter if available */
  propsParam?: t.Identifier | t.ObjectPattern;
  /** Hooks used in this component */
  hooks: HookInfo[];
}

/**
 * Hook usage information
 */
export interface HookInfo {
  /** Name of the hook */
  name: string;
  /** NodePath to the hook call */
  path: NodePath;
  /** Return bindings from the hook */
  returnBindings: string[];
  /** Dependencies passed to the hook (for useEffect, useMemo, etc.) */
  dependencies?: string[];
}

/**
 * Scope tree representation
 */
export interface ScopeTree {
  /** Root scope (module scope) */
  root: ScopeInfo;
  /** Map from scope ID to scope info */
  scopes: Map<string, ScopeInfo>;
  /** Map from AST node to scope info */
  nodeToScope: WeakMap<t.Node, ScopeInfo>;
  /** Map from binding name to binding info within each scope */
  bindingsByScope: Map<string, Map<string, BindingInfo>>;
}
