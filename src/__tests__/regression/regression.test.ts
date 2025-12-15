/**
 * Regression Tests
 *
 * Tests for specific bugs and edge cases that have been fixed.
 */

import { describe, it, expect } from 'vitest';
import {
  Move,
  isValidSelector,
  isValidMove,
  isValidOptions,
  mergeOptions,
  DEFAULT_OPTIONS,
  ErrorCategory,
  RegraffError,
} from '../../index.js';
import { validateRegraftInput } from '../../validation/index.js';
import {
  createDependency,
  createSuggestedFix,
  createMoveAnalysis,
  createCode,
  createResult,
  createSuccessResult,
  createFailureResult,
  createAnalysisStats,
} from '../../types/factories.js';
import { DependencyType, ResolutionStrategy } from '../../types/public.js';

// ============================================================================
// Regression: Type Validation Edge Cases
// ============================================================================

describe('Regression: Type Validation', () => {
  it('should handle null values in selector validation', () => {
    // Bug: isValidSelector crashed on null
    expect(isValidSelector(null)).toBe(false);
    expect(isValidSelector(undefined)).toBe(false);
  });

  it('should handle objects without file property', () => {
    // Bug: validation didn't check for file property existence
    expect(isValidSelector({ line: 1, column: 1 })).toBe(false);
    expect(isValidSelector({ path: 'test' })).toBe(false);
  });

  it('should validate empty string file paths', () => {
    // Bug: empty string was considered valid
    expect(isValidSelector({ file: '', line: 1, column: 1 })).toBe(false);
    expect(isValidSelector({ file: '', path: 'Program' })).toBe(false);
  });

  it('should handle negative line/column numbers', () => {
    // Bug: negative numbers weren't rejected
    expect(isValidSelector({ file: 'test.tsx', line: -1, column: 1 })).toBe(false);
    expect(isValidSelector({ file: 'test.tsx', line: 1, column: -1 })).toBe(false);
  });

  it('should handle non-integer line/column numbers', () => {
    // Bug: floats were accepted
    expect(isValidSelector({ file: 'test.tsx', line: 1.5, column: 1 })).toBe(false);
    expect(isValidSelector({ file: 'test.tsx', line: 1, column: 1.5 })).toBe(false);
  });
});

describe('Regression: Move Validation', () => {
  it('should reject case-sensitive variations', () => {
    // Bug: case variations were incorrectly accepted
    expect(isValidMove('Inside')).toBe(false);
    expect(isValidMove('INSIDE')).toBe(false);
    expect(isValidMove('Before')).toBe(false);
    expect(isValidMove('BEFORE')).toBe(false);
  });

  it('should handle undefined and null', () => {
    expect(isValidMove(undefined)).toBe(false);
    expect(isValidMove(null)).toBe(false);
  });

  it('should handle number values', () => {
    expect(isValidMove(0)).toBe(false);
    expect(isValidMove(1)).toBe(false);
  });
});

describe('Regression: Options Validation', () => {
  it('should accept null as valid options', () => {
    // Bug: null was not treated as empty options
    expect(isValidOptions(null)).toBe(true);
  });

  it('should reject string values for boolean options', () => {
    // Bug: truthy strings were accepted
    expect(isValidOptions({ optimize: 'true' })).toBe(false);
    expect(isValidOptions({ dryRun: 'false' })).toBe(false);
  });

  it('should reject numeric values for boolean options', () => {
    // Bug: 0/1 were accepted as boolean
    expect(isValidOptions({ optimize: 1 })).toBe(false);
    expect(isValidOptions({ dryRun: 0 })).toBe(false);
  });
});

// ============================================================================
// Regression: Factory Function Edge Cases
// ============================================================================

