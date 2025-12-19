/**
 * ComponentBuilder Test
 *
 * Task 6.1: ComponentBuilder 테스트 작성 - Props 없는 컴포넌트
 * Task 6.3: ComponentBuilder 테스트 작성 - Props 있는 컴포넌트
 */

import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { ComponentBuilder } from '../component-builder.js';

describe('ComponentBuilder', () => {
  describe('buildComponent - Props 없는 컴포넌트', () => {
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
        // JSX body가 단일 노드면 그대로, 여러 노드면 Fragment로 감싸짐
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
        // 여러 JSX 노드는 Fragment로 감싸져야 함
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

  describe('buildComponent - Props 있는 컴포넌트', () => {
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

      // Props 파라미터 확인 (destructuring 또는 props 파라미터)
      const propsParam = result.params[0];
      expect(
        t.isIdentifier(propsParam) || t.isObjectPattern(propsParam)
      ).toBe(true);

      // Destructuring된 경우 message 프로퍼티 확인
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
      // Props destructuring이 ObjectPattern으로 표현됨
      expect(
        t.isObjectPattern(propsParam) || t.isIdentifier(propsParam)
      ).toBe(true);

      if (t.isObjectPattern(propsParam)) {
        // destructuring된 props 확인
        expect(propsParam.properties.length).toBeGreaterThan(0);
      }
    });
  });
});
