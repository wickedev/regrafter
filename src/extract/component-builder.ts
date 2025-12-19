/**
 * ComponentBuilder
 *
 * Task 6.2: Basic ComponentBuilder implementation
 * Generate AST for new component
 */

import * as t from '@babel/types';

import type { IComponentBuilder } from './interfaces/i-component-builder.js';
import type { ExtractPlan, HookDeclaration } from './types.js';

/**
 * ComponentBuilder class
 *
 * Responsible for generating AST for new component
 */
export class ComponentBuilder implements IComponentBuilder {
  /**
   * Build a new component from an extraction plan
   *
   * @param plan - Extraction plan
   * @returns AST for the new component file
   */
  build(plan: ExtractPlan): t.File {
    // Extract JSX nodes from selected node paths
    const jsxBody: t.Node[] = plan.selectedNodes.map((nodePath) => nodePath.node);

    // Build props interface if there are prop types
    const propsInterface =
      plan.propTypes.length > 0
        ? this.buildPropsInterface(plan.propsInterfaceName, plan.propTypes)
        : null;

    // Build component function
    const componentFunction = this.buildComponent(
      plan.componentName,
      propsInterface,
      jsxBody,
      plan.hooksToMove
    );

    // Build program body with props interface (if any) and component
    const programBody: t.Statement[] = [];
    if (propsInterface) {
      programBody.push(propsInterface);
    }
    programBody.push(componentFunction);

    // Create file AST
    return t.file(t.program(programBody, [], 'module'), [], []);
  }

  /**
   * Build props interface from prop types
   */
  private buildPropsInterface(
    interfaceName: string,
    propTypes: Array<{ name: string; typeAnnotation: t.TSType; optional: boolean }>
  ): t.TSInterfaceDeclaration {
    const properties = propTypes.map((prop) => {
      const signature = t.tsPropertySignature(
        t.identifier(prop.name),
        t.tsTypeAnnotation(prop.typeAnnotation)
      );
      signature.optional = prop.optional;
      return signature;
    });

    return t.tsInterfaceDeclaration(
      t.identifier(interfaceName),
      null,
      null,
      t.tsInterfaceBody(properties)
    );
  }

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
    _hooks: HookDeclaration[]
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
  ): Array<t.Identifier | t.Pattern | t.RestElement> {
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
    const fragmentChildren = this.filterJSXChildren(jsxBody);
    const fragment = t.jsxFragment(
      t.jsxOpeningFragment(),
      t.jsxClosingFragment(),
      fragmentChildren
    );

    return t.returnStatement(fragment);
  }

  private filterJSXChildren(
    nodes: t.Node[]
  ): Array<t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXFragment> {
    return nodes.filter((node): node is t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXFragment =>
      t.isJSXElement(node) ||
      t.isJSXText(node) ||
      t.isJSXExpressionContainer(node) ||
      t.isJSXSpreadChild(node) ||
      t.isJSXFragment(node)
    );
  }
}
