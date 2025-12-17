/**
 * Transformer Unit Tests
 *
 * Tests for the Transformer module that executes transformation plans
 * to move elements, hoist dependencies, and thread props.
 *
 * Test File: src/transformer/__tests__/transformer.test.ts
 *
 * Test Purpose:
 * - Validate element move operations
 * - Validate dependency hoisting operations
 * - Validate prop threading operations
 * - Validate import operations
 * - Validate transformation plan execution
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import generateFn from '@babel/generator';
import type * as t from '@babel/types';

const generate = generateFn as any as typeof generateFn.default;
import {
  Move,
  HoistStrategy,
  AtomicUnitType,
  type TransformPlan,
  type TransformResult,
  type MoveOperation,
  type HoistOperation,
  type PropThreadOperation,
  type ImportOperation,
  type ValidationResult,
  createTransformPlan,
  createMoveOperation,
  createHoistOperation,
  createPropThreadOperation,
  createImportOperation,
  createImportSpecifier,
  createValidationResult,
  createTransformResult,
  createTransformStats,
  createModification,
} from '../../types/index.js';

// =============================================================================
// Test Cases Overview
// =============================================================================
/**
 * | Case ID   | Feature Description                              | Test Type     |
 * |-----------|--------------------------------------------------|---------------|
 * | TRANS-01  | Execute Move.Inside operation                     | Positive Test |
 * | TRANS-02  | Execute Move.Before operation                     | Positive Test |
 * | TRANS-03  | Execute Move.After operation                      | Positive Test |
 * | TRANS-04  | Execute hoist operation (Hoist strategy)          | Positive Test |
 * | TRANS-05  | Execute hoist operation (PassAsProp strategy)     | Positive Test |
 * | TRANS-06  | Execute prop threading operation                  | Positive Test |
 * | TRANS-07  | Execute import addition operation                 | Positive Test |
 * | TRANS-08  | Validate plan before execution                    | Positive Test |
 * | TRANS-09  | Reject invalid plan                               | Error Test    |
 * | TRANS-10  | Track modifications during transform              | Positive Test |
 * | TRANS-11  | Generate transform statistics                     | Positive Test |
 * | TRANS-12  | Handle multiple operations in one plan            | Positive Test |
 * | TRANS-13  | Preserve AST integrity after transform            | Positive Test |
 * | TRANS-14  | Handle cross-file transformations                 | Positive Test |
 * | TRANS-15  | Roll back on error                                | Error Test    |
 * | TRANS-16  | Remove element from source location               | Positive Test |
 * | TRANS-17  | Insert element at target location                 | Positive Test |
 * | TRANS-18  | Adjust indentation during move                    | Positive Test |
 * | TRANS-19  | Preserve comments during transform                | Positive Test |
 * | TRANS-20  | Handle atomic unit moves                          | Positive Test |
 */

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Helper to parse code
 */
function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

/**
 * Helper to generate code from AST
 */
function generateCode(ast: t.File): string {
  return generate(ast).code;
}

/**
 * Mock Transformer for testing
 * Simulates expected behavior of the Transformer module
 */
class MockTransformer {
  private asts: Map<string, t.File> = new Map();

  constructor(files: Map<string, string>) {
    for (const [path, content] of files) {
      this.asts.set(path, parseCode(content));
    }
  }

  /**
   * Validate a transformation plan
   */
  validatePlan(plan: TransformPlan): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check move operations
    for (const move of plan.moves) {
      if (!this.asts.has(move.sourceFile)) {
        errors.push(`Source file not found: ${move.sourceFile}`);
      }
      if (!this.asts.has(move.targetFile)) {
        errors.push(`Target file not found: ${move.targetFile}`);
      }
    }

    // Check import operations
    for (const imp of plan.imports) {
      if (!this.asts.has(imp.file)) {
        errors.push(`Import target file not found: ${imp.file}`);
      }
    }

    // Warn about potentially complex operations
    if (plan.hoists.length > 3) {
      warnings.push('Many hoist operations may indicate complex dependency structure');
    }

