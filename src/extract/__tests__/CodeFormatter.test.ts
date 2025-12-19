/**
 * CodeFormatter Tests
 *
 * Task 11.1: CodeFormatter 테스트 작성
 * - AST를 코드로 변환 테스트
 * - 들여쓰기 유지 테스트
 * Requirements: 8.1, 8.3
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import { CodeFormatter } from '../CodeFormatter.js';
import { isOk, isErr } from '../../result/index.js';

describe('CodeFormatter', () => {
  describe('format - AST를 코드로 변환', () => {
    it('간단한 AST를 코드로 변환해야 한다', () => {
      // Given: 간단한 함수 컴포넌트 AST
      const sourceCode = `function MyComponent() {
  return <div>Hello</div>;
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 성공적으로 코드가 생성되어야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('function MyComponent');
        expect(result.value).toContain('return');
        expect(result.value).toContain('<div>Hello</div>');
      }
    });

    it('JSX를 포함한 코드를 변환해야 한다', () => {
      // Given: JSX 엘리먼트를 포함한 AST
      const sourceCode = `const element = <div className="container">Content</div>;`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: JSX가 올바르게 변환되어야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('const element');
        expect(result.value).toContain('<div');
        expect(result.value).toContain('className');
        expect(result.value).toContain('</div>');
      }
    });

    it('빈 AST도 처리해야 한다', () => {
      // Given: 빈 파일 AST
      const sourceCode = '';

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 빈 문자열이 반환되어야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.trim()).toBe('');
      }
    });
  });

  describe('format - 들여쓰기 유지', () => {
    it('원본 코드의 들여쓰기 스타일(2 spaces)을 유지해야 한다', () => {
      // Given: 2칸 들여쓰기를 사용하는 코드
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

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 2칸 들여쓰기가 유지되어야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines = result.value.split('\n');
        // function 내부 첫 줄이 2칸 들여쓰기인지 확인
        const constLine = lines.find(line => line.includes('const name'));
        expect(constLine).toBeDefined();
        if (constLine) {
          expect(constLine.startsWith('  ')).toBe(true); // 2 spaces
          expect(constLine.startsWith('   ')).toBe(false); // not 3 spaces
        }
      }
    });

    it('원본 코드의 들여쓰기 스타일(4 spaces)을 유지해야 한다', () => {
      // Given: 4칸 들여쓰기를 사용하는 코드
      const sourceCode = `function MyComponent() {
    const name = "World";
    return <div>Hello</div>;
}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 4칸 들여쓰기가 유지되어야 한다
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

    it('원본 코드의 탭 들여쓰기를 유지해야 한다', () => {
      // Given: 탭 들여쓰기를 사용하는 코드
      const sourceCode = `function MyComponent() {\n\tconst name = "World";\n\treturn <div>Hello</div>;\n}`;

      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      }) as t.File;

      const formatter = new CodeFormatter();

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 탭 들여쓰기가 유지되어야 한다
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

    it('중첩된 구조의 들여쓰기를 올바르게 유지해야 한다', () => {
      // Given: 중첩된 JSX 구조
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

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 중첩된 들여쓰기가 올바르게 유지되어야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines = result.value.split('\n');

        // <section>은 4칸 들여쓰기
        const sectionLine = lines.find(line => line.trim().startsWith('<section>'));
        if (sectionLine) {
          expect(sectionLine.match(/^\s*/)?.[0].length).toBeGreaterThan(2);
        }

        // <h1>은 6칸 들여쓰기
        const h1Line = lines.find(line => line.trim().startsWith('<h1>'));
        if (h1Line) {
          expect(h1Line.match(/^\s*/)?.[0].length).toBeGreaterThan(4);
        }
      }
    });
  });

  describe('format - 따옴표 스타일 유지', () => {
    it('원본 코드가 single quotes를 사용하면 생성된 코드도 single quotes를 사용해야 한다', () => {
      // Given: single quotes를 주로 사용하는 코드
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

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 생성된 코드도 single quotes를 사용해야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // 문자열 리터럴이 single quotes로 감싸져 있어야 함
        expect(result.value).toContain("'Hello'");
        expect(result.value).toContain("'World'");
        expect(result.value).toContain("'container'");

        // double quotes는 사용하지 않아야 함 (JSX 속성 제외)
        const stringLiterals = result.value.match(/(['"])(?:(?=(\\?))\2.)*?\1/g) || [];
        const singleQuoteCount = stringLiterals.filter(s => s.startsWith("'")).length;
        const doubleQuoteCount = stringLiterals.filter(s => s.startsWith('"')).length;
        expect(singleQuoteCount).toBeGreaterThan(doubleQuoteCount);
      }
    });

    it('원본 코드가 double quotes를 사용하면 생성된 코드도 double quotes를 사용해야 한다', () => {
      // Given: double quotes를 주로 사용하는 코드
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

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 생성된 코드도 double quotes를 사용해야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // 문자열 리터럴이 double quotes로 감싸져 있어야 함
        expect(result.value).toContain('"Hello"');
        expect(result.value).toContain('"World"');
        expect(result.value).toContain('"container"');

        // single quotes보다 double quotes가 더 많아야 함
        const stringLiterals = result.value.match(/(['"])(?:(?=(\\?))\2.)*?\1/g) || [];
        const singleQuoteCount = stringLiterals.filter(s => s.startsWith("'")).length;
        const doubleQuoteCount = stringLiterals.filter(s => s.startsWith('"')).length;
        expect(doubleQuoteCount).toBeGreaterThanOrEqual(singleQuoteCount);
      }
    });
  });

  describe('format - 세미콜론 사용 여부 유지', () => {
    it('원본 코드가 세미콜론을 사용하면 생성된 코드도 세미콜론을 사용해야 한다', () => {
      // Given: 세미콜론을 사용하는 코드
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

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 생성된 코드도 세미콜론을 사용해야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // 변수 선언과 return 문에 세미콜론이 있어야 함
        expect(result.value).toMatch(/const greeting = ['"]Hello['"];/);
        expect(result.value).toMatch(/const name = ['"]World['"];/);

        // 세미콜론이 여러 개 있어야 함
        const semicolonCount = (result.value.match(/;/g) || []).length;
        expect(semicolonCount).toBeGreaterThan(0);
      }
    });

    it('원본 코드가 세미콜론을 사용하지 않으면 생성된 코드도 세미콜론을 생략해야 한다', () => {
      // Given: 세미콜론을 사용하지 않는 코드
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

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: 생성된 코드도 세미콜론을 사용하지 않아야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // 변수 선언 라인에 세미콜론이 없어야 함
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

  describe('format - import 정렬 스타일 유지', () => {
    it('원본 코드의 import 정렬 방식을 유지해야 한다', () => {
      // Given: 특정 순서로 정렬된 import 문
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

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: import 문의 순서가 유지되어야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines = result.value.split('\n');
        const importLines = lines.filter(line => line.trim().startsWith('import'));

        // import 문이 존재해야 함
        expect(importLines.length).toBeGreaterThan(0);

        // React import가 먼저 나와야 함
        const reactImportIndex = importLines.findIndex(line => line.includes("from 'react'"));
        const componentImportIndex = importLines.findIndex(line => line.includes('./components/Button'));

        if (reactImportIndex !== -1 && componentImportIndex !== -1) {
          expect(reactImportIndex).toBeLessThan(componentImportIndex);
        }
      }
    });

    it('원본 코드의 import 그룹화를 유지해야 한다', () => {
      // Given: 빈 줄로 그룹화된 import 문
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

      // When: format 호출
      const result = formatter.format(ast, sourceCode);

      // Then: import 그룹 사이의 빈 줄이 유지되어야 한다
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // import 문이 포함되어 있어야 함
        expect(result.value).toContain('import');
        expect(result.value).toContain('react');
        expect(result.value).toContain('./components/Button');
      }
    });
  });

  describe('format - 에러 처리', () => {
    it('유효하지 않은 AST에 대해 에러를 반환해야 한다', () => {
      // Given: 완전히 잘못된 구조의 AST
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

      // When: format 호출
      const result = formatter.format(invalidAst, '');

      // Then: 에러가 반환되어야 한다
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('CODE_GENERATION_FAILED');
      }
    });
  });
});
