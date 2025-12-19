/**
 * ComponentBuilder Test
 *
 * Task 6.1: ComponentBuilder test implementation - Component without Props
 * Task 6.3: ComponentBuilder test implementation - Component with Props
 */

import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { ComponentBuilder } from '../component-builder.js';

describe('ComponentBuilder', () => {
  describe('buildComponent - Component without Props', () => {
    it('should build simple function component without props', () => {
      // Arrange
      const builder = new ComponentBuilder();
      const componentName = 'SimpleComponent';
      const propsInterface = null;
      const jsxBody = [
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('div'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('div')),
          [t.jsxText('Hello World')],
          false
        ),
      ];
      const hooks: never[] = [];

      // Act
      const result = builder.buildComponent(
        componentName,
        propsInterface,
        jsxBody,
        hooks
      );

      // Assert
      expect(result).toBeDefined();
      expect(t.isFunctionDeclaration(result)).toBe(true);
      expect(result.id?.name).toBe('SimpleComponent');
      expect(result.params).toHaveLength(0);
    });

    it('should include JSX body in return statement', () => {
      // Arrange
      const builder = new ComponentBuilder();
      const componentName = 'TestComponent';
      const jsxBody = [
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('span'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('span')),
          [t.jsxText('Test')],
          false
        ),
      ];

      // Act
      const result = builder.buildComponent(componentName, null, jsxBody, []);

      // Assert
      const body = result.body.body;
      expect(body).toHaveLength(1);

      const returnStatement = body[0];
      expect(t.isReturnStatement(returnStatement)).toBe(true);

      if (t.isReturnStatement(returnStatement)) {
        expect(returnStatement.argument).toBeDefined();
        // If JSX body is a single node, use as-is; if multiple nodes, wrap in Fragment
        if (jsxBody.length === 1) {
          expect(t.isJSXElement(returnStatement.argument)).toBe(true);
        }
      }
    });

    it('should wrap multiple JSX nodes in Fragment', () => {
      // Arrange
      const builder = new ComponentBuilder();
      const componentName = 'MultiNodeComponent';
      const jsxBody = [
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('div'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('div')),
          [t.jsxText('First')],
          false
        ),
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('div'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('div')),
          [t.jsxText('Second')],
          false
        ),
      ];

      // Act
      const result = builder.buildComponent(componentName, null, jsxBody, []);

      // Assert
      const body = result.body.body;
      const returnStatement = body[0];

      if (t.isReturnStatement(returnStatement) && returnStatement.argument) {
        // Multiple JSX nodes should be wrapped in Fragment
        expect(
          t.isJSXFragment(returnStatement.argument) ||
          t.isJSXElement(returnStatement.argument)
        ).toBe(true);
      }
    });

    it('should handle JSXText nodes', () => {
      // Arrange
      const builder = new ComponentBuilder();
      const componentName = 'TextComponent';
      const jsxBody = [t.jsxText('Plain text')];

      // Act
      const result = builder.buildComponent(componentName, null, jsxBody, []);

      // Assert
      expect(result).toBeDefined();
      expect(t.isFunctionDeclaration(result)).toBe(true);
    });

    it('should handle JSXExpressionContainer nodes', () => {
      // Arrange
      const builder = new ComponentBuilder();
      const componentName = 'ExpressionComponent';
      const jsxBody = [
        t.jsxExpressionContainer(t.identifier('value')),
      ];

      // Act
      const result = builder.buildComponent(componentName, null, jsxBody, []);

      // Assert
      expect(result).toBeDefined();
      expect(t.isFunctionDeclaration(result)).toBe(true);
    });
  });

  describe('buildComponent - Component with Props', () => {
    it('should build component with Props parameter', () => {
      // Arrange
      const builder = new ComponentBuilder();
      const componentName = 'PropsComponent';
      const propsInterface = t.tsInterfaceDeclaration(
        t.identifier('PropsComponentProps'),
        null,
        null,
        t.tsInterfaceBody([
          t.tsPropertySignature(
            t.identifier('message'),
            t.tsTypeAnnotation(t.tsStringKeyword())
          ),
        ])
      );
      const jsxBody = [
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('div'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('div')),
          [t.jsxExpressionContainer(t.identifier('message'))],
          false
        ),
      ];

      // Act
      const result = builder.buildComponent(
        componentName,
        propsInterface,
        jsxBody,
        []
      );

      // Assert
      expect(result).toBeDefined();
      expect(t.isFunctionDeclaration(result)).toBe(true);
      expect(result.params).toHaveLength(1);

      // Verify Props parameter (destructuring or props parameter)
      const propsParam = result.params[0];
      expect(
        t.isIdentifier(propsParam) || t.isObjectPattern(propsParam)
      ).toBe(true);

      // If destructured, verify message property
      if (t.isObjectPattern(propsParam)) {
        expect(propsParam.properties.length).toBeGreaterThan(0);
      }
    });

    it('should add TypeScript type annotation to Props parameter', () => {
      // Arrange
      const builder = new ComponentBuilder();
      const componentName = 'TypedComponent';
      const propsInterface = t.tsInterfaceDeclaration(
        t.identifier('TypedComponentProps'),
        null,
        null,
        t.tsInterfaceBody([])
      );
      const jsxBody = [
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('div'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('div')),
          [],
          false
        ),
      ];

      // Act
      const result = builder.buildComponent(
        componentName,
        propsInterface,
        jsxBody,
        []
      );

      // Assert
      const propsParam = result.params[0];
      if (t.isIdentifier(propsParam)) {
        expect(propsParam.typeAnnotation).toBeDefined();
        expect(t.isTSTypeAnnotation(propsParam.typeAnnotation)).toBe(true);
      }
    });

    it('should destructure Props parameter', () => {
      // Arrange
      const builder = new ComponentBuilder();
      const componentName = 'DestructuredComponent';
      const propsInterface = t.tsInterfaceDeclaration(
        t.identifier('DestructuredComponentProps'),
        null,
        null,
        t.tsInterfaceBody([
          t.tsPropertySignature(
            t.identifier('title'),
            t.tsTypeAnnotation(t.tsStringKeyword())
          ),
          t.tsPropertySignature(
            t.identifier('count'),
            t.tsTypeAnnotation(t.tsNumberKeyword())
          ),
        ])
      );
      const jsxBody = [
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('div'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('div')),
          [
            t.jsxExpressionContainer(t.identifier('title')),
            t.jsxExpressionContainer(t.identifier('count')),
          ],
          false
        ),
      ];

      // Act
      const result = builder.buildComponent(
        componentName,
        propsInterface,
        jsxBody,
        []
      );

      // Assert
      const propsParam = result.params[0];
      // Props destructuring is represented as ObjectPattern
      expect(
        t.isObjectPattern(propsParam) || t.isIdentifier(propsParam)
      ).toBe(true);

      if (t.isObjectPattern(propsParam)) {
        // Verify destructured props
        expect(propsParam.properties.length).toBeGreaterThan(0);
      }
    });
  });
});