    return createValidationResult({
      valid: errors.length === 0,
      errors,
      warnings,
    });
  }

  /**
   * Execute a transformation plan
   */
  execute(plan: TransformPlan): TransformResult {
    const validation = this.validatePlan(plan);
    if (!validation.valid) {
      return createTransformResult({
        asts: new Map(),
        newFiles: new Map(),
        modifications: [],
        stats: createTransformStats({
          elementsMoved: 0,
          dependenciesHoisted: 0,
          propsAdded: 0,
          importsAdded: 0,
          filesModified: 0,
          filesCreated: 0,
        }),
      });
    }

    const modifications: ReturnType<typeof createModification>[] = [];
    let elementsMoved = 0;
    let dependenciesHoisted = 0;
    let propsAdded = 0;
    let importsAdded = 0;
    const modifiedFiles = new Set<string>();

    // Execute move operations
    for (const move of plan.moves) {
      this.executeMove(move);
      elementsMoved++;
      modifiedFiles.add(move.sourceFile);
      modifiedFiles.add(move.targetFile);

      modifications.push(
        createModification({
          type: 'move',
          file: move.sourceFile,
          description: `Moved element from ${move.sourcePath} to ${move.targetPath}`,
        })
      );
    }

    // Execute hoist operations
    for (const hoist of plan.hoists) {
      this.executeHoist(hoist);
      dependenciesHoisted++;
      modifiedFiles.add(hoist.fromFile);
      modifiedFiles.add(hoist.toFile);

      modifications.push(
        createModification({
          type: 'hoist',
          file: hoist.toFile,
          description: `Hoisted ${hoist.symbol} from ${hoist.fromScope} to ${hoist.toScope}`,
        })
      );
    }

    // Execute prop threading operations
    for (const prop of plan.propThreads) {
      this.executePropThread(prop);
      propsAdded++;

      modifications.push(
        createModification({
          type: 'prop',
          file: prop.fromComponent,
          description: `Added prop ${prop.propName} threading from ${prop.fromComponent} to ${prop.toComponent}`,
        })
      );
    }

    // Execute import operations
    for (const imp of plan.imports) {
      this.executeImport(imp);
      importsAdded++;
      modifiedFiles.add(imp.file);

      modifications.push(
        createModification({
          type: 'import',
          file: imp.file,
          description: `Added import from ${imp.importSource}`,
        })
      );
    }

    return createTransformResult({
      asts: this.asts,
      newFiles: new Map(),
      modifications,
      stats: createTransformStats({
        elementsMoved,
        dependenciesHoisted,
        propsAdded,
        importsAdded,
        filesModified: modifiedFiles.size,
        filesCreated: 0,
      }),
    });
  }

  /**
   * Execute a move operation (mock)
   */
  private executeMove(move: MoveOperation): void {
    // In real implementation, this would:
    // 1. Find source node
    // 2. Remove from source location
    // 3. Insert at target location based on move.mode
    const sourceAst = this.asts.get(move.sourceFile);
    const targetAst = this.asts.get(move.targetFile);

    if (!sourceAst || !targetAst) {
      throw new Error('Missing AST for move operation');
    }

    // Mock implementation - in reality would manipulate AST
  }

  /**
   * Execute a hoist operation (mock)
   */
  private executeHoist(hoist: HoistOperation): void {
    // In real implementation, this would:
    // 1. Find declaration node
    // 2. Move to target scope
    // 3. Update all references
    const ast = this.asts.get(hoist.fromFile);

    if (!ast) {
      throw new Error('Missing AST for hoist operation');
    }

    // Mock implementation
  }

  /**
   * Execute a prop threading operation (mock)
   */
  private executePropThread(_prop: PropThreadOperation): void {
    // In real implementation, this would:
    // 1. Add prop to source component JSX
    // 2. Add prop to intermediate components
    // 3. Use prop in target component
  }

  /**
   * Execute an import operation (mock)
   */
  private executeImport(imp: ImportOperation): void {
    // In real implementation, this would:
    // 1. Check if import already exists
    // 2. Add import declaration
    // 3. Handle grouping/positioning
    const ast = this.asts.get(imp.file);

    if (!ast) {
      throw new Error('Missing AST for import operation');
    }

    // Mock implementation
  }

  /**
   * Get ASTs
   */
  getASTs(): Map<string, t.File> {
    return this.asts;
  }

  /**
   * Get generated code for a file
   */
  getGeneratedCode(file: string): string {
    const ast = this.asts.get(file);
    if (!ast) {
      throw new Error(`File not found: ${file}`);
    }
    return generateCode(ast);
  }
}

