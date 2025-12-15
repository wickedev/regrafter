/**
 * Optimizer Module
 *
 * Provides optimization capabilities for the Regrafter library including
 * sink analysis, dead code removal, and performance optimization.
 *
 * Phase 5: Optimization & Performance
 */

// Types
export type {
  // Sink Analysis Types
  ISinkAnalyzer,
  SinkAnalysisOptions,
  SinkAnalysisResult,
  LCAResult,
  ScopeTree,
  HoistedDeclaration,

  // Sink Execution Types
  ISinkExecutor,
  SinkExecutionResult,
  SinkOperation,
  SinkModification,
  DeadCodeInfo,

  // Performance Types
  IPerformanceOptimizer,
  PerformanceConfig,
  PerformanceMetrics,
  CacheEntry,
  OptimizedOperationResult,

  // Fast canMove Types
  FastCanMoveResult,
  FastCanMoveOptions,
  BlockingIssue,

  // Benchmark Types
  BenchmarkCase,
  BenchmarkResult,
  BenchmarkSuite,

  // Optimizer API Types
  IOptimizer,
  OptimizeOptions,
  ExtendedOptimizeResult,
} from './types.js';

// Sink Analyzer
export { SinkAnalyzer, createSinkAnalyzer } from './SinkAnalyzer.js';

// Sink Executor
export { SinkExecutor, createSinkExecutor } from './SinkExecutor.js';

// Performance Optimizer
export {
  PerformanceOptimizer,
  createPerformanceOptimizer,
  PerformanceTracker,
  createPerformanceTracker,
} from './PerformanceOptimizer.js';

// Fast canMove
export { FastCanMove, createFastCanMove } from './FastCanMove.js';

// Main Optimizer
export {
  Optimizer,
  createOptimizer,
  optimize,
  optimizeWithDetails,
} from './Optimizer.js';

// Benchmark utilities
export {
  BenchmarkRunner,
  createBenchmarkRunner,
  MemoryTracker,
  createMemoryTracker,
  // Predefined benchmark cases
  createSmallFileBenchmark,
  createMediumFileBenchmark,
  createMultiFileBenchmark,
  createCanMoveBenchmark,
  runAllBenchmarks,
} from './Benchmark.js';
