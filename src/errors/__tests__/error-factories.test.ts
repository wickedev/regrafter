/**
 * Error Factory Functions Tests
 *
 * Tests for ValidationError, TransformError, CircularError, InternalError factory functions (Tasks 8.7-8.14)
 * and RegraffError union type (Task 9)
 */

import { describe, it, expect } from 'vitest';
import {
  ParseError,
  createParseError,
  createSelectorError,
  createDependencyError,
  createValidationError,
  createTransformError,
  createCircularError,
  createInternalError,
  isValidationError,
  isTransformError,
  isCircularError,
  isInternalError,
  isParseError,
  isSelectorError,
  isDependencyError,
  type RegraffError,
} from '../error-category.js';

// Task 8.7: Tests for ValidationError factory function
describe('ValidationError factory function', () => {
  it('should create ValidationError with _tag discriminant', () => {
    const error = createValidationError({
      code: 'E030',
      message: 'Hook in conditional',
      constraint: 'HOOKS_RULES',
      details: 'Cannot call hooks conditionally',
    });

    expect(error._tag).toBe('ValidationError');
  });

  it('should include all required fields', () => {
    const error = createValidationError({
      code: 'E030',
      message: 'Hook in conditional',
      constraint: 'HOOKS_RULES',
      details: 'Cannot call hooks conditionally',
    });

    expect(error.code).toBe('E030');
    expect(error.message).toBe('Hook in conditional');
    expect(error.constraint).toBe('HOOKS_RULES');
    expect(error.details).toBe('Cannot call hooks conditionally');
    expect(error.suggestions).toEqual([]);
    expect(error.recoverable).toBe(false);
  });

  it('should include optional file and location fields', () => {
    const error = createValidationError({
      code: 'E030',
      message: 'Hook in conditional',
      constraint: 'HOOKS_RULES',
      details: 'Cannot call hooks conditionally',
      file: 'test.tsx',
      location: { start: { line: 10, column: 5 }, end: { line: 10, column: 15 } },
    });

    expect(error.file).toBe('test.tsx');
    expect(error.location).toEqual({ start: { line: 10, column: 5 }, end: { line: 10, column: 15 } });
  });

  it('should include optional suggestions', () => {
    const suggestions = [{ description: 'Move hook to top level', action: 'move', automatic: true }];
    const error = createValidationError({
      code: 'E030',
      message: 'Hook in conditional',
      constraint: 'HOOKS_RULES',
      details: 'Cannot call hooks conditionally',
      suggestions,
    });

    expect(error.suggestions).toEqual(suggestions);
  });

  it('should allow custom recoverable flag', () => {
    const error = createValidationError({
      code: 'E030',
      message: 'Hook in conditional',
      constraint: 'HOOKS_RULES',
      details: 'Cannot call hooks conditionally',
      recoverable: true,
    });

    expect(error.recoverable).toBe(true);
  });

  it('should work with isValidationError type guard', () => {
    const error = createValidationError({
      code: 'E030',
      message: 'Hook in conditional',
      constraint: 'HOOKS_RULES',
      details: 'Cannot call hooks conditionally',
    });

    expect(isValidationError(error)).toBe(true);
  });

  it('should return false for non-ValidationError with isValidationError', () => {
    const parseError = new ParseError({
      code: 'E001',
      message: 'Test',
      syntaxError: 'test',
      file: 'test.tsx',
    });

    expect(isValidationError(parseError)).toBe(false);
    expect(isValidationError(null)).toBe(false);
    expect(isValidationError({ _tag: 'SomeOtherError' })).toBe(false);
  });
});

// Task 8.9: Tests for TransformError factory function
describe('TransformError factory function', () => {
  it('should create TransformError with _tag discriminant', () => {
    const error = createTransformError({
      code: 'E050',
      message: 'Insert failed',
      operation: 'insert_element',
    });

    expect(error._tag).toBe('TransformError');
  });

  it('should include all required fields', () => {
    const error = createTransformError({
      code: 'E050',
      message: 'Insert failed',
      operation: 'insert_element',
    });

    expect(error.code).toBe('E050');
    expect(error.message).toBe('Insert failed');
    expect(error.operation).toBe('insert_element');
    expect(error.suggestions).toEqual([]);
    expect(error.recoverable).toBe(false);
  });

  it('should include optional file and location fields', () => {
    const error = createTransformError({
      code: 'E050',
      message: 'Insert failed',
      operation: 'insert_element',
      file: 'test.tsx',
      location: { start: { line: 10, column: 5 }, end: { line: 10, column: 15 } },
    });

    expect(error.file).toBe('test.tsx');
    expect(error.location).toEqual({ start: { line: 10, column: 5 }, end: { line: 10, column: 15 } });
  });

  it('should include optional suggestions', () => {
    const suggestions = [{ description: 'Check target location', action: 'check', automatic: false }];
    const error = createTransformError({
      code: 'E050',
      message: 'Insert failed',
      operation: 'insert_element',
      suggestions,
    });

    expect(error.suggestions).toEqual(suggestions);
  });

  it('should work with isTransformError type guard', () => {
    const error = createTransformError({
      code: 'E050',
      message: 'Insert failed',
      operation: 'insert_element',
    });

    expect(isTransformError(error)).toBe(true);
  });

  it('should return false for non-TransformError with isTransformError', () => {
    const parseError = new ParseError({
      code: 'E001',
      message: 'Test',
      syntaxError: 'test',
      file: 'test.tsx',
    });

    expect(isTransformError(parseError)).toBe(false);
    expect(isTransformError(null)).toBe(false);
    expect(isTransformError({ _tag: 'SomeOtherError' })).toBe(false);
  });
});

