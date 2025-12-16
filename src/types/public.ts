/**
 * Regrafter Public API Types
 *
 * This module contains all public-facing type definitions for the Regrafter library.
 * These types are part of the stable API and should maintain backward compatibility.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Move Mode Enum
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Specifies how the source element should be positioned relative to the target.
 *
 * @example
 * ```typescript
 * // Move element as a child of target
 * regraft(files, from, to, Move.Inside);
 *
 * // Move element before target (as previous sibling)
 * regraft(files, from, to, Move.Before);
 *
 * // Move element after target (as next sibling)
 * regraft(files, from, to, Move.After);
 * ```
 */
export enum Move {
  /** Insert source element as a child of the target element */
  Inside = 'inside',
  /** Insert source element as the previous sibling of the target element */
  Before = 'before',
  /** Insert source element as the next sibling of the target element */
  After = 'after',
}

// ═══════════════════════════════════════════════════════════════════════════════
// Selector Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Position-based selector using file path and line/column coordinates.
 * Useful for IDE integrations where cursor position is available.
 *
 * @example
 * ```typescript
 * const selector: PositionSelector = {
 *   file: 'src/components/App.tsx',
 *   line: 15,
 *   column: 8
 * };
 * ```
 */
export interface PositionSelector {
  /** Path to the source file */
  file: string;
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
}

/**
 * AST path-based selector for programmatic access.
 * Uses dot notation to traverse the AST structure.
 *
 * @example
 * ```typescript
 * const selector: PathSelector = {
 *   file: 'src/components/App.tsx',
 *   path: 'Program.body[0].declaration.body.body[2]'
 * };
 * ```
 */
export interface PathSelector {
  /** Path to the source file */
  file: string;
  /** AST path using dot notation (e.g., "Program.body[0].declaration") */
  path: string;
}

/**
 * Union type for element selection.
 * Either position-based (line/column) or path-based (AST path).
 */
export type Selector = PositionSelector | PathSelector;

// ═══════════════════════════════════════════════════════════════════════════════
// Options Interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration options for the regraft operation.
 * All fields are optional with sensible defaults.
 */
export interface Options {
  /**
   * Whether to run sinking optimization after the move.
   * When true, over-hoisted dependencies are moved to optimal locations.
   * @default true
   */
  optimize?: boolean;

  /**
   * When true, performs analysis only without executing transformations.
   * Useful for previewing changes before applying them.
   * @default false
   */
  dryRun?: boolean;

  /**
   * Whether to preserve comments in the transformed code.
   * @default true
   */
  preserveComments?: boolean;

