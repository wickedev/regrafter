/**
 * Types Integration Tests
 *
 * Additional tests for type exports from the main types module.
 * Complements the unit tests in src/types/public.test.ts and factories.test.ts.
 *
 * Test File: src/__tests__/types.test.ts
 *
 * Test Purpose:
 * - Validate that all public types are properly exported from the main module
 * - Validate factory functions create valid structures for API usage
 * - Test edge cases and integration scenarios
 */

import { describe, it, expect } from 'vitest';
import {
  // Enums
  Move,
  DependencyType,
  ResolutionStrategy,
  // Types
  type PositionSelector,
  type PathSelector,
  type Code,
  type MoveAnalysis,
  // Type Guards
  isPositionSelector,
  isPathSelector,
  isValidMove,
  isValidDependencyType,
  isValidSelector,
  // Defaults and utilities
  DEFAULT_OPTIONS,
  mergeOptions,
  // Factory Functions
  createDependency,
  createMoveAnalysis,
  createCode,
  createResult,
  createSuccessResult,
  createFailureResult,
} from '../types/index.js';

// =============================================================================
// Test Cases Overview
// =============================================================================
/**
 * | Case ID  | Feature Description                      | Test Type     |
 * |----------|------------------------------------------|---------------|
 * | TYPE-01  | Move enum has correct string values      | Positive Test |
 * | TYPE-02  | Move enum has exactly 3 values           | Positive Test |
 * | TYPE-03  | isPositionSelector identifies position   | Positive Test |
 * | TYPE-04  | isPositionSelector rejects path          | Negative Test |
 * | TYPE-05  | isPathSelector identifies path           | Positive Test |
 * | TYPE-06  | isPathSelector rejects position          | Negative Test |
 * | TYPE-07  | DependencyType has all 6 values          | Positive Test |
 * | TYPE-08  | isValidMove accepts valid values         | Positive Test |
 * | TYPE-09  | isValidMove rejects invalid values       | Negative Test |
 * | TYPE-10  | isValidDependencyType validates          | Positive Test |
 * | TYPE-11  | isValidSelector validates position       | Positive Test |
 * | TYPE-12  | isValidSelector validates path           | Positive Test |
 * | TYPE-13  | isValidSelector rejects invalid          | Negative Test |
 * | TYPE-16  | createDependency creates correct         | Positive Test |
 * | TYPE-17  | DEFAULT_OPTIONS has all defaults         | Positive Test |
 * | TYPE-20  | createMoveAnalysis creates correctly     | Positive Test |
 * | TYPE-21  | createSuccessResult creates correctly    | Positive Test |
 * | TYPE-22  | createFailureResult creates correctly    | Positive Test |
 * | TYPE-23  | ResolutionStrategy has all values        | Positive Test |
 *
 * Note: Additional unit tests are in src/types/public.test.ts and factories.test.ts
 */

// =============================================================================
// Move Enum Tests
// =============================================================================

describe('Move enum', () => {
  /**
   * TYPE-01: Move enum has correct string values
   *
   * Test Purpose: Verify Move enum values match specification
   *
   * Expected Results:
   * - Move.Inside === 'inside'
   * - Move.Before === 'before'
   * - Move.After === 'after'
   */
  it('TYPE-01: should have correct string values', () => {
    expect(Move.Inside).toBe('inside');
    expect(Move.Before).toBe('before');
    expect(Move.After).toBe('after');
  });

  /**
   * TYPE-02: Move enum has exactly 3 values
   *
   * Test Purpose: Ensure no unexpected enum values exist
   *
   * Expected Results:
   * - Enum has exactly 3 values
   */
  it('TYPE-02: should have exactly 3 values', () => {
    const values = Object.values(Move);
    expect(values).toHaveLength(3);
    expect(values).toContain('inside');
    expect(values).toContain('before');
    expect(values).toContain('after');
  });
});

// =============================================================================
// Selector Type Guard Tests
// =============================================================================