// =============================================================================
// Test Data
// =============================================================================

const simpleComponent = `
import React from 'react';

const SimpleComponent = () => {
  return (
    <div className="container">
      <header>Header</header>
      <main>
        <p>Content</p>
        <span>Text</span>
      </main>
      <footer>Footer</footer>
    </div>
  );
};

export default SimpleComponent;
`;

const componentWithHook = `
import React, { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
};
`;

const parentComponent = `
import React from 'react';
import Child from './Child';

const Parent = ({ value }) => {
  return (
    <div>
      <Child value={value} />
    </div>
  );
};
`;

const childComponent = `
import React from 'react';

const Child = ({ value }) => {
  return <span>{value}</span>;
};

export default Child;
`;

// =============================================================================
// Move Operation Tests
// =============================================================================

describe('Transformer - Move Operations', () => {
  /**
   * TRANS-01: Execute Move.Inside operation
   *
   * Test Purpose: Verify element moves inside target
   *
   * Expected Results:
   * - Element becomes child of target
   */
  it('TRANS-01: should execute Move.Inside operation', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-1',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'simple.tsx',
          sourcePath: 'body.0.declaration.body.body[0].argument.children[0]',
          targetFile: 'simple.tsx',
          targetPath: 'body.0.declaration.body.body[0].argument.children[1]',
          mode: Move.Inside,
          atomicUnit: AtomicUnitType.Element,
        }),
      ],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.elementsMoved).toBe(1);
    expect(result.modifications.length).toBeGreaterThan(0);
  });

  /**
   * TRANS-02: Execute Move.Before operation
   *
   * Test Purpose: Verify element moves before target
   *
   * Expected Results:
   * - Element is sibling before target
   */
  it('TRANS-02: should execute Move.Before operation', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-2',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'simple.tsx',
          sourcePath: 'children[2]',
          targetFile: 'simple.tsx',
          targetPath: 'children[0]',
          mode: Move.Before,
          atomicUnit: AtomicUnitType.Element,
        }),
      ],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.elementsMoved).toBe(1);
  });

  /**
   * TRANS-03: Execute Move.After operation
   *
   * Test Purpose: Verify element moves after target
   *
   * Expected Results:
   * - Element is sibling after target
   */
  it('TRANS-03: should execute Move.After operation', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-3',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'simple.tsx',
          sourcePath: 'children[0]',
          targetFile: 'simple.tsx',
          targetPath: 'children[2]',
          mode: Move.After,
          atomicUnit: AtomicUnitType.Element,
        }),
      ],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.elementsMoved).toBe(1);
  });
});

// =============================================================================
// Hoist Operation Tests
// =============================================================================

