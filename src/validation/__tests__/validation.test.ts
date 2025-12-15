/**
 * Runtime Validation Tests
 *
 * Tests for API input validation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateString,
  validatePositiveInteger,
  validateBoolean,
  validatePositionSelector,
  validatePathSelector,
  validateSelector,
  validateMove,
  validateOptions,
  validateFileInput,
  validateFileInputArray,
  validateRegraftInput,
  assertRegraftInput,
  assertSelector,
  assertMove,
  assertOptions,
  InputValidationError,
} from '../index.js';
import { Move } from '../../types/public.js';

describe('Primitive Validators', () => {
  describe('validateString', () => {
    it('should accept valid string', () => {
      const result = validateString('hello', 'test');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should reject non-string', () => {
      const result = validateString(123, 'test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a string');
    });

    it('should reject empty string', () => {
      const result = validateString('', 'test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
  });

  describe('validatePositiveInteger', () => {
    it('should accept positive integer', () => {
      const result = validatePositiveInteger(5, 'test');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should reject non-number', () => {
      const result = validatePositiveInteger('5', 'test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a number');
    });

    it('should reject non-integer', () => {
      const result = validatePositiveInteger(5.5, 'test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an integer');
    });

    it('should reject zero', () => {
      const result = validatePositiveInteger(0, 'test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });

    it('should reject negative', () => {
      const result = validatePositiveInteger(-1, 'test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });
  });

  describe('validateBoolean', () => {
    it('should accept boolean', () => {
      expect(validateBoolean(true, 'test').valid).toBe(true);
      expect(validateBoolean(false, 'test').valid).toBe(true);
    });

    it('should reject non-boolean', () => {
      expect(validateBoolean('true', 'test').valid).toBe(false);
      expect(validateBoolean(1, 'test').valid).toBe(false);
      expect(validateBoolean(null, 'test').valid).toBe(false);
    });
  });
});

describe('Selector Validators', () => {
  describe('validatePositionSelector', () => {
    it('should accept valid position selector', () => {
      const result = validatePositionSelector({
        file: 'test.tsx',
        line: 10,
        column: 5,
      });

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({
        file: 'test.tsx',
        line: 10,
        column: 5,
      });
    });

    it('should reject missing file', () => {
      const result = validatePositionSelector({
        line: 10,
        column: 5,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject invalid line', () => {
      const result = validatePositionSelector({
        file: 'test.tsx',
        line: 0,
        column: 5,
      });

      expect(result.valid).toBe(false);
    });

    it('should reject non-object', () => {
      const result = validatePositionSelector('test.tsx:10:5');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePathSelector', () => {
    it('should accept valid path selector', () => {
      const result = validatePathSelector({
        file: 'test.tsx',
        path: 'Program.body[0]',
      });

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({
        file: 'test.tsx',
        path: 'Program.body[0]',
      });
    });

    it('should reject missing path', () => {
      const result = validatePathSelector({
        file: 'test.tsx',
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('validateSelector', () => {
    it('should accept position selector', () => {
      const result = validateSelector({
        file: 'test.tsx',
        line: 10,
        column: 5,
      });

      expect(result.valid).toBe(true);
    });

    it('should accept path selector', () => {
      const result = validateSelector({
        file: 'test.tsx',
        path: 'Program.body[0]',
      });

      expect(result.valid).toBe(true);
    });

    it('should reject invalid selector', () => {
      const result = validateSelector({
        file: 'test.tsx',
        // neither position nor path
      });

      expect(result.valid).toBe(false);
    });
  });
});

describe('validateMove', () => {
  it('should accept valid move values', () => {
    expect(validateMove('inside').valid).toBe(true);
    expect(validateMove('before').valid).toBe(true);
    expect(validateMove('after').valid).toBe(true);
    expect(validateMove(Move.Inside).valid).toBe(true);
  });

  it('should reject invalid move values', () => {
    expect(validateMove('into').valid).toBe(false);
    expect(validateMove('').valid).toBe(false);
    expect(validateMove(null).valid).toBe(false);
  });
});

describe('validateOptions', () => {
  it('should accept undefined', () => {
    const result = validateOptions(undefined);
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({});
  });

  it('should accept empty object', () => {
    const result = validateOptions({});
    expect(result.valid).toBe(true);
  });

  it('should accept valid options', () => {
    const result = validateOptions({
      optimize: true,
      dryRun: false,
      preserveComments: true,
      formatOutput: false,
    });

    expect(result.valid).toBe(true);
  });

  it('should reject invalid option types', () => {
    const result = validateOptions({
      optimize: 'yes',
    });

    expect(result.valid).toBe(false);
  });

  it('should reject unknown options', () => {
    const result = validateOptions({
      unknownOption: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.includes('unknownOption'))).toBe(true);
  });
});

describe('validateFileInput', () => {
  it('should accept valid file input', () => {
    const result = validateFileInput(
      { path: 'test.tsx', content: 'const x = 1;' },
      0
    );

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      path: 'test.tsx',
      content: 'const x = 1;',
    });
  });

  it('should reject missing path', () => {
    const result = validateFileInput({ content: 'code' }, 0);
    expect(result.valid).toBe(false);
  });

  it('should reject missing content', () => {
    const result = validateFileInput({ path: 'test.tsx' }, 0);
    expect(result.valid).toBe(false);
  });

  it('should accept empty content', () => {
    const result = validateFileInput({ path: 'test.tsx', content: '' }, 0);
    expect(result.valid).toBe(true);
  });
});

describe('validateFileInputArray', () => {
  it('should accept valid file array', () => {
    const result = validateFileInputArray([
      { path: 'a.tsx', content: 'const a = 1;' },
      { path: 'b.tsx', content: 'const b = 2;' },
    ]);

    expect(result.valid).toBe(true);
    expect(result.value).toHaveLength(2);
  });

  it('should reject empty array', () => {
    const result = validateFileInputArray([]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least one file');
  });

  it('should reject non-array', () => {
    const result = validateFileInputArray({ path: 'test.tsx', content: '' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be an array');
  });

  it('should collect errors from all invalid files', () => {
    const result = validateFileInputArray([
      { path: '', content: 'code' },
      { content: 'code' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });
});

describe('validateRegraftInput', () => {
  const validFiles = [{ path: 'test.tsx', content: 'code' }];
  const validFrom = { file: 'test.tsx', line: 1, column: 1 };
  const validTo = { file: 'test.tsx', line: 10, column: 1 };
  const validMode = Move.Inside;

  it('should accept valid input', () => {
    const result = validateRegraftInput(
      validFiles,
      validFrom,
      validTo,
      validMode,
      {}
    );

    expect(result.valid).toBe(true);
  });

  it('should reject invalid files', () => {
    const result = validateRegraftInput(
      [],
      validFrom,
      validTo,
      validMode
    );

    expect(result.valid).toBe(false);
  });

  it('should reject when from.file not in files', () => {
    const result = validateRegraftInput(
      validFiles,
      { file: 'other.tsx', line: 1, column: 1 },
      validTo,
      validMode
    );

    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.includes('from.file'))).toBe(true);
  });

  it('should reject when to.file not in files', () => {
    const result = validateRegraftInput(
      validFiles,
      validFrom,
      { file: 'other.tsx', line: 1, column: 1 },
      validMode
    );

    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.includes('to.file'))).toBe(true);
  });
});

describe('Assertion Helpers', () => {
  describe('assertRegraftInput', () => {
    it('should not throw for valid input', () => {
      expect(() => {
        assertRegraftInput(
          [{ path: 'test.tsx', content: 'code' }],
          { file: 'test.tsx', line: 1, column: 1 },
          { file: 'test.tsx', line: 10, column: 1 },
          Move.Inside
        );
      }).not.toThrow();
    });

    it('should throw InputValidationError for invalid input', () => {
      expect(() => {
        assertRegraftInput(
          [],
          { file: 'test.tsx', line: 1, column: 1 },
          { file: 'test.tsx', line: 10, column: 1 },
          Move.Inside
        );
      }).toThrow(InputValidationError);
    });
  });

  describe('assertSelector', () => {
    it('should not throw for valid selector', () => {
      expect(() => {
        assertSelector({ file: 'test.tsx', line: 1, column: 1 });
      }).not.toThrow();
    });

    it('should throw for invalid selector', () => {
      expect(() => {
        assertSelector({ file: 'test.tsx' });
      }).toThrow(InputValidationError);
    });
  });

  describe('assertMove', () => {
    it('should not throw for valid move', () => {
      expect(() => assertMove(Move.Inside)).not.toThrow();
      expect(() => assertMove('before')).not.toThrow();
    });

    it('should throw for invalid move', () => {
      expect(() => assertMove('invalid')).toThrow(InputValidationError);
    });
  });

  describe('assertOptions', () => {
    it('should not throw for valid options', () => {
      expect(() => assertOptions({})).not.toThrow();
      expect(() => assertOptions(undefined)).not.toThrow();
      expect(() => assertOptions({ optimize: true })).not.toThrow();
    });

    it('should throw for invalid options', () => {
      expect(() => assertOptions({ optimize: 'yes' })).toThrow(InputValidationError);
    });
  });
});

describe('InputValidationError', () => {
  it('should contain validation details', () => {
    const error = new InputValidationError({
      parameterName: 'files',
      expected: 'non-empty array',
      actual: [],
    });

    expect(error.parameterName).toBe('files');
    expect(error.expected).toBe('non-empty array');
    expect(error.actual).toEqual([]);
    expect(error.message).toContain('files');
  });
});
