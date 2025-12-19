/**
 * Analyzability Validator
 *
 * Checks if code is analyzable by detecting constructs that prevent static analysis
 * (eval, dynamic code, with statements, etc.)
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import type * as t from '@babel/types';

import type { AnalyzabilityResult, UnanalyzableCode } from '../../types/internal.js';
import { loadTraverseFunction, type TraverseFunction } from '../../utils/index.js';

const traverse: TraverseFunction = loadTraverseFunction(traverseModule);

/**
 * Error codes for analyzability validation failures
 */
export enum AnalyzabilityError {
  /** Code contains unanalyzable constructs */
  UNANALYZABLE_CODE = 'UNANALYZABLE_CODE',
}

/**
 * Check if the code is analyzable (no eval, dynamic code, etc.)
 */
export function checkAnalyzability(ast: t.File): AnalyzabilityResult {
  const blockers: UnanalyzableCode[] = [];

  traverse(ast, {
    // Check for eval()
    CallExpression(path: NodePath<t.CallExpression>): void {
      const callee = path.node.callee;
      if (callee.type === 'Identifier' && callee.name === 'eval') {
        blockers.push({
          type: 'eval',
          location: path.node.loc
            ? {
                start: { line: path.node.loc.start.line, column: path.node.loc.start.column },
                end: { line: path.node.loc.end.line, column: path.node.loc.end.column },
              }
            : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          description: 'eval() makes static analysis impossible',
        });
      }

      // Check for Function constructor (as a call)
      if (
        callee.type === 'Identifier' &&
        callee.name === 'Function' &&
        path.node.arguments.length > 0
      ) {
        blockers.push({
          type: 'dynamicCode',
          location: path.node.loc
            ? {
                start: { line: path.node.loc.start.line, column: path.node.loc.start.column },
                end: { line: path.node.loc.end.line, column: path.node.loc.end.column },
              }
            : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          description: 'Function constructor creates dynamic code',
        });
      }
    },

    // Check for new Function() constructor
    NewExpression(path: NodePath<t.NewExpression>): void {
      const callee = path.node.callee;
      if (
        callee.type === 'Identifier' &&
        callee.name === 'Function' &&
        path.node.arguments.length > 0
      ) {
        blockers.push({
          type: 'dynamicCode',
          location: path.node.loc
            ? {
                start: { line: path.node.loc.start.line, column: path.node.loc.start.column },
                end: { line: path.node.loc.end.line, column: path.node.loc.end.column },
              }
            : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          description: 'Function constructor creates dynamic code',
        });
      }
    },

    // Check for with statements
    WithStatement(path: NodePath<t.WithStatement>): void {
      blockers.push({
        type: 'dynamicCode',
        location: path.node.loc
          ? {
              start: { line: path.node.loc.start.line, column: path.node.loc.start.column },
              end: { line: path.node.loc.end.line, column: path.node.loc.end.column },
            }
          : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
        description: 'with statement makes scope analysis impossible',
      });
    },
  });

  return {
    analyzable: blockers.length === 0,
    blockers: blockers.length > 0 ? blockers : undefined,
  };
}
