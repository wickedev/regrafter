/**
 * TypeInferrer Test
 *
 * Task 14.1: TypeInferrer 테스트 작성 - 기본 타입
 * Tests type inference for basic TypeScript types
 */

import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { loadTraverseFunction } from '../../utils/index.js';
import { TypeInferrer } from '../type-inferrer.js';
import type { VariableDependency, FunctionDependency } from '../types.js';

const traverse = loadTraverseFunction(traverseModule);

/**
 * 테스트용 헬퍼: TypeScript 코드를 파싱하여 변수 의존성 생성
 */
function createVariableDependency(
  code: string,
  variableName: string
): VariableDependency {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  let dependency: VariableDependency | null = null;

  traverse(ast, {
    VariableDeclarator(path) {
      const id = path.node.id;
      if (t.isIdentifier(id) && id.name === variableName) {
        dependency = {
          name: variableName,
          declaration: path,
          type: id.typeAnnotation
            ? (id.typeAnnotation.typeAnnotation as t.TSType)
            : undefined,
        };
      }
    },
  });

  if (!dependency) {
    throw new Error(`Variable ${variableName} not found in code`);
  }

  return dependency;
}

/**
 * 테스트용 헬퍼: TypeScript 코드를 파싱하여 함수 의존성 생성
 */
function createFunctionDependency(
  code: string,
  functionName: string
): FunctionDependency {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  let dependency: FunctionDependency | null = null;

  traverse(ast, {
    VariableDeclarator(path) {
      const id = path.node.id;
      if (t.isIdentifier(id) && id.name === functionName) {
        dependency = {
          name: functionName,
          declaration: path,
          type: id.typeAnnotation
            ? (id.typeAnnotation.typeAnnotation as t.TSType)
            : undefined,
        };
      }
    },
    FunctionDeclaration(path) {
      const id = path.node.id;
      if (id && id.name === functionName) {
        dependency = {
          name: functionName,
          declaration: path,
          type: id.typeAnnotation
            ? (id.typeAnnotation.typeAnnotation as t.TSType)
            : undefined,
        };
      }
    },
  });

  if (!dependency) {
    throw new Error(`Function ${functionName} not found in code`);
  }

  return dependency;
}

