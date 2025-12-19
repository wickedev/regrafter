/**
 * ComponentBuilder
 *
 * Task 6.2: Basic ComponentBuilder implementation
 * Generate AST for new component
 */

import * as t from '@babel/types';
import type { IComponentBuilder } from './interfaces/i-component-builder.js';
import type { HookDeclaration } from './types.js';

/**
 * ComponentBuilder class
 *
 * Responsible for generating AST for new component
 */
export class ComponentBuilder implements IComponentBuilder {
  /**
   * Generate component function declaration
   *
   * @param componentName - Component name
   * @param propsInterface - Props interface (null if none)
   * @param jsxBody - JSX body nodes
   * @param hooks - Hook declarations to move
   * @returns Function declaration AST
   */
  buildComponent(
    componentName: string,
    propsInterface: t.TSInterfaceDeclaration | null,
    jsxBody: t.Node[],
    hooks: HookDeclaration[]
  ): t.FunctionDeclaration {
    // Generate JSX return statement
    const returnStatement = this.createReturnStatement(jsxBody);

    // Generate function body (currently contains only return statement)
    const functionBody = t.blockStatement([returnStatement]);

    // Generate Props parameter
    const params = this.createParams(propsInterface);

    // Generate function declaration
    const functionDeclaration = t.functionDeclaration(
      t.identifier(componentName),
      params,
      functionBody
    );

    return functionDeclaration;
  }

  /**
   * Generate Props parameter
   *
   * @param propsInterface - Props interface
   * @returns Parameter array
   */
  private createParams(
    propsInterface: t.TSInterfaceDeclaration | null
  ): (t.Identifier | t.Pattern | t.RestElement)[] {
    if (!propsInterface) {
      return [];
    }

    // Extract properties from Props interface
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

    // Generate Props destructuring pattern
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

      // Add TypeScript type annotation
      const typeAnnotation = t.tsTypeAnnotation(
        t.tsTypeReference(propsInterface.id)
      );
      objectPattern.typeAnnotation = typeAnnotation;

      return [objectPattern];
    }

    // Generate simple props parameter if Props is empty
    const propsParam = t.identifier('props');
    const typeAnnotation = t.tsTypeAnnotation(
      t.tsTypeReference(propsInterface.id)
    );
    propsParam.typeAnnotation = typeAnnotation;

    return [propsParam];
  }

  /**
   * Generate JSX return statement
   *
   * @param jsxBody - JSX body nodes
   * @returns return statement AST
   */
  private createReturnStatement(jsxBody: t.Node[]): t.ReturnStatement {
    // Return as-is if single JSX node and is Expression
    if (jsxBody.length === 1) {
      const node = jsxBody[0];
      // Only JSXElement and JSXFragment can be returned as Expression
      if (t.isJSXElement(node) || t.isJSXFragment(node)) {
        return t.returnStatement(node);
      }
    }

    // Wrap in Fragment if multiple JSX nodes or single node is JSXText/JSXExpressionContainer
    const fragment = t.jsxFragment(
      t.jsxOpeningFragment(),
      t.jsxClosingFragment(),
      jsxBody as (t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXFragment)[]
    );

    return t.returnStatement(fragment);
  }
}
