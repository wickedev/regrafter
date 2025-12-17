/**
 * Dynamic Code Detector
 *
 * Detects dynamic code patterns that cannot be statically analyzed.
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import type { SourceLocation } from '../types/internal.js';

/**
 * Information about detected dynamic code
 */
export interface DynamicCodeInfo {
  /** Type of dynamic code detected */
  type: 'eval' | 'Function' | 'dynamic_import';
  /** Location in source code */
  location: SourceLocation;
  /** Code pattern description */
  code: string;
}

/**
 * DynamicCodeDetector class for detecting unanalyzable code patterns
 */
export class DynamicCodeDetector {
  /**
   * Detect dynamic code patterns in the given AST path
   *
   * @param path - NodePath to analyze (typically a JSX element)
   * @returns Array of detected dynamic code patterns
   */
  detect(path: NodePath): DynamicCodeInfo[] {
    const results: DynamicCodeInfo[] = [];

    // Find the containing function/component scope
    let containerPath: NodePath | null = path;
    while (containerPath && !this.isFunctionOrComponentScope(containerPath)) {
      containerPath = containerPath.parentPath;
    }

    // If no container found, use element path
    const scopeToCheck = containerPath ?? path;

    scopeToCheck.traverse({
      CallExpression: (callPath: NodePath<t.CallExpression>) => {
        // Check for eval()
        if (
          t.isIdentifier(callPath.node.callee) &&
          callPath.node.callee.name === 'eval'
        ) {
          results.push({
            type: 'eval',
            location: this.getLocation(callPath.node),
            code: 'eval(...)',
          });
        }

        // Check for Function() constructor
        if (
          t.isIdentifier(callPath.node.callee) &&
          callPath.node.callee.name === 'Function'
        ) {
          results.push({
            type: 'Function',
            location: this.getLocation(callPath.node),
            code: 'Function(...)',
          });
        }

        // Check for dynamic import() with non-literal arguments
        if (t.isImport(callPath.node.callee)) {
          const firstArg = callPath.node.arguments[0];
          if (firstArg && !t.isStringLiteral(firstArg)) {
            results.push({
              type: 'dynamic_import',
              location: this.getLocation(callPath.node),
              code: 'import(...)',
            });
          }
        }
      },

      NewExpression: (newPath: NodePath<t.NewExpression>) => {
        // Check for new Function()
        if (
          t.isIdentifier(newPath.node.callee) &&
          newPath.node.callee.name === 'Function'
        ) {
          results.push({
            type: 'Function',
            location: this.getLocation(newPath.node),
            code: 'new Function(...)',
          });
        }
      },
    });

    return results;
  }

  /**
   * Check if a node path is a function or component scope
   */
  private isFunctionOrComponentScope(path: NodePath): boolean {
    const node = path.node;
    return (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'ClassMethod' ||
      node.type === 'ClassPrivateMethod'
    );
  }

  /**
   * Extract location from a node
   */
  private getLocation(node: t.Node): SourceLocation {
    return {
      start: {
        line: node.loc?.start.line ?? 0,
        column: node.loc?.start.column ?? 0,
      },
      end: {
        line: node.loc?.end.line ?? 0,
        column: node.loc?.end.column ?? 0,
      },
    };
  }
}

/**
 * Create a new DynamicCodeDetector instance
 */
export function createDynamicCodeDetector(): DynamicCodeDetector {
  return new DynamicCodeDetector();
}