describe('Selector type guards', () => {
  const positionSelector: PositionSelector = {
    file: 'test.tsx',
    line: 10,
    column: 5,
  };

  const pathSelector: PathSelector = {
    file: 'test.tsx',
    path: 'Program.body[0]',
  };

  /**
   * TYPE-03: isPositionSelector identifies position selectors
   *
   * Test Purpose: Verify type guard correctly identifies PositionSelector
   *
   * Test Data Preparation:
   * - Create valid PositionSelector object
   *
   * Expected Results:
   * - Returns true for position selector
   */
  it('TYPE-03: isPositionSelector should return true for position selector', () => {
    expect(isPositionSelector(positionSelector)).toBe(true);
  });

  /**
   * TYPE-04: isPositionSelector rejects path selectors
   *
   * Test Purpose: Verify type guard rejects PathSelector
   *
   * Expected Results:
   * - Returns false for path selector
   */
  it('TYPE-04: isPositionSelector should return false for path selector', () => {
    expect(isPositionSelector(pathSelector)).toBe(false);
  });

  /**
   * TYPE-05: isPathSelector identifies path selectors
   *
   * Test Purpose: Verify type guard correctly identifies PathSelector
   *
   * Expected Results:
   * - Returns true for path selector
   */
  it('TYPE-05: isPathSelector should return true for path selector', () => {
    expect(isPathSelector(pathSelector)).toBe(true);
  });

  /**
   * TYPE-06: isPathSelector rejects position selectors
   *
   * Test Purpose: Verify type guard rejects PositionSelector
   *
   * Expected Results:
   * - Returns false for position selector
   */
  it('TYPE-06: isPathSelector should return false for position selector', () => {
    expect(isPathSelector(positionSelector)).toBe(false);
  });
});

// =============================================================================
// DependencyType Enum Tests
// =============================================================================

describe('DependencyType enum', () => {
  /**
   * TYPE-07: DependencyType has all 6 values
   *
   * Test Purpose: Verify all dependency types are defined
   *
   * Expected Results:
   * - Hook, Variable, Import, Prop, Context, Ref all defined
   */
  it('TYPE-07: should have all 6 dependency types', () => {
    expect(DependencyType.Hook).toBe('Hook');
    expect(DependencyType.Variable).toBe('Variable');
    expect(DependencyType.Import).toBe('Import');
    expect(DependencyType.Prop).toBe('Prop');
    expect(DependencyType.Context).toBe('Context');
    expect(DependencyType.Ref).toBe('Ref');

    const values = Object.values(DependencyType);
    expect(values).toHaveLength(6);
  });
});

// =============================================================================
// Validation Function Tests
// =============================================================================

describe('Validation functions', () => {
  /**
   * TYPE-08: isValidMove accepts valid Move values
   *
   * Test Purpose: Verify validation accepts all valid Move enum values
   *
   * Expected Results:
   * - Returns true for all Move enum values
   */
  it('TYPE-08: isValidMove should accept valid Move values', () => {
    expect(isValidMove(Move.Inside)).toBe(true);
    expect(isValidMove(Move.Before)).toBe(true);
    expect(isValidMove(Move.After)).toBe(true);
    expect(isValidMove('inside')).toBe(true);
    expect(isValidMove('before')).toBe(true);
    expect(isValidMove('after')).toBe(true);
  });

  /**
   * TYPE-09: isValidMove rejects invalid values
   *
   * Test Purpose: Verify validation rejects non-Move values
   *
   * Expected Results:
   * - Returns false for invalid values
   */
  it('TYPE-09: isValidMove should reject invalid values', () => {
    expect(isValidMove('invalid')).toBe(false);
    expect(isValidMove(null)).toBe(false);
    expect(isValidMove(undefined)).toBe(false);
    expect(isValidMove(123)).toBe(false);
    expect(isValidMove({})).toBe(false);
  });

  /**
   * TYPE-10: isValidDependencyType validates correctly
   *
   * Test Purpose: Verify DependencyType validation
   *
   * Expected Results:
   * - Returns true for valid types, false for invalid
   */
  it('TYPE-10: isValidDependencyType should validate correctly', () => {
    expect(isValidDependencyType(DependencyType.Hook)).toBe(true);
    expect(isValidDependencyType(DependencyType.Variable)).toBe(true);
    expect(isValidDependencyType('Hook')).toBe(true);
    expect(isValidDependencyType('invalid')).toBe(false);
    expect(isValidDependencyType(null)).toBe(false);
  });

  /**
   * TYPE-11: isValidSelector validates position selectors
   *
   * Test Purpose: Verify selector validation for PositionSelector
   *
   * Expected Results:
   * - Returns true for valid position selector
   */
  it('TYPE-11: isValidSelector should validate position selector', () => {
    const selector = { file: 'test.tsx', line: 10, column: 5 };
    expect(isValidSelector(selector)).toBe(true);
  });

  /**
   * TYPE-12: isValidSelector validates path selectors
   *
   * Test Purpose: Verify selector validation for PathSelector
   *
   * Expected Results:
   * - Returns true for valid path selector
   */
  it('TYPE-12: isValidSelector should validate path selector', () => {
    const selector = { file: 'test.tsx', path: 'Program.body[0]' };
    expect(isValidSelector(selector)).toBe(true);
  });

  /**
   * TYPE-13: isValidSelector rejects invalid selectors
   *
   * Test Purpose: Verify selector validation rejects malformed input
   *
   * Expected Results:
   * - Returns false for invalid selectors
   */
  it('TYPE-13: isValidSelector should reject invalid selectors', () => {
    expect(isValidSelector(null)).toBe(false);
    expect(isValidSelector(undefined)).toBe(false);
    expect(isValidSelector({})).toBe(false);
    expect(isValidSelector({ file: 'test.tsx' })).toBe(false);
    expect(isValidSelector({ file: 'test.tsx', line: 10 })).toBe(false);
    expect(isValidSelector({ line: 10, column: 5 })).toBe(false);
    expect(isValidSelector({ file: 123, line: 10, column: 5 })).toBe(false);
  });
});

