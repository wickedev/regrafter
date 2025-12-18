/**
 * Tests for analyze() API with Result-based error handling
 *
 * This test suite verifies that analyze() returns Result<MoveAnalysis, RegraffError>
 * instead of returning MoveAnalysis with canMove: false for errors.
 */

import { describe, test, expect } from 'vitest';
import { analyze, Move, type FileInput, isErr, isOk } from '../../index.js';

describe('analyze() Result-based error handling', () => {
  test('returns Ok result with analysis on successful analysis', () => {
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

    const result = analyze(
      files,
      { file: 'test.tsx', line: 4, column: 7 }, // <span>
      { file: 'test.tsx', line: 5, column: 7 }, // <button>
      Move.After
    );

    // Should return Result instead of MoveAnalysis with canMove field
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const analysis = result.value;
      expect(analysis).toHaveProperty('dependencies');
      expect(analysis).toHaveProperty('hoistedDeps');
      expect(analysis).toHaveProperty('stats');
      expect(Array.isArray(analysis.dependencies)).toBe(true);
    }
  });

  test('returns Err result on parse failure', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: 'invalid JSX syntax <<>>',
      },
    ];

    const result = analyze(
      files,
      { file: 'test.tsx', line: 1, column: 1 },
      { file: 'test.tsx', line: 1, column: 5 },
      Move.After
    );

    // Should return Err instead of MoveAnalysis with canMove: false
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

    const result = analyze(
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

  test('returns Err result on selector resolution failure', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: '<div>Test</div>',
      },
    ];

    const result = analyze(
      files,
      { file: 'test.tsx', line: 999, column: 999 }, // Invalid position
      { file: 'test.tsx', line: 1, column: 1 },
      Move.After
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toMatch(/No element found|not found/i);
    }
  });

  test('returns Err result on validation failure', () => {
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

    // Try to analyze moving element into itself (circular)
    const result = analyze(
      files,
      { file: 'test.tsx', line: 2, column: 10 }, // <div>
      { file: 'test.tsx', line: 2, column: 15 }, // <span> (child of div)
      Move.Inside
    );

    // Should return Err for invalid move
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toBeDefined();
    }
  });

  test('returns Ok with dependency analysis for elements with dependencies', () => {
    const files: FileInput[] = [
      {
        path: 'test.tsx',
        content: `
function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>Click</button>
    </div>
  );
}
        `.trim(),
      },
    ];

    const result = analyze(
      files,
      { file: 'test.tsx', line: 5, column: 7 }, // <span>
      { file: 'test.tsx', line: 6, column: 7 }, // <button>
      Move.After
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const analysis = result.value;
      // Should have detected useState dependency
      expect(analysis.dependencies).toBeDefined();
      expect(analysis.stats).toBeDefined();
    }
  });
});
