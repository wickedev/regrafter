/**
 * Component Detector
 *
 * Analyzes React components to determine if they can be safely inlined.
 * Classifies components by complexity: simple, hooks, cross-file.
 *
 * Phase 1: Simple component detection (no props, no hooks)
 */

import type * as t from '@babel/types';
import traverse from '@babel/traverse';

/**
 * Component classification based on complexity
 */
export enum ComponentComplexity {
  /** Simple presentational component - no hooks, no state */
  Simple = 'simple',
  /** Component with hooks - useState, useEffect, etc. */
  WithHooks = 'with-hooks',
  /** Component defined in another file */
  CrossFile = 'cross-file',
  /** Component with unsupported features */
  Unsupported = 'unsupported',
}

/**
 * Information about a detected component
 */
export interface ComponentInfo {
  /** Component name */
  name: string;
  /** Component complexity classification */
  complexity: ComponentComplexity;
  /** AST node of the component definition */
  node: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression;
  /** Whether the component can be inlined */
  isInlineable: boolean;
  /** Reason if not inlineable */
  reason?: string;
}

/**
 * Finds a component definition by name in the AST
 */
export function findComponentDefinition(
  ast: t.File,
  componentName: string
): ComponentInfo | null {
  let componentInfo: ComponentInfo | null = null;

  traverse(ast, {
    // Handle function declarations: function MyComponent() { ... }
    FunctionDeclaration(path) {
      const node = path.node;
      if (node.id?.name === componentName) {
        // Check if it returns JSX
        if (returnsJSX(node.body)) {
          componentInfo = {
            name: componentName,
            complexity: ComponentComplexity.Simple,
            node,
            isInlineable: true,
          };
        }
      }
    },
  });

  return componentInfo;
}

/**
 * Checks if a function body returns JSX
 */
function returnsJSX(body: t.BlockStatement): boolean {
  // Walk through statements to find return statement with JSX
  for (const statement of body.body) {
    if (statement.type === 'ReturnStatement' && statement.argument) {
      if (isJSXNode(statement.argument)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a node is a JSX node
 */
function isJSXNode(node: t.Node): boolean {
  return (
    node.type === 'JSXElement' ||
    node.type === 'JSXFragment' ||
    node.type === 'JSXText'
  );
}