describe('TypeInferrer', () => {
  describe('inferPropTypes - 기본 타입', () => {
    it('should infer string type from variable dependency', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const userName: string = "John";';
      const dependency = createVariableDependency(code, 'userName');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('userName');
        expect(t.isTSStringKeyword(propTypes[0].typeAnnotation)).toBe(true);
        expect(propTypes[0].optional).toBe(false);
      }
    });

    it('should infer number type from variable dependency', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const age: number = 25;';
      const dependency = createVariableDependency(code, 'age');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('age');
        expect(t.isTSNumberKeyword(propTypes[0].typeAnnotation)).toBe(true);
        expect(propTypes[0].optional).toBe(false);
      }
    });

    it('should infer boolean type from variable dependency', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const isActive: boolean = true;';
      const dependency = createVariableDependency(code, 'isActive');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('isActive');
        expect(t.isTSBooleanKeyword(propTypes[0].typeAnnotation)).toBe(true);
        expect(propTypes[0].optional).toBe(false);
      }
    });

    it('should infer multiple prop types from multiple dependencies', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const nameDep = createVariableDependency('const name: string = "Test";', 'name');
      const countDep = createVariableDependency('const count: number = 0;', 'count');
      const enabledDep = createVariableDependency(
        'const enabled: boolean = false;',
        'enabled'
      );

      // Act
      const result = inferrer.inferPropTypes([nameDep, countDep, enabledDep]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(3);

        const nameType = propTypes.find((p) => p.name === 'name');
        expect(nameType).toBeDefined();
        expect(t.isTSStringKeyword(nameType!.typeAnnotation)).toBe(true);

        const countType = propTypes.find((p) => p.name === 'count');
        expect(countType).toBeDefined();
        expect(t.isTSNumberKeyword(countType!.typeAnnotation)).toBe(true);

        const enabledType = propTypes.find((p) => p.name === 'enabled');
        expect(enabledType).toBeDefined();
        expect(t.isTSBooleanKeyword(enabledType!.typeAnnotation)).toBe(true);
      }
    });

    it('should handle function dependencies', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const handleClick: () => void = () => {};';
      const dependency = createFunctionDependency(code, 'handleClick');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('handleClick');
        // Function type should be a TSFunctionType
        expect(t.isTSFunctionType(propTypes[0].typeAnnotation)).toBe(true);
      }
    });

    it('should use any type when type annotation is missing', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const value = "test";'; // No type annotation
      const dependency = createVariableDependency(code, 'value');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('value');
        // Should default to any type when no annotation
        expect(t.isTSAnyKeyword(propTypes[0].typeAnnotation)).toBe(true);
      }
    });
  });

  describe('buildPropsInterface - Props 인터페이스 생성', () => {
    it('should build Props interface with basic types', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const propTypes = [
        {
          name: 'userName',
          typeAnnotation: t.tsStringKeyword(),
          optional: false,
        },
        {
          name: 'age',
          typeAnnotation: t.tsNumberKeyword(),
          optional: false,
        },
        {
          name: 'isActive',
          typeAnnotation: t.tsBooleanKeyword(),
          optional: false,
        },
      ];
      const interfaceName = 'UserProfileProps';

      // Act
      const result = inferrer.buildPropsInterface(propTypes, interfaceName);

      // Assert
      expect(t.isTSInterfaceDeclaration(result)).toBe(true);
      expect(result.id.name).toBe('UserProfileProps');
      expect(result.body.body).toHaveLength(3);

      // Check properties
      const properties = result.body.body;
      expect(t.isTSPropertySignature(properties[0])).toBe(true);
      expect(t.isTSPropertySignature(properties[1])).toBe(true);
      expect(t.isTSPropertySignature(properties[2])).toBe(true);

      // Verify property names
      const prop0 = properties[0] as t.TSPropertySignature;
      expect(t.isIdentifier(prop0.key)).toBe(true);
      if (t.isIdentifier(prop0.key)) {
        expect(prop0.key.name).toBe('userName');
      }
    });

    it('should handle optional properties', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const propTypes = [
        {
          name: 'name',
          typeAnnotation: t.tsStringKeyword(),
          optional: false,
        },
        {
          name: 'email',
          typeAnnotation: t.tsStringKeyword(),
          optional: true,
        },
      ];
      const interfaceName = 'ContactProps';

      // Act
      const result = inferrer.buildPropsInterface(propTypes, interfaceName);

      // Assert
      expect(result.body.body).toHaveLength(2);
      const properties = result.body.body;

      const nameProp = properties[0] as t.TSPropertySignature;
      expect(nameProp.optional).toBe(false);

      const emailProp = properties[1] as t.TSPropertySignature;
      expect(emailProp.optional).toBe(true);
    });

    it('should handle empty props interface', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const propTypes: any[] = [];
      const interfaceName = 'EmptyProps';

      // Act
      const result = inferrer.buildPropsInterface(propTypes, interfaceName);

      // Assert
      expect(t.isTSInterfaceDeclaration(result)).toBe(true);
      expect(result.id.name).toBe('EmptyProps');
      expect(result.body.body).toHaveLength(0);
    });

    it('should preserve type annotations for complex types', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const propTypes = [
        {
          name: 'callback',
          typeAnnotation: t.tsFunctionType(
            null,
            [
              t.identifier('value', {
                typeAnnotation: t.tsTypeAnnotation(t.tsStringKeyword()),
              } as any),
            ],
            t.tsTypeAnnotation(t.tsVoidKeyword())
          ),
          optional: false,
        },
      ];
      const interfaceName = 'CallbackProps';

      // Act
      const result = inferrer.buildPropsInterface(propTypes, interfaceName);

      // Assert
      expect(result.body.body).toHaveLength(1);
      const prop = result.body.body[0] as t.TSPropertySignature;
      expect(prop.typeAnnotation).toBeDefined();
      if (prop.typeAnnotation) {
        expect(t.isTSFunctionType(prop.typeAnnotation.typeAnnotation)).toBe(true);
      }
    });
  });

  describe('inferPropTypes - 복잡한 타입', () => {
    it('should infer object type from variable dependency', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const user: { name: string; age: number } = { name: "John", age: 25 };';
      const dependency = createVariableDependency(code, 'user');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('user');
        expect(t.isTSTypeLiteral(propTypes[0].typeAnnotation)).toBe(true);
      }
    });

    it('should infer array type from variable dependency', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const items: string[] = ["a", "b", "c"];';
      const dependency = createVariableDependency(code, 'items');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('items');
        expect(t.isTSArrayType(propTypes[0].typeAnnotation)).toBe(true);
        const arrayType = propTypes[0].typeAnnotation as t.TSArrayType;
        expect(t.isTSStringKeyword(arrayType.elementType)).toBe(true);
      }
    });

    it('should infer union type from variable dependency', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const status: "active" | "inactive" | "pending" = "active";';
      const dependency = createVariableDependency(code, 'status');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('status');
        expect(t.isTSUnionType(propTypes[0].typeAnnotation)).toBe(true);
        const unionType = propTypes[0].typeAnnotation as t.TSUnionType;
        expect(unionType.types).toHaveLength(3);
      }
    });

    it('should infer tuple type from variable dependency', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const pair: [string, number] = ["test", 42];';
      const dependency = createVariableDependency(code, 'pair');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('pair');
        expect(t.isTSTupleType(propTypes[0].typeAnnotation)).toBe(true);
        const tupleType = propTypes[0].typeAnnotation as t.TSTupleType;
        expect(tupleType.elementTypes).toHaveLength(2);
      }
    });

    it('should infer optional type from union with undefined', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const value: string | undefined = undefined;';
      const dependency = createVariableDependency(code, 'value');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('value');
        // Union with undefined should result in optional property
        expect(propTypes[0].optional).toBe(true);
        // The type annotation should be just string (without undefined)
        expect(t.isTSStringKeyword(propTypes[0].typeAnnotation)).toBe(true);
      }
    });

    it('should handle complex nested types', () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code =
        'const data: { users: Array<{ id: number; name: string }> } = { users: [] };';
      const dependency = createVariableDependency(code, 'data');

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        expect(propTypes[0].name).toBe('data');
        expect(t.isTSTypeLiteral(propTypes[0].typeAnnotation)).toBe(true);
      }
    });
  });
});
