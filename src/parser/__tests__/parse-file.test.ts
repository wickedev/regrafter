/**
 * Tests for parseFile with Result return type (Task 10.1)
 *
 * Tests the new parseFile function that returns Result<BabelFile, ParseErrorType>
 * instead of throwing exceptions.
 */

import { describe, it, expect } from 'vitest';
import { parseFile } from '../parse-file.js';
import { isOk, isErr } from '../../result/index.js';

describe('parseFile with Result return type', () => {
  describe('valid source files', () => {
    it('should return Ok<BabelFile> for valid JavaScript source', () => {
      const source = 'const x = 1;';
      const result = parseFile('test.js', source);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(result.value.program).toBeDefined();
        expect(result.value.type).toBe('File');
      }
    });

    it('should return Ok<BabelFile> for valid JSX source', () => {
      const source = 'const element = <div>Hello</div>;';
      const result = parseFile('test.jsx', source);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(result.value.program).toBeDefined();
      }
    });

    it('should return Ok<BabelFile> for valid TypeScript source', () => {
      const source = 'const x: number = 1;';
      const result = parseFile('test.ts', source);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(result.value.program).toBeDefined();
      }
    });

    it('should return Ok<BabelFile> for valid TSX source', () => {
      const source = `
        interface Props {
          name: string;
        }
        const Component = (props: Props) => <div>{props.name}</div>;
      `;
      const result = parseFile('test.tsx', source);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(result.value.program).toBeDefined();
      }
    });
  });

  describe('syntax errors', () => {
    it('should return Err<ParseError> for invalid syntax', () => {
      const source = 'const x = @@@;'; // Invalid syntax
      const result = parseFile('test.js', source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error._tag).toBe('ParseError');
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
        expect(result.error.syntaxError).toBeDefined();
      }
    });

    it('should return Err<ParseError> for incomplete code', () => {
      const source = 'const x = '; // Incomplete statement
      const result = parseFile('test.js', source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error._tag).toBe('ParseError');
        expect(result.error.syntaxError).toContain('Unexpected');
      }
    });

    it('should return Err<ParseError> for unexpected tokens', () => {
      const source = 'function () { }'; // Missing function name
      const result = parseFile('test.js', source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error._tag).toBe('ParseError');
      }
    });
  });

  describe('empty source', () => {
    it('should return Err<ParseError> for empty source', () => {
      const source = '';
      const result = parseFile('test.js', source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error._tag).toBe('ParseError');
        expect(result.error.code).toBe('E004');
        expect(result.error.message).toContain('Empty source');
      }
    });

    it('should return Err<ParseError> for whitespace-only source', () => {
      const source = '   \n\t  ';
      const result = parseFile('test.js', source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error._tag).toBe('ParseError');
        expect(result.error.code).toBe('E004');
      }
    });
  });

  describe('error contains file path', () => {
    it('should include file path in error for syntax errors', () => {
      const source = 'const x = @@@;';
      const filename = 'my-component.tsx';
      const result = parseFile(filename, source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.file).toBe(filename);
        expect(result.error.message).toContain(filename);
      }
    });

    it('should include file path in error for empty source', () => {
      const source = '';
      const filename = 'empty-file.js';
      const result = parseFile(filename, source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.file).toBe(filename);
        expect(result.error.message).toContain(filename);
      }
    });
  });

  describe('error contains syntax error message', () => {
    it('should include Babel syntax error message in ParseError', () => {
      const source = 'const x = @@@;';
      const result = parseFile('test.js', source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.syntaxError).toBeDefined();
        expect(result.error.syntaxError.length).toBeGreaterThan(0);
        // Babel should report something about unexpected token
        expect(result.error.syntaxError.toLowerCase()).toMatch(/unexpected|invalid/);
      }
    });
  });

  describe('error includes location information when available', () => {
    it('should include location information for syntax errors', () => {
      const source = 'const x = @@@;';
      const result = parseFile('test.js', source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        // Babel provides location info for parse errors
        if (result.error.location) {
          expect(result.error.location.start).toBeDefined();
          expect(result.error.location.start.line).toBeGreaterThan(0);
          expect(result.error.location.start.column).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should handle missing location information gracefully', () => {
      const source = '';
      const result = parseFile('test.js', source);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        // Empty source errors may not have location info
        // Just verify the error structure is valid even without location
        expect(result.error._tag).toBe('ParseError');
        expect(result.error.location).toBeUndefined();
      }
    });
  });
});
