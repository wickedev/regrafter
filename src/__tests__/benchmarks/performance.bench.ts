/**
 * Performance Benchmarks
 *
 * Tests performance requirements from requirements.md:
 * - Requirement 12.1: Single file < 1000 lines: P95 < 100ms
 * - Requirement 12.2: Multi-file 10 files: P95 < 500ms
 * - Requirement 12.3: canMove < 20% of full operation time
 */

import { bench, describe } from 'vitest';
import { regraft, canMove, Move } from '../../index.js';
import type { FileInput } from '../../types/index.js';

/**
 * Generate a React component with specified number of lines
 *
 * Creates a realistic React component with:
 * - Import statements
 * - State hooks (1 per 10 lines)
 * - JSX elements (1 per 5 lines)
 *
 * @param lines Target number of lines for the component
 * @returns Generated React component source code
 */
function generateReactComponent(lines: number): string {
  const imports = `import React, { useState, useEffect } from 'react';\n\n`;

  const componentStart = `export function Component() {\n`;

  // Add hooks (1 hook per 10 lines)
  const hookCount = Math.floor(lines / 10);
  const hooks = Array.from({ length: hookCount }, (_, i) =>
    `  const [state${i}, setState${i}] = useState(0);\n`
  ).join('');

  // Add JSX elements (1 element per 5 lines)
  const elementCount = Math.floor(lines / 5);
  const elements = Array.from({ length: elementCount }, (_, i) =>
    `    <div key={${i}}>Element {state0 + ${i}}</div>\n`
  ).join('');

  const componentEnd = `  return (\n    <div>\n${elements}    </div>\n  );\n}\n`;

  return imports + componentStart + hooks + componentEnd;
}

/**
 * Create a FileInput for benchmarking
 */
function createFileInput(lines: number, index: number = 0): FileInput {
  return {
    path: `Component${index}.tsx`,
    content: generateReactComponent(lines),
  };
}

// =============================================================================
// Requirement 12.1: Single File Operations < 100ms (P95)
// =============================================================================

describe('Performance Benchmarks - Single File', () => {
  bench('regraft - 500 lines', () => {
    const file = createFileInput(500);
    regraft(
      [file],
      { file: 'Component0.tsx', line: 10, column: 5 },
      { file: 'Component0.tsx', line: 20, column: 5 },
      Move.Inside
    );
  });

  bench('regraft - 1000 lines', () => {
    const file = createFileInput(1000);
    regraft(
      [file],
      { file: 'Component0.tsx', line: 10, column: 5 },
      { file: 'Component0.tsx', line: 50, column: 5 },
      Move.Inside
    );
  });

  bench('canMove - 1000 lines', () => {
    const file = createFileInput(1000);
    canMove(
      [file],
      { file: 'Component0.tsx', line: 10, column: 5 },
      { file: 'Component0.tsx', line: 50, column: 5 },
      Move.Inside
    );
  });
});

// =============================================================================
// Requirement 12.2: Multi-File Operations < 500ms (P95)
// =============================================================================

describe('Performance Benchmarks - Multi-File', () => {
  bench('regraft - 10 files, 1000 lines each', () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      createFileInput(1000, i)
    );

    regraft(
      files,
      { file: 'Component0.tsx', line: 10, column: 5 },
      { file: 'Component0.tsx', line: 50, column: 5 },
      Move.Inside
    );
  });

  bench('regraft - 10 files, cross-file move', () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      createFileInput(1000, i)
    );

    regraft(
      files,
      { file: 'Component0.tsx', line: 10, column: 5 },
      { file: 'Component1.tsx', line: 20, column: 5 },
      Move.Inside
    );
  });
});

// =============================================================================
// Requirement 12.3: canMove Relative Cost < 20% of full operation
// =============================================================================

describe('Performance Benchmarks - canMove vs Full Operation', () => {
  const file = createFileInput(1000);
  const from = { file: 'Component0.tsx', line: 10, column: 5 };
  const to = { file: 'Component0.tsx', line: 50, column: 5 };

  bench('canMove only', () => {
    canMove([file], from, to, Move.Inside);
  });

  bench('full regraft', () => {
    regraft([file], from, to, Move.Inside);
  });
});

// =============================================================================
// Additional Benchmarks - Different Move Modes
// =============================================================================

describe('Performance Benchmarks - Move Modes', () => {
  const file = createFileInput(1000);

  bench('Move.Before - 1000 lines', () => {
    regraft(
      [file],
      { file: 'Component0.tsx', line: 20, column: 5 },
      { file: 'Component0.tsx', line: 10, column: 5 },
      Move.Before
    );
  });

  bench('Move.After - 1000 lines', () => {
    regraft(
      [file],
      { file: 'Component0.tsx', line: 10, column: 5 },
      { file: 'Component0.tsx', line: 20, column: 5 },
      Move.After
    );
  });

  bench('Move.Inside - 1000 lines', () => {
    regraft(
      [file],
      { file: 'Component0.tsx', line: 10, column: 5 },
      { file: 'Component0.tsx', line: 20, column: 5 },
      Move.Inside
    );
  });
});