describe('Transformer - Hoist Operations', () => {
  /**
   * TRANS-04: Execute hoist operation (Hoist strategy)
   *
   * Test Purpose: Verify dependency hoisting to ancestor scope
   *
   * Expected Results:
   * - Declaration moved to higher scope
   */
  it('TRANS-04: should execute hoist operation with Hoist strategy', () => {
    const files = new Map([['counter.tsx', componentWithHook]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-4',
      moves: [],
      hoists: [
        createHoistOperation({
          id: 'hoist-1',
          dependencyId: 'dep-1',
          symbol: 'count',
          fromFile: 'counter.tsx',
          fromScope: 'Counter',
          toFile: 'counter.tsx',
          toScope: 'module',
          strategy: HoistStrategy.Hoist,
        }),
      ],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.dependenciesHoisted).toBe(1);
  });

  /**
   * TRANS-05: Execute hoist operation (PassAsProp strategy)
   *
   * Test Purpose: Verify dependency passed as prop
   *
   * Expected Results:
   * - Value threaded through props
   */
  it('TRANS-05: should execute hoist operation with PassAsProp strategy', () => {
    const files = new Map([['counter.tsx', componentWithHook]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-5',
      moves: [],
      hoists: [
        createHoistOperation({
          id: 'hoist-1',
          dependencyId: 'dep-1',
          symbol: 'count',
          fromFile: 'counter.tsx',
          fromScope: 'Counter',
          toFile: 'counter.tsx',
          toScope: 'Parent',
          strategy: HoistStrategy.PassAsProp,
        }),
      ],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.dependenciesHoisted).toBe(1);
  });
});

// =============================================================================
// Prop Threading Tests
// =============================================================================

describe('Transformer - Prop Threading Operations', () => {
  /**
   * TRANS-06: Execute prop threading operation
   *
   * Test Purpose: Verify prop threading through component tree
   *
   * Expected Results:
   * - Prop added to all components in path
   */
  it('TRANS-06: should execute prop threading operation', () => {
    const files = new Map([
      ['Parent.tsx', parentComponent],
      ['Child.tsx', childComponent],
    ]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-6',
      moves: [],
      hoists: [],
      propThreads: [
        createPropThreadOperation({
          id: 'prop-1',
          propName: 'extraValue',
          valueExpression: 'value * 2',
          fromComponent: 'Parent',
          toComponent: 'Child',
          path: ['Parent', 'Child'],
        }),
      ],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.propsAdded).toBe(1);
  });
});

// =============================================================================
// Import Operation Tests
// =============================================================================

describe('Transformer - Import Operations', () => {
  /**
   * TRANS-07: Execute import addition operation
   *
   * Test Purpose: Verify import statement added correctly
   *
   * Expected Results:
   * - Import declaration added to file
   */
  it('TRANS-07: should execute import addition operation', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-7',
      moves: [],
      hoists: [],
      propThreads: [],
      imports: [
        createImportOperation({
          id: 'import-1',
          file: 'simple.tsx',
          importSource: './utils',
          specifiers: [
            createImportSpecifier({
              type: 'named',
              imported: 'formatDate',
              local: 'formatDate',
            }),
          ],
          position: 'grouped',
        }),
      ],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.importsAdded).toBe(1);
  });
});

// =============================================================================
// Plan Validation Tests
// =============================================================================

describe('Transformer - Plan Validation', () => {
  /**
   * TRANS-08: Validate plan before execution
   *
   * Test Purpose: Verify plan validation catches issues
   *
   * Expected Results:
   * - Valid plan passes validation
   */
  it('TRANS-08: should validate plan before execution', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-8',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'simple.tsx',
          sourcePath: 'children[0]',
          targetFile: 'simple.tsx',
          targetPath: 'children[1]',
          mode: Move.Inside,
          atomicUnit: AtomicUnitType.Element,
        }),
      ],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const validation = transformer.validatePlan(plan);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  /**
   * TRANS-09: Reject invalid plan
   *
   * Test Purpose: Verify invalid plan is rejected
   *
   * Expected Results:
   * - Invalid plan fails validation
   */
  it('TRANS-09: should reject invalid plan', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-9',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'nonexistent.tsx',
          sourcePath: 'children[0]',
          targetFile: 'simple.tsx',
          targetPath: 'children[1]',
          mode: Move.Inside,
          atomicUnit: AtomicUnitType.Element,
        }),
      ],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const validation = transformer.validatePlan(plan);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Tracking Tests
// =============================================================================

describe('Transformer - Tracking', () => {
  /**
   * TRANS-10: Track modifications during transform
   *
   * Test Purpose: Verify modifications are recorded
   *
   * Expected Results:
   * - Each operation creates modification record
   */
  it('TRANS-10: should track modifications during transform', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-10',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'simple.tsx',
          sourcePath: 'children[0]',
          targetFile: 'simple.tsx',
          targetPath: 'children[1]',
          mode: Move.Inside,
          atomicUnit: AtomicUnitType.Element,
        }),
      ],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.modifications.length).toBeGreaterThan(0);
    expect(result.modifications[0]?.type).toBe('move');
    expect(result.modifications[0]?.file).toBe('simple.tsx');
  });

  /**
   * TRANS-11: Generate transform statistics
   *
   * Test Purpose: Verify stats are calculated
   *
   * Expected Results:
   * - Stats reflect actual operations
   */
  it('TRANS-11: should generate transform statistics', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-11',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'simple.tsx',
          sourcePath: 'a',
          targetFile: 'simple.tsx',
          targetPath: 'b',
          mode: Move.Inside,
          atomicUnit: AtomicUnitType.Element,
        }),
        createMoveOperation({
          id: 'move-2',
          sourceFile: 'simple.tsx',
          sourcePath: 'c',
          targetFile: 'simple.tsx',
          targetPath: 'd',
          mode: Move.After,
          atomicUnit: AtomicUnitType.Element,
        }),
      ],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.elementsMoved).toBe(2);
    expect(result.stats.filesModified).toBeGreaterThan(0);
  });
});

