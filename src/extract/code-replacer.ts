/**
 * CodeReplacer
 *
 * Task 7.2: CodeReplacer implementation
 * Replaces original JSX code with component calls
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { ICodeReplacer } from './interfaces/i-code-replacer.js';

/**
 * CodeReplacer
 *
 * Class that replaces original JSX code with new component calls
 *
 * Requirements:
 * - 3.3: Replace JSX code at original location with new component call
 * - 3.6: Generate props passing code
 */
export class CodeReplacer implements ICodeReplacer {
  /**
   * Replace JSX node with component call
   *
   * @param sourcePath - Path to original JSX node to replace
   * @param componentName - New component name
   * @param props - Props to pass (name -> expression map)
   */
  replace(
    sourcePath: NodePath,
    componentName: string,
    props: Map<string, t.Expression>
  ): void {
    // Generate JSX element name
    const jsxIdentifier = t.jsxIdentifier(componentName);

    // Convert Props to JSX attributes
    const attributes: t.JSXAttribute[] = [];
    for (const [propName, propExpression] of props.entries()) {
      const attributeName = t.jsxIdentifier(propName);
      const attributeValue = t.jsxExpressionContainer(propExpression);
      attributes.push(t.jsxAttribute(attributeName, attributeValue));
    }

    // Create new JSX element
    let newElement: t.JSXElement | t.JSXFragment;

    if (attributes.length === 0) {
      // Self-closing element if no props
      newElement = t.jsxElement(
        t.jsxOpeningElement(jsxIdentifier, attributes, true),
        null, // closingElement is null for selfClosing
        [],
        true // selfClosing
      );
    } else {
      // Self-closing element with props
      newElement = t.jsxElement(
        t.jsxOpeningElement(jsxIdentifier, attributes, true),
        null,
        [],
        true
      );
    }

    // Replace original node with new element
    sourcePath.replaceWith(newElement);
  }
}
