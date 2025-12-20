/**
 * Prop Substituter
 *
 * Handles substitution of component props with their actual values
 * when inlining components. Keeps props as inline expressions without
 * creating variables.
 *
 * Phase 1: Simple prop substitution (literals and identifiers)
 */

import type * as t from '@babel/types';
import * as t_factory from '@babel/types';

/**
 * Map of prop names to their values
 */
export type PropMapping = Map<string, t.Expression>;

/**
 * Extract props from a JSX element
 *
 * @param element - The JSX element (e.g., <Greeting name="World" />)
 * @returns Map of prop names to their values
 */
export function extractPropsFromElement(element: t.JSXElement): PropMapping {
  const props = new Map<string, t.Expression>();
  const openingElement = element.openingElement;

  for (const attribute of openingElement.attributes) {
    if (t_factory.isJSXAttribute(attribute)) {
      const name = attribute.name;
      const value = attribute.value;

      if (t_factory.isJSXIdentifier(name)) {
        const propName = name.name;

        // Handle different value types
        if (value === null || value === undefined) {
          // Boolean prop with no value (e.g., <Button disabled />)
          props.set(propName, t_factory.booleanLiteral(true));
        } else if (t_factory.isStringLiteral(value)) {
          // String literal (e.g., name="World")
          props.set(propName, value);
        } else if (t_factory.isJSXExpressionContainer(value)) {
          // Expression (e.g., onClick={handleClick})
          const expression = value.expression;
          if (t_factory.isExpression(expression)) {
            props.set(propName, expression);
          }
        }
      }
    }
  }

  return props;
}

/**
 * Extract prop names from a component's function parameters
 *
 * @param node - The function declaration/expression
 * @returns Array of prop names
 */
export function extractPropNames(
  node: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
): string[] {
  const propNames: string[] = [];

  // Get the first parameter (props)
  const firstParam = node.params[0];

  if (!firstParam) {
    return propNames;
  }

  // Handle destructuring pattern: function Component({ name, age }) { ... }
  if (t_factory.isObjectPattern(firstParam)) {
    for (const property of firstParam.properties) {
      if (t_factory.isObjectProperty(property)) {
        const key = property.key;
        if (t_factory.isIdentifier(key)) {
          propNames.push(key.name);
        }
      }
    }
  }
  // Handle simple identifier: function Component(props) { ... }
  else if (t_factory.isIdentifier(firstParam)) {
    // For now, we'll skip this case - Phase 1 focuses on destructured props
    // Phase 2 can handle props.name syntax
  }

  return propNames;
}

/**
 * Substitute prop references in a JSX body with their actual values
 *
 * @param body - The JSX element or fragment body to transform
 * @param propMapping - Map of prop names to their values
 * @returns Transformed JSX element or fragment
 */
export function substituteProps(body: t.JSXElement | t.JSXFragment, propMapping: PropMapping): t.JSXElement | t.JSXFragment {
  // Clone the body to avoid mutating the original
  const clonedBody = t_factory.cloneNode(body, true);

  // Manually walk and replace prop references
  visitNode(clonedBody, propMapping);

  return clonedBody;
}

/**
 * Recursively visit nodes and replace prop references
 */
function visitNode(node: t.Node, propMapping: PropMapping): void {
  // Handle JSX expression containers (e.g., {name})
  if (t_factory.isJSXExpressionContainer(node)) {
    const expression = node.expression;
    if (t_factory.isIdentifier(expression) && propMapping.has(expression.name)) {
      const propValue = propMapping.get(expression.name);
      if (propValue) {
        node.expression = t_factory.cloneNode(propValue, true);
      }
    } else if (t_factory.isExpression(expression)) {
      visitNode(expression, propMapping);
    }
  }
  // Handle JSX elements
  else if (t_factory.isJSXElement(node)) {
    // Visit opening element attributes
    for (const attribute of node.openingElement.attributes) {
      visitNode(attribute, propMapping);
    }
    // Visit children
    for (const child of node.children) {
      visitNode(child, propMapping);
    }
  }
  // Handle JSX fragments
  else if (t_factory.isJSXFragment(node)) {
    // Visit children
    for (const child of node.children) {
      visitNode(child, propMapping);
    }
  }
  // Handle JSX attributes
  else if (t_factory.isJSXAttribute(node)) {
    if (node.value) {
      visitNode(node.value, propMapping);
    }
  }
  // Handle member expressions (e.g., props.onClick)
  else if (t_factory.isMemberExpression(node)) {
    if (
      t_factory.isIdentifier(node.object) &&
      propMapping.has(node.object.name) &&
      t_factory.isIdentifier(node.property)
    ) {
      const propValue = propMapping.get(node.object.name);
      if (propValue) {
        // For now, we don't handle props.x syntax - Phase 1 focuses on destructured props
      }
    }
  }
}
