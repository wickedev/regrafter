/**
 * ComponentBuilder
 *
 * Task 6.2: ComponentBuilder 기본 구현
 * 새로운 컴포넌트의 AST를 생성
 */

import * as t from '@babel/types';
import type { HookDeclaration } from './types.js';

/**
 * ComponentBuilder 클래스
 *
 * 새 컴포넌트의 AST를 생성하는 역할
 */
export class ComponentBuilder {
  /**
   * 컴포넌트 함수 선언 생성
   *
   * @param componentName - 컴포넌트 이름
   * @param propsInterface - Props 인터페이스 (없으면 null)
   * @param jsxBody - JSX 본문 노드들
   * @param hooks - 이동할 Hook 선언들
   * @returns 함수 선언 AST
   */
  buildComponent(
    componentName: string,
    propsInterface: t.TSInterfaceDeclaration | null,
    jsxBody: t.Node[],
    hooks: HookDeclaration[]
  ): t.FunctionDeclaration {
    // JSX return 문 생성
    const returnStatement = this.createReturnStatement(jsxBody);

    // 함수 본문 생성 (현재는 return 문만 포함)
    const functionBody = t.blockStatement([returnStatement]);

    // Props 파라미터 생성
    const params = this.createParams(propsInterface);

    // 함수 선언 생성
    const functionDeclaration = t.functionDeclaration(
      t.identifier(componentName),
      params,
      functionBody
    );

    return functionDeclaration;
  }

  /**
   * Props 파라미터 생성
   *
   * @param propsInterface - Props 인터페이스
   * @returns 파라미터 배열
   */
  private createParams(
    propsInterface: t.TSInterfaceDeclaration | null
  ): (t.Identifier | t.Pattern | t.RestElement)[] {
    if (!propsInterface) {
      return [];
    }

    // Props 인터페이스에서 프로퍼티 추출
    const properties = propsInterface.body.body;
    const propNames = properties
      .filter((prop): prop is t.TSPropertySignature => t.isTSPropertySignature(prop))
      .map(prop => {
        if (t.isIdentifier(prop.key)) {
          return prop.key.name;
        }
        return null;
      })
      .filter((name): name is string => name !== null);

    // Props destructuring 패턴 생성
    if (propNames.length > 0) {
      const objectPattern = t.objectPattern(
        propNames.map(name =>
          t.objectProperty(
            t.identifier(name),
            t.identifier(name),
            false,
            true // shorthand
          )
        )
      );

      // TypeScript 타입 어노테이션 추가
      const typeAnnotation = t.tsTypeAnnotation(
        t.tsTypeReference(propsInterface.id)
      );
      objectPattern.typeAnnotation = typeAnnotation;

      return [objectPattern];
    }

    // Props가 비어있으면 단순 props 파라미터 생성
    const propsParam = t.identifier('props');
    const typeAnnotation = t.tsTypeAnnotation(
      t.tsTypeReference(propsInterface.id)
    );
    propsParam.typeAnnotation = typeAnnotation;

    return [propsParam];
  }

  /**
   * JSX return 문 생성
   *
   * @param jsxBody - JSX 본문 노드들
   * @returns return 문 AST
   */
  private createReturnStatement(jsxBody: t.Node[]): t.ReturnStatement {
    // JSX 노드가 하나이고 Expression인 경우 그대로 반환
    if (jsxBody.length === 1) {
      const node = jsxBody[0];
      // JSXElement와 JSXFragment만 Expression으로 return 가능
      if (t.isJSXElement(node) || t.isJSXFragment(node)) {
        return t.returnStatement(node);
      }
    }

    // 여러 JSX 노드이거나 단일 노드가 JSXText/JSXExpressionContainer인 경우
    // Fragment로 감싸기
    const fragment = t.jsxFragment(
      t.jsxOpeningFragment(),
      t.jsxClosingFragment(),
      jsxBody as (t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXFragment)[]
    );

    return t.returnStatement(fragment);
  }
}