// Task 8.11: Tests for CircularError factory function
describe('CircularError factory', () => {
  it('should create CircularError with _tag discriminant', () => {
    const cycle = ['A.tsx', 'B.tsx', 'C.tsx', 'A.tsx'];
    const error = createCircularError({
      code: 'E040',
      message: 'Circular dependency detected',
      cycle,
    });

    expect(error._tag).toBe('CircularError');
    expect(error.code).toBe('E040');
    expect(error.message).toBe('Circular dependency detected');
    expect(error.cycle).toEqual(cycle);
    expect(error.recoverable).toBe(true);
    expect(error.suggestions).toEqual([]);
  });

  it('should create CircularError with all optional fields', () => {
    const cycle = ['A.tsx', 'B.tsx', 'A.tsx'];
    const location = { start: { line: 5, column: 0 }, end: { line: 5, column: 20 } };
    const suggestions = [{ description: 'Break the cycle', action: 'refactor', automatic: false }];

    const error = createCircularError({
      code: 'E041',
      message: 'Import cycle detected',
      cycle,
      file: 'A.tsx',
      location,
      suggestions,
    });

    expect(error._tag).toBe('CircularError');
    expect(error.file).toBe('A.tsx');
    expect(error.location).toEqual(location);
    expect(error.suggestions).toEqual(suggestions);
  });

  it('should have type guard isCircularError working correctly', () => {
    const cycle = ['A.tsx', 'B.tsx', 'A.tsx'];
    const error = createCircularError({
      code: 'E040',
      message: 'Circular dependency',
      cycle,
    });

    expect(isCircularError(error)).toBe(true);
    expect(isCircularError({ _tag: 'ParseError' })).toBe(false);
    expect(isCircularError(null)).toBe(false);
    expect(isCircularError(undefined)).toBe(false);
    expect(isCircularError('not an error')).toBe(false);
  });
});

// Task 8.13: Tests for InternalError factory function
describe('InternalError factory', () => {
  it('should create InternalError with _tag discriminant', () => {
    const error = createInternalError({
      message: 'Unexpected null reference',
    });

    expect(error._tag).toBe('InternalError');
    expect(error.code).toBe('E099');
    expect(error.message).toBe('Unexpected null reference');
    expect(error.recoverable).toBe(false);
    expect(error.suggestions).toEqual([]);
  });

  it('should create InternalError with custom code', () => {
    const error = createInternalError({
      code: 'E090',
      message: 'Assertion failed',
    });

    expect(error._tag).toBe('InternalError');
    expect(error.code).toBe('E090');
  });

  it('should create InternalError with all optional fields', () => {
    const location = { start: { line: 10, column: 5 }, end: { line: 10, column: 15 } };
    const cause = new Error('Original error');

    const error = createInternalError({
      code: 'E091',
      message: 'Internal state corrupted',
      file: 'module.tsx',
      location,
      cause,
    });

    expect(error._tag).toBe('InternalError');
    expect(error.file).toBe('module.tsx');
    expect(error.location).toEqual(location);
    expect(error.cause).toBe(cause);
  });

  it('should have type guard isInternalError working correctly', () => {
    const error = createInternalError({
      message: 'Internal error',
    });

    expect(isInternalError(error)).toBe(true);
    expect(isInternalError({ _tag: 'CircularError' })).toBe(false);
    expect(isInternalError(null)).toBe(false);
    expect(isInternalError(undefined)).toBe(false);
    expect(isInternalError('not an error')).toBe(false);
  });
});

