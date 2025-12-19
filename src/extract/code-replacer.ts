/**
 * CodeReplacer
 *
 * Task 7.2: CodeReplacer 구현
 * Replaces original JSX code with component calls
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

/**
 * CodeReplacer
 *
 * 원본 JSX 코드를 새 컴포넌트 호출로 교체하는 클래스
 *
 * Requirements:
 * - 3.3: 원본 위치의 JSX 코드를 새 컴포넌트 호출로 교체
 * - 3.6: Props 전달 코드 생성
 */
export class CodeReplacer {
  /**
   * JSX 노드를 컴포넌트 호출로 교체
   *
   * @param sourcePath - 교체할 원본 JSX 노드 경로
   * @param componentName - 새 컴포넌트 이름
   * @param props - 전달할 props (이름 -> 표현식 맵)
   */
  replace(
    sourcePath: NodePath,
    componentName: string,
    props: Map<string, t.Expression>
  ): void {
    // JSX 엘리먼트 이름 생성
    const jsxIdentifier = t.jsxIdentifier(componentName);

    // Props를 JSX attributes로 변환
    const attributes: t.JSXAttribute[] = [];
    for (const [propName, propExpression] of props.entries()) {
      const attributeName = t.jsxIdentifier(propName);
      const attributeValue = t.jsxExpressionContainer(propExpression);
      attributes.push(t.jsxAttribute(attributeName, attributeValue));
    }

    // 새 JSX 엘리먼트 생성
    let newElement: t.JSXElement | t.JSXFragment;

    if (attributes.length === 0) {
      // Props가 없으면 self-closing element
      newElement = t.jsxElement(
        t.jsxOpeningElement(jsxIdentifier, attributes, true),
        null, // selfClosing이므로 closingElement는 null
        [],
        true // selfClosing
      );
    } else {
      // Props가 있으면 self-closing element
      newElement = t.jsxElement(
        t.jsxOpeningElement(jsxIdentifier, attributes, true),
        null,
        [],
        true
      );
    }

    // 원본 노드를 새 엘리먼트로 교체
    sourcePath.replaceWith(newElement);
  }
}
