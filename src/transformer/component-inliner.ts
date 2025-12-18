/**
 * Component Inliner
 *
 * Main orchestrator for inlining React components.
 * Replaces component calls with their implementation.
 *
 * Phase 1: Simple components without props or hooks
 */

import type * as t from '@babel/types';
import traverse from '@babel/traverse';
import * as t_factory from '@babel/types';
import { findComponentDefinition, type ComponentInfo } from '../analyzer/component-detector.js';

/**
 * Result of an inline operation
 */
export interface InlineResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Modified AST */
  ast: t.File;
  /** Number of inlined instances */
  inlinedCount: number;
  /** Error message if operation failed */
  error?: string;
}

/**
 * ComponentInliner class
 *
 * Handles the inlining of React components by replacing their usage
 * with their implementation.
 */
export class ComponentInliner {
  /**
   * Inline a component by name
   *
   * @param ast - The AST to transform
   * @param componentName - Name of the component to inline
   * @returns Result of the inline operation
   */
  inline(ast: t.File, componentName: string): InlineResult {
    // Step 1: Find the component definition
    const componentInfo = findComponentDefinition(ast, componentName);

    if (!componentInfo) {
      return {
        success: false,
        ast,
        inlinedCount: 0,
        error: `Component '${componentName}' not found`,
      };
    }

    if (!componentInfo.isInlineable) {
      return {
        success: false,
        ast,
        inlinedCount: 0,
        error: componentInfo.reason || 'Component cannot be inlined',
      };
    }

    // Step 2: Find all usages and replace with implementation
    let inlinedCount = 0;
    const componentBody = this.extractComponentBody(componentInfo.node);

    if (!componentBody) {
      return {
        success: false,
        ast,
        inlinedCount: 0,
        error: 'Could not extract component body',
      };
    }

    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        const name = openingElement.name;

        // Check if this is a usage of our component
        if (t_factory.isJSXIdentifier(name) && name.name === componentName) {
          // Replace the component usage with its implementation
          path.replaceWith(t_factory.cloneNode(componentBody, true));
          inlinedCount++;
        }
      },
    });

    // Step 3: Remove the component definition
    this.removeComponentDefinition(ast, componentName);

    return {
      success: true,
      ast,
      inlinedCount,
    };
  }

  /**
   * Extract the JSX body from a component function
   */
  private extractComponentBody(
    node: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
  ): t.JSXElement | null {
    // For function declarations with block body
    if (t_factory.isBlockStatement(node.body)) {
      // Find the return statement
      for (const statement of node.body.body) {
        if (t_factory.isReturnStatement(statement) && statement.argument) {
          if (t_factory.isJSXElement(statement.argument)) {
            return statement.argument;
          }
        }
      }
    }

    return null;
  }

  /**
   * Remove the component definition from the AST
   */
  private removeComponentDefinition(ast: t.File, componentName: string): void {
    traverse(ast, {
      FunctionDeclaration(path) {
        const node = path.node;
        if (node.id?.name === componentName) {
          path.remove();
        }
      },
    });
  }
}
