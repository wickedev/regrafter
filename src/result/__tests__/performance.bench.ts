/**
 * Result Type Performance Benchmarks
 *
 * Tests performance requirements from design.md:
 * - Result creation (ok/err) < 1μs
 * - map/flatMap operations < 2μs
 * - No significant end-to-end performance degradation vs try-catch
 * - Memory overhead < 100 bytes per Result
 *
 * These benchmarks verify that the Result type system has minimal overhead
 * compared to exception-based error handling.
 */

import { bench, describe } from 'vitest';
import { ok, err, map, flatMap, mapErr, tryCatch } from '../index.js';

// =============================================================================
// Benchmark 1: Result Creation Performance
// Target: < 1μs (1000 nanoseconds) per operation
// =============================================================================

describe('Result Creation Performance', () => {
  bench('ok() constructor', () => {
    ok(42);
  });

  bench('err() constructor', () => {
    err('error message');
  });

  bench('ok() with object', () => {
    ok({ id: 1, name: 'test', value: 42 });
  });

  bench('err() with object', () => {
    err({ code: 'E001', message: 'error', context: { file: 'test.ts' } });
  });
});

// =============================================================================
// Benchmark 2: Mapping Operations Performance
// Target: < 2μs (2000 nanoseconds) per operation
// =============================================================================

describe('Mapping Operations Performance', () => {
  const okValue = ok(42);
  const errValue = err('error');

  bench('map() on Ok', () => {
    map(okValue, (x) => x * 2);
  });

  bench('map() on Err (passthrough)', () => {
    map(errValue, (x) => x * 2);
  });

  bench('flatMap() on Ok', () => {
    flatMap(okValue, (x) => ok(x * 2));
  });

  bench('flatMap() on Err (passthrough)', () => {
    flatMap(errValue, (x) => ok(x * 2));
  });

  bench('mapErr() on Ok (passthrough)', () => {
    mapErr(okValue, (e) => `Error: ${e}`);
  });

  bench('mapErr() on Err', () => {
    mapErr(errValue, (e) => `Error: ${e}`);
  });
});

// =============================================================================
// Benchmark 3: Chained Operations Performance
// =============================================================================

describe('Chained Operations Performance', () => {
  bench('map chain (3 operations)', () => {
    const result = ok(10);
    const step1 = map(result, (x) => x * 2);
    const step2 = map(step1, (x) => x + 5);
    const step3 = map(step2, (x) => x / 3);
    return step3;
  });

  bench('flatMap chain (3 operations)', () => {
    const result = ok(10);
    const step1 = flatMap(result, (x) => ok(x * 2));
    const step2 = flatMap(step1, (x) => ok(x + 5));
    const step3 = flatMap(step2, (x) => ok(x / 3));
    return step3;
  });

  bench('mixed chain (map + flatMap + mapErr)', () => {
    const result = ok(10);
    const step1 = map(result, (x) => x * 2);
    const step2 = flatMap(step1, (x) => (x > 15 ? ok(x) : err('too small')));
    const step3 = mapErr(step2, (e) => `Error: ${e}`);
    return step3;
  });
});

// =============================================================================
// Benchmark 4: End-to-End Pipeline Comparison
// Compare Result-based code vs try-catch baseline
// Target: No significant performance degradation (within 2x)
// =============================================================================

describe('End-to-End Pipeline - Result vs Try-Catch', () => {
  // Simulate a realistic parsing pipeline

  // Result-based implementation
  function parseNumberResult(input: string): Result<number, string> {
    const num = Number(input);
    if (isNaN(num)) {
      return err(`Invalid number: ${input}`);
    }
    return ok(num);
  }

  function validateRangeResult(num: number): Result<number, string> {
    if (num < 0 || num > 100) {
      return err(`Number out of range: ${num}`);
    }
    return ok(num);
  }

  function processResult(input: string): Result<number, string> {
    return flatMap(parseNumberResult(input), (num) =>
      flatMap(validateRangeResult(num), (validated) => ok(validated * 2))
    );
  }

  // Try-catch based implementation
  function parseNumberThrows(input: string): number {
    const num = Number(input);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${input}`);
    }
    return num;
  }

  function validateRangeThrows(num: number): number {
    if (num < 0 || num > 100) {
      throw new Error(`Number out of range: ${num}`);
    }
    return num;
  }

  function processThrows(input: string): number {
    try {
      const num = parseNumberThrows(input);
      const validated = validateRangeThrows(num);
      return validated * 2;
    } catch (e) {
      throw e;
    }
  }

  // Benchmark success path
  bench('Result-based pipeline (success path)', () => {
    processResult('42');
  });

  bench('Try-catch pipeline (success path)', () => {
    processThrows('42');
  });

  // Benchmark error path
  bench('Result-based pipeline (error path)', () => {
    processResult('invalid');
  });

  bench('Try-catch pipeline (error path)', () => {
    try {
      processThrows('invalid');
    } catch {
      // Catch and ignore
    }
  });

  // Benchmark tryCatch wrapper
  bench('tryCatch wrapper', () => {
    tryCatch(() => JSON.parse('{"valid": true}'));
  });

  bench('raw try-catch', () => {
    try {
      JSON.parse('{"valid": true}');
    } catch {
      // Catch and ignore
    }
  });
});

// =============================================================================
// Benchmark 5: Stress Test - High Volume Operations
// Note: Memory overhead tests are in memory.test.ts
// =============================================================================

describe('Stress Test - High Volume', () => {
  bench('10,000 ok() creations', () => {
    for (let i = 0; i < 10000; i++) {
      ok(i);
    }
  });

  bench('10,000 map() operations', () => {
    const result = ok(42);
    for (let i = 0; i < 10000; i++) {
      map(result, (x) => x + 1);
    }
  });

  bench('10,000 flatMap() operations', () => {
    const result = ok(42);
    for (let i = 0; i < 10000; i++) {
      flatMap(result, (x) => ok(x + 1));
    }
  });

  bench('1,000 chained operations', () => {
    let result: Result<number, string> = ok(0);
    for (let i = 0; i < 1000; i++) {
      result = map(result, (x) => x + 1);
    }
    return result;
  });
});
