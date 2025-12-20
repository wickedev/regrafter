/**
 * Component Inliner
 *
 * Main orchestrator for inlining React components.
 * Replaces component calls with their implementation.
 *
 * Phase 1: Simple components without props or hooks
 */

import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t_factory from '@babel/types';
import type * as t from '@babel/types';

import { findComponentDefinition, ComponentComplexity } from '../analyzer/component-detector.js';
import {
  extractHookStatements,
  removeHookStatements,
  substituteDependencies,
  insertHooksIntoParent,
} from '../strategies/hook-merger.js';
import { loadTraverseFunction } from '../utils/index.js';

import { extractPropsFromElement, substituteProps } from './prop-substituter.js';

const traverse = loadTraverseFunction(traverseModule);

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
   * @param ast - The AST to transform (usage file)
   * @param componentName - Name of the component to inline
   * @param componentDefAst - Optional AST containing component definition (for cross-file)
   * @param removeDefinition - Whether to remove the component definition (default: true)
   * @returns Result of the inline operation
   */
  inline(ast: t.File, componentName: string, componentDefAst?: t.File, removeDefinition = true): InlineResult {
    // Step 1: Find the component definition
    // First try in the provided componentDefAst (cross-file case)
    let componentInfo = componentDefAst
      ? findComponentDefinition(componentDefAst, componentName)
      : null;

    // If not found and no componentDefAst provided, try in the same file
    componentInfo ??= findComponentDefinition(ast, componentName);

    if (componentInfo === null) {
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
        error: componentInfo.reason ?? 'Component cannot be inlined',
      };
    }

    // Step 2: Extract hooks if component has them
    const hasHooks = componentInfo.complexity === ComponentComplexity.WithHooks;
    let hookStatements: t.Statement[] = [];
    let componentBodyNode = componentInfo.node.body;

    if (hasHooks && componentInfo.hooks !== undefined && componentInfo.hooks.length > 0) {
      // Only process if body is a BlockStatement
      if (t_factory.isBlockStatement(componentBodyNode)) {
        // Extract hook statements
        hookStatements = extractHookStatements(componentBodyNode, componentInfo.hooks);

        // Remove hooks from component body to get just the JSX part
        componentBodyNode = removeHookStatements(componentBodyNode, componentInfo.hooks);
      }
    }

    // Step 3: Find all usages and replace with implementation
    let inlinedCount = 0;
    let parentFunctionPath: NodePath<
      t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
    > | null = null;

    // Extract component body using potentially modified componentBodyNode
    // Pass the componentInfo.node and separately handle the body replacement
    const componentBody = this.extractComponentBody(componentInfo.node);

    if (componentBody === null) {
      return {
        success: false,
        ast,
        inlinedCount: 0,
        error: 'Could not extract component body',
      };
    }

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        const openingElement = path.node.openingElement;
        const name = openingElement.name;

        // Check if this is a usage of our component
        if (t_factory.isJSXIdentifier(name) && name.name === componentName) {

          // Step 3a: Extract props from the call site
          const propMapping = extractPropsFromElement(path.node);

          // Step 3b: If component has hooks, substitute props in dependency arrays
          let finalHookStatements = hookStatements;
          if (hasHooks && propMapping.size > 0) {
            finalHookStatements = substituteDependencies(hookStatements, propMapping);
          }

          // Step 3c: Insert hooks into parent function (if any)
          if (hasHooks && finalHookStatements.length > 0 && parentFunctionPath === null) {
            // Find the parent function
            let currentPath: NodePath = path;
            while (currentPath.parentPath !== null) {
              currentPath = currentPath.parentPath;
              if (
                currentPath.isFunctionDeclaration() === true ||
                currentPath.isFunctionExpression() === true ||
                currentPath.isArrowFunctionExpression() === true
              ) {
                // Use type guard to ensure correct type
                if (
                  currentPath.isFunctionDeclaration() ||
                  currentPath.isFunctionExpression() ||
                  currentPath.isArrowFunctionExpression()
                ) {
                  parentFunctionPath = currentPath;
                }
                break;
              }
            }

            if (
              parentFunctionPath !== null &&
              t_factory.isBlockStatement(parentFunctionPath.node.body)
            ) {
              const newBody = insertHooksIntoParent(
                parentFunctionPath.node.body,
                finalHookStatements
              );
              parentFunctionPath.node.body = newBody;
            }
          }

          // Step 3d: Substitute props in the component body
          let inlinedBody: t.JSXElement | t.JSXFragment;
          if (propMapping.size > 0) {
            inlinedBody = substituteProps(componentBody, propMapping);
          } else {
            inlinedBody = t_factory.cloneNode(componentBody, true);
          }

          // Step 3e: Replace the component usage with its implementation
          path.replaceWith(inlinedBody);
          inlinedCount++;
        }
      },
    });

    // Step 3: Remove the component definition (if requested)
    if (removeDefinition) {
      this.removeComponentDefinition(ast, componentName);
    }

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
  ): t.JSXElement | t.JSXFragment | null {
    // For function declarations with block body
    if (t_factory.isBlockStatement(node.body)) {
      // Find the return statement
      for (const statement of node.body.body) {
        if (t_factory.isReturnStatement(statement) && statement.argument) {
          if (t_factory.isJSXElement(statement.argument) || t_factory.isJSXFragment(statement.argument)) {
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
      FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
        const node = path.node;
        if (node.id?.name === componentName) {
          path.remove();
        }
      },
    });
  }
}
