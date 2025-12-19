/**
 * CodeReplacer Tests
 *
 * Task 7.1: CodeReplacer test implementation
 * Tests the replacement of original JSX with component calls
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import generate from '@babel/generator';
import { CodeReplacer } from '../code-replacer.js';

describe('CodeReplacer', () => {
  describe('replace - Replace original JSX with component call', () => {
    it('should replace JSX element with component call without props', () => {
      // Given: original JSX code
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

      // Find h1 element
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

      // When: Replace with CodeReplacer
      const replacer = new CodeReplacer();
      const props = new Map<string, t.Expression>();
      replacer.replace(targetPath!, 'Greeting', props);

      // Then: should be replaced with component call
      const output = generate(ast).code;
      expect(output).toContain('<Greeting />');
      expect(output).not.toContain('<h1>');
    });

    it('should replace JSX element with component call with single prop', () => {
      // Given: original JSX code
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

      // Find h1 element
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

      // When: replace with CodeReplacer (pass name prop)
      const replacer = new CodeReplacer();
      const props = new Map<string, t.Expression>();
      props.set('name', t.identifier('name'));
      replacer.replace(targetPath!, 'Greeting', props);

      // Then: prop should be passed to component call
      const output = generate(ast).code;
      expect(output).toContain('<Greeting name={name} />');
      expect(output).not.toContain('<h1>');
    });

    it('should replace JSX element with component call with multiple props', () => {
      // Given: original JSX code
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

      // Find h1 element
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

      // When: replace with CodeReplacer (pass multiple props)
      const replacer = new CodeReplacer();
      const props = new Map<string, t.Expression>();
      props.set('name', t.identifier('name'));
      props.set('count', t.identifier('count'));
      props.set('isActive', t.identifier('isActive'));
      replacer.replace(targetPath!, 'Greeting', props);

      // Then: all props should be passed to component call
      const output = generate(ast).code;
      expect(output).toContain('<Greeting');
      expect(output).toContain('name={name}');
      expect(output).toContain('count={count}');
      expect(output).toContain('isActive={isActive}');
      expect(output).not.toContain('<h1>');
    });

    it('should preserve other JSX elements when replacing', () => {
      // Given: code with multiple JSX elements
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

      // Find only h1 element
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

      // When: replace only h1
      const replacer = new CodeReplacer();
      const props = new Map<string, t.Expression>();
      replacer.replace(targetPath!, 'Title', props);

      // Then: h1 should be replaced and p should remain
      const output = generate(ast).code;
      expect(output).toContain('<Title />');
      expect(output).toContain('<p>Content</p>');
      expect(output).not.toContain('<h1>');
    });
  });
});