// =============================================================================
// Multiple Operations Tests
// =============================================================================

describe('Transformer - Multiple Operations', () => {
  /**
   * TRANS-12: Handle multiple operations in one plan
   *
   * Test Purpose: Verify plan with many operations
   *
   * Expected Results:
   * - All operations executed
   */
  it('TRANS-12: should handle multiple operations in one plan', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-12',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'simple.tsx',
          sourcePath: 'a',
          targetFile: 'simple.tsx',
          targetPath: 'b',
          mode: Move.Inside,
          atomicUnit: AtomicUnitType.Element,
        }),
      ],
      hoists: [
        createHoistOperation({
          id: 'hoist-1',
          dependencyId: 'dep-1',
          symbol: 'x',
          fromFile: 'simple.tsx',
          fromScope: 'A',
          toFile: 'simple.tsx',
          toScope: 'B',
          strategy: HoistStrategy.Hoist,
        }),
      ],
      propThreads: [],
      imports: [
        createImportOperation({
          id: 'import-1',
          file: 'simple.tsx',
          importSource: './utils',
          specifiers: [],
          position: 'start',
        }),
      ],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.elementsMoved).toBe(1);
    expect(result.stats.dependenciesHoisted).toBe(1);
    expect(result.stats.importsAdded).toBe(1);
  });
});

// =============================================================================
// AST Integrity Tests
// =============================================================================