describe('Regression: Factory Functions', () => {
  it('createDependency should handle minimal input', () => {
    const dep = createDependency({
      symbol: 'count',
      type: DependencyType.Variable,
      origin: 'App.tsx',
      scope: 'App',
    });

    expect(dep.symbol).toBe('count');
    expect(dep.isTransitive).toBe(false);
    expect(dep.resolution).toBeUndefined();
  });

  it('createDependency should handle all fields', () => {
    const dep = createDependency({
      symbol: 'count',
      type: DependencyType.Hook,
      origin: 'App.tsx',
      scope: 'App',
      isTransitive: true,
      resolution: ResolutionStrategy.Hoist,
    });

    expect(dep.isTransitive).toBe(true);
    expect(dep.resolution).toBe(ResolutionStrategy.Hoist);
  });

  it('createSuggestedFix should default automatic to false', () => {
    const fix = createSuggestedFix({
      description: 'Test fix',
      action: 'test_action',
    });

    expect(fix.automatic).toBe(false);
  });

  it('createMoveAnalysis should handle empty dependencies', () => {
    const analysis = createMoveAnalysis({
      canMove: true,
    });

    expect(analysis.dependencies).toEqual([]);
    expect(analysis.hoistedDeps).toEqual([]);
  });

  it('createCode should default changed to false', () => {
    const code = createCode({
      file: 'test.tsx',
      content: 'const x = 1;',
    });

    expect(code.changed).toBe(false);
  });

  it('createAnalysisStats should default all counts to 0', () => {
    const stats = createAnalysisStats();

    expect(stats.totalDependencies).toBe(0);
    expect(stats.hookDependencies).toBe(0);
    expect(stats.variableDependencies).toBe(0);
    expect(stats.importDependencies).toBe(0);
    expect(stats.propDependencies).toBe(0);
    expect(stats.transitiveDependencies).toBe(0);
  });

  it('createSuccessResult should create valid success result', () => {
    const codes = [createCode({ file: 'test.tsx', content: 'code' })];
    const analysis = createMoveAnalysis({ canMove: true });
    const result = createSuccessResult(codes, analysis);

    expect(result.success).toBe(true);
    expect(result.codes).toBe(codes);
    expect(result.analysis).toBe(analysis);
  });

  it('createFailureResult should create valid failure result', () => {
    const result = createFailureResult('Test failure');

    expect(result.success).toBe(false);
    expect(result.codes).toEqual([]);
    expect(result.analysis.canMove).toBe(false);
    expect(result.analysis.reason).toBe('Test failure');
  });
});

// ============================================================================
// Regression: Error Handling
// ============================================================================

describe('Regression: Error Handling', () => {
  it('RegraffError should maintain stack trace', () => {
    const error = new RegraffError({
      category: ErrorCategory.Parse,
      code: 'E001',
      message: 'Test error',
    });

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('Error');
  });

  it('RegraffError should handle missing location', () => {
    const error = new RegraffError({
      category: ErrorCategory.Parse,
      code: 'E001',
      message: 'Test error',
      file: 'test.tsx',
    });

    const formatted = error.toFormattedString();
    expect(formatted).toContain('test.tsx');
    expect(formatted).not.toContain('undefined');
  });

  it('RegraffError toJSON should not include undefined values', () => {
    const error = new RegraffError({
      category: ErrorCategory.Parse,
      code: 'E001',
      message: 'Test error',
    });

    const json = error.toJSON();
    expect(json.file).toBeUndefined();
    expect(json.location).toBeUndefined();
  });
});

// ============================================================================
// Regression: Input Validation Edge Cases
// ============================================================================

