/**
 * Benchmark Suite
 *
 * Performance benchmarking utilities for measuring optimizer performance,
 * memory usage, and throughput.
 *
 * Task 5.6: Benchmarks
 * - Performance benchmark suite
 * - Memory usage tracking
 */

import os from 'os';

import { createOptimizer } from './Optimizer.js';
import type {
  BenchmarkCase,
  BenchmarkResult,
  BenchmarkSuite,
} from './types.js';

/**
 * Default benchmark configuration.
 */
const DEFAULT_ITERATIONS = 100;
const DEFAULT_WARMUP_ITERATIONS = 10;

/**
 * Benchmark runner for measuring optimizer performance.
 */
export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  /**
   * Run a single benchmark case.
   *
   * @param benchmarkCase - The benchmark case to run
   * @returns Benchmark result
   */
  run(benchmarkCase: BenchmarkCase): BenchmarkResult {
    const iterations = benchmarkCase.iterations ?? DEFAULT_ITERATIONS;
    const warmupIterations = benchmarkCase.warmupIterations ?? DEFAULT_WARMUP_ITERATIONS;

    // Warmup runs
    for (let i = 0; i < warmupIterations; i++) {
      this.executeCase(benchmarkCase);
    }

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    // Measurement runs
    const runTimesMs: number[] = [];
    const memoryUsages: number[] = [];
    let peakMemory = 0;

    for (let i = 0; i < iterations; i++) {
      const startMemory = this.getMemoryUsage();
      const startTime = performance.now();

      this.executeCase(benchmarkCase);

      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      runTimesMs.push(endTime - startTime);
      memoryUsages.push(endMemory - startMemory);
      peakMemory = Math.max(peakMemory, endMemory);
    }

    // Calculate statistics
    const result = this.calculateStats(benchmarkCase, runTimesMs, memoryUsages, peakMemory);
    this.results.push(result);

    return result;
  }

  /**
   * Run multiple benchmark cases.
   *
   * @param cases - Array of benchmark cases
   * @returns Benchmark suite result
   */
  runSuite(cases: BenchmarkCase[]): BenchmarkSuite {
    const startTime = performance.now();
    const results: BenchmarkResult[] = [];

    for (const benchmarkCase of cases) {
      const result = this.run(benchmarkCase);
      results.push(result);
    }

    const totalTimeMs = performance.now() - startTime;

    return {
      name: 'Optimizer Benchmark Suite',
      results,
      totalTimeMs,
      environment: this.getEnvironmentInfo(),
    };
  }

  /**
   * Get all recorded results.
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Clear recorded results.
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Generate a performance report.
   *
   * @param suite - Benchmark suite to report on
   * @returns Formatted report string
   */
  generateReport(suite: BenchmarkSuite): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('OPTIMIZER PERFORMANCE BENCHMARK REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(`Suite: ${suite.name}`);
    lines.push(`Total Time: ${suite.totalTimeMs.toFixed(2)}ms`);
    lines.push('');
    lines.push('Environment:');
    lines.push(`  Node Version: ${suite.environment.nodeVersion}`);
    lines.push(`  Platform: ${suite.environment.platform}`);
    lines.push(`  CPU Cores: ${suite.environment.cpuCount}`);
    lines.push('');
    lines.push('-'.repeat(80));

    for (const result of suite.results) {
      lines.push('');
      lines.push(`Benchmark: ${result.case.name}`);
      lines.push(`  Description: ${result.case.description}`);
      lines.push(`  Files: ${result.case.files.length}`);
      lines.push(`  Iterations: ${result.case.iterations ?? DEFAULT_ITERATIONS}`);
      lines.push('');
      lines.push('  Timing (ms):');
      lines.push(`    Mean:   ${result.meanMs.toFixed(3)}`);
      lines.push(`    Median: ${result.medianMs.toFixed(3)}`);
      lines.push(`    StdDev: ${result.stdDevMs.toFixed(3)}`);
      lines.push(`    Min:    ${result.minMs.toFixed(3)}`);
      lines.push(`    Max:    ${result.maxMs.toFixed(3)}`);
      lines.push(`    P95:    ${result.p95Ms.toFixed(3)}`);
      lines.push(`    P99:    ${result.p99Ms.toFixed(3)}`);
      lines.push('');
      lines.push('  Throughput:');
      lines.push(`    Ops/sec: ${result.opsPerSecond.toFixed(2)}`);
      lines.push('');
      lines.push('  Memory:');
      lines.push(`    Mean: ${this.formatBytes(result.memoryStats.meanBytes)}`);
      lines.push(`    Peak: ${this.formatBytes(result.memoryStats.peakBytes)}`);
      lines.push('');
      lines.push('-'.repeat(80));
    }

    lines.push('');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private executeCase(benchmarkCase: BenchmarkCase): void {
    const optimizer = createOptimizer();
    optimizer.optimize(benchmarkCase.files);
  }

  private calculateStats(
    benchmarkCase: BenchmarkCase,
    runTimesMs: number[],
    memoryUsages: number[],
    peakMemory: number
  ): BenchmarkResult {
    // Sort for percentile calculations
    const sortedTimes = [...runTimesMs].sort((a, b) => a - b);
    const _sortedMemory = [...memoryUsages].sort((a, b) => a - b);

    // Mean
    const meanMs = runTimesMs.reduce((a, b) => a + b, 0) / runTimesMs.length;
    const meanBytes = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;

    // Median
    const medianMs = this.percentile(sortedTimes, 50);

    // Standard deviation
    const variance =
      runTimesMs.reduce((acc, val) => acc + Math.pow(val - meanMs, 2), 0) /
      runTimesMs.length;
    const stdDevMs = Math.sqrt(variance);

    // Percentiles
    const p95Ms = this.percentile(sortedTimes, 95);
    const p99Ms = this.percentile(sortedTimes, 99);

    // Min/Max
    const minMs = sortedTimes[0] ?? 0;
    const maxMs = sortedTimes[sortedTimes.length - 1] ?? 0;

    // Operations per second
    const opsPerSecond = meanMs > 0 ? 1000 / meanMs : 0;

    return {
      case: benchmarkCase,
      runTimesMs,
      meanMs,
      medianMs,
      stdDevMs,
      p95Ms,
      p99Ms,
      minMs,
      maxMs,
      opsPerSecond,
      memoryStats: {
        meanBytes,
        peakBytes: peakMemory,
      },
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;

    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower] ?? 0;
    }

    const lowerValue = sortedArray[lower] ?? 0;
    const upperValue = sortedArray[upper] ?? 0;
    const fraction = index - lower;

    return lowerValue + (upperValue - lowerValue) * fraction;
  }

  private getMemoryUsage(): number {
    const heapUsed = process.memoryUsage().heapUsed;
    return heapUsed ?? 0;
  }

  private getEnvironmentInfo(): BenchmarkSuite['environment'] {
    return {
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.release()}`,
      cpuCount: os.cpus().length,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}

/**
 * Create a BenchmarkRunner instance.
 */
export function createBenchmarkRunner(): BenchmarkRunner {
  return new BenchmarkRunner();
}

/**
 * Memory tracker for monitoring memory usage during operations.
 */
export class MemoryTracker {
  private samples: number[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startMemory = 0;
  private peakMemory = 0;

  /**
   * Start tracking memory usage.
   *
   * @param intervalMs - Sampling interval in milliseconds
   */
  start(intervalMs = 10): void {
    this.samples = [];
    this.startMemory = this.getHeapUsed();
    this.peakMemory = this.startMemory;

    this.intervalId = setInterval(() => {
      const current = this.getHeapUsed();
      this.samples.push(current);
      this.peakMemory = Math.max(this.peakMemory, current);
    }, intervalMs);
  }

  /**
   * Stop tracking memory usage.
   *
   * @returns Memory statistics
   */
  stop(): {
    startBytes: number;
    endBytes: number;
    peakBytes: number;
    deltaBytes: number;
    samples: number[];
    meanBytes: number;
  } {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const endMemory = this.getHeapUsed();
    const meanBytes =
      this.samples.length > 0
        ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length
        : endMemory;

    return {
      startBytes: this.startMemory,
      endBytes: endMemory,
      peakBytes: this.peakMemory,
      deltaBytes: endMemory - this.startMemory,
      samples: [...this.samples],
      meanBytes,
    };
  }

  /**
   * Force garbage collection if available.
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  private getHeapUsed(): number {
    const heapUsed = process.memoryUsage().heapUsed;
    return heapUsed ?? 0;
  }
}

/**
 * Create a MemoryTracker instance.
 */
export function createMemoryTracker(): MemoryTracker {
  return new MemoryTracker();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Predefined Benchmark Cases
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a small file benchmark case.
 */
export function createSmallFileBenchmark(): BenchmarkCase {
  return {
    name: 'Small File',
    description: 'Single small React component (~50 lines)',
    files: [
      {
        path: 'SmallComponent.tsx',
        content: `
import React, { useState, useEffect } from 'react';

interface Props {
  title: string;
  onAction: () => void;
}

export function SmallComponent({ title, onAction }: Props) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('Component mounted');
    return () => console.log('Component unmounted');
  }, []);

  const handleClick = () => {
    setCount(c => c + 1);
    onAction();
  };

  return (
    <div className="small-component">
      <h1>{title}</h1>
      <p>Count: {count}</p>
      <button onClick={handleClick}>
        {loading ? 'Loading...' : 'Click me'}
      </button>
    </div>
  );
}
`.trim(),
      },
    ],
    iterations: 100,
    warmupIterations: 10,
  };
}

/**
 * Create a medium file benchmark case.
 */
export function createMediumFileBenchmark(): BenchmarkCase {
  // Using array join to avoid template literal parsing issues
  const content = [
    'import React, { useState, useEffect, useCallback, useMemo } from "react";',
    '',
    'interface Item {',
    '  id: string;',
    '  name: string;',
    '  value: number;',
    '}',
    '',
    'interface Props {',
    '  items: Item[];',
    '  onSelect: (item: Item) => void;',
    '  onDelete: (id: string) => void;',
    '}',
    '',
    'export function MediumComponent({ items, onSelect, onDelete }: Props) {',
    '  const [search, setSearch] = useState("");',
    '  const [sortKey, setSortKey] = useState<"name" | "value">("name");',
    '  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");',
    '  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());',
    '  const [loading, setLoading] = useState(false);',
    '',
    '  useEffect(() => {',
    '    setLoading(true);',
    '    const timer = setTimeout(() => setLoading(false), 1000);',
    '    return () => clearTimeout(timer);',
    '  }, [items]);',
    '',
    '  const filteredItems = useMemo(() => {',
    '    return items.filter(item =>',
    '      item.name.toLowerCase().includes(search.toLowerCase())',
    '    );',
    '  }, [items, search]);',
    '',
    '  const handleToggleSelect = useCallback((id: string) => {',
    '    setSelectedIds(prev => {',
    '      const next = new Set(prev);',
    '      if (next.has(id)) next.delete(id);',
    '      else next.add(id);',
    '      return next;',
    '    });',
    '  }, []);',
    '',
    '  if (loading) {',
    '    return <div className="loading">Loading...</div>;',
    '  }',
    '',
    '  return (',
    '    <div className="medium-component">',
    '      <input',
    '        type="text"',
    '        placeholder="Search..."',
    '        value={search}',
    '        onChange={e => setSearch(e.target.value)}',
    '      />',
    '      <ul>',
    '        {filteredItems.map(item => (',
    '          <li key={item.id}>',
    '            <span>{item.name}: {item.value}</span>',
    '            <button onClick={() => onSelect(item)}>Select</button>',
    '          </li>',
    '        ))}',
    '      </ul>',
    '    </div>',
    '  );',
    '}',
  ].join('\n');

  return {
    name: 'Medium File',
    description: 'Single medium React component (~100 lines)',
    files: [
      {
        path: 'MediumComponent.tsx',
        content,
      },
    ],
    iterations: 50,
    warmupIterations: 5,
  };
}

/**
 * Create a multi-file benchmark case.
 */
export function createMultiFileBenchmark(): BenchmarkCase {
  return {
    name: 'Multi-File',
    description: 'Multiple interconnected React components',
    files: [
      {
        path: 'App.tsx',
        content: `
