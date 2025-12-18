/**
 * DependencyError Factory Tests
 *
 * Tests for the new interface-based DependencyError with factory function.
 * This implements Task 8.5: Write tests for DependencyError factory function.
 */

import { describe, it, expect } from 'vitest';
import {
  createDependencyError,
  isDependencyError,
  ParseError,
} from '../error-category.js';

describe('DependencyError factory (interface-based)', () => {
  it('should create DependencyError with _tag discriminant', () => {
    const error = createDependencyError({
      code: 'E020',
      message: 'Cannot analyze',
      unresolvableReason: 'eval() detected',
      file: 'test.tsx',
    });

    expect(error._tag).toBe('DependencyError');
    expect(error.code).toBe('E020');
    expect(error.message).toBe('Cannot analyze');
    expect(error.unresolvableReason).toBe('eval() detected');
    expect(error.file).toBe('test.tsx');
  });

  it('should create DependencyError with all required fields', () => {
    const error = createDependencyError({
      code: 'E021',
      message: 'Unresolvable reference',
      unresolvableReason: 'Reference not found',
      file: 'app.tsx',
      location: { start: { line: 5, column: 10 }, end: { line: 5, column: 20 } },
    });

    expect(error._tag).toBe('DependencyError');
    expect(error.code).toBe('E021');
    expect(error.message).toBe('Unresolvable reference');
    expect(error.unresolvableReason).toBe('Reference not found');
    expect(error.file).toBe('app.tsx');
    expect(error.location).toEqual({ start: { line: 5, column: 10 }, end: { line: 5, column: 20 } });
    expect(error.suggestions).toEqual([]);
    expect(error.recoverable).toBe(false);
  });

  it('should create DependencyError with dependency chain field', () => {
    const dependency: any = {
      identifier: 'foo',
      source: 'test.tsx',
      type: 'variable',
      symbol: 'foo',
      origin: 'test.tsx',
      scope: 'module',
      isTransitive: false,
    };

    const error = createDependencyError({
      code: 'E020',
      message: 'Cannot resolve dependency',
      unresolvableReason: 'eval() detected',
      dependency,
      file: 'test.tsx',
    });

    expect(error._tag).toBe('DependencyError');
    expect(error.dependency).toMatchObject({ identifier: 'foo', source: 'test.tsx', type: 'variable' });
  });

  it('should create DependencyError with optional suggestions', () => {
    const suggestions = [
      { description: 'Remove eval()', action: 'remove_eval', automatic: false },
    ];

    const error = createDependencyError({
      code: 'E020',
      message: 'Cannot analyze',
      unresolvableReason: 'eval() detected',
      file: 'test.tsx',
      suggestions,
    });

    expect(error._tag).toBe('DependencyError');
    expect(error.suggestions).toEqual(suggestions);
  });

  it('should create DependencyError with custom recoverable flag', () => {
    const error = createDependencyError({
      code: 'E022',
      message: 'Unresolvable reference',
      unresolvableReason: 'Reference not in scope',
      file: 'test.tsx',
      recoverable: true,
    });

    expect(error._tag).toBe('DependencyError');
    expect(error.recoverable).toBe(true);
  });

  it('should have type guard isDependencyError work correctly', () => {
    const error = createDependencyError({
      code: 'E020',
      message: 'Cannot analyze',
      unresolvableReason: 'eval() detected',
      file: 'test.tsx',
    });

    expect(isDependencyError(error)).toBe(true);
  });

  it('should have type guard reject non-DependencyError objects', () => {
    const parseError = new ParseError({
      code: 'E001',
      message: 'Parse failed',
      syntaxError: 'Unexpected token',
      file: 'test.tsx',
    });

    expect(isDependencyError(parseError)).toBe(false);
    expect(isDependencyError(null)).toBe(false);
    expect(isDependencyError(undefined)).toBe(false);
    expect(isDependencyError({ _tag: 'SomethingElse' })).toBe(false);
  });
});
