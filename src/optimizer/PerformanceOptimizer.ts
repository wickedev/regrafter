/**
 * Performance Optimizer
 *
 * Provides optimized AST traversal, memory management, and parallel processing
 * capabilities for the optimizer module.
 *
 * Task 5.4: Performance Optimization
 * - AST traversal optimization
 * - Memory optimization (WeakMaps, cache limits)
 * - Parallel file processing
 */

import traverse, { NodePath, Visitor } from '@babel/traverse';
import type * as t from '@babel/types';
import type { FileInput } from '../types/public.js';
import type {
  IPerformanceOptimizer,
  PerformanceConfig,
  PerformanceMetrics,
  CacheEntry,
} from './types.js';

/**
 * Default performance configuration.
 */
const DEFAULT_PERFORMANCE_CONFIG: Required<PerformanceConfig> = {
  maxCacheSize: 100,
  parallelProcessing: true,
  maxWorkers: 4,
  incrementalAnalysis: true,
  enableMemoization: true,
  cacheTTL: 60000, // 1 minute
};

/**
 * LRU Cache implementation with size limits and TTL support.
 */
class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = Date.now();

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: K, value: V, sizeEstimate: number = 1): void {
    // Evict if at capacity
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      } else {
        break;
      }
    }

    const entry: CacheEntry<V> = {
      value,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
      sizeEstimate,
    };

    this.cache.set(key, entry);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  /**
   * Get hit rate statistics.
   */
  getStats(): { hits: number; total: number; hitRate: number } {
    let hits = 0;
    let total = 0;

    for (const entry of this.cache.values()) {
      total++;
      hits += entry.accessCount - 1; // First access doesn't count as hit
    }

    return {
      hits,
      total,
      hitRate: total > 0 ? hits / (hits + total) : 0,
    };
  }
}

/**
 * PerformanceOptimizer provides optimized operations for AST processing.
 */
export class PerformanceOptimizer implements IPerformanceOptimizer {
  private config: Required<PerformanceConfig>;
  private traversalCache: LRUCache<string, unknown[]>;
  private memoCache: WeakMap<t.File, Map<string, unknown>> = new WeakMap();
  private metrics: PerformanceMetrics;