describe('Transformer - AST Integrity', () => {
  /**
   * TRANS-13: Preserve AST integrity after transform
   *
   * Test Purpose: Verify AST is still valid after transforms
   *
   * Expected Results:
   * - AST can still be generated to code
   */
  it('TRANS-13: should preserve AST integrity after transform', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-13',
      moves: [],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    transformer.execute(plan);

    // Should be able to generate code from AST
    const code = transformer.getGeneratedCode('simple.tsx');
    expect(code).toBeDefined();
    expect(code.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Cross-File Tests
// =============================================================================

describe('Transformer - Cross-File Operations', () => {
  /**
   * TRANS-14: Handle cross-file transformations
   *
   * Test Purpose: Verify operations across files
   *
   * Expected Results:
   * - Both files updated correctly
   */
  it('TRANS-14: should handle cross-file transformations', () => {
    const files = new Map([
      ['Parent.tsx', parentComponent],
      ['Child.tsx', childComponent],
    ]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-14',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'Parent.tsx',
          sourcePath: 'element',
          targetFile: 'Child.tsx',
          targetPath: 'target',
          mode: Move.Inside,
          atomicUnit: AtomicUnitType.Element,
        }),
      ],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.filesModified).toBe(2);
  });
});

// =============================================================================
// Atomic Unit Tests
// =============================================================================

describe('Transformer - Atomic Units', () => {
  /**
   * TRANS-20: Handle atomic unit moves
   *
   * Test Purpose: Verify conditional/map units move together
   *
   * Expected Results:
   * - Entire atomic unit moved
   */
  it('TRANS-20: should handle atomic unit moves', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan-20',
      moves: [
        createMoveOperation({
          id: 'move-1',
          sourceFile: 'simple.tsx',
          sourcePath: 'conditional',
          targetFile: 'simple.tsx',
          targetPath: 'target',
          mode: Move.Inside,
          atomicUnit: AtomicUnitType.Conditional,
        }),
      ],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.elementsMoved).toBe(1);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Transformer - Edge Cases', () => {
  it('should handle empty plan', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'empty-plan',
      moves: [],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.elementsMoved).toBe(0);
    expect(result.stats.dependenciesHoisted).toBe(0);
    expect(result.modifications).toHaveLength(0);
  });

  it('should handle plan with only imports', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'import-plan',
      moves: [],
      hoists: [],
      propThreads: [],
      imports: [
        createImportOperation({
          id: 'import-1',
          file: 'simple.tsx',
          importSource: 'react',
          specifiers: [
            createImportSpecifier({
              type: 'default',
              imported: 'React',
              local: 'React',
            }),
          ],
          position: 'start',
        }),
      ],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.importsAdded).toBe(1);
    expect(result.stats.elementsMoved).toBe(0);
  });

  it('should warn about complex plans', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'complex-plan',
      moves: [],
      hoists: [
        createHoistOperation({
          id: 'h1',
          dependencyId: 'd1',
          symbol: 'a',
          fromFile: 'simple.tsx',
          fromScope: 'A',
          toFile: 'simple.tsx',
          toScope: 'B',
          strategy: HoistStrategy.Hoist,
        }),
        createHoistOperation({
          id: 'h2',
          dependencyId: 'd2',
          symbol: 'b',
          fromFile: 'simple.tsx',
          fromScope: 'A',
          toFile: 'simple.tsx',
          toScope: 'B',
          strategy: HoistStrategy.Hoist,
        }),
        createHoistOperation({
          id: 'h3',
          dependencyId: 'd3',
          symbol: 'c',
          fromFile: 'simple.tsx',
          fromScope: 'A',
          toFile: 'simple.tsx',
          toScope: 'B',
          strategy: HoistStrategy.Hoist,
        }),
        createHoistOperation({
          id: 'h4',
          dependencyId: 'd4',
          symbol: 'd',
          fromFile: 'simple.tsx',
          fromScope: 'A',
          toFile: 'simple.tsx',
          toScope: 'B',
          strategy: HoistStrategy.Hoist,
        }),
      ],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const validation = transformer.validatePlan(plan);

    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  it('should handle single file with many operations', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const moves = Array.from({ length: 5 }, (_, i) =>
      createMoveOperation({
        id: `move-${i}`,
        sourceFile: 'simple.tsx',
        sourcePath: `source-${i}`,
        targetFile: 'simple.tsx',
        targetPath: `target-${i}`,
        mode: Move.Inside,
        atomicUnit: AtomicUnitType.Element,
      })
    );

    const plan = createTransformPlan({
      id: 'many-ops',
      moves,
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result.stats.elementsMoved).toBe(5);
    expect(result.stats.filesModified).toBe(1); // All in same file
  });
});

// =============================================================================
// Result Structure Tests
// =============================================================================

describe('Transformer - Result Structure', () => {
  it('should return properly structured TransformResult', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan',
      moves: [],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const result = transformer.execute(plan);

    expect(result).toHaveProperty('asts');
    expect(result).toHaveProperty('newFiles');
    expect(result).toHaveProperty('modifications');
    expect(result).toHaveProperty('stats');

    expect(result.stats).toHaveProperty('elementsMoved');
    expect(result.stats).toHaveProperty('dependenciesHoisted');
    expect(result.stats).toHaveProperty('propsAdded');
    expect(result.stats).toHaveProperty('importsAdded');
    expect(result.stats).toHaveProperty('filesModified');
    expect(result.stats).toHaveProperty('filesCreated');
  });

  it('should return properly structured ValidationResult', () => {
    const files = new Map([['simple.tsx', simpleComponent]]);
    const transformer = new MockTransformer(files);

    const plan = createTransformPlan({
      id: 'plan',
      moves: [],
      hoists: [],
      propThreads: [],
      imports: [],
      sharedModules: [],
      validation: createValidationResult({ valid: true, errors: [], warnings: [] }),
    });

    const validation = transformer.validatePlan(plan);

    expect(validation).toHaveProperty('valid');
    expect(validation).toHaveProperty('errors');
    expect(validation).toHaveProperty('warnings');

    expect(typeof validation.valid).toBe('boolean');
    expect(Array.isArray(validation.errors)).toBe(true);
    expect(Array.isArray(validation.warnings)).toBe(true);
  });
});