// Task 9: Tests for RegraffError union type
describe('RegraffError union type', () => {
  it('should accept ParseErrorType', () => {
    const error: RegraffError = createParseError({
      code: 'E001',
      message: 'Parse failed',
      syntaxError: 'Unexpected token',
      file: 'test.tsx',
    });

    expect(error._tag).toBe('ParseError');
    expect(isParseError(error)).toBe(true);
  });

  it('should accept SelectorErrorType', () => {
    const error: RegraffError = createSelectorError({
      code: 'E010',
      message: 'Selector not found',
      selector: { file: 'test.tsx', line: 10, column: 5 },
      file: 'test.tsx',
    });

    expect(error._tag).toBe('SelectorError');
    expect(isSelectorError(error)).toBe(true);
  });

  it('should accept DependencyErrorType', () => {
    const error: RegraffError = createDependencyError({
      code: 'E020',
      message: 'Dependency unresolvable',
      unresolvableReason: 'eval() detected',
    });

    expect(error._tag).toBe('DependencyError');
    expect(isDependencyError(error)).toBe(true);
  });

  it('should accept ValidationErrorType', () => {
    const error: RegraffError = createValidationError({
      code: 'E030',
      message: 'Validation failed',
      constraint: 'HOOKS_RULES',
      details: 'Hook in conditional',
    });

    expect(error._tag).toBe('ValidationError');
    expect(isValidationError(error)).toBe(true);
  });

  it('should accept TransformErrorType', () => {
    const error: RegraffError = createTransformError({
      code: 'E050',
      message: 'Transform failed',
      operation: 'insert_element',
    });

    expect(error._tag).toBe('TransformError');
    expect(isTransformError(error)).toBe(true);
  });

  it('should accept CircularErrorType', () => {
    const error: RegraffError = createCircularError({
      code: 'E040',
      message: 'Circular dependency',
      cycle: ['A.tsx', 'B.tsx', 'A.tsx'],
    });

    expect(error._tag).toBe('CircularError');
    expect(isCircularError(error)).toBe(true);
  });

  it('should accept InternalErrorType', () => {
    const error: RegraffError = createInternalError({
      message: 'Internal error',
    });

    expect(error._tag).toBe('InternalError');
    expect(isInternalError(error)).toBe(true);
  });

  it('should allow exhaustive switch checking with discriminated union', () => {
    const errors: RegraffError[] = [
      createParseError({ code: 'E001', message: 'Parse error', syntaxError: 'test', file: 'test.tsx' }),
      createSelectorError({ code: 'E010', message: 'Selector error', selector: { file: 'test.tsx', line: 1, column: 1 }, file: 'test.tsx' }),
      createDependencyError({ code: 'E020', message: 'Dependency error', unresolvableReason: 'test' }),
      createValidationError({ code: 'E030', message: 'Validation error', constraint: 'test', details: 'test' }),
      createTransformError({ code: 'E050', message: 'Transform error', operation: 'test' }),
      createCircularError({ code: 'E040', message: 'Circular error', cycle: [] }),
      createInternalError({ message: 'Internal error' }),
    ];

    const errorTypes = errors.map(error => {
      switch (error._tag) {
        case 'ParseError':
          return 'parse';
        case 'SelectorError':
          return 'selector';
        case 'DependencyError':
          return 'dependency';
        case 'ValidationError':
          return 'validation';
        case 'TransformError':
          return 'transform';
        case 'CircularError':
          return 'circular';
        case 'InternalError':
          return 'internal';
        default:
          // TypeScript should ensure this is unreachable if union is exhaustive
          const _exhaustive: never = error;
          return _exhaustive;
      }
    });

    expect(errorTypes).toEqual(['parse', 'selector', 'dependency', 'validation', 'transform', 'circular', 'internal']);
  });

  it('should work correctly with all type guards', () => {
    const parseError = createParseError({ code: 'E001', message: 'test', syntaxError: 'test', file: 'test.tsx' });
    const selectorError = createSelectorError({ code: 'E010', message: 'test', selector: { file: 'test.tsx', line: 1, column: 1 }, file: 'test.tsx' });
    const dependencyError = createDependencyError({ code: 'E020', message: 'test', unresolvableReason: 'test' });

    // Type guard should correctly identify each error type
    expect(isParseError(parseError)).toBe(true);
    expect(isParseError(selectorError)).toBe(false);
    expect(isParseError(dependencyError)).toBe(false);

    expect(isSelectorError(parseError)).toBe(false);
    expect(isSelectorError(selectorError)).toBe(true);
    expect(isSelectorError(dependencyError)).toBe(false);

    expect(isDependencyError(parseError)).toBe(false);
    expect(isDependencyError(selectorError)).toBe(false);
    expect(isDependencyError(dependencyError)).toBe(true);
  });
});
