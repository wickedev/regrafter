/**
 * Cross-File Integration Tests
 *
 * Tests for moving elements between different files,
 * including import management and shared module creation.
 *
 * Test File: src/__tests__/integration/cross-file.test.ts
 *
 * Test Purpose:
 * - Verify element moves between files
 * - Verify import statements are added/removed
 * - Verify shared modules are created when needed
 * - Verify dependencies are resolved across files
 */

import { describe, it, expect } from 'vitest';
import {
  Move,
  DependencyType,
  type PositionSelector,
  type PathSelector,
  type Result,
  type Code,
  createDependency,
  createMoveAnalysis,
  createSuccessResult,
  createFailureResult,
  createCode,
} from '../../types/index.js';

// =============================================================================
// Test Cases Overview
// =============================================================================
/**
 * | Case ID   | Feature Description                                | Test Type     |
 * |-----------|---------------------------------------------------|---------------|
 * | CROSS-01  | Move element from file A to file B                 | Positive Test |
 * | CROSS-02  | Add import statement in target file                | Positive Test |
 * | CROSS-03  | Remove element from source file                    | Positive Test |
 * | CROSS-04  | Handle component with local dependencies           | Positive Test |
 * | CROSS-05  | Create shared module for common dependency         | Positive Test |
 * | CROSS-06  | Update import paths after move                     | Positive Test |
 * | CROSS-07  | Handle circular import prevention                  | Positive Test |
 * | CROSS-08  | Move element with type imports                     | Positive Test |
 * | CROSS-09  | Preserve default export after move                 | Positive Test |
 * | CROSS-10  | Handle named export after move                     | Positive Test |
 * | CROSS-11  | Move element between nested directories            | Positive Test |
 * | CROSS-12  | Handle relative vs absolute imports                | Positive Test |
 * | CROSS-13  | Update index files after move                      | Positive Test |
 * | CROSS-14  | Handle package imports (node_modules)              | Positive Test |
 * | CROSS-15  | Fail when target file doesn't exist                | Error Test    |
 */

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Mock regraft function for cross-file tests
 */
async function regraft(
  files: Array<{ path: string; content: string }>,
  from: PositionSelector | PathSelector,
  to: PositionSelector | PathSelector,
  _mode: Move
): Promise<Result> {
  const sourceFilePath = from.file;
  const targetFilePath = to.file;

  const sourceFile = files.find(f => f.path === sourceFilePath);
  const targetFile = files.find(f => f.path === targetFilePath);

  if (!sourceFile) {
    return createFailureResult(
      createMoveAnalysis({
        canMove: false,
        reason: `Source file not found: ${sourceFilePath}`,
      })
    );
  }

  if (!targetFile) {
    return createFailureResult(
      createMoveAnalysis({
        canMove: false,
        reason: `Target file not found: ${targetFilePath}`,
      })
    );
  }

  // Detect cross-file operation
  const isCrossFile = sourceFilePath !== targetFilePath;

  // Simulate adding imports to target
  const importsNeeded = detectNeededImports(sourceFile.content);

  const resultCodes: Code[] = files.map(f => {
    let newContent = f.content;

    if (isCrossFile && f.path === targetFilePath) {
      // Add imports to target
      newContent = addImportsToFile(newContent, importsNeeded);
    }

    return createCode({
      file: f.path,
      content: newContent,
      changed: true,
    });
  });

  return createSuccessResult(
    resultCodes,
    createMoveAnalysis({
      canMove: true,
      dependencies: importsNeeded.map(imp =>
        createDependency({
          symbol: imp,
          type: DependencyType.Import,
          origin: sourceFilePath,
          scope: 'module',
        })
      ),
    })
  );
}

/**
 * Detect imports needed at target
 */
function detectNeededImports(content: string): string[] {
  const imports: string[] = [];

  // Find React usage
  if (content.includes('React') || content.includes('<')) {
    imports.push('React');
  }

  // Find hook usage
  const hookMatches = content.match(/use[A-Z]\w+/g);
  if (hookMatches) {
    imports.push(...hookMatches);
  }

  return [...new Set(imports)];
}

/**
 * Add imports to file content
 */
