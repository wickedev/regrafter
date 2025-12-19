/**
 * TypeInferrer
 *
 * Task 14.2: TypeInferrer 기본 타입 구현
 *
 * Infers TypeScript types from dependencies and builds Props interfaces
 */

import * as t from '@babel/types';
import { ok, type Result } from '../result/index.js';
import type { PropType, VariableDependency, FunctionDependency } from './types.js';

/**
 * 의존성으로부터 TypeScript 타입을 추론하고 Props 인터페이스를 생성
 */
export class TypeInferrer {
  /**
   * 의존성 목록으로부터 Props 타입 추론
   *
   * @param dependencies - 변수 또는 함수 의존성 배열
   * @returns Result<PropType[], RegraffError>
   */
  inferPropTypes(
    dependencies: Array<VariableDependency | FunctionDependency>
  ): Result<PropType[], any> {
    const propTypes: PropType[] = [];

    for (const dep of dependencies) {
      const rawType = this.extractTypeAnnotation(dep);
      const { typeAnnotation, optional } = this.normalizeType(rawType);

      propTypes.push({
        name: dep.name,
        typeAnnotation,
        optional,
      });
    }

    return ok(propTypes);
  }

  /**
   * 의존성으로부터 TypeScript 타입 AST 추출
   */
  private extractTypeAnnotation(
    dep: VariableDependency | FunctionDependency
  ): t.TSType {
    // 이미 타입이 있으면 그대로 사용
    if (dep.type) {
      return dep.type;
    }

    // 타입 어노테이션이 없으면 any 타입 사용
    return t.tsAnyKeyword();
  }

  /**
   * 타입을 정규화하고 optional 여부를 결정
   * Union 타입에서 undefined를 제거하고 optional로 변환
   */
  private normalizeType(type: t.TSType): { typeAnnotation: t.TSType; optional: boolean } {
    // Union 타입 처리
    if (t.isTSUnionType(type)) {
      const hasUndefined = type.types.some((tsType) => t.isTSUndefinedKeyword(tsType));

      if (hasUndefined) {
        // undefined를 제외한 타입들만 추출
        const nonUndefinedTypes = type.types.filter((tsType) => !t.isTSUndefinedKeyword(tsType));

        // undefined만 있으면 any 타입으로 대체
        if (nonUndefinedTypes.length === 0) {
          return { typeAnnotation: t.tsAnyKeyword(), optional: true };
        }

        // 하나의 타입만 남으면 union을 풀어서 반환
        if (nonUndefinedTypes.length === 1) {
          return { typeAnnotation: nonUndefinedTypes[0], optional: true };
        }

        // 여러 타입이 남으면 새로운 union 생성
        return { typeAnnotation: t.tsUnionType(nonUndefinedTypes), optional: true };
      }
    }

    // 기본적으로 optional이 아님
    return { typeAnnotation: type, optional: false };
  }

  /**
   * PropType 배열로부터 TypeScript Props 인터페이스 생성
   *
   * @param propTypes - Prop 타입 배열
   * @param interfaceName - 생성할 인터페이스 이름
   * @returns TSInterfaceDeclaration
   */
  buildPropsInterface(
    propTypes: PropType[],
    interfaceName: string
  ): t.TSInterfaceDeclaration {
    const properties: t.TSPropertySignature[] = [];

    for (const propType of propTypes) {
      const property = t.tsPropertySignature(
        t.identifier(propType.name),
        t.tsTypeAnnotation(propType.typeAnnotation)
      );
      property.optional = propType.optional;
      properties.push(property);
    }

    const interfaceBody = t.tsInterfaceBody(properties);
    return t.tsInterfaceDeclaration(t.identifier(interfaceName), null, null, interfaceBody);
  }
}