// =============================================================================
// Factory Function Integration Tests
// =============================================================================

describe('Factory functions (integration)', () => {
  /**
   * TYPE-16: createDependency creates correct structure
   *
   * Test Purpose: Verify factory creates valid Dependency
   *
   * Expected Results:
   * - Object has all required fields
   * - Values match input
   */
  it('TYPE-16: createDependency should create correct structure', () => {
    const dep = createDependency({
      symbol: 'count',
      type: DependencyType.Hook,
      origin: 'Component.tsx',
      scope: 'Counter',
    });

    expect(dep.symbol).toBe('count');
    expect(dep.type).toBe(DependencyType.Hook);
    expect(dep.origin).toBe('Component.tsx');
    expect(dep.scope).toBe('Counter');
    expect(dep.isTransitive).toBe(false);

    // With isTransitive = true
    const transitiveDep = createDependency({
      symbol: 'value',
      type: DependencyType.Variable,
      origin: 'Utils.ts',
      scope: 'helper',
      isTransitive: true,
    });
    expect(transitiveDep.isTransitive).toBe(true);
  });

  /**
   * TYPE-17: DEFAULT_OPTIONS has all defaults
   *
   * Test Purpose: Verify default options match specification
   *
   * Expected Results:
   * - optimize: true
   * - dryRun: false
   * - preserveComments: true
   * - formatOutput: true
   */
  it('TYPE-17: DEFAULT_OPTIONS should have all defaults', () => {
    expect(DEFAULT_OPTIONS).toEqual({
      optimize: true,
      dryRun: false,
      preserveComments: true,
      formatOutput: true,
    });
  });

  /**
   * TYPE-20: createMoveAnalysis creates correct structure
   *
   * Test Purpose: Verify analysis has correct structure
   *
   * Expected Results:
   * - canMove defaults to true
   * - Arrays default to empty
   */
  it('TYPE-20: createMoveAnalysis should create correct structure', () => {
    const analysis = createMoveAnalysis({});

    expect(analysis.canMove).toBe(true);
    expect(analysis.dependencies).toEqual([]);
    expect(analysis.hoistedDeps).toEqual([]);

    // With canMove: false and reason
    const failedAnalysis = createMoveAnalysis({
      canMove: false,
      reason: 'Element not found',
    });

    expect(failedAnalysis.canMove).toBe(false);
    expect(failedAnalysis.reason).toBe('Element not found');
  });

  /**
   * TYPE-21: createSuccessResult creates correct structure
   *
   * Test Purpose: Verify success result has correct structure
   *
   * Expected Results:
   * - success is true
   * - codes and analysis match input
   */
  it('TYPE-21: createSuccessResult should create correct structure', () => {
    const codes: Code[] = [
      createCode({ file: 'test.tsx', content: 'content', changed: true }),
    ];
    const analysis: MoveAnalysis = createMoveAnalysis({
      canMove: true,
      dependencies: [],
      hoistedDeps: [],
    });

    const result = createSuccessResult(codes, analysis);

    expect(result.success).toBe(true);
    expect(result.codes).toEqual(codes);
    expect(result.analysis).toEqual(analysis);
  });

  /**
   * TYPE-22: createFailureResult creates correct structure
   *
   * Test Purpose: Verify failed result has correct structure
   *
   * Expected Results:
   * - success is false
   * - codes is empty
   * - analysis contains reason
   */
  it('TYPE-22: createFailureResult should create correct structure', () => {
    const analysis = createMoveAnalysis({
      canMove: false,
      reason: 'Parse error',
    });
    const result = createFailureResult(analysis);

    expect(result.success).toBe(false);
    expect(result.codes).toEqual([]);
    expect(result.analysis.canMove).toBe(false);
    expect(result.analysis.reason).toBe('Parse error');
  });
});