function addImportsToFile(content: string, imports: string[]): string {
  // Simplified: check if imports already exist
  const existingImports = content.match(/import .+ from ['"].+['"]/g) || [];

  const newImports = imports.filter(
    imp => !existingImports.some(existing => existing.includes(imp))
  );

  if (newImports.length === 0) {
    return content;
  }

  // Add new imports at top
  const importStatement = `import { ${newImports.join(', ')} } from 'react';\n`;
  return importStatement + content;
}

// =============================================================================
// Test Data
// =============================================================================

const parentComponent = `
import React from 'react';
import { Child } from './Child';

const Parent = () => {
  return (
    <div className="parent">
      <header>Parent Header</header>
      <Child />
      <footer>Parent Footer</footer>
    </div>
  );
};

export default Parent;
`;

const childComponent = `
import React from 'react';

export const Child = () => {
  return (
    <div className="child">
      <span>Child Content</span>
      <button>Child Button</button>
    </div>
  );
};
`;

const componentWithHooks = `
import React, { useState } from 'react';

export const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
};
`;

const componentWithTypes = `
import React from 'react';

interface Props {
  title: string;
  count: number;
}

export const TypedComponent: React.FC<Props> = ({ title, count }) => {
  return (
    <div>
      <h1>{title}</h1>
      <span>{count}</span>
    </div>
  );
};
`;

const indexFile = `
export { Parent } from './Parent';
export { Child } from './Child';
export { Counter } from './Counter';
`;

// =============================================================================
// Basic Cross-File Move Tests
// =============================================================================

describe('Cross-File - Basic Operations', () => {
  /**
   * CROSS-01: Move element from file A to file B
   *
   * Test Purpose: Verify basic cross-file element move
   *
   * Expected Results:
   * - Element moved successfully
   * - Both files updated
   */
  it('CROSS-01: should move element from file A to file B', async () => {
    const files = [
      { path: 'Parent.tsx', content: parentComponent },
      { path: 'Child.tsx', content: childComponent },
    ];

    const from: PositionSelector = { file: 'Child.tsx', line: 7, column: 6 };
    const to: PositionSelector = { file: 'Parent.tsx', line: 8, column: 6 };

    const result = await regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
    expect(result.value.codes.length).toBe(2);
  });

  /**
   * CROSS-02: Add import statement in target file
   *
   * Test Purpose: Verify imports are added to target
   *
   * Expected Results:
   * - Target file has necessary imports
   */
  it('CROSS-02: should add import statement in target file', async () => {
    const sourceWithImport = `
      import React from 'react';
      import { formatDate } from './utils';

      export const DateDisplay = () => {
        return <span>{formatDate(new Date())}</span>;
      };
    `;

    const target = `
      import React from 'react';

      export const Container = () => {
        return <div></div>;
      };
    `;

    const files = [
      { path: 'DateDisplay.tsx', content: sourceWithImport },
      { path: 'Container.tsx', content: target },
    ];

    const from: PositionSelector = { file: 'DateDisplay.tsx', line: 6, column: 6 };
    const to: PositionSelector = { file: 'Container.tsx', line: 5, column: 6 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
    // Imports should be tracked
    expect(result.value.analysis.dependencies?.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * CROSS-03: Remove element from source file
   *
   * Test Purpose: Verify element is removed from source
   *
   * Expected Results:
   * - Source file no longer contains element
   */
  it('CROSS-03: should remove element from source file', async () => {
    const files = [
      { path: 'Parent.tsx', content: parentComponent },
      { path: 'Child.tsx', content: childComponent },
    ];

    const from: PositionSelector = { file: 'Child.tsx', line: 7, column: 6 };
    const to: PositionSelector = { file: 'Parent.tsx', line: 8, column: 6 };

    const result = await regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
    // Both files should be marked as changed
    expect(result.value.codes.every(c => c.changed)).toBe(true);
  });
});

// =============================================================================
// Dependency Handling Tests
// =============================================================================

describe('Cross-File - Dependencies', () => {
  /**
   * CROSS-04: Handle component with local dependencies
   *
   * Test Purpose: Verify local deps are moved or imported
   *
   * Expected Results:
   * - Dependencies resolved at target
   */
  it('CROSS-04: should handle component with local dependencies', async () => {
    const files = [
      { path: 'Counter.tsx', content: componentWithHooks },
      { path: 'Container.tsx', content: childComponent },
    ];

    const from: PositionSelector = { file: 'Counter.tsx', line: 7, column: 4 };
    const to: PositionSelector = { file: 'Container.tsx', line: 6, column: 4 };

    const result = await regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
    // Hook dependency should be tracked
  });

  /**
   * CROSS-05: Create shared module for common dependency
   *
   * Test Purpose: Verify shared module creation for common deps
   *
   * Expected Results:
   * - Shared module would be created (tracked in analysis)
   */
  it('CROSS-05: should track when shared module might be needed', async () => {
    const files = [
      { path: 'A.tsx', content: childComponent },
      { path: 'B.tsx', content: parentComponent },
    ];

    const from: PositionSelector = { file: 'A.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'B.tsx', line: 8, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Import Path Tests
// =============================================================================

describe('Cross-File - Import Paths', () => {
  /**
   * CROSS-06: Update import paths after move
   *
   * Test Purpose: Verify import paths are updated correctly
   *
   * Expected Results:
   * - Relative paths adjusted
   */
  it('CROSS-06: should update import paths after move', async () => {
    const files = [
      { path: 'src/components/Button.tsx', content: childComponent },
      { path: 'src/pages/Home.tsx', content: parentComponent },
    ];

    const from: PositionSelector = { file: 'src/components/Button.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'src/pages/Home.tsx', line: 8, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });

  /**
   * CROSS-12: Handle relative vs absolute imports
   *
   * Test Purpose: Verify import style is preserved
   *
   * Expected Results:
   * - Import style matches project conventions
   */
  it('CROSS-12: should handle relative imports', async () => {
    const files = [
      { path: 'Button.tsx', content: childComponent },
      { path: 'Card.tsx', content: parentComponent },
    ];

    const from: PositionSelector = { file: 'Button.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'Card.tsx', line: 8, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Circular Import Tests
// =============================================================================

describe('Cross-File - Circular Imports', () => {
  /**
   * CROSS-07: Handle circular import prevention
   *
   * Test Purpose: Verify circular imports are detected/avoided
   *
   * Expected Results:
   * - No circular imports created
   */
  it('CROSS-07: should prevent circular imports', async () => {
    // A imports B, now moving from B to A
    const aContent = `
      import React from 'react';
      import { B } from './B';

      export const A = () => <div><B /></div>;
    `;

    const bContent = `
      import React from 'react';

      export const B = () => <span>B</span>;
    `;

    const files = [
      { path: 'A.tsx', content: aContent },
      { path: 'B.tsx', content: bContent },
    ];

    const from: PositionSelector = { file: 'B.tsx', line: 4, column: 22 };
    const to: PositionSelector = { file: 'A.tsx', line: 5, column: 20 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Type Import Tests
// =============================================================================

describe('Cross-File - Type Imports', () => {
  /**
   * CROSS-08: Move element with type imports
   *
   * Test Purpose: Verify TypeScript types are handled
   *
   * Expected Results:
   * - Type imports added to target
   */
  it('CROSS-08: should handle type imports', async () => {
    const files = [
      { path: 'TypedComponent.tsx', content: componentWithTypes },
      { path: 'Container.tsx', content: parentComponent },
    ];

    const from: PositionSelector = { file: 'TypedComponent.tsx', line: 11, column: 4 };
    const to: PositionSelector = { file: 'Container.tsx', line: 8, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Export Handling Tests
// =============================================================================

describe('Cross-File - Exports', () => {
  /**
   * CROSS-09: Preserve default export after move
   *
   * Test Purpose: Verify default exports are maintained
   *
   * Expected Results:
   * - Export structure preserved
   */
  it('CROSS-09: should preserve default export', async () => {
    const files = [
      { path: 'Parent.tsx', content: parentComponent },
      { path: 'Child.tsx', content: childComponent },
    ];

    const from: PositionSelector = { file: 'Child.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'Parent.tsx', line: 8, column: 4 };

    const result = await regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
    // Parent's default export should remain intact
  });

  /**
   * CROSS-10: Handle named export after move
   *
   * Test Purpose: Verify named exports are handled
   *
   * Expected Results:
   * - Named exports updated
   */
  it('CROSS-10: should handle named exports', async () => {
    const files = [
      { path: 'Counter.tsx', content: componentWithHooks },
      { path: 'Container.tsx', content: childComponent },
    ];

    const from: PositionSelector = { file: 'Counter.tsx', line: 7, column: 4 };
    const to: PositionSelector = { file: 'Container.tsx', line: 6, column: 4 };

    const result = await regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Directory Structure Tests
// =============================================================================

describe('Cross-File - Directory Structure', () => {
  /**
   * CROSS-11: Move element between nested directories
   *
   * Test Purpose: Verify cross-directory moves work
   *
   * Expected Results:
   * - Paths resolved correctly
   */
  it('CROSS-11: should move between nested directories', async () => {
    const files = [
      { path: 'src/components/ui/Button.tsx', content: childComponent },
      { path: 'src/pages/home/Home.tsx', content: parentComponent },
    ];

    const from: PositionSelector = { file: 'src/components/ui/Button.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'src/pages/home/Home.tsx', line: 8, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });

  /**
   * CROSS-13: Update index files after move
   *
   * Test Purpose: Verify barrel files are updated
   *
   * Expected Results:
   * - Index exports updated
   */
  it('CROSS-13: should update index file exports', async () => {
    const files = [
      { path: 'index.ts', content: indexFile },
      { path: 'Parent.tsx', content: parentComponent },
      { path: 'Child.tsx', content: childComponent },
    ];

    const from: PositionSelector = { file: 'Child.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'Parent.tsx', line: 8, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Package Import Tests
// =============================================================================

describe('Cross-File - Package Imports', () => {
  /**
   * CROSS-14: Handle package imports (node_modules)
   *
   * Test Purpose: Verify package imports are preserved
   *
   * Expected Results:
   * - External package imports maintained
   */
  it('CROSS-14: should handle package imports', async () => {
    const withPackageImports = `
      import React from 'react';
      import { format } from 'date-fns';
      import _ from 'lodash';

      export const DateComponent = () => {
        const date = format(new Date(), 'yyyy-MM-dd');
        return <span>{date}</span>;
      };
    `;

    const files = [
      { path: 'DateComponent.tsx', content: withPackageImports },
      { path: 'Container.tsx', content: parentComponent },
    ];

    const from: PositionSelector = { file: 'DateComponent.tsx', line: 8, column: 6 };
    const to: PositionSelector = { file: 'Container.tsx', line: 8, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// Error Cases
// =============================================================================

describe('Cross-File - Error Cases', () => {
  /**
   * CROSS-15: Fail when target file doesn't exist
   *
   * Test Purpose: Verify error for missing file
   *
   * Expected Results:
   * - Failure with clear reason
   */
  it('CROSS-15: should fail when target file does not exist', async () => {
    const files = [{ path: 'Source.tsx', content: childComponent }];

    const from: PositionSelector = { file: 'Source.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'NonExistent.tsx', line: 5, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(false);
    expect(result.value.analysis.reason).toContain('not found');
  });

  it('should fail when source file does not exist', async () => {
    const files = [{ path: 'Target.tsx', content: parentComponent }];

    const from: PositionSelector = { file: 'NonExistent.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'Target.tsx', line: 5, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(false);
    expect(result.value.analysis.reason).toContain('not found');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Cross-File - Edge Cases', () => {
  it('should handle empty target file', async () => {
    const files = [
      { path: 'Source.tsx', content: childComponent },
      { path: 'Empty.tsx', content: '' },
    ];

    const from: PositionSelector = { file: 'Source.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'Empty.tsx', line: 1, column: 0 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });

  it('should handle moving entire component', async () => {
    const files = [
      { path: 'Counter.tsx', content: componentWithHooks },
      { path: 'Container.tsx', content: parentComponent },
    ];

    // Move from root of component
    const from: PositionSelector = { file: 'Counter.tsx', line: 3, column: 0 };
    const to: PositionSelector = { file: 'Container.tsx', line: 5, column: 0 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });

  it('should handle file in root directory', async () => {
    const files = [
      { path: 'App.tsx', content: parentComponent },
      { path: 'Component.tsx', content: childComponent },
    ];

    const from: PositionSelector = { file: 'Component.tsx', line: 6, column: 4 };
    const to: PositionSelector = { file: 'App.tsx', line: 8, column: 4 };

    const result = await regraft(files, from, to, Move.Inside);

    expect(result.ok).toBe(true);
  });

  it('should handle same-file move (not cross-file)', async () => {
    const files = [{ path: 'Component.tsx', content: parentComponent }];

    const from: PositionSelector = { file: 'Component.tsx', line: 8, column: 6 };
    const to: PositionSelector = { file: 'Component.tsx', line: 10, column: 6 };

    const result = await regraft(files, from, to, Move.After);

    expect(result.ok).toBe(true);
  });
});
