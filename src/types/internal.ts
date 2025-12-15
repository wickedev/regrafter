/**
 * Regrafter Internal Data Structures
 *
 * This module contains internal type definitions used by the transformation engine.
 * These types are not part of the public API and may change between versions.
 */

import type { NodePath, Binding } from '@babel/traverse';
import type * as t from '@babel/types';

import type { DependencyType, Move } from './public.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Scope Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type of scope in the scope tree.
 */
export enum ScopeType {
  /** Module-level scope (file root) */
  Module = 'module',
  /** Regular function scope */
  Function = 'function',
  /** React component scope */
  Component = 'component',
  /** Block scope (if/for/while/etc.) */
  Block = 'block',
  /** Loop scope (for/while/do-while) */
  Loop = 'loop',
  /** Conditional scope (if/ternary) */
  Conditional = 'conditional',
}

/**
 * Information about a scope in the scope tree.
 */
export interface ScopeInfo {
  /** Unique identifier for this scope */
  id: string;
  /** Type of this scope */
  type: ScopeType;
  /** NodePath for the scope's AST node */
  path: NodePath;
  /** Parent scope (null for module scope) */
  parent: ScopeInfo | null;
  /** Bindings defined in this scope */
  bindings: Map<string, Binding>;
  /** Depth in the scope tree (0 for module) */
  depth: number;
}

/**
 * Information about hook usage within a component.
 */
export interface HookUsage {
  /** Name of the hook (e.g., 'useState', 'useEffect') */
  name: string;
  /** NodePath to the hook call */
  path: NodePath;
  /** Identifiers this hook depends on */
  dependencies: string[];
}

/**
 * Extended scope information for React components.
 */