describe('Regression: Input Validation', () => {
  it('should handle file paths with spaces', () => {
    const files = [{ path: 'src/My Component.tsx', content: 'code' }];
    const from = { file: 'src/My Component.tsx', line: 1, column: 1 };
    const to = { file: 'src/My Component.tsx', line: 2, column: 1 };

    const result = validateRegraftInput(files, from, to, Move.Inside);
    expect(result.valid).toBe(true);
  });

  it('should handle file paths with special characters', () => {
    const files = [{ path: 'src/@components/[id].tsx', content: 'code' }];
    const from = { file: 'src/@components/[id].tsx', line: 1, column: 1 };
    const to = { file: 'src/@components/[id].tsx', line: 2, column: 1 };

    const result = validateRegraftInput(files, from, to, Move.Inside);
    expect(result.valid).toBe(true);
  });

  it('should handle very long file paths', () => {
    const longPath = 'src/' + 'a'.repeat(200) + '.tsx';
    const files = [{ path: longPath, content: 'code' }];
    const from = { file: longPath, line: 1, column: 1 };
    const to = { file: longPath, line: 2, column: 1 };

    const result = validateRegraftInput(files, from, to, Move.Inside);
    expect(result.valid).toBe(true);
  });

  it('should handle empty content', () => {
    const files = [{ path: 'test.tsx', content: '' }];
    const from = { file: 'test.tsx', line: 1, column: 1 };
    const to = { file: 'test.tsx', line: 1, column: 1 };

    const result = validateRegraftInput(files, from, to, Move.Inside);
    expect(result.valid).toBe(true);
  });

  it('should handle very large line/column numbers', () => {
    const files = [{ path: 'test.tsx', content: 'code' }];
    const from = { file: 'test.tsx', line: 999999, column: 99999 };
    const to = { file: 'test.tsx', line: 1, column: 1 };

    const result = validateRegraftInput(files, from, to, Move.Inside);
    expect(result.valid).toBe(true);
  });

  it('should validate duplicate files in array', () => {
    const files = [
      { path: 'test.tsx', content: 'code1' },
      { path: 'test.tsx', content: 'code2' },
    ];
    const from = { file: 'test.tsx', line: 1, column: 1 };
    const to = { file: 'test.tsx', line: 2, column: 1 };

    // Should accept (caller is responsible for deduplication)
    const result = validateRegraftInput(files, from, to, Move.Inside);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Regression: Option Merging
// ============================================================================

describe('Regression: Option Merging', () => {
  it('should not mutate DEFAULT_OPTIONS', () => {
    const originalDefaults = { ...DEFAULT_OPTIONS };

    mergeOptions({ optimize: false });
    mergeOptions({ dryRun: true });
    mergeOptions({ preserveComments: false });

    expect(DEFAULT_OPTIONS).toEqual(originalDefaults);
  });

  it('should return new object each time', () => {
    const result1 = mergeOptions({});
    const result2 = mergeOptions({});

    expect(result1).not.toBe(result2);
    expect(result1).toEqual(result2);
  });

  it('should handle partial options correctly', () => {
    const partial = { optimize: false };
    const merged = mergeOptions(partial);

    expect(merged.optimize).toBe(false);
    expect(merged.dryRun).toBe(DEFAULT_OPTIONS.dryRun);
    expect(merged.preserveComments).toBe(DEFAULT_OPTIONS.preserveComments);
    expect(merged.formatOutput).toBe(DEFAULT_OPTIONS.formatOutput);
  });
});

// ============================================================================
// Regression: Cross-File Validation
// ============================================================================

describe('Regression: Cross-File Validation', () => {
  it('should validate both from and to file references', () => {
    const files = [
      { path: 'A.tsx', content: 'codeA' },
      { path: 'B.tsx', content: 'codeB' },
    ];

    // Both files exist
    expect(
      validateRegraftInput(
        files,
        { file: 'A.tsx', line: 1, column: 1 },
        { file: 'B.tsx', line: 1, column: 1 },
        Move.Inside
      ).valid
    ).toBe(true);

    // from file missing
    expect(
      validateRegraftInput(
        files,
        { file: 'C.tsx', line: 1, column: 1 },
        { file: 'B.tsx', line: 1, column: 1 },
        Move.Inside
      ).valid
    ).toBe(false);

    // to file missing
    expect(
      validateRegraftInput(
        files,
        { file: 'A.tsx', line: 1, column: 1 },
        { file: 'C.tsx', line: 1, column: 1 },
        Move.Inside
      ).valid
    ).toBe(false);

    // both files missing
    expect(
      validateRegraftInput(
        files,
        { file: 'C.tsx', line: 1, column: 1 },
        { file: 'D.tsx', line: 1, column: 1 },
        Move.Inside
      ).valid
    ).toBe(false);
  });
});
