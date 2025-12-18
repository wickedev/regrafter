/**
 * Result-based error handling tests for CodeGenerator
 *
 * Task 16: Tests for migrating code generator to Result-based error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import { CodeGenerator } from '../code-generator.js';
import { isOk, isErr } from '../../result/index.js';

describe('CodeGenerator - Result-based Error Handling', () => {
  let generator: CodeGenerator;

  const parseCode = (code: string): t.File => {
    return parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  };

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  describe('generate() with Result return type', () => {
    it('should return Ok with GenerateResult for valid AST', () => {
      const code = `const x = 1;`;
      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.code).toBe(`const x = 1;`);
        expect(result.value.errors).toHaveLength(0);
      }
    });

    it('should return Ok for complex JSX', () => {
      const code = `const App = () => <div>Hello</div>;`;
      const ast = parseCode(code);
      const result = generator.generate(ast);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.code).toContain('<div>Hello</div>');
      }
    });

    it('should return Err with TransformError for invalid AST', () => {
      const invalidAst: t.File = { type: 'Invalid' } as unknown as t.File;
      const result = generator.generate(invalidAst);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error._tag).toBe('TransformError');
        expect(result.error.message).toContain('Code generation failed');
        expect(result.error.code).toBeDefined();
      }
    });

    it('should include error details in TransformError', () => {
      const invalidAst: t.File = { type: 'Invalid' } as unknown as t.File;
      const result = generator.generate(invalidAst);

      if (!result.ok) {
        expect(result.error.code).toBe('E060');
        expect(result.error._tag).toBe('TransformError');
      }
    });
  });

  describe('generateMultiple() with Result return type', () => {
    it('should return Ok with Map of results for valid ASTs', () => {
      const files = new Map<string, t.File>([
        ['file1.tsx', parseCode('const A = () => <div>A</div>;')],
        ['file2.tsx', parseCode('const B = () => <span>B</span>;')],
      ]);

      const result = generator.generateMultiple(files);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(2);
        const file1Result = result.value.get('file1.tsx');
        const file2Result = result.value.get('file2.tsx');

        expect(file1Result?.code).toContain('<div>A</div>');
        expect(file2Result?.code).toContain('<span>B</span>');
      }
    });

    it('should return Err if any AST generation fails', () => {
      const files = new Map<string, t.File>([
        ['valid.tsx', parseCode('const A = () => <div>A</div>;')],
        ['invalid.tsx', { type: 'Invalid' } as unknown as t.File],
      ]);

      const result = generator.generateMultiple(files);

      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error._tag).toBe('TransformError');
        expect(result.error.file).toBe('invalid.tsx');
      }
    });

    it('should return Ok with empty Map for empty input', () => {
      const files = new Map<string, t.File>();
      const result = generator.generateMultiple(files);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(0);
      }
    });
  });

  describe('Error propagation', () => {
    it('should preserve error context from Babel generator', () => {
      const invalidAst: t.File = {
        type: 'File',
        program: {
          type: 'Program',
          body: [{ type: 'InvalidNode' } as any],
          directives: [],
          sourceType: 'module',
        },
      } as unknown as t.File;

      const result = generator.generate(invalidAst);

      if (!result.ok) {
        expect(result.error.message).toBeDefined();
        expect(result.error._tag).toBe('TransformError');
      }
    });
  });
});
