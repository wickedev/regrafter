/**
 * Dependency Analyzer Types
 *
 * Type definitions for dependency analysis operations.
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import type { ScopeInfo, ComponentScope } from '../scope/types.js';
import {
  type InternalDependency,
  type DependencyAnalysis,
  type UnanalyzableCode,
  type AnalyzabilityResult,
} from '../types/internal.js';
import {
  DependencyType,
  type Dependency,
  type MoveAnalysis,
  type AnalysisStats,
} from '../types/public.js';

/**
 * Re-export types
 */
export {
  DependencyType,
  type Dependency,
  type MoveAnalysis,
  type AnalysisStats,
  type InternalDependency,
  type DependencyAnalysis,
  type UnanalyzableCode,
  type AnalyzabilityResult,
};

/**
 * Identifier reference found in JSX
 */
export interface IdentifierReference {
  /** The identifier name */
  name: string;
  /** NodePath to the identifier */
  path: NodePath;
  /** How the identifier is used */
  usage: 'value' | 'call' | 'jsx-element' | 'jsx-attribute' | 'spread';
  /** The scope where this reference occurs */
  scope: ScopeInfo | null;
}

/**
 * Hook dependency information
 */
export interface HookDependency {
  /** Name of the hook */
  hookName: string;
  /** Bindings created by this hook (e.g., [state, setState]) */
  bindings: string[];
  /** NodePath to the hook call */
  path: NodePath;
  /** Type of the hook dependency */
  type: DependencyType.Hook;
  /** Dependencies of useEffect/useMemo etc. */
  hookDeps?: string[];
}

/**
 * Variable dependency information
 */
export interface VariableDependency {
  /** Name of the variable */
  name: string;
  /** NodePath to the variable declaration */
  path: NodePath;
  /** Type of the variable dependency */
  type: DependencyType.Variable;
  /** Whether this is a constant */
  isConst: boolean;
  /** The initializer expression if any */
  initializer?: t.Expression;
}

/**
 * Import dependency information
 */
export interface ImportDependency {
  /** Local name of the import */
  localName: string;
  /** Imported name (may differ from local) */
  importedName: string;
  /** Source module */
  source: string;
  /** NodePath to the import declaration */
  path: NodePath;
  /** Type of import (default, named, namespace) */
  importType: 'default' | 'named' | 'namespace';
  /** Type of the dependency */
  type: DependencyType.Import;
}

/**
 * Prop dependency information
 */
export interface PropDependency {
  /** Name of the prop */
  name: string;
  /** Component that provides this prop */
  component: string;
  /** NodePath to the prop usage */
  path: NodePath;
  /** Type of the dependency */
  type: DependencyType.Prop;
  /** Whether this prop is destructured */
  isDestructured: boolean;
}

/**
 * Context dependency information
 */
export interface ContextDependency {
  /** Name of the context value binding */
  name: string;
  /** Context name/provider */
  contextName: string;
  /** NodePath to the useContext call */
  path: NodePath;
  /** Type of the dependency */
  type: DependencyType.Context;
}

/**
 * Ref dependency information
 */
export interface RefDependency {
  /** Name of the ref binding */
  name: string;
  /** NodePath to the useRef call */
  path: NodePath;
  /** Type of the dependency */
  type: DependencyType.Ref;
  /** Initial value if any */
  initialValue?: t.Expression;
}

/**
 * Union type for all specific dependency types
 */
export type SpecificDependency =
  | HookDependency
  | VariableDependency
  | ImportDependency
  | PropDependency
  | ContextDependency
  | RefDependency;

/**
 * Result of collecting all identifiers from a JSX element
 */
export interface IdentifierCollectionResult {
  /** All unique identifiers found */
  identifiers: IdentifierReference[];
  /** JSX element names used (component references) */
  jsxElementNames: string[];
  /** Spread expressions found */
  spreads: NodePath[];
  /** Any collection errors */
  errors: string[];
}

/**
 * Options for dependency analysis
 */
export interface AnalyzerOptions {
  /** Whether to track transitive dependencies */
  trackTransitive?: boolean;
  /** Maximum depth for transitive analysis */
  maxTransitiveDepth?: number;
  /** Whether to include import dependencies */
  includeImports?: boolean;
}

/**
 * Default analyzer options
 */
export const DEFAULT_ANALYZER_OPTIONS: Required<AnalyzerOptions> = {
  trackTransitive: true,
  maxTransitiveDepth: 10,
  includeImports: true,
};

/**
 * Merge analyzer options with defaults
 */
export function mergeAnalyzerOptions(
  options?: AnalyzerOptions
): Required<AnalyzerOptions> {
  return {
    ...DEFAULT_ANALYZER_OPTIONS,
    ...options,
  };
}