  // Performance tracking
  private parseTime = 0;
  private analysisTime = 0;
  private transformTime = 0;
  private generateTime = 0;
  private nodesProcessed = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config?: PerformanceConfig) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.traversalCache = new LRUCache<string, unknown[]>(
      this.config.maxCacheSize,
      this.config.cacheTTL
    );
    this.metrics = this.initializeMetrics();
  }

  /**
   * Create an optimized AST traversal function.
   *
   * Uses visitor batching and early termination for better performance.
   *
   * @param visitor - Visitor function to execute on each matching node
   * @returns Optimized traversal function
   */
  createOptimizedTraversal<T>(
    visitor: (path: NodePath) => T | undefined
  ): (ast: t.File) => T[] {
    return (ast: t.File): T[] => {
      const results: T[] = [];
      const startTime = performance.now();
      let nodeCount = 0;

      // Create batched visitor
      const batchedVisitor: Visitor = {
        enter(path: NodePath) {
          nodeCount++;
          const result = visitor(path);
          if (result !== undefined) {
            results.push(result);
          }
        },
      };

      traverse(ast, batchedVisitor);

      // Update metrics
      const elapsed = performance.now() - startTime;
      this.analysisTime += elapsed;
      this.nodesProcessed += nodeCount;

      return results;
    };
  }

  /**
   * Process files in parallel using async processing.
   *
   * @param files - Files to process
   * @param processor - Processing function for each file
   * @returns Promise resolving to array of results
   */
  async processFilesParallel<T>(
    files: FileInput[],
    processor: (file: FileInput) => Promise<T>
  ): Promise<T[]> {
    if (!this.config.parallelProcessing || files.length <= 1) {
      // Sequential processing
      const results: T[] = [];
      for (const file of files) {
        results.push(await processor(file));
      }
      return results;
    }

    // Parallel processing with concurrency limit
    const results: T[] = [];
    const chunks = this.chunkArray(files, this.config.maxWorkers);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map(processor));
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Get current performance metrics.
   */
  getMetrics(): PerformanceMetrics {
    const totalTime =
      this.parseTime + this.analysisTime + this.transformTime + this.generateTime;

    const cacheStats = this.traversalCache.getStats();

    return {
      totalTimeMs: totalTime,
      parseTimeMs: this.parseTime,
      analysisTimeMs: this.analysisTime,
      transformTimeMs: this.transformTime,
      generateTimeMs: this.generateTime,
      memoryUsageBytes: this.getMemoryUsage(),
      peakMemoryBytes: this.metrics.peakMemoryBytes,
      nodesProcessed: this.nodesProcessed,
      cacheHitRate:
        this.cacheHits + this.cacheMisses > 0
          ? this.cacheHits / (this.cacheHits + this.cacheMisses)
          : cacheStats.hitRate,
    };
  }

  /**
   * Clear all caches and reset metrics.
   */
  clearCaches(): void {
    this.traversalCache.clear();
    this.memoCache = new WeakMap();
    this.resetMetrics();
  }

  /**
   * Memoize an expensive computation per AST.
   *
   * @param ast - The AST to memoize for
   * @param key - Cache key
   * @param compute - Computation function
   * @returns Cached or computed result
   */
  memoize<T>(ast: t.File, key: string, compute: () => T): T {
    if (!this.config.enableMemoization) {
      return compute();
    }

    let astCache = this.memoCache.get(ast);
    if (!astCache) {
      astCache = new Map();
      this.memoCache.set(ast, astCache);
    }

    if (astCache.has(key)) {
      this.cacheHits++;
      return astCache.get(key) as T;
    }

    this.cacheMisses++;
    const result = compute();
    astCache.set(key, result);
    return result;
  }

  /**
   * Time a phase of processing.
   *
   * @param phase - The phase being timed
   * @param fn - Function to execute
   * @returns Result of the function
   */
  timePhase<T>(phase: 'parse' | 'analysis' | 'transform' | 'generate', fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      const elapsed = performance.now() - start;
      switch (phase) {
        case 'parse':
          this.parseTime += elapsed;
          break;
        case 'analysis':
          this.analysisTime += elapsed;
          break;
        case 'transform':
          this.transformTime += elapsed;
          break;
        case 'generate':
          this.generateTime += elapsed;
          break;
      }

      // Update peak memory
      const currentMemory = this.getMemoryUsage();
      if (currentMemory > this.metrics.peakMemoryBytes) {
        this.metrics.peakMemoryBytes = currentMemory;
      }
    }
  }

  /**
   * Create an optimized visitor that processes multiple node types.
   *
   * @param nodeTypes - Array of node types to visit
   * @param handler - Handler function for matching nodes
   * @returns Babel visitor object
   */
  createBatchedVisitor(
    nodeTypes: string[],
    handler: (path: NodePath, nodeType: string) => void
  ): Visitor {
    const visitor: Visitor = {};

    for (const nodeType of nodeTypes) {
      (visitor as Record<string, (path: NodePath) => void>)[nodeType] = (path: NodePath) => {
        this.nodesProcessed++;
        handler(path, nodeType);
      };
    }

    return visitor;
  }

  /**
   * Perform incremental analysis by only processing changed nodes.
   *
   * @param ast - The AST to analyze
   * @param previousHash - Hash of the previous version
   * @param currentHash - Hash of the current version
   * @param fullAnalysis - Function to perform full analysis
   * @param incrementalAnalysis - Function to perform incremental analysis
   * @returns Analysis result
   */
  incrementalAnalyze<T>(
    ast: t.File,
    previousHash: string | null,
    currentHash: string,
    fullAnalysis: () => T,
    incrementalAnalysis: (previous: T) => T
  ): T {
    if (!this.config.incrementalAnalysis || !previousHash) {
      return fullAnalysis();
    }

    const cacheKey = `${previousHash}-${currentHash}`;
    const cached = this.traversalCache.get(cacheKey) as T | undefined;

    if (cached) {
      this.cacheHits++;
      return incrementalAnalysis(cached);
    }

    this.cacheMisses++;
    const result = fullAnalysis();
    this.traversalCache.set(cacheKey, result as unknown[], 1);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private initializeMetrics(): PerformanceMetrics {
    return {
      totalTimeMs: 0,
      parseTimeMs: 0,
      analysisTimeMs: 0,
      transformTimeMs: 0,
      generateTimeMs: 0,
      memoryUsageBytes: 0,
      peakMemoryBytes: 0,
      nodesProcessed: 0,
      cacheHitRate: 0,
    };
  }

  private resetMetrics(): void {
    this.parseTime = 0;
    this.analysisTime = 0;
    this.transformTime = 0;
    this.generateTime = 0;
    this.nodesProcessed = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.metrics = this.initializeMetrics();
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

/**
 * Create a PerformanceOptimizer instance.
 */
export function createPerformanceOptimizer(
  config?: PerformanceConfig
): PerformanceOptimizer {
  return new PerformanceOptimizer(config);
}

/**
 * Utility class for tracking operation performance.
 */
export class PerformanceTracker {
  private startTime: number = 0;
  private phases: Map<string, number> = new Map();
  private currentPhase: string | null = null;
  private phaseStart: number = 0;

  start(): void {
    this.startTime = performance.now();
    this.phases.clear();
    this.currentPhase = null;
  }

  startPhase(name: string): void {
    if (this.currentPhase) {
      this.endPhase();
    }
    this.currentPhase = name;
    this.phaseStart = performance.now();
  }

  endPhase(): void {
    if (!this.currentPhase) return;

    const elapsed = performance.now() - this.phaseStart;
    const existing = this.phases.get(this.currentPhase) || 0;
    this.phases.set(this.currentPhase, existing + elapsed);
    this.currentPhase = null;
  }

  getTotalTime(): number {
    return performance.now() - this.startTime;
  }

  getPhaseTime(name: string): number {
    return this.phases.get(name) || 0;
  }

  getAllPhases(): Map<string, number> {
    return new Map(this.phases);
  }
}

/**
 * Create a PerformanceTracker instance.
 */
export function createPerformanceTracker(): PerformanceTracker {
  return new PerformanceTracker();
}
