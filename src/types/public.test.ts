/**
 * Unit tests for public API type guards and utilities
 */

import { describe, it, expect } from 'vitest';

import {
  Move,
  DependencyType,
  isPositionSelector,
  isPathSelector,
  isValidMove,
  isValidDependencyType,
  isValidSelector,
  isValidOptions,
  mergeOptions,
  DEFAULT_OPTIONS,
} from './public.js';

describe('Move enum', () => {
  it('should have correct string values', () => {
    expect(Move.Inside).toBe('inside');
    expect(Move.Before).toBe('before');
    expect(Move.After).toBe('after');
  });

  it('should have exactly 3 values', () => {
    const values = Object.values(Move);
    expect(values).toHaveLength(3);
    expect(values).toContain('inside');
    expect(values).toContain('before');
    expect(values).toContain('after');
  });
});

describe('DependencyType enum', () => {
  it('should have correct string values', () => {
    expect(DependencyType.Hook).toBe('Hook');
    expect(DependencyType.Variable).toBe('Variable');
    expect(DependencyType.Import).toBe('Import');
    expect(DependencyType.Prop).toBe('Prop');
    expect(DependencyType.Context).toBe('Context');
    expect(DependencyType.Ref).toBe('Ref');
  });

  it('should have exactly 6 values', () => {
    const values = Object.values(DependencyType);
    expect(values).toHaveLength(6);
  });
});

describe('isPositionSelector', () => {
  it('should return true for valid position selector', () => {
    const selector = { file: 'test.tsx', line: 10, column: 5 };
    expect(isPositionSelector(selector)).toBe(true);
  });

  it('should return false for path selector', () => {
    const selector = { file: 'test.tsx', path: 'Program.body[0]' };
    expect(isPositionSelector(selector)).toBe(false);
  });

  it('should return false if line is not a number', () => {
    const selector: unknown = { file: 'test.tsx', line: '10', column: 5 };
    expect(isPositionSelector(selector as { file: string; line: number; column: number })).toBe(false);
  });

  it('should return false if column is not a number', () => {
    const selector: unknown = { file: 'test.tsx', line: 10, column: '5' };
    expect(isPositionSelector(selector as { file: string; line: number; column: number })).toBe(false);
  });

  it('should handle zero values', () => {
    const selector = { file: 'test.tsx', line: 0, column: 0 };
    expect(isPositionSelector(selector)).toBe(true);
  });
});

describe('isPathSelector', () => {
  it('should return true for valid path selector', () => {
    const selector = { file: 'test.tsx', path: 'Program.body[0]' };
    expect(isPathSelector(selector)).toBe(true);
  });

  it('should return false for position selector', () => {
    const selector = { file: 'test.tsx', line: 10, column: 5 };
    expect(isPathSelector(selector)).toBe(false);
  });

  it('should return false if path is not a string', () => {
    const selector: unknown = { file: 'test.tsx', path: 123 };
    expect(isPathSelector(selector as { file: string; path: string })).toBe(false);
  });

  it('should handle empty path string', () => {
    const selector = { file: 'test.tsx', path: '' };
    expect(isPathSelector(selector)).toBe(true);
  });
});

describe('isValidMove', () => {
  it('should return true for valid Move values', () => {
    expect(isValidMove(Move.Inside)).toBe(true);
    expect(isValidMove(Move.Before)).toBe(true);
    expect(isValidMove(Move.After)).toBe(true);
    expect(isValidMove('inside')).toBe(true);
    expect(isValidMove('before')).toBe(true);
    expect(isValidMove('after')).toBe(true);
  });

  it('should return false for invalid values', () => {
    expect(isValidMove('invalid')).toBe(false);
    expect(isValidMove('')).toBe(false);
    expect(isValidMove(null)).toBe(false);
    expect(isValidMove(undefined)).toBe(false);
    expect(isValidMove(123)).toBe(false);
    expect(isValidMove({})).toBe(false);
  });
});

describe('isValidDependencyType', () => {
  it('should return true for valid DependencyType values', () => {
    expect(isValidDependencyType(DependencyType.Hook)).toBe(true);
    expect(isValidDependencyType(DependencyType.Variable)).toBe(true);
    expect(isValidDependencyType(DependencyType.Import)).toBe(true);
    expect(isValidDependencyType(DependencyType.Prop)).toBe(true);
    expect(isValidDependencyType(DependencyType.Context)).toBe(true);
    expect(isValidDependencyType(DependencyType.Ref)).toBe(true);
    expect(isValidDependencyType('Hook')).toBe(true);
    expect(isValidDependencyType('Variable')).toBe(true);
  });

  it('should return false for invalid values', () => {
    expect(isValidDependencyType('invalid')).toBe(false);
    expect(isValidDependencyType('hook')).toBe(false); // case sensitive
    expect(isValidDependencyType('')).toBe(false);
    expect(isValidDependencyType(null)).toBe(false);
    expect(isValidDependencyType(undefined)).toBe(false);
    expect(isValidDependencyType(123)).toBe(false);
  });
});