  /**
   * Whether to format the output code using Prettier.
   * When false, original formatting is preserved as much as possible.
   * @default false
   */
  formatOutput?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Classification of dependency types for analysis and hoisting strategy selection.
 */
export enum DependencyType {
  /** React hooks (useState, useEffect, useContext, custom hooks, etc.) */
  Hook = 'Hook',
  /** Local variable declarations (const, let, var) */
  Variable = 'Variable',
  /** External module imports */
  Import = 'Import',
  /** Component props passed from parent */
  Prop = 'Prop',
  /** React context values accessed via useContext */
  Context = 'Context',
  /** React refs created via useRef */
  Ref = 'Ref',
}

/**
 * Strategy used to resolve a dependency when moving an element.
 */
export enum ResolutionStrategy {
  /** Hoist the dependency declaration to a common ancestor scope */
  Hoist = 'hoist',
  /** Thread the value through component props */
  PropThread = 'prop_thread',
  /** Add import statement to target file */
  Import = 'import',
  /** Create a shared module for cross-file dependencies */
  SharedModule = 'shared_module',
  /** Hoist the Context.Provider to a common ancestor */
  ProviderHoist = 'provider_hoist',
  /** Extract context value and pass as props */
  ContextToProps = 'context_to_props',
}

/**
 * Represents a dependency of a JSX element that may need resolution when moving.
 */
export interface Dependency {
  /** Symbol/identifier name */
  symbol: string;
  /** Type classification of the dependency */
  type: DependencyType;
  /** File path where the dependency originates */
  origin: string;
  /** Name of the scope (component/function) where dependency is defined */
  scope: string;
  /** Whether this is a transitive dependency (dependency of a dependency) */
  isTransitive: boolean;
  /** Resolution strategy if hoisting is needed */
  resolution?: ResolutionStrategy;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suggested Fix Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A suggested fix or action when a move operation encounters issues.
 */
export interface SuggestedFix {
  /** Human-readable description of the fix */
  description: string;
  /** Technical action to take (e.g., "hoist_hook", "add_suspense") */
  action: string;
  /** Whether this fix can be applied automatically */
  automatic: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Analysis Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Statistics about the dependency analysis.
 */
export interface AnalysisStats {
  /** Total number of dependencies found */
  totalDependencies: number;
  /** Number of Hook dependencies */
  hookDependencies: number;
  /** Number of Variable dependencies */
  variableDependencies: number;
  /** Number of Import dependencies */
  importDependencies: number;
  /** Number of Prop dependencies */
  propDependencies: number;
  /** Number of transitive (indirect) dependencies */
  transitiveDependencies: number;
}

/**
 * Complete analysis of a proposed move operation.
 */
export interface MoveAnalysis {
  /** Whether the move operation is possible */
  canMove: boolean;
  /** Explanation if move is not possible */
  reason?: string;
  /** All dependencies identified for the source element */
  dependencies: Dependency[];
  /** Dependencies that will be hoisted during the move */
  hoistedDeps: Dependency[];
  /** Dependencies that were sunk after optimization (if optimize: true) */
  sunkDeps?: Dependency[];
  /** Suggested fixes if there are issues */
  suggestedFixes?: SuggestedFix[];
  /** Statistics about the analysis */
  stats?: AnalysisStats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Result Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Represents a single file's code after transformation.
 */
export interface Code {
  /** Path to the file */
  file: string;
  /** Content of the file after transformation */
  content: string;
  /** Whether this file was modified */
  changed: boolean;
  /** True if this is a newly created file (e.g., shared module) */
  isNew?: boolean;
  /** Original content before transformation (if changed) */
  original?: string;
}

/**
 * Result of a regraft operation.
 */
export interface Result {
  /** Whether the operation completed successfully */
  success: boolean;
  /** Array of file contents (all input files + any new files) */
  codes: Code[];
  /** Detailed analysis of the move operation */
  analysis: MoveAnalysis;
}

// ═══════════════════════════════════════════════════════════════════════════════
// File Input Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input file representation with path and content.
 */
export interface FileInput {
  /** Path to the file */
  path: string;
  /** Content of the file */
  content: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Type Guards
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type guard to check if a selector is position-based.
 */
export function isPositionSelector(
  selector: Selector
): selector is PositionSelector {
  return (
    'line' in selector &&
    'column' in selector &&
    typeof selector.line === 'number' &&
    typeof selector.column === 'number'
  );
}

/**
 * Type guard to check if a selector is path-based.
 */
export function isPathSelector(selector: Selector): selector is PathSelector {
  return 'path' in selector && typeof selector.path === 'string';
}

/**
 * Type guard to check if a value is a valid Move enum value.
 */
export function isValidMove(value: unknown): value is Move {
  if (typeof value !== 'string') {
    return false;
  }
  const moveValues: string[] = Object.values(Move);
  return moveValues.includes(value);
}

/**
 * Type guard to check if a value is a valid DependencyType enum value.
 */
export function isValidDependencyType(value: unknown): value is DependencyType {
  if (typeof value !== 'string') {
    return false;
  }
  const dependencyTypeValues: string[] = Object.values(DependencyType);
  return dependencyTypeValues.includes(value);
}

/**
 * Type guard to check if an object is a valid Selector.
 */
export function isValidSelector(value: unknown): value is Selector {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('file' in value)) {
    return false;
  }

  const obj: { file: unknown } = value;

  // Validate file path is non-empty string
  if (typeof obj.file !== 'string' || obj.file.length === 0) {
    return false;
  }

  // Check if it looks like a PositionSelector
  if ('line' in value && 'column' in value) {
    const posObj: { line: unknown; column: unknown } = value;

    // Line must be positive integer
    if (typeof posObj.line !== 'number' || posObj.line < 1 || !Number.isInteger(posObj.line)) {
      return false;
    }
    // Column must be non-negative integer
    if (typeof posObj.column !== 'number' || posObj.column < 0 || !Number.isInteger(posObj.column)) {
      return false;
    }
    return true;
  }

  // Check if it looks like a PathSelector
  if ('path' in value) {
    const pathObj: { path: unknown } = value;

    // Path must be non-empty string
    if (typeof pathObj.path !== 'string' || pathObj.path.length === 0) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Type guard to check if an object is a valid Options object.
 */
export function isValidOptions(value: unknown): value is Options {
  if (typeof value !== 'object' || value === null) {
    return true; // Empty options is valid
  }

  const obj: Record<string, unknown> = value;

  if (obj.optimize !== undefined && typeof obj.optimize !== 'boolean') {
    return false;
  }
  if (obj.dryRun !== undefined && typeof obj.dryRun !== 'boolean') {
    return false;
  }
  if (
    obj.preserveComments !== undefined &&
    typeof obj.preserveComments !== 'boolean'
  ) {
    return false;
  }
  if (obj.formatOutput !== undefined && typeof obj.formatOutput !== 'boolean') {
    return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Values
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default options for regraft operations.
 */
export const DEFAULT_OPTIONS: Required<Options> = {
  optimize: true,
  dryRun: false,
  preserveComments: true,
  formatOutput: false,
};

/**
 * Merges user options with defaults.
 */
export function mergeOptions(options?: Options): Required<Options> {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}
