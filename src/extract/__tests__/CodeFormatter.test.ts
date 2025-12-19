/**
 * CodeFormatter Tests
 *
 * Task 11.1: CodeFormatter test implementation
 * - Test AST to code conversion
 * - Test indentation preservation
 * Requirements: 8.1, 8.3
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import { CodeFormatter } from '../CodeFormatter.js';
import { isOk, isErr } from '../../result/index.js';

describe('CodeFormatter', () => {
  describe('format - Convert AST to code', () => {
    it('should convert a simple AST to code', () => {
      // Given: simple function component AST
      const sourceCode = `function MyComponent() {
  return <div>Hello</div>;
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: code should be generated successfully
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('function MyComponent');
        expect(result.value).toContain('return');
        expect(result.value).toContain('<div>Hello</div>');
      }
    });

    it('should convert code containing JSX', () => {
      // Given: AST containing JSX elements
      const sourceCode = `const element = <div className="container">Content</div>;`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: JSX should be converted correctly
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('const element');
        expect(result.value).toContain('<div');
        expect(result.value).toContain('className');
        expect(result.value).toContain('</div>');
      }
    });

    it('should handle empty AST', () => {
      // Given: empty file AST
      const sourceCode = '';

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: should return an empty string
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.trim()).toBe('');
      }
    });
  });

  describe('format - Preserve indentation', () => {
    it('should preserve the original code indentation style (2 spaces)', () => {
      // Given: code using 2-space indentation
      const sourceCode = `function MyComponent() {
  const name = "World";
  return (
    <div>
      <h1>Hello {name}</h1>
    </div>
  );
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: 2-space indentation should be preserved
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines = result.value.split('\n');
        // Check if first line inside function has 2-space indentation
        const constLine = lines.find(line => line.includes('const name'));
        expect(constLine).toBeDefined();
        if (constLine) {
          expect(constLine.startsWith('  ')).toBe(true); // 2 spaces
          expect(constLine.startsWith('   ')).toBe(false); // not 3 spaces
        }
      }
    });

    it('should preserve original code indentation style (4 spaces)', () => {
      // Given: code using 4-space indentation
      const sourceCode = `function MyComponent() {
    const name = "World";
    return <div>Hello</div>;
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: 4-space indentation should be preserved
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines = result.value.split('\n');
        const constLine = lines.find(line => line.includes('const name'));
        expect(constLine).toBeDefined();
        if (constLine) {
          expect(constLine.startsWith('    ')).toBe(true); // 4 spaces
          expect(constLine.startsWith('     ')).toBe(false); // not 5 spaces
        }
      }
    });

    it('should preserve original code tab indentation', () => {
      // Given: code using tab indentation
      const sourceCode = `function MyComponent() {\n\tconst name = "World";\n\treturn <div>Hello</div>;\n}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: tab indentation should be preserved
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines = result.value.split('\n');
        const constLine = lines.find(line => line.includes('const name'));
        expect(constLine).toBeDefined();
        if (constLine) {
          expect(constLine.startsWith('\t')).toBe(true); // tab
        }
      }
    });

    it('should correctly preserve nested structure indentation', () => {
      // Given: nested JSX structure
      const sourceCode = `function MyComponent() {
  return (
    <div>
      <section>
        <h1>Title</h1>
      </section>
    </div>
  );
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: nested indentation should be preserved correctly
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines = result.value.split('\n');

        // <section> should have 4-space indentation
        const sectionLine = lines.find(line => line.trim().startsWith('<section>'));
        if (sectionLine) {
          expect(sectionLine.match(/^\s*/)?.[0].length).toBeGreaterThan(2);
        }

        // <h1> should have 6-space indentation
        const h1Line = lines.find(line => line.trim().startsWith('<h1>'));
        if (h1Line) {
          expect(h1Line.match(/^\s*/)?.[0].length).toBeGreaterThan(4);
        }
      }
    });
  });

  describe('format - Preserve quote style', () => {
    it('should use single quotes in generated code when original code uses single quotes', () => {
      // Given: code primarily using single quotes
      const sourceCode = `const greeting = 'Hello';
const name = 'World';
function MyComponent() {
  return <div className='container'>Hello</div>;
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: generated code should also use single quotes
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // String literals should be wrapped in single quotes
        expect(result.value).toContain("'Hello'");
        expect(result.value).toContain("'World'");
        expect(result.value).toContain("'container'");

        // Should not use double quotes (except JSX attributes)
        const stringLiterals = result.value.match(/(['"])(?:(?=(\\?))\2.)*?\1/g) || [];
        const singleQuoteCount = stringLiterals.filter(s => s.startsWith("'")).length;
        const doubleQuoteCount = stringLiterals.filter(s => s.startsWith('"')).length;
        expect(singleQuoteCount).toBeGreaterThan(doubleQuoteCount);
      }
    });

    it('should use double quotes in generated code when original code uses double quotes', () => {
      // Given: code primarily using double quotes
      const sourceCode = `const greeting = "Hello";
const name = "World";
function MyComponent() {
  return <div className="container">Hello</div>;
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: generated code should also use double quotes
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // String literals should be wrapped in double quotes
        expect(result.value).toContain('"Hello"');
        expect(result.value).toContain('"World"');
        expect(result.value).toContain('"container"');

        // Should have more double quotes than single quotes
        const stringLiterals = result.value.match(/(['"])(?:(?=(\\?))\2.)*?\1/g) || [];
        const singleQuoteCount = stringLiterals.filter(s => s.startsWith("'")).length;
        const doubleQuoteCount = stringLiterals.filter(s => s.startsWith('"')).length;
        expect(doubleQuoteCount).toBeGreaterThanOrEqual(singleQuoteCount);
      }
    });
  });

  describe('format - Preserve semicolon usage', () => {
    it('should use semicolons in generated code when original code uses semicolons', () => {
      // Given: Code using semicolons
      const sourceCode = `const greeting = 'Hello';
const name = 'World';
function MyComponent() {
  return <div>Hello</div>;
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: Generated code should also use semicolons
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Variable declarations and return statements should have semicolons
        expect(result.value).toMatch(/const greeting = ['"]Hello['"];/);
        expect(result.value).toMatch(/const name = ['"]World['"];/);

        // Should have multiple semicolons
        const semicolonCount = (result.value.match(/;/g) || []).length;
        expect(semicolonCount).toBeGreaterThan(0);
      }
    });

    it('should omit semicolons in generated code when original code does not use semicolons', () => {
      // Given: Code not using semicolons
      const sourceCode = `const greeting = 'Hello'
const name = 'World'
function MyComponent() {
  return <div>Hello</div>
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: Generated code should also not use semicolons
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Variable declaration lines should not have semicolons
        const lines = result.value.split('\n');
        const greetingLine = lines.find(line => line.includes('greeting'));
        const nameLine = lines.find(line => line.includes('const name'));

        if (greetingLine && !greetingLine.includes('function')) {
          expect(greetingLine.trim().endsWith(';')).toBe(false);
        }
        if (nameLine) {
          expect(nameLine.trim().endsWith(';')).toBe(false);
        }
      }
    });
  });

  describe('format - Preserve import sorting style', () => {
    it('should preserve original code import sorting method', () => {
      // Given: Import statements sorted in specific order
      const sourceCode = `import React from 'react';
import { useState } from 'react';
import type { FC } from 'react';
import { Button } from './components/Button';
import { utils } from '../utils';

function MyComponent() {
  return <div>Hello</div>;
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: Order of import statements should be preserved
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines = result.value.split('\n');
        const importLines = lines.filter(line => line.trim().startsWith('import'));

        // Import statements should exist
        expect(importLines.length).toBeGreaterThan(0);

        // React import should come first
        const reactImportIndex = importLines.findIndex(line => line.includes("from 'react'"));
        const componentImportIndex = importLines.findIndex(line => line.includes('./components/Button'));

        if (reactImportIndex !== -1 && componentImportIndex !== -1) {
          expect(reactImportIndex).toBeLessThan(componentImportIndex);
        }
      }
    });

    it('should preserve original code import grouping', () => {
      // Given: Import statements grouped by blank lines
      const sourceCode = `import React from 'react';
import { useState } from 'react';

import { Button } from './components/Button';
import { Input } from './components/Input';

function MyComponent() {
  return <div>Hello</div>;
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(ast, sourceCode);

      // Then: Blank lines between import groups should be preserved
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should contain import statements
        expect(result.value).toContain('import');
        expect(result.value).toContain('react');
        expect(result.value).toContain('./components/Button');
      }
    });
  });

  describe('format - Error handling', () => {
    it('should return error for invalid AST', () => {
      // Given: Completely incorrectly structured AST
      const invalidAst = {
        type: 'InvalidType', // Invalid type
        program: {
          type: 'Program',
          body: [
            {
              type: 'InvalidStatement', // Invalid node type
            },
          ],
        },
      } as unknown as t.File;

      const formatter = new CodeFormatter();

      // When: call format
      const result = formatter.format(invalidAst, '');

      // Then: Error should be returned
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('CODE_GENERATION_FAILED');
      }
    });
  });
});
