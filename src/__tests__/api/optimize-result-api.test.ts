/**
 * Tests for optimize() API with Result-based error handling
 *
 * This test suite verifies that optimize() returns Result<Code[], RegraffError>
 * instead of throwing errors.
 */

import { describe, test, expect } from 'vitest';
import { optimize, type FileInput, isOk } from '../../index.js';

describe('optimize() Result-based error handling', () => {
  test('returns Ok result with optimized code on success', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: `
function Parent() {
  const value = 'test';
  return <Child value={value} />;
}

function Child({ value }: { value: string }) {
  return <div>{value}</div>;
}
        `.trim(),
      },
    ];

    const result = optimize(files);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value.length).toBeGreaterThan(0);
      expect(result.value[0]).toHaveProperty('file');
      expect(result.value[0]).toHaveProperty('content');
      expect(result.value[0]).toHaveProperty('changed');
    }
  });

  test('returns Ok result for files with parse errors (graceful handling)', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: 'invalid JSX syntax <<>>',
      },
    ];

    // The optimizer gracefully handles parse errors by returning result
    const result = optimize(files);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  test('returns Ok result for empty files array', () => {
    const result = optimize([]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(0);
    }
  });

  test('returns Ok result when no optimizations needed', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: `
function App() {
  return <div>Hello World</div>;
}
        `.trim(),
      },
    ];

    const result = optimize(files);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
    }
  });

  test('returns Ok result with optimization options', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: `
function Parent() {
  const value = 'test';
  return <Child value={value} />;
}

function Child({ value }: { value: string }) {
  return <div>{value}</div>;
}
        `.trim(),
      },
    ];

    const result = optimize(files, { dryRun: true });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toHaveProperty('content');
    }
  });
});