export interface ComponentScope extends ScopeInfo {
  /** Type is always Component */
  type: ScopeType.Component;
  /** Name of the component */
  componentName: string;
  /** Whether this component is conditionally rendered */
  isConditionallyRendered: boolean;
  /** Whether this component is inside a loop */
  isInsideLoop: boolean;
  /** Parent component scope (null if top-level) */
  parentComponent: ComponentScope | null;
  /** Hooks used in this component */
  hooks: HookUsage[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency Graph Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Metadata for a dependency node.
 */
export interface NodeMetadata {
  /** Whether this is a React hook */
  isHook: boolean;
  /** Whether this binding is pure (no side effects) */
  isPure: boolean;
  /** Whether this has side effects */
  hasSideEffects: boolean;
  /** Whether this is exported from its module */
  isExported: boolean;
}

/**
 * A node in the dependency graph.
 */
export interface DependencyNode {
  /** Unique identifier */
  id: string;
  /** Type of node */
  type: 'symbol' | 'element' | 'scope';
  /** Name of the symbol/element */
  name: string;
  /** NodePath in the AST */
  path: NodePath;
  /** Scope where this node is defined */
  scope: ScopeInfo;
  /** Additional metadata */
  metadata: NodeMetadata;
}

/**
 * Graph structure for tracking dependencies between symbols and elements.
 */
export interface DependencyGraph {
  /** All nodes in the graph, keyed by ID */
  nodes: Map<string, DependencyNode>;
  /** Forward edges: from -> Set of to IDs (dependencies) */
  edges: Map<string, Set<string>>;
  /** Reverse edges: to -> Set of from IDs (consumers) */
  reverseEdges: Map<string, Set<string>>;
}

/**
 * Origin information for a dependency.
 */
export interface DependencyOrigin {
  /** AST node where the dependency is defined */
  node: t.Node;
  /** File path where the dependency is defined */
  file: string;
  /** Source location in the file */
  location: t.SourceLocation | null | undefined;
}

/**
 * Internal dependency representation with full details.
 */
export interface InternalDependency {
  /** Unique identifier */
  id: string;
  /** Symbol/identifier name */
  symbol: string;
  /** Type classification */
  type: DependencyType;
  /** Origin information */
  origin: DependencyOrigin;
  /** Scope information */
  scope: ScopeInfo;
  /** Whether this is a transitive dependency */
  isTransitive: boolean;
  /** IDs of symbols that consume this dependency */
  consumers: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// AST Store Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Entry in the AST store for a single file.
 */
export interface ASTEntry {
  /** File path */
  path: string;
  /** Parsed AST */
  ast: t.File;
  /** Whether the AST has been modified */
  dirty: boolean;
  /** Content hash for cache validation */
  hash: string;
  /** Set of file paths this file depends on */
  dependencies: Set<string>;
  /** Set of file paths that depend on this file */
  dependents: Set<string>;
}

/**
 * Store for caching parsed ASTs and related metadata.
 */
export interface ASTStore {
  /** Map of file path to AST entry */
  files: Map<string, ASTEntry>;
  /** WeakMap from AST nodes to their scope info */
  scopeMap: WeakMap<t.Node, ScopeInfo>;
  /** WeakMap from identifiers to their bindings */
  bindingCache: WeakMap<t.Identifier, Binding>;
  /** WeakMap from AST file nodes to dependency graphs */
  dependencyGraphCache: WeakMap<t.File, DependencyGraph>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Transformation Plan Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Strategy for hoisting a dependency.
 */
export enum HoistStrategy {
  /** Hoist declaration to ancestor scope */
  Hoist = 'hoist',
  /** Pass as prop through component tree */
  PassAsProp = 'prop',
  /** Create shared module for cross-file deps */
  CreateShared = 'shared',
  /** Wrap target with Context.Provider */
  WrapProvider = 'provider',
  /** Extract context value to props */
  ExtractContext = 'extract_context',
}

/**
 * Type of atomic unit for move operations.
 */
export enum AtomicUnitType {
  /** Single JSX element */
  Element = 'element',
  /** Conditional expression: {cond && <E />} */
  Conditional = 'conditional',
  /** Ternary expression: {cond ? <A /> : <B />} */
  Ternary = 'ternary',
  /** Map expression: {items.map(...)} */
  MapExpression = 'map',
  /** Compound component: <Tabs.Panel> */
  CompoundComponent = 'compound',
  /** Suspense boundary with lazy component */
  SuspenseBoundary = 'suspense',
}

/**
 * A move operation to be executed.
 */
export interface MoveOperation {
  /** Unique identifier for this operation */
  id: string;
  /** Source file path */
  sourceFile: string;
  /** AST path to source element */
  sourcePath: string;
  /** Target file path */
  targetFile: string;
  /** AST path to target element */
  targetPath: string;
  /** Move mode */
  mode: Move;
  /** Type of atomic unit being moved */
  atomicUnit: AtomicUnitType;
}

/**
 * A hoist operation to be executed.
 */
export interface HoistOperation {
  /** Unique identifier for this operation */
  id: string;
  /** ID of the dependency being hoisted */
  dependencyId: string;
  /** Symbol name being hoisted */
  symbol: string;
  /** Source file path */
  fromFile: string;
  /** Source scope name */
  fromScope: string;
  /** Target file path */
  toFile: string;
  /** Target scope name */
  toScope: string;
  /** Hoisting strategy to use */
  strategy: HoistStrategy;
}

/**
 * A prop threading operation to be executed.
 */
export interface PropThreadOperation {
  /** Unique identifier for this operation */
  id: string;
  /** Name of the prop to thread */
  propName: string;
  /** Expression for the prop value */
  valueExpression: string;
  /** Component where the prop originates */
  fromComponent: string;
  /** Component that consumes the prop */
  toComponent: string;
  /** Path of components from source to target */
  path: string[];
}

/**
 * Import specifier details.
 */
export interface ImportSpecifier {
  /** Type of import specifier */
  type: 'default' | 'named' | 'namespace';
  /** Name as exported from source */
  imported: string;
  /** Local name in target file */
  local: string;
}

/**
 * An import operation to be executed.
 */
export interface ImportOperation {
  /** Unique identifier for this operation */
  id: string;
  /** File path where import should be added */
  file: string;
  /** Module specifier for the import */
  importSource: string;
  /** Import specifiers */
  specifiers: ImportSpecifier[];
  /** Position for the import statement */
  position: 'start' | 'end' | 'grouped';
}

/**
 * Export declaration for shared modules.
 */
export interface ExportDeclaration {
  /** Name of the exported symbol */
  name: string;
  /** Type of export */
  type: 'named' | 'default';
  /** AST node being exported */
  node: t.Node;
}

/**
 * A shared module creation operation.
 */
export interface SharedModuleOperation {
  /** Unique identifier for this operation */
  id: string;
  /** Path for the new shared module file */
  newFilePath: string;
  /** Exports to include in the shared module */
  exports: ExportDeclaration[];
  /** Files that will import from this shared module */
  importers: string[];
}

/**
 * Validation result for a transformation plan.
 */
export interface ValidationResult {
  /** Whether the plan is valid */
  valid: boolean;
  /** Validation errors if not valid */
  errors: string[];
  /** Warnings that don't prevent execution */
  warnings: string[];
}

/**
 * Complete transformation plan.
 */
export interface TransformPlan {
  /** Unique identifier for this plan */
  id: string;
  /** Move operations to execute */
  moves: MoveOperation[];
  /** Hoist operations to execute */
  hoists: HoistOperation[];
  /** Prop threading operations to execute */
  propThreads: PropThreadOperation[];
  /** Import operations to execute */
  imports: ImportOperation[];
  /** Shared module operations to execute */
  sharedModules: SharedModuleOperation[];
  /** Validation result */
  validation: ValidationResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Transform Result Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Modification record for tracking changes.
 */
export interface Modification {
  /** Type of modification */
  type: 'move' | 'hoist' | 'prop' | 'import' | 'delete';
  /** File that was modified */
  file: string;
  /** Description of the modification */
  description: string;
  /** Location in the file */
  location?: t.SourceLocation | null;
}

/**
 * Statistics about a transformation.
 */
export interface TransformStats {
  /** Number of elements moved */
  elementsMoved: number;
  /** Number of dependencies hoisted */
  dependenciesHoisted: number;
  /** Number of props added */
  propsAdded: number;
  /** Number of imports added */
  importsAdded: number;
  /** Number of files modified */
  filesModified: number;
  /** Number of files created */
  filesCreated: number;
}

/**
 * Result of a transformation execution.
 */
export interface TransformResult {
  /** Modified ASTs keyed by file path */
  asts: Map<string, t.File>;
  /** Newly created files */
  newFiles: Map<string, t.File>;
  /** Record of all modifications */
  modifications: Modification[];
  /** Statistics about the transformation */
  stats: TransformStats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Parser Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Source location information.
 */
export interface SourceLocation {
  /** Start position */
  start: { line: number; column: number };
  /** End position */
  end: { line: number; column: number };
}

/**
 * Parser error details.
 */
export interface ParseError {
  /** Error message */
  message: string;
  /** Location of the error */
  location: SourceLocation;
  /** Error code */
  code: string;
}

/**
 * Result of parsing a file.
 */
export interface ParseResult {
  /** Parsed AST */
  ast: t.File;
  /** Any errors encountered (in error recovery mode) */
  errors: ParseError[];
  /** Source map if generated */
  sourceMap?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Selector Resolution Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Atomic unit representation.
 */
export interface AtomicUnit {
  /** Type of atomic unit */
  type: AtomicUnitType;
  /** NodePath to the atomic unit root */
  path: NodePath;
  /** All nodes included in this atomic unit */
  nodes: t.Node[];
}

/**
 * Error during selector resolution.
 */
export interface SelectorError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Location if applicable */
  location?: SourceLocation;
}

/**
 * Result of resolving a selector.
 */
export interface ResolveResult {
  /** Resolved AST node (null if not found) */
  node: t.Node | null;
  /** NodePath to the resolved node */
  path: NodePath | null;
  /** Atomic unit containing the resolved element */
  atomicUnit: AtomicUnit | null;
  /** Error if resolution failed */
  error?: SelectorError;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency Analysis Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Unanalyzable code blocker.
 */
export interface UnanalyzableCode {
  /** Type of unanalyzable code */
  type: 'eval' | 'dynamicCode';
  /** Location of the code */
  location: SourceLocation;
  /** Description of why it's unanalyzable */
  description: string;
}

/**
 * Result of analyzability check.
 */
export interface AnalyzabilityResult {
  /** Whether the code is analyzable */
  analyzable: boolean;
  /** Blockers if not analyzable */
  blockers?: UnanalyzableCode[];
}

/**
 * Result of dependency analysis.
 */
export interface DependencyAnalysis {
  /** All dependencies found */
  dependencies: InternalDependency[];
  /** Dependencies that need hoisting */
  needsHoisting: InternalDependency[];
  /** Dependencies that need import in target */
  needsImport: InternalDependency[];
  /** Dependencies that need prop threading */
  needsPropThreading: InternalDependency[];
  /** Whether all dependencies can be resolved */
  canResolve: boolean;
  /** Reason if cannot resolve */
  unresolvedReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Optimizer Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Information about a consumer of a dependency.
 */
export interface ConsumerInfo {
  /** NodePath to the consumer */
  path: NodePath;
  /** Scope of the consumer */
  scope: ScopeInfo;
  /** How the dependency is used */
  usageType: 'direct' | 'prop' | 'closure';
}

/**
 * Candidate for sinking optimization.
 */
export interface SinkCandidate {
  /** The dependency to potentially sink */
  dependency: InternalDependency;
  /** Current scope of the dependency */
  currentScope: ScopeInfo;
  /** Optimal scope to sink to */
  optimalScope: ScopeInfo;
  /** All consumers of this dependency */
  consumers: ConsumerInfo[];
  /** Whether sinking is possible */
  sinkable: boolean;
  /** Reason if not sinkable */
  reason?: string;
}

/**
 * Record of a removed prop.
 */
export interface PropRemoval {
  /** Component the prop was removed from */
  component: string;
  /** Name of the removed prop */
  propName: string;
}

/**
 * Result of optimization.
 */
export interface OptimizeResult {
  /** Optimized ASTs */
  asts: Map<string, t.File>;
  /** Dependencies that were sunk */
  sunkDependencies: SinkCandidate[];
  /** Props that were removed */
  removedProps: PropRemoval[];
  /** Dead code that was removed */
  deadCodeRemoved: string[];
}
