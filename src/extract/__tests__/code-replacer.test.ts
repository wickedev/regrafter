/**
 * CodeReplacer Tests
 *
 * Task 7.1: CodeReplacer 테스트 작성
 * Tests the replacement of original JSX with component calls
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import generate from '@babel/generator';
import { CodeReplacer } from '../code-replacer.js';

describe('CodeReplacer', () => {
  describe('replace - 원본 JSX를 컴포넌트 호출로 교체', () => {
    it('should replace JSX element with component call without props', () => {
      // Given: 원본 JSX 코드
      const code = `
        function App() {
          return (
            <div>
              <h1>Hello</h1>
            </div>
          );
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let targetPath: NodePath | null = null;

      // h1 엘리먼트를 찾기
      traverse(ast, {
        JSXElement(path) {
          const openingElement = path.node.openingElement;
          if (
            t.isJSXIdentifier(openingElement.name) &&
            openingElement.name.name === 'h1'
          ) {
            targetPath = path;
            path.stop();
          }
        },
      });

      expect(targetPath).not.toBeNull();

      // When: CodeReplacer로 교체
      const replacer = new CodeReplacer();
      const props = new Map<string, t.Expression>();
      replacer.replace(targetPath!, 'Greeting', props);

      // Then: 컴포넌트 호출로 교체되어야 함
      const output = generate(ast).code;
      expect(output).toContain('<Greeting />');
      expect(output).not.toContain('<h1>');
    });

    it('should replace JSX element with component call with single prop', () => {
      // Given: 원본 JSX 코드
      const code = `
        function App() {
          const name = "World";
          return (
            <div>
              <h1>Hello</h1>
            </div>
          );
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let targetPath: NodePath | null = null;

      // h1 엘리먼트를 찾기
      traverse(ast, {
        JSXElement(path) {
          const openingElement = path.node.openingElement;
          if (
            t.isJSXIdentifier(openingElement.name) &&
            openingElement.name.name === 'h1'
          ) {
            targetPath = path;
            path.stop();
          }
        },
      });

      expect(targetPath).not.toBeNull();

      // When: CodeReplacer로 교체 (name prop 전달)
      const replacer = new CodeReplacer();
      const props = new Map<string, t.Expression>();
      props.set('name', t.identifier('name'));
      replacer.replace(targetPath!, 'Greeting', props);

      // Then: 컴포넌트 호출에 prop이 전달되어야 함
      const output = generate(ast).code;
      expect(output).toContain('<Greeting name={name} />');
      expect(output).not.toContain('<h1>');
    });

    it('should replace JSX element with component call with multiple props', () => {
      // Given: 원본 JSX 코드
      const code = `
        function App() {
          const name = "World";
          const count = 42;
          const isActive = true;
          return (
            <div>
              <h1>Hello</h1>
            </div>
          );
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let targetPath: NodePath | null = null;

      // h1 엘리먼트를 찾기
      traverse(ast, {
        JSXElement(path) {
          const openingElement = path.node.openingElement;
          if (
            t.isJSXIdentifier(openingElement.name) &&
            openingElement.name.name === 'h1'
          ) {
            targetPath = path;
            path.stop();
          }
        },
      });

      expect(targetPath).not.toBeNull();

      // When: CodeReplacer로 교체 (여러 props 전달)
      const replacer = new CodeReplacer();
      const props = new Map<string, t.Expression>();
      props.set('name', t.identifier('name'));
      props.set('count', t.identifier('count'));
      props.set('isActive', t.identifier('isActive'));
      replacer.replace(targetPath!, 'Greeting', props);

      // Then: 컴포넌트 호출에 모든 props가 전달되어야 함
      const output = generate(ast).code;
      expect(output).toContain('<Greeting');
      expect(output).toContain('name={name}');
      expect(output).toContain('count={count}');
      expect(output).toContain('isActive={isActive}');
      expect(output).not.toContain('<h1>');
    });

    it('should preserve other JSX elements when replacing', () => {
      // Given: 여러 JSX 엘리먼트가 있는 코드
      const code = `
        function App() {
          return (
            <div>
              <h1>Title</h1>
              <p>Content</p>
            </div>
          );
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let targetPath: NodePath | null = null;

      // h1 엘리먼트만 찾기
      traverse(ast, {
        JSXElement(path) {
          const openingElement = path.node.openingElement;
          if (
            t.isJSXIdentifier(openingElement.name) &&
            openingElement.name.name === 'h1'
          ) {
            targetPath = path;
            path.stop();
          }
        },
      });

      expect(targetPath).not.toBeNull();

      // When: h1만 교체
      const replacer = new CodeReplacer();
      const props = new Map<string, t.Expression>();
      replacer.replace(targetPath!, 'Title', props);

      // Then: h1은 교체되고 p는 유지되어야 함
      const output = generate(ast).code;
      expect(output).toContain('<Title />');
      expect(output).toContain('<p>Content</p>');
      expect(output).not.toContain('<h1>');
    });
  });
});
