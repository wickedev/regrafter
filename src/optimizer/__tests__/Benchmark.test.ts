/**
 * Benchmark Unit Tests
 *
 * Tests for benchmark utilities and performance tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BenchmarkRunner,
  createBenchmarkRunner,
  MemoryTracker,
  createMemoryTracker,
  createSmallFileBenchmark,
  createMediumFileBenchmark,
  createMultiFileBenchmark,
  createCanMoveBenchmark,
} from '../Benchmark.js';
import type { BenchmarkCase } from '../types.js';

describe('BenchmarkRunner', () => {
  let runner: BenchmarkRunner;

  beforeEach(() => {
    runner = createBenchmarkRunner();
  });

  describe('createBenchmarkRunner', () => {
    it('should create a BenchmarkRunner instance', () => {
      const instance = createBenchmarkRunner();
      expect(instance).toBeInstanceOf(BenchmarkRunner);
    });
  });

  describe('run', () => {
    it('should run a benchmark case and return results', async () => {
      const benchmarkCase: BenchmarkCase = {
        name: 'Test Benchmark',
        description: 'A simple test benchmark',
        files: [
          {
            path: 'Test.tsx',
            content: 'export function Test() { return null; }',
          },
        ],
        iterations: 5,
        warmupIterations: 2,
      };

      const result = await runner.run(benchmarkCase);

      expect(result).toBeDefined();
      expect(result.case).toBe(benchmarkCase);
      expect(result.runTimesMs).toHaveLength(5);
      expect(result.meanMs).toBeGreaterThanOrEqual(0);
      expect(result.medianMs).toBeGreaterThanOrEqual(0);
      expect(result.stdDevMs).toBeGreaterThanOrEqual(0);
      expect(result.minMs).toBeGreaterThanOrEqual(0);
      expect(result.maxMs).toBeGreaterThanOrEqual(result.minMs);
      expect(result.p95Ms).toBeGreaterThanOrEqual(0);
      expect(result.p99Ms).toBeGreaterThanOrEqual(0);
      expect(result.opsPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('should track memory statistics', async () => {
      const benchmarkCase: BenchmarkCase = {
        name: 'Memory Test',
        description: 'Test memory tracking',
        files: [
          {
            path: 'Test.tsx',
            content: 'export function Test() { return null; }',
          },
        ],
        iterations: 3,
        warmupIterations: 1,
      };

      const result = await runner.run(benchmarkCase);

      expect(result.memoryStats).toBeDefined();
      expect(typeof result.memoryStats.meanBytes).toBe('number');
      expect(typeof result.memoryStats.peakBytes).toBe('number');
    });
  });

  describe('runSuite', () => {
    it('should run multiple benchmark cases', async () => {
      const cases: BenchmarkCase[] = [
        {
          name: 'Test 1',
          description: 'First test',
          files: [
            { path: 'Test1.tsx', content: 'export function Test1() { return null; }' },
          ],
          iterations: 2,
          warmupIterations: 1,
        },
        {
          name: 'Test 2',
          description: 'Second test',
          files: [
            { path: 'Test2.tsx', content: 'export function Test2() { return null; }' },
          ],
          iterations: 2,
          warmupIterations: 1,
        },
      ];

      const suite = await runner.runSuite(cases);

      expect(suite).toBeDefined();
      expect(suite.name).toBe('Optimizer Benchmark Suite');
      expect(suite.results).toHaveLength(2);
      expect(suite.totalTimeMs).toBeGreaterThan(0);
      expect(suite.environment).toBeDefined();
      expect(suite.environment.nodeVersion).toBeDefined();
      expect(suite.environment.platform).toBeDefined();
      expect(suite.environment.cpuCount).toBeGreaterThan(0);
    });
  });

  describe('getResults', () => {
    it('should return all recorded results', async () => {
      const benchmarkCase: BenchmarkCase = {
        name: 'Recorded Test',
        description: 'Test result recording',
        files: [
          { path: 'Test.tsx', content: 'export function Test() { return null; }' },
        ],
        iterations: 2,
        warmupIterations: 1,
      };

      await runner.run(benchmarkCase);
      const results = runner.getResults();

      expect(results).toHaveLength(1);
      expect(results[0]?.case.name).toBe('Recorded Test');
    });
  });

  describe('clearResults', () => {
    it('should clear all recorded results', async () => {
      const benchmarkCase: BenchmarkCase = {
        name: 'Clear Test',
        description: 'Test clearing results',
        files: [
          { path: 'Test.tsx', content: 'export function Test() { return null; }' },
        ],
        iterations: 2,
        warmupIterations: 1,
      };

      await runner.run(benchmarkCase);
      runner.clearResults();
      const results = runner.getResults();

      expect(results).toHaveLength(0);
    });
  });

  describe('generateReport', () => {
    it('should generate a formatted report', async () => {
      const cases: BenchmarkCase[] = [
        {
          name: 'Report Test',
          description: 'Test report generation',
          files: [
            { path: 'Test.tsx', content: 'export function Test() { return null; }' },
          ],
          iterations: 2,
          warmupIterations: 1,
        },
      ];

      const suite = await runner.runSuite(cases);
      const report = runner.generateReport(suite);

      expect(typeof report).toBe('string');
      expect(report).toContain('OPTIMIZER PERFORMANCE BENCHMARK REPORT');
      expect(report).toContain('Report Test');
      expect(report).toContain('Mean:');
      expect(report).toContain('Median:');
      expect(report).toContain('Ops/sec:');
    });
  });
});

describe('MemoryTracker', () => {
  let tracker: MemoryTracker;

  beforeEach(() => {
    tracker = createMemoryTracker();
  });

  describe('createMemoryTracker', () => {
    it('should create a MemoryTracker instance', () => {
      const instance = createMemoryTracker();
      expect(instance).toBeInstanceOf(MemoryTracker);
    });
  });

  describe('start/stop', () => {
    it('should track memory usage between start and stop', async () => {
      tracker.start(50);

      // Allocate some memory
      const arr: number[] = [];
      for (let i = 0; i < 10000; i++) {
        arr.push(i);
      }

      // Wait a bit for samples
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = tracker.stop();

      expect(stats).toBeDefined();
      expect(typeof stats.startBytes).toBe('number');
      expect(typeof stats.endBytes).toBe('number');
      expect(typeof stats.peakBytes).toBe('number');
      expect(typeof stats.deltaBytes).toBe('number');
      expect(Array.isArray(stats.samples)).toBe(true);
      expect(typeof stats.meanBytes).toBe('number');
    });

    it('should handle immediate stop', () => {
      tracker.start();
      const stats = tracker.stop();

      expect(stats).toBeDefined();
      expect(stats.samples.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('forceGC', () => {
    it('should not throw when called', () => {
      expect(() => tracker.forceGC()).not.toThrow();
    });
  });
});

describe('Predefined Benchmark Cases', () => {
  describe('createSmallFileBenchmark', () => {
    it('should create a valid benchmark case', () => {
      const benchmark = createSmallFileBenchmark();

      expect(benchmark.name).toBe('Small File');
      expect(benchmark.description).toBeDefined();
      expect(benchmark.files).toHaveLength(1);
      expect(benchmark.files[0]?.path).toBe('SmallComponent.tsx');
      expect(benchmark.iterations).toBe(100);
      expect(benchmark.warmupIterations).toBe(10);
    });
  });

  describe('createMediumFileBenchmark', () => {
    it('should create a valid benchmark case', () => {
      const benchmark = createMediumFileBenchmark();

      expect(benchmark.name).toBe('Medium File');
      expect(benchmark.files).toHaveLength(1);
      expect(benchmark.files[0]?.path).toBe('MediumComponent.tsx');
      // Medium file should have more content
      expect(benchmark.files[0]?.content.length).toBeGreaterThan(
        createSmallFileBenchmark().files[0]?.content.length || 0
      );
    });
  });

  describe('createMultiFileBenchmark', () => {
    it('should create a valid benchmark case with multiple files', () => {
      const benchmark = createMultiFileBenchmark();

      expect(benchmark.name).toBe('Multi-File');
      expect(benchmark.files.length).toBeGreaterThan(1);
      expect(benchmark.files.some((f) => f.path === 'App.tsx')).toBe(true);
      expect(benchmark.files.some((f) => f.path === 'Header.tsx')).toBe(true);
    });
  });

  describe('createCanMoveBenchmark', () => {
    it('should create a valid benchmark case for canMove', () => {
      const benchmark = createCanMoveBenchmark();

      expect(benchmark.name).toBe('canMove Check');
      expect(benchmark.files).toHaveLength(2);
      expect(benchmark.files.some((f) => f.path === 'Source.tsx')).toBe(true);
      expect(benchmark.files.some((f) => f.path === 'Target.tsx')).toBe(true);
      // canMove benchmark should have more iterations since it's faster
      expect(benchmark.iterations).toBe(200);
    });
  });
});

describe('Benchmark Statistics', () => {
  let runner: BenchmarkRunner;

  beforeEach(() => {
    runner = createBenchmarkRunner();
  });

  it('should calculate correct mean', async () => {
    const benchmarkCase: BenchmarkCase = {
      name: 'Stats Test',
      description: 'Test statistics calculation',
      files: [
        { path: 'Test.tsx', content: 'export function Test() { return null; }' },
      ],
      iterations: 10,
      warmupIterations: 2,
    };

    const result = await runner.run(benchmarkCase);

    // Mean should be sum / count
    const expectedMean =
      result.runTimesMs.reduce((a, b) => a + b, 0) / result.runTimesMs.length;
    expect(Math.abs(result.meanMs - expectedMean)).toBeLessThan(0.001);
  });

  it('should calculate percentiles correctly', async () => {
    const benchmarkCase: BenchmarkCase = {
      name: 'Percentile Test',
      description: 'Test percentile calculation',
      files: [
        { path: 'Test.tsx', content: 'export function Test() { return null; }' },
      ],
      iterations: 20,
      warmupIterations: 2,
    };

    const result = await runner.run(benchmarkCase);

    // P95 should be >= median and <= max
    expect(result.p95Ms).toBeGreaterThanOrEqual(result.medianMs);
    expect(result.p95Ms).toBeLessThanOrEqual(result.maxMs);

    // P99 should be >= P95 and <= max
    expect(result.p99Ms).toBeGreaterThanOrEqual(result.p95Ms);
    expect(result.p99Ms).toBeLessThanOrEqual(result.maxMs);
  });

  it('should calculate operations per second', async () => {
    const benchmarkCase: BenchmarkCase = {
      name: 'Ops/sec Test',
      description: 'Test ops/sec calculation',
      files: [
        { path: 'Test.tsx', content: 'export function Test() { return null; }' },
      ],
      iterations: 10,
      warmupIterations: 2,
    };

    const result = await runner.run(benchmarkCase);

    // Ops/sec should be 1000 / mean (ms to seconds)
    if (result.meanMs > 0) {
      const expectedOps = 1000 / result.meanMs;
      expect(Math.abs(result.opsPerSecond - expectedOps)).toBeLessThan(0.01);
    }
  });
});