import React from 'react';
import { Header } from './Header';
import { Content } from './Content';
import { Footer } from './Footer';

export function App() {
  return (
    <div className="app">
      <Header />
      <Content />
      <Footer />
    </div>
  );
}
`.trim(),
      },
      {
        path: 'Header.tsx',
        content: `
import React from 'react';

export function Header() {
  return (
    <header>
      <h1>Application</h1>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
  );
}
`.trim(),
      },
      {
        path: 'Content.tsx',
        content: `
import React, { useState } from 'react';

export function Content() {
  const [data, setData] = useState([]);

  return (
    <main>
      <h2>Content</h2>
      <p>Data count: {data.length}</p>
    </main>
  );
}
`.trim(),
      },
      {
        path: 'Footer.tsx',
        content: `
import React from 'react';

export function Footer() {
  return (
    <footer>
      <p>Copyright 2024</p>
    </footer>
  );
}
`.trim(),
      },
    ],
    iterations: 50,
    warmupIterations: 5,
  };
}

/**
 * Create a canMove benchmark case.
 */
export function createCanMoveBenchmark(): BenchmarkCase {
  return {
    name: 'canMove Check',
    description: 'Fast canMove validation',
    files: [
      {
        path: 'Source.tsx',
        content: `
import React, { useState } from 'react';

export function Source() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <span id="movable">{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
`.trim(),
      },
      {
        path: 'Target.tsx',
        content: `
import React from 'react';

export function Target() {
  return (
    <div id="target">
      <h1>Target Component</h1>
    </div>
  );
}
`.trim(),
      },
    ],
    iterations: 200,
    warmupIterations: 20,
  };
}

/**
 * Run all predefined benchmarks.
 */
export function runAllBenchmarks(): BenchmarkSuite {
  const runner = createBenchmarkRunner();

  const cases = [
    createSmallFileBenchmark(),
    createMediumFileBenchmark(),
    createMultiFileBenchmark(),
    createCanMoveBenchmark(),
  ];

  return runner.runSuite(cases);
}
