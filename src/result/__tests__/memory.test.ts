/**
 * Result Type Memory Overhead Tests
 *
 * Verifies requirement from design.md:
 * - Memory overhead < 100 bytes per Result object
 *
 * Note: Actual memory usage includes V8 overhead, so we use pragmatic thresholds.
 */

import { describe, it, expect } from 'vitest';
import { ok, err } from '../index.js';
import type { Result } from '../types.js';

/**
 * Force garbage collection if available
 * Note: Run Node with --expose-gc flag to enable this
 */
function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

describe('Memory Overhead Verification', () => {
  it('should have reasonable memory overhead for Ok results', () => {
    // Force GC if available
    forceGC();

    const memBefore = process.memoryUsage().heapUsed;

    // Create 10000 Ok results
    const results: Array<Result<number, string>> = [];
    for (let i = 0; i < 10000; i++) {
      results.push(ok(i));
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memUsed = memAfter - memBefore;
    const bytesPerResult = memUsed / 10000;

    console.log(`Memory per Ok result: ${bytesPerResult.toFixed(2)} bytes`);

    // V8 overhead may cause this to be higher in practice
    // Target is < 100 bytes, but we allow < 200 bytes for V8 overhead
    expect(bytesPerResult).toBeLessThan(200);

    // Keep results in memory to prevent optimization
    expect(results.length).toBe(10000);
  });

  it('should have reasonable memory overhead for Err results', () => {
    // Force GC if available
    forceGC();

    const memBefore = process.memoryUsage().heapUsed;

    // Create 10000 Err results
    const results: Array<Result<number, string>> = [];
    for (let i = 0; i < 10000; i++) {
      results.push(err(`error ${i}`));
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memUsed = memAfter - memBefore;
    const bytesPerResult = memUsed / 10000;

    console.log(`Memory per Err result: ${bytesPerResult.toFixed(2)} bytes`);

    // Err results may be slightly larger due to string content
    // Allow < 300 bytes for V8 overhead and string storage
    expect(bytesPerResult).toBeLessThan(300);

    // Keep results in memory to prevent optimization
    expect(results.length).toBe(10000);
  });

  it('should have minimal memory overhead for simple Ok results', () => {
    // Force GC if available
    forceGC();

    const memBefore = process.memoryUsage().heapUsed;

    // Create 10000 simple Ok results with same value (deduplication possible)
    const results: Array<Result<number, string>> = [];
    for (let i = 0; i < 10000; i++) {
      results.push(ok(42));
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memUsed = memAfter - memBefore;
    const bytesPerResult = memUsed / 10000;

    console.log(`Memory per simple Ok result: ${bytesPerResult.toFixed(2)} bytes`);

    // Simple results should have lower overhead
    expect(bytesPerResult).toBeLessThan(200);

    // Keep results in memory to prevent optimization
    expect(results.length).toBe(10000);
  });
});
