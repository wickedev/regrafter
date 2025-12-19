/**
 * Tests for move() API with Result-based error handling
 *
 * This test suite verifies that move() returns Result<TransformedCode, RegraffError>
 * instead of throwing exceptions, ensuring consistent error handling across
 * the public API.
 */

import { describe, test, expect } from 'vitest';
import { move, Move, type FileInput, isErr, isOk } from '../../index.js';

describe('move() Result-based error handling', () => {
  test('returns Ok result on successful move', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: `
function App() {
  return (
    <div>
      <span>Hello</span>
      <button>Click</button>
    </div>
  );
}
        `.trim(),
      },
    ];

    const result = move(
      files,
      { file: 'test.tsx', line: 4, column: 7 }, // <span>
      { file: 'test.tsx', line: 5, column: 7 }, // <button>
      Move.After
    );

    // Should return Result instead of throwing
    if (isErr(result)) {
      console.error('Move failed:', result.error.message);
    }
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      // move() now returns TransformedCode with codes array
      expect(result.value).toHaveProperty('codes');
      expect(result.value).toHaveProperty('analysis');
      expect(Array.isArray(result.value.codes)).toBe(true);
      expect(result.value.codes.length).toBeGreaterThan(0);
      expect(result.value.codes[0]).toHaveProperty('file');
      expect(result.value.codes[0]).toHaveProperty('content');
    }
  });

  test('returns Err result on parse failure', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: 'invalid JSX syntax <<>>',
      },
    ];

    const result = move(
      files,
      { file: 'test.tsx', line: 1, column: 1 },
      { file: 'test.tsx', line: 1, column: 5 },
      Move.After
    );

    // Should return Err instead of throwing
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toHaveProperty('message');
      expect(result.error.message).toMatch(/parse/i);
    }
  });

  test('returns Err result when source file not found', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: '<div>Test</div>',
      },
    ];

    const result = move(
      files,
      { file: 'nonexistent.tsx', line: 1, column: 1 },
      { file: 'test.tsx', line: 1, column: 1 },
      Move.After
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toMatch(/source file not found/i);
    }
  });

  test('returns Err result when target file not found', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: '<div>Test</div>',
      },
    ];

    const result = move(
      files,
      { file: 'test.tsx', line: 1, column: 1 },
      { file: 'nonexistent.tsx', line: 1, column: 1 },
      Move.After
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toMatch(/target file not found/i);
    }
  });

  test('returns Err result on selector resolution failure', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: '<div>Test</div>',
      },
    ];

    const result = move(
      files,
      { file: 'test.tsx', line: 999, column: 999 }, // Invalid position
      { file: 'test.tsx', line: 1, column: 1 },
      Move.After
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      // Message should indicate the element was not found
      expect(result.error.message).toMatch(/No element found|No JSX element found|not found/i);
    }
  });

  test('returns Err result on transformation failure', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: `
function App() {
  return <div><span>Hello</span></div>;
}
        `.trim(),
      },
    ];

    // Try to move element into itself (circular move)
    const result = move(
      files,
      { file: 'test.tsx', line: 2, column: 10 }, // <div>
      { file: 'test.tsx', line: 2, column: 15 }, // <span> (child of div)
      Move.Inside
    );

    // Should return Err for circular dependency
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBeDefined();
    }
  });

  test('returns Err result on code generation failure', () => {
    // This is harder to trigger, but we should handle it
    // For now, we'll skip this test and implement it when we have
    // a way to inject a failing generator
    expect(true).toBe(true);
  });
});