// =============================================================================
// Additional Enum Tests
// =============================================================================

describe('ResolutionStrategy enum', () => {
  /**
   * TYPE-23: ResolutionStrategy has all values
   *
   * Test Purpose: Verify all resolution strategies are defined
   *
   * Expected Results:
   * - All 6 strategies defined with correct values
   */
  it('TYPE-23: should have all resolution strategies', () => {
    expect(ResolutionStrategy.Hoist).toBe('hoist');
    expect(ResolutionStrategy.PropThread).toBe('prop_thread');
    expect(ResolutionStrategy.Import).toBe('import');
    expect(ResolutionStrategy.SharedModule).toBe('shared_module');
    expect(ResolutionStrategy.ProviderHoist).toBe('provider_hoist');
    expect(ResolutionStrategy.ContextToProps).toBe('context_to_props');

    const values = Object.values(ResolutionStrategy);
    expect(values).toHaveLength(6);
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('Edge cases', () => {
  it('should reject selector with zero line value', () => {
    const selector: PositionSelector = { file: 'test.tsx', line: 0, column: 0 };
    expect(isValidSelector(selector)).toBe(false); // line must be >= 1
  });

  it('should reject empty file path in selector', () => {
    const selector: PositionSelector = { file: '', line: 1, column: 1 };
    expect(isValidSelector(selector)).toBe(false); // file must be non-empty
  });

  it('should reject empty path in PathSelector', () => {
    const selector: PathSelector = { file: 'test.tsx', path: '' };
    expect(isValidSelector(selector)).toBe(false); // path must be non-empty
  });

  it('should create dependency with empty strings', () => {
    const dep = createDependency({
      symbol: '',
      type: DependencyType.Variable,
      origin: '',
      scope: '',
    });
    expect(dep.symbol).toBe('');
    expect(dep.origin).toBe('');
    expect(dep.scope).toBe('');
  });

  it('should handle analysis with dependencies and suggested fixes', () => {
    const analysis = createMoveAnalysis({
      canMove: false,
      reason: 'Error',
      dependencies: [
        createDependency({
          symbol: 'test',
          type: DependencyType.Variable,
          origin: 'file.ts',
          scope: 'scope',
        }),
      ],
      suggestedFixes: [{ description: 'Fix', action: 'do', automatic: true }],
    });

    expect(analysis.dependencies).toHaveLength(1);
    expect(analysis.suggestedFixes).toHaveLength(1);
    expect(analysis.hoistedDeps).toEqual([]);
  });
});

// =============================================================================
// Module Export Validation Tests
// =============================================================================

describe('Module exports', () => {
  it('should export all required enums', () => {
    expect(Move).toBeDefined();
    expect(DependencyType).toBeDefined();
    expect(ResolutionStrategy).toBeDefined();
  });

  it('should export all required type guards', () => {
    expect(isPositionSelector).toBeDefined();
    expect(isPathSelector).toBeDefined();
    expect(isValidMove).toBeDefined();
    expect(isValidDependencyType).toBeDefined();
    expect(isValidSelector).toBeDefined();
  });

  it('should export all required factories', () => {
    expect(createDependency).toBeDefined();
    expect(createMoveAnalysis).toBeDefined();
    expect(createCode).toBeDefined();
    expect(createResult).toBeDefined();
    expect(createSuccessResult).toBeDefined();
    expect(createFailureResult).toBeDefined();
  });

  it('should export DEFAULT_OPTIONS and mergeOptions', () => {
    expect(DEFAULT_OPTIONS).toBeDefined();
    expect(mergeOptions).toBeDefined();
  });
});
