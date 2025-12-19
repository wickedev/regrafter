/**
 * Extract Feature Type Definitions
 *
 * Task 1.2: Core data model type definition
 * Defines all core data models for the extract feature
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import type { Code } from '../types/public.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Options
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract function options
 */
export interface ExtractOptions {
  /** Component name to extract (auto-generated if not provided) */
  componentName?: string;

  /** Target file path (extract to same file if not provided) */
  targetFile?: string;

  /** Enable TypeScript type generation (default: true) */
  generateTypes?: boolean;

  /** Preserve comments (default: true) */
  preserveComments?: boolean;

  /** Code formatting options */
  formatting?: FormattingOptions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Range Selector
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Range selector (select multiple nodes)
 */
export interface RangeSelector {
  /** File path */
  file: string;

  /** Start position */
  start: {
    line: number;
    column: number;
  };

  /** End position */
  end: {
    line: number;
    column: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Result
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract result
 */
export interface ExtractResult {
  /** Transformed files */
  codes: Code[];

  /** Generated component information */
  component: ComponentInfo;

  /** Extract statistics */
  stats: ExtractStats;
}

/**
 * Extract analysis result (analysis only without transformation)
 *
 * Task 21.3: analyzeExtract() function test
 */
export interface ExtractAnalysis {
  /** Number of selected JSX nodes */
  selectedNodesCount: number;

  /** Identified dependency information */
  dependencies: {
    /** List of variable dependencies */
    variables: string[];

    /** List of function dependencies */
    functions: string[];

    /** List of state dependencies */
    states: Array<{ stateName: string; setterName: string }>;

    /** List of Hook dependencies */
    hooks: string[];

    /** List of Import dependencies */
    imports: Array<{ name: string; source: string }>;
  };

  /** Props type information */
  propTypes: Array<{
    name: string;
    type: string;
    optional: boolean;
  }>;

  /** Component name to be generated */
  componentName: string;

  /** Target file path */
  targetFile: string;

  /** Whether extracting within same file */
  isSameFile: boolean;
}

/**
 * Generated component information
 */
export interface ComponentInfo {
  /** Component name */
  name: string;

  /** File where component is located */
  file: string;

  /** Props interface name */
  propsInterface?: string;

  /** List of Props */
  props: PropInfo[];
}

/**
 * Prop information
 */
export interface PropInfo {
  /** Prop name */
  name: string;

  /** Prop type */
  type: string;

  /** Whether optional */
  optional: boolean;
}

/**
 * Extract statistics
 */
export interface ExtractStats {
  /** Number of extracted JSX nodes */
  nodesExtracted: number;

  /** Number of identified dependencies */
  dependenciesFound: number;

  /** Number of generated Props */
  propsGenerated: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Plan
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract plan
 */
export interface ExtractPlan {
  /** Selected JSX nodes */
  selectedNodes: NodePath[];

  /** Source file */
  sourceFile: string;

  /** Target file */
  targetFile: string;

  /** Component name to create */
  componentName: string;

  /** Props interface name */
  propsInterfaceName: string;

  /** Dependency information */
  dependencies: ExtractDependencies;

  /** Props type information */
  propTypes: PropType[];

  /** Hook declarations to move */
  hooksToMove: HookDeclaration[];

  /** Whether extracting within same file */
  isSameFile: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Dependencies
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract dependency information
 */
export interface ExtractDependencies {
  /** Variables to pass as Props */
  variables: VariableDependency[];

  /** Functions to pass as Props */
  functions: FunctionDependency[];

  /** States to pass as Props */
  states: StateDependency[];

  /** Hooks to move to new component */
  hooks: HookDependency[];

  /** Required Imports */
  imports: ImportDependency[];
}

/**
 * Variable dependency
 */
export interface VariableDependency {
  /** Variable name */
  name: string;

  /** Variable type (TypeScript) */
  type?: t.TSType;

  /** Variable declaration node */
  declaration: NodePath;
}

/**
 * Function dependency
 */
export interface FunctionDependency {
  /** Function name */
  name: string;

  /** Function type (TypeScript) */
  type?: t.TSType;

  /** Function declaration node */
  declaration: NodePath;
}

/**
 * State dependency
 */
export interface StateDependency {
  /** State variable name */
  stateName: string;

  /** Setter function name */
  setterName: string;

  /** State type (TypeScript) */
  type?: t.TSType;

  /** useState call node */
  declaration: NodePath;
}

/**
 * Hook dependency
 */
export interface HookDependency {
  /** Hook name */
  name: string;

  /** Hook call node */
  callNode: NodePath;

  /** List of external dependencies */
  externalDeps: string[];
}

/**
 * Import dependency
 */
export interface ImportDependency {
  /** Import name */
  name: string;

  /** Import source path */
  source: string;

  /** Whether default import */
  isDefault: boolean;
}

/**
 * Prop type information
 */
export interface PropType {
  /** Prop name */
  name: string;

  /** TypeScript type AST */
  typeAnnotation: t.TSType;

  /** Whether optional */
  optional: boolean;
}

/**
 * Hook declaration information
 */
export interface HookDeclaration {
  /** Hook name */
  hookName: string;

  /** Hook call expression */
  callExpression: t.CallExpression;

  /** Variable declarator (const [x, setX] = ...) */
  declarator?: t.VariableDeclarator;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Formatting Options
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Formatting options
 */
export interface FormattingOptions {
  /** Indentation size */
  indentSize?: number;

  /** Whether to use tabs */
  useTabs?: boolean;

  /** Quote style */
  quotes?: 'single' | 'double';

  /** Whether to use semicolons */
  semi?: boolean;
}
