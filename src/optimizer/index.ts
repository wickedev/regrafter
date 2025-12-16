/**
 * Optimizer Module
 *
 * Provides optimization capabilities for the Regrafter library including
 * sink analysis, dead code removal, and performance optimization.
 *
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
export { SinkAnalyzer, createSinkAnalyzer } from './sink-analyzer.js';

// Sink Executor
export { SinkExecutor, createSinkExecutor } from './sink-executor.js';

// Performance Optimizer
export {
  PerformanceOptimizer,
  createPerformanceOptimizer,
  PerformanceTracker,
  createPerformanceTracker,
} from './performance-optimizer.js';

// Fast canMove
export { FastCanMove, createFastCanMove } from './fast-can-move.js';

// Main Optimizer
export {
  Optimizer,
  createOptimizer,
  optimize,
  optimizeWithDetails,
} from './optimizer.js';

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
} from './benchmark.js';