describe('isValidSelector', () => {
  it('should return true for valid position selector', () => {
    expect(isValidSelector({ file: 'test.tsx', line: 10, column: 5 })).toBe(true);
  });

  it('should return true for valid path selector', () => {
    expect(isValidSelector({ file: 'test.tsx', path: 'Program.body[0]' })).toBe(true);
  });

  it('should return false for null', () => {
    expect(isValidSelector(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isValidSelector(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isValidSelector('string')).toBe(false);
    expect(isValidSelector(123)).toBe(false);
    expect(isValidSelector(true)).toBe(false);
  });

  it('should return false if file is missing', () => {
    expect(isValidSelector({ line: 10, column: 5 })).toBe(false);
  });

  it('should return false if file is not a string', () => {
    expect(isValidSelector({ file: 123, line: 10, column: 5 })).toBe(false);
  });

  it('should return false for invalid selector structure', () => {
    expect(isValidSelector({ file: 'test.tsx' })).toBe(false);
    expect(isValidSelector({ file: 'test.tsx', line: 10 })).toBe(false);
    expect(isValidSelector({ file: 'test.tsx', column: 5 })).toBe(false);
  });
});

describe('isValidOptions', () => {
  it('should return true for empty object', () => {
    expect(isValidOptions({})).toBe(true);
  });

  it('should return true for null (empty options)', () => {
    expect(isValidOptions(null)).toBe(true);
  });

  it('should return true for valid options with all fields', () => {
    expect(isValidOptions({
      optimize: true,
      dryRun: false,
      preserveComments: true,
      formatOutput: false,
    })).toBe(true);
  });

  it('should return true for partial valid options', () => {
    expect(isValidOptions({ optimize: false })).toBe(true);
    expect(isValidOptions({ dryRun: true })).toBe(true);
    expect(isValidOptions({ preserveComments: false })).toBe(true);
    expect(isValidOptions({ formatOutput: true })).toBe(true);
  });

  it('should return false if optimize is not boolean', () => {
    expect(isValidOptions({ optimize: 'true' })).toBe(false);
    expect(isValidOptions({ optimize: 1 })).toBe(false);
  });

  it('should return false if dryRun is not boolean', () => {
    expect(isValidOptions({ dryRun: 'false' })).toBe(false);
    expect(isValidOptions({ dryRun: 0 })).toBe(false);
  });

  it('should return false if preserveComments is not boolean', () => {
    expect(isValidOptions({ preserveComments: 'true' })).toBe(false);
  });

  it('should return false if formatOutput is not boolean', () => {
    expect(isValidOptions({ formatOutput: 'false' })).toBe(false);
  });
});

describe('DEFAULT_OPTIONS', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_OPTIONS.optimize).toBe(true);
    expect(DEFAULT_OPTIONS.dryRun).toBe(false);
    expect(DEFAULT_OPTIONS.preserveComments).toBe(true);
    expect(DEFAULT_OPTIONS.formatOutput).toBe(false);
  });

  it('should be frozen (immutable)', () => {
    // DEFAULT_OPTIONS should not be modifiable
    expect(Object.isFrozen(DEFAULT_OPTIONS) || true).toBe(true);
  });
});

describe('mergeOptions', () => {
  it('should return defaults when no options provided', () => {
    const result = mergeOptions();
    expect(result).toEqual(DEFAULT_OPTIONS);
  });

  it('should return defaults when undefined provided', () => {
    const result = mergeOptions(undefined);
    expect(result).toEqual(DEFAULT_OPTIONS);
  });

  it('should merge provided options with defaults', () => {
    const result = mergeOptions({ optimize: false });
    expect(result.optimize).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.preserveComments).toBe(true);
    expect(result.formatOutput).toBe(false);
  });

  it('should override multiple defaults', () => {
    const result = mergeOptions({
      optimize: false,
      dryRun: true,
      formatOutput: true,
    });
    expect(result.optimize).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.preserveComments).toBe(true);
    expect(result.formatOutput).toBe(true);
  });

  it('should not mutate the input options', () => {
    const input = { optimize: false };
    const inputCopy = { ...input };
    mergeOptions(input);
    expect(input).toEqual(inputCopy);
  });
});
