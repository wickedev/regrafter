/**
 * Component Detector
 *
 * Analyzes React components to determine if they can be safely inlined.
 * Classifies components by complexity: simple, hooks, cross-file.
 *
 * Phase 1: Simple component detection (no props, no hooks)
 */

import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import { loadTraverseFunction } from '../utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

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
  /** List of hooks used in the component */
  hooks?: HookInfo[];
}

/**
 * Information about a hook call
 */
export interface HookInfo {
  /** Hook name (useState, useEffect, etc.) */
  name: string;
  /** The call expression node */
  node: t.CallExpression;
  /** Variable declarator if hook returns values */
  declarator?: t.VariableDeclarator;
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
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      const node = path.node;
      if (node.id?.name === componentName) {
        // Check if it returns JSX
        if (returnsJSX(node.body)) {
          // Detect hooks in the component
          const hooks = detectHooks(node.body);
          const complexity = hooks.length > 0
            ? ComponentComplexity.WithHooks
            : ComponentComplexity.Simple;

          componentInfo = {
            name: componentName,
            complexity,
            node,
            isInlineable: true,
            hooks,
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

/**
 * Detects React hooks in a function body
 */
function detectHooks(body: t.BlockStatement): HookInfo[] {
  const hooks: HookInfo[] = [];

  for (const statement of body.body) {
    // Look for variable declarations with hook calls
    // e.g., const [state, setState] = useState(0);
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        if (declarator.init?.type === 'CallExpression') {
          const callExpr = declarator.init;
          const callee = callExpr.callee;

          // Check if it's a hook call (starts with 'use')
          if (callee.type === 'Identifier' && callee.name.startsWith('use')) {
            hooks.push({
              name: callee.name,
              node: callExpr,
              declarator,
            });
          }
        }
      }
    }
    // Look for standalone hook calls (mostly useEffect)
    // e.g., useEffect(() => {...}, [deps]);
    else if (statement.type === 'ExpressionStatement') {
      const expr = statement.expression;
      if (expr.type === 'CallExpression') {
        const callee = expr.callee;
        if (callee.type === 'Identifier' && callee.name.startsWith('use')) {
          hooks.push({
            name: callee.name,
            node: expr,
          });
        }
      }
    }
  }

  return hooks;
}
