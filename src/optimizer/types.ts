/**
 * Optimizer Module Types
 *
 * Type definitions for the optimizer module including sink analysis,
 * performance optimization, and benchmark utilities.
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import type {
  ScopeInfo,
  InternalDependency,
  ConsumerInfo,
  SinkCandidate,
  PropRemoval,
  OptimizeResult,
  DependencyGraph,
} from '../types/internal.js';
import type { FileInput, Code } from '../types/public.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Sink Analysis Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of LCA (Lowest Common Ancestor) computation.
 */
export interface LCAResult {
  /** The computed LCA scope */
  scope: ScopeInfo;
  /** Depth of the LCA scope in the scope tree */
  depth: number;
  /** Scopes traversed to reach LCA */
  pathFromRoot: ScopeInfo[];
}

/**
 * Declaration that may be a candidate for sinking.
 */
export interface HoistedDeclaration {
  /** The internal dependency representation */
  dependency: InternalDependency;
  /** The AST node of the declaration */
  node: t.Node;
  /** NodePath to the declaration */
  path: NodePath;
  /** Current scope where declaration exists */
  currentScope: ScopeInfo;
  /** Whether the declaration was artificially hoisted (vs natural position) */
  wasHoisted: boolean;
}

/**
 * Analysis result for a potential sink operation.
 */
export interface SinkAnalysisResult {
  /** All identified sink candidates */
  candidates: SinkCandidate[];
  /** Candidates that can safely be sunk */
  sinkable: SinkCandidate[];
  /** Candidates that cannot be sunk with reasons */
  unsinkable: Array<{ candidate: SinkCandidate; reason: string }>;
  /** Dependencies between candidates (affects sink order) */
  dependencyOrder: string[];
}

/**
 * Options for sink analysis.
 */
export interface SinkAnalysisOptions {
  /** Minimum depth improvement required to consider sinking (default: 1) */
  minDepthImprovement?: number;
  /** Whether to analyze transitive dependencies (default: true) */
  analyzeTransitive?: boolean;
  /** Maximum number of consumers to analyze (default: 100) */
  maxConsumers?: number;
  /** Whether to consider hooks when sinking (default: false - hooks cannot be sunk across component boundaries) */
  allowHookSinking?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sink Execution Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A single sink operation to execute.
 */
export interface SinkOperation {
  /** Unique ID of the operation */
  id: string;
  /** The sink candidate being processed */
  candidate: SinkCandidate;
  /** Target scope to sink to */
  targetScope: ScopeInfo;
  /** AST modifications required */
  modifications: SinkModification[];
}

/**
 * A modification required for sinking.
 */
export interface SinkModification {
  /** Type of modification */
  type: 'move' | 'remove_prop' | 'update_reference' | 'remove_declaration';
  /** File being modified */
  file: string;
  /** NodePath to the node being modified */
  path: NodePath;
  /** Description of the modification */
  description: string;
}

/**
 * Result of executing a sink operation.
 */
export interface SinkExecutionResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Sunk candidates with their final locations */
  sunkDependencies: SinkCandidate[];
  /** Props that were removed after sinking */
  removedProps: PropRemoval[];
  /** Dead code that was detected and removed */
  deadCodeRemoved: DeadCodeInfo[];
  /** Errors if operation failed */
  errors?: string[];
}

/**
 * Information about removed dead code.
 */
