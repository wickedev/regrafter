/**
 * Error Handling Tests
 *
 * Tests for error categories, error codes, and error recovery.
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCategory,
  RegraffError,
  ParseError,
  SelectorError,
  DependencyError,
  ValidationError,
  TransformError,
  CircularError,
  InternalError,
  isRegraffError,
  isParseError,
  isSelectorError,
  isDependencyError,
  isValidationError,
  isTransformError,
  isCircularError,
  isInternalError,
} from '../ErrorCategory.js';

import {
  ERROR_CODES,
  createParseErrorWithCode,
  createSelectorErrorWithCode,
  createDependencyErrorWithCode,
  createValidationErrorWithCode,
  createCircularErrorWithCode,
  createTransformErrorWithCode,
  createInternalErrorWithCode,
  getErrorCodeDefinition,
  getErrorCodesByCategory,
  isRecoverableErrorCode,
} from '../ErrorCodes.js';

import {
  getSuggestedFixesForParseError,
  getSuggestedFixesForSelectorError,
  getSuggestedFixesForDependencyError,
  getSuggestedFixesForValidationError,
  getSuggestedFixesForCircularError,
  getSuggestedFixesForError,
} from '../SuggestedFixes.js';

import {
  isRecoverable,
  getRecoveryStrategy,
  attemptRecovery,
  RECOVERY_STRATEGIES,
} from '../ErrorRecovery.js';

describe('ErrorCategory', () => {
  it('should have all expected categories', () => {
    expect(ErrorCategory.Parse).toBe('PARSE');
    expect(ErrorCategory.Selector).toBe('SELECTOR');
    expect(ErrorCategory.Dependency).toBe('DEPENDENCY');
    expect(ErrorCategory.Validation).toBe('VALIDATION');
    expect(ErrorCategory.Transform).toBe('TRANSFORM');
    expect(ErrorCategory.Circular).toBe('CIRCULAR');
    expect(ErrorCategory.Internal).toBe('INTERNAL');
  });
});

describe('RegraffError', () => {
  it('should create error with all properties', () => {
    const error = new RegraffError({
      category: ErrorCategory.Parse,
      code: 'E001',
      message: 'Test error',
      file: 'test.tsx',
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
      suggestions: [{ description: 'Fix it', action: 'fix', automatic: true }],
      recoverable: true,
    });

    expect(error.category).toBe(ErrorCategory.Parse);
    expect(error.code).toBe('E001');
    expect(error.message).toBe('Test error');
    expect(error.file).toBe('test.tsx');
    expect(error.location).toBeDefined();
    expect(error.suggestions).toHaveLength(1);
    expect(error.recoverable).toBe(true);
  });

  it('should format error string with location', () => {
    const error = new RegraffError({
      category: ErrorCategory.Parse,
      code: 'E001',
      message: 'Test error',
      file: 'test.tsx',
      location: { start: { line: 10, column: 5 }, end: { line: 10, column: 15 } },
    });

    const formatted = error.toFormattedString();
    expect(formatted).toContain('[E001]');
    expect(formatted).toContain('Test error');
    expect(formatted).toContain('test.tsx:10:5');
  });

  it('should convert to JSON', () => {
    const error = new RegraffError({
      category: ErrorCategory.Parse,
      code: 'E001',
      message: 'Test error',
    });

    const json = error.toJSON();
    expect(json.category).toBe('PARSE');
    expect(json.code).toBe('E001');
    expect(json.message).toBe('Test error');
  });
});

describe('Specialized Error Classes', () => {
  describe('ParseError', () => {
    it('should create parse error with syntax details', () => {
      const error = new ParseError({
        code: 'E001',
        message: 'Parse failed',
        syntaxError: 'Unexpected token',
        file: 'test.tsx',
        recoveryHint: 'Check for missing bracket',
      });

      expect(error.category).toBe(ErrorCategory.Parse);
      expect(error.syntaxError).toBe('Unexpected token');
      expect(error.recoveryHint).toBe('Check for missing bracket');
    });
  });

  describe('SelectorError', () => {
    it('should create selector error with selector info', () => {
      const selector = { file: 'test.tsx', line: 10, column: 5 };
      const error = new SelectorError({
        code: 'E010',
        message: 'Element not found',
        selector,
        file: 'test.tsx',
        nearestMatch: '<div>',
      });

      expect(error.category).toBe(ErrorCategory.Selector);
      expect(error.selector).toBe(selector);
      expect(error.nearestMatch).toBe('<div>');
    });
  });

  describe('DependencyError', () => {
    it('should create dependency error with reason', () => {
      const error = new DependencyError({
        code: 'E020',
        message: 'Cannot analyze',
        unresolvableReason: 'eval() detected',
        file: 'test.tsx',
      });

      expect(error.category).toBe(ErrorCategory.Dependency);
      expect(error.unresolvableReason).toBe('eval() detected');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with constraint info', () => {
      const error = new ValidationError({
        code: 'E030',
        message: 'Hook in conditional',
        constraint: 'HOOKS_RULES',
        details: 'Cannot call hooks conditionally',
      });

      expect(error.category).toBe(ErrorCategory.Validation);
      expect(error.constraint).toBe('HOOKS_RULES');
      expect(error.details).toBe('Cannot call hooks conditionally');
    });
  });

  describe('TransformError', () => {
    it('should create transform error with operation info', () => {
      const error = new TransformError({
        code: 'E050',
        message: 'Insert failed',
        operation: 'insert_element',
      });

      expect(error.category).toBe(ErrorCategory.Transform);
      expect(error.operation).toBe('insert_element');
    });
  });

  describe('CircularError', () => {
    it('should create circular error with cycle info', () => {
      const cycle = ['A', 'B', 'C', 'A'];
      const error = new CircularError({
        code: 'E040',
        message: 'Circular dependency',
        cycle,
      });

      expect(error.category).toBe(ErrorCategory.Circular);
      expect(error.cycle).toEqual(cycle);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('InternalError', () => {
    it('should create internal error', () => {
      const error = new InternalError({
        message: 'Assertion failed',
        code: 'E090',
      });

      expect(error.category).toBe(ErrorCategory.Internal);
      expect(error.code).toBe('E090');
    });
  });
});

describe('Type Guards', () => {
  it('should identify RegraffError', () => {
    const error = new RegraffError({
      category: ErrorCategory.Parse,
      code: 'E001',
      message: 'Test',
    });

    expect(isRegraffError(error)).toBe(true);
    expect(isRegraffError(new Error('test'))).toBe(false);
    expect(isRegraffError(null)).toBe(false);
  });

  it('should identify specific error types', () => {
    const parseError = new ParseError({
      code: 'E001',
      message: 'Test',
      syntaxError: 'test',
      file: 'test.tsx',
    });

    expect(isParseError(parseError)).toBe(true);
    expect(isSelectorError(parseError)).toBe(false);
    expect(isDependencyError(parseError)).toBe(false);
    expect(isValidationError(parseError)).toBe(false);
    expect(isTransformError(parseError)).toBe(false);
    expect(isCircularError(parseError)).toBe(false);
    expect(isInternalError(parseError)).toBe(false);
  });
});

describe('ERROR_CODES', () => {
  it('should have all documented error codes', () => {
    // Parse errors
    expect(ERROR_CODES['E001']).toBeDefined();
    expect(ERROR_CODES['E002']).toBeDefined();
    expect(ERROR_CODES['E003']).toBeDefined();
    expect(ERROR_CODES['E004']).toBeDefined();
    expect(ERROR_CODES['E005']).toBeDefined();

    // Selector errors
    expect(ERROR_CODES['E010']).toBeDefined();
    expect(ERROR_CODES['E011']).toBeDefined();
    expect(ERROR_CODES['E012']).toBeDefined();

    // Dependency errors
    expect(ERROR_CODES['E020']).toBeDefined();
    expect(ERROR_CODES['E021']).toBeDefined();
    expect(ERROR_CODES['E022']).toBeDefined();

    // Validation errors
    expect(ERROR_CODES['E030']).toBeDefined();
    expect(ERROR_CODES['E031']).toBeDefined();
    expect(ERROR_CODES['E032']).toBeDefined();

    // Circular errors
    expect(ERROR_CODES['E040']).toBeDefined();
    expect(ERROR_CODES['E041']).toBeDefined();

    // Transform errors
    expect(ERROR_CODES['E050']).toBeDefined();
    expect(ERROR_CODES['E051']).toBeDefined();

    // Internal errors
    expect(ERROR_CODES['E099']).toBeDefined();
  });

  it('should have correct categories', () => {
    expect(ERROR_CODES['E001']?.category).toBe(ErrorCategory.Parse);
    expect(ERROR_CODES['E010']?.category).toBe(ErrorCategory.Selector);
    expect(ERROR_CODES['E020']?.category).toBe(ErrorCategory.Dependency);
    expect(ERROR_CODES['E030']?.category).toBe(ErrorCategory.Validation);
    expect(ERROR_CODES['E040']?.category).toBe(ErrorCategory.Circular);
    expect(ERROR_CODES['E050']?.category).toBe(ErrorCategory.Transform);
    expect(ERROR_CODES['E099']?.category).toBe(ErrorCategory.Internal);
  });
});

describe('Error Code Factories', () => {
  describe('createParseErrorWithCode', () => {
    it('should create parse error with formatted message', () => {
      const error = createParseErrorWithCode('E001', {
        file: 'test.tsx',
        message: 'Unexpected token',
      });

      expect(error.code).toBe('E001');
      expect(error.message).toContain('test.tsx');
      expect(error.message).toContain('Unexpected token');
    });
  });

  describe('createSelectorErrorWithCode', () => {
    it('should create selector error with formatted message', () => {
      const error = createSelectorErrorWithCode('E010', {
        selector: { file: 'test.tsx', line: 10, column: 5 },
        file: 'test.tsx',
        line: 10,
        column: 5,
      });

      expect(error.code).toBe('E010');
      expect(error.message).toContain('test.tsx');
      expect(error.message).toContain('10');
    });
  });

  describe('createValidationErrorWithCode', () => {
    it('should create validation error with hook name', () => {
      const error = createValidationErrorWithCode('E030', {
        hook: 'useState',
      });

      expect(error.code).toBe('E030');
      expect(error.message).toContain('useState');
    });
  });

  describe('createCircularErrorWithCode', () => {
    it('should create circular error with cycle path', () => {
      const error = createCircularErrorWithCode('E040', {
        cycle: ['A', 'B', 'C', 'A'],
      });

      expect(error.code).toBe('E040');
      expect(error.message).toContain('A -> B -> C -> A');
    });
  });
});

describe('Error Code Lookup', () => {
  describe('getErrorCodeDefinition', () => {
    it('should return definition for valid code', () => {
      const def = getErrorCodeDefinition('E001');
      expect(def).toBeDefined();
      expect(def?.code).toBe('E001');
      expect(def?.category).toBe(ErrorCategory.Parse);
    });

    it('should return undefined for invalid code', () => {
      const def = getErrorCodeDefinition('E999');
      expect(def).toBeUndefined();
    });
  });

  describe('getErrorCodesByCategory', () => {
    it('should return all errors in category', () => {
      const parseErrors = getErrorCodesByCategory(ErrorCategory.Parse);
      expect(parseErrors.length).toBeGreaterThan(0);
      expect(parseErrors.every(e => e.category === ErrorCategory.Parse)).toBe(true);
    });
  });

  describe('isRecoverableErrorCode', () => {
    it('should identify recoverable codes', () => {
      expect(isRecoverableErrorCode('E022')).toBe(true); // Unresolvable reference
      expect(isRecoverableErrorCode('E030')).toBe(true); // Hook in conditional
      expect(isRecoverableErrorCode('E040')).toBe(true); // Circular dependency
    });

    it('should identify non-recoverable codes', () => {
      expect(isRecoverableErrorCode('E001')).toBe(false); // Parse error
      expect(isRecoverableErrorCode('E020')).toBe(false); // eval() detected
      expect(isRecoverableErrorCode('E050')).toBe(false); // Transform failed
    });
  });
});

describe('Suggested Fixes', () => {
  describe('getSuggestedFixesForParseError', () => {
    it('should suggest fixes for token errors', () => {
      const fixes = getSuggestedFixesForParseError('Unexpected token', 'test.tsx');
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some(f => f.description.includes('bracket'))).toBe(true);
    });

    it('should suggest fixes for JSX errors', () => {
      const fixes = getSuggestedFixesForParseError('JSX error', 'test.tsx');
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some(f => f.description.toLowerCase().includes('jsx'))).toBe(true);
    });
  });

  describe('getSuggestedFixesForValidationError', () => {
    it('should suggest fixes for hook in conditional', () => {
      const fixes = getSuggestedFixesForValidationError('E030', 'useState');
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some(f => f.description.includes('useState'))).toBe(true);
      expect(fixes.some(f => f.automatic)).toBe(true);
    });

    it('should suggest fixes for hook in loop', () => {
      const fixes = getSuggestedFixesForValidationError('E031', 'useEffect');
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some(f => f.action === 'move_hook_to_top')).toBe(true);
    });
  });

  describe('getSuggestedFixesForCircularError', () => {
    it('should suggest breaking cycle', () => {
      const fixes = getSuggestedFixesForCircularError('E040', ['A', 'B', 'A']);
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some(f => f.action === 'create_shared_module')).toBe(true);
    });
  });
});

describe('Error Recovery', () => {
  describe('isRecoverable', () => {
    it('should identify recoverable errors', () => {
      const recoverableError = new ValidationError({
        code: 'E030',
        message: 'Hook in conditional',
        constraint: 'HOOKS_RULES',
        details: 'test',
        recoverable: true,
      });

      expect(isRecoverable(recoverableError)).toBe(true);
    });

    it('should reject non-recoverable errors', () => {
      const nonRecoverableError = new ParseError({
        code: 'E001',
        message: 'Parse failed',
        syntaxError: 'test',
        file: 'test.tsx',
      });

      expect(isRecoverable(nonRecoverableError)).toBe(false);
    });
  });

  describe('getRecoveryStrategy', () => {
    it('should return strategy for recoverable error', () => {
      const error = new ValidationError({
        code: 'E030',
        message: 'Hook in conditional',
        constraint: 'HOOKS_RULES',
        details: 'test',
        recoverable: true,
      });

      const strategy = getRecoveryStrategy(error);
      expect(strategy).toBeDefined();
      expect(strategy?.canAutoRecover).toBe(true);
    });
  });

  describe('attemptRecovery', () => {
    it('should attempt recovery for recoverable error', async () => {
      const error = new ValidationError({
        code: 'E030',
        message: 'Hook in conditional',
        constraint: 'HOOKS_RULES',
        details: 'test',
        recoverable: true,
      });

      const result = await attemptRecovery(error);
      expect(result.success).toBe(true);
      expect(result.action).toBeDefined();
    });

    it('should fail for non-recoverable error', async () => {
      const error = new ParseError({
        code: 'E001',
        message: 'Parse failed',
        syntaxError: 'test',
        file: 'test.tsx',
      });

      const result = await attemptRecovery(error);
      expect(result.success).toBe(false);
    });
  });

  describe('RECOVERY_STRATEGIES', () => {
    it('should have strategies for validation errors', () => {
      expect(RECOVERY_STRATEGIES.has('E030')).toBe(true);
      expect(RECOVERY_STRATEGIES.has('E031')).toBe(true);
      expect(RECOVERY_STRATEGIES.has('E035')).toBe(true);
    });

    it('should have strategies for circular errors', () => {
      expect(RECOVERY_STRATEGIES.has('E040')).toBe(true);
      expect(RECOVERY_STRATEGIES.has('E041')).toBe(true);
    });
  });
});