export interface DeadCodeInfo {
  /** Type of dead code */
  type: 'unused_variable' | 'unused_import' | 'unreachable_code' | 'orphaned_prop';
  /** Symbol or identifier name */
  name: string;
  /** File containing the dead code */
  file: string;
  /** Location in the file */
  location?: t.SourceLocation | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Performance Optimization Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for performance optimization.
 */
export interface PerformanceConfig {
  /** Maximum cache size for AST store (default: 100) */
  maxCacheSize?: number;
  /** Enable parallel file processing (default: true) */
  parallelProcessing?: boolean;
  /** Maximum parallel workers (default: 4) */
  maxWorkers?: number;
  /** Enable incremental analysis (default: true) */
  incrementalAnalysis?: boolean;
  /** Enable memoization of expensive operations (default: true) */
  enableMemoization?: boolean;
  /** Cache TTL in milliseconds (default: 60000) */
  cacheTTL?: number;
}

/**
 * Cache entry with metadata for LRU eviction.
 */
export interface CacheEntry<T> {
  /** The cached value */
  value: T;
  /** Timestamp when entry was created */
  timestamp: number;
  /** Number of times this entry was accessed */
  accessCount: number;
  /** Last access timestamp */
  lastAccess: number;
  /** Size estimate for memory management */
  sizeEstimate: number;
}

/**
 * Performance metrics for benchmarking.
 */
export interface PerformanceMetrics {
  /** Total operation time in milliseconds */
  totalTimeMs: number;
  /** Time spent parsing files */
  parseTimeMs: number;
  /** Time spent on dependency analysis */
  analysisTimeMs: number;
  /** Time spent on transformation */
  transformTimeMs: number;
  /** Time spent generating code */
  generateTimeMs: number;
  /** Memory usage in bytes */
  memoryUsageBytes: number;
  /** Peak memory usage in bytes */
  peakMemoryBytes: number;
  /** Number of AST nodes processed */
  nodesProcessed: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
}

/**
 * Result of a performance-optimized operation.
 */
export interface OptimizedOperationResult<T> {
  /** The operation result */
  result: T;
  /** Performance metrics */
  metrics: PerformanceMetrics;
  /** Whether result came from cache */
  fromCache: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fast canMove Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Blocking issue that prevents a move operation.
 */
export interface BlockingIssue {
  /** Type of blocking issue */
  type:
    | 'hook_rule_violation'
    | 'scope_escape'
    | 'circular_dependency'
    | 'unanalyzable_code'
    | 'conditional_hook'
    | 'context_unavailable'
    | 'target_not_found'
    | 'source_not_found';
  /** Description of the issue */
  description: string;
  /** Severity level */
  severity: 'error' | 'warning';
  /** Location in source if applicable */
  location?: t.SourceLocation | null;
}

/**
 * Result of fast canMove analysis.
 */
export interface FastCanMoveResult {
  /** Whether the move is possible */
  canMove: boolean;
  /** Blocking issues if canMove is false */
  blockingIssues: BlockingIssue[];
  /** Quick estimate of complexity (0-1) */
  complexityEstimate: number;
  /** Whether further detailed analysis is recommended */
  needsDetailedAnalysis: boolean;
  /** Time taken for analysis in milliseconds */
  analysisTimeMs: number;
}

/**
 * Options for fast canMove analysis.
 */
export interface FastCanMoveOptions {
  /** Skip certain checks for faster results (default: false) */
  skipDetailedChecks?: boolean;
  /** Timeout in milliseconds (default: 100) */
  timeout?: number;
  /** Whether to check for hook rule violations (default: true) */
  checkHookRules?: boolean;
  /** Whether to check for circular dependencies (default: true) */
  checkCircularDeps?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Benchmark Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Benchmark case configuration.
 */
export interface BenchmarkCase {
  /** Name of the benchmark */
  name: string;
  /** Description of what is being benchmarked */
  description: string;
  /** Input files for the benchmark */
  files: FileInput[];
  /** Number of iterations to run (default: 100) */
  iterations?: number;
  /** Warmup iterations before measurement (default: 10) */
  warmupIterations?: number;
}

/**
 * Result of running a benchmark.
 */
export interface BenchmarkResult {
  /** Benchmark case that was run */
  case: BenchmarkCase;
  /** Individual run times in milliseconds */
  runTimesMs: number[];
  /** Mean run time */
  meanMs: number;
  /** Median run time */
  medianMs: number;
  /** Standard deviation */
  stdDevMs: number;
  /** 95th percentile */
  p95Ms: number;
  /** 99th percentile */
  p99Ms: number;
  /** Min run time */
  minMs: number;
  /** Max run time */
  maxMs: number;
  /** Operations per second */
  opsPerSecond: number;
  /** Memory stats */
  memoryStats: {
    meanBytes: number;
    peakBytes: number;
  };
}

/**
 * Suite of benchmark results.
 */
export interface BenchmarkSuite {
  /** Name of the suite */
  name: string;
  /** Individual benchmark results */
  results: BenchmarkResult[];
  /** Total suite run time */
  totalTimeMs: number;
  /** Environment information */
  environment: {
    nodeVersion: string;
    platform: string;
    cpuCount: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Optimizer API Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for the optimize function.
 */
export interface OptimizeOptions {
  /** Enable sink optimization (default: true) */
  enableSinking?: boolean;
  /** Enable dead code removal (default: true) */
  enableDeadCodeRemoval?: boolean;
  /** Enable prop cleanup (default: true) */
  enablePropCleanup?: boolean;
  /** Sink analysis options */
  sinkOptions?: SinkAnalysisOptions;
  /** Performance configuration */
  performanceConfig?: PerformanceConfig;
  /** Whether to run in dry-run mode (default: false) */
  dryRun?: boolean;
}

/**
 * Extended optimize result with additional metadata.
 */
export interface ExtendedOptimizeResult extends OptimizeResult {
  /** Detailed sink analysis results */
  sinkAnalysis?: SinkAnalysisResult;
  /** Dead code that was found and optionally removed */
  deadCode: DeadCodeInfo[];
  /** Performance metrics */
  metrics?: PerformanceMetrics;
  /** Whether changes were made */
  hasChanges: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Scope Tree Utilities Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scope tree for efficient LCA computation.
 */
export interface ScopeTree {
  /** Root scope (module level) */
  root: ScopeInfo;
  /** Map from scope ID to scope info */
  scopes: Map<string, ScopeInfo>;
  /** Map from scope ID to depth */
  depths: Map<string, number>;
  /** Map from scope ID to parent ID */
  parents: Map<string, string | null>;
  /** Map from scope ID to children IDs */
  children: Map<string, Set<string>>;
}

/**
 * Interface for the SinkAnalyzer.
 */
export interface ISinkAnalyzer {
  /** Analyze files for sink candidates */
  analyze(
    files: FileInput[],
    graph: DependencyGraph,
    options?: SinkAnalysisOptions
  ): SinkAnalysisResult;

  /** Find all consumers of a dependency */
  findConsumers(dependency: InternalDependency, graph: DependencyGraph): ConsumerInfo[];

  /** Compute LCA of multiple scopes */
  computeLCA(scopes: ScopeInfo[]): LCAResult;

  /** Build scope tree from parsed files */
  buildScopeTree(ast: t.File): ScopeTree;
}

/**
 * Interface for the SinkExecutor.
 */
export interface ISinkExecutor {
  /** Execute sink operations */
  execute(
    candidates: SinkCandidate[],
    asts: Map<string, t.File>
  ): SinkExecutionResult;

  /** Remove orphaned props */
  removeOrphanedProps(
    asts: Map<string, t.File>,
    propsToCheck: string[]
  ): PropRemoval[];

  /** Detect and remove dead code */
  removeDeadCode(asts: Map<string, t.File>): DeadCodeInfo[];
}

/**
 * Interface for the PerformanceOptimizer.
 */
export interface IPerformanceOptimizer {
  /** Create optimized AST traversal */
  createOptimizedTraversal<T>(
    visitor: (path: NodePath) => T | undefined
  ): (ast: t.File) => T[];

  /** Process files in parallel */
  processFilesParallel<T>(
    files: FileInput[],
    processor: (file: FileInput) => Promise<T>
  ): Promise<T[]>;

  /** Get performance metrics */
  getMetrics(): PerformanceMetrics;

  /** Clear all caches */
  clearCaches(): void;
}

/**
 * Interface for the Optimizer.
 */
export interface IOptimizer {
  /** Run optimization on files */
  optimize(files: FileInput[], options?: OptimizeOptions): Code[];

  /** Run optimization with extended results */
  optimizeWithDetails(
    files: FileInput[],
    options?: OptimizeOptions
  ): ExtendedOptimizeResult;

  /** Fast canMove check */
  canMove(
    files: FileInput[],
    from: { file: string; path: string },
    to: { file: string; path: string },
    options?: FastCanMoveOptions
  ): FastCanMoveResult;
}
