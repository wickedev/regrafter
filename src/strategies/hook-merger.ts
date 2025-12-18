/**
 * Hook Merger
 *
 * Handles merging React hooks from an inlined component into the parent component.
 * Preserves Rules of Hooks:
 * - Hooks must be called at the top level
 * - Hooks must be called in the same order
 *
 * Phase 2: Basic hook merging with dependency substitution
 */

import type * as t from '@babel/types';
import * as t_factory from '@babel/types';
import type { HookInfo } from '../analyzer/component-detector.js';
import type { PropMapping } from '../transformer/prop-substituter.js';

/**
 * Extract hook statements from a component function body
 *
 * @param body - The function body containing hooks
 * @param hooks - Information about detected hooks
 * @returns Array of statements containing hook calls
 */
export function extractHookStatements(
  body: t.BlockStatement,
  hooks: HookInfo[]
): t.Statement[] {
  const hookStatements: t.Statement[] = [];

  for (const statement of body.body) {
    // Check if this statement contains a hook
    const containsHook = hooks.some(hook => {
      // For variable declarations with hooks
      if (
        statement.type === 'VariableDeclaration' &&
        hook.declarator
      ) {
        return statement.declarations.includes(hook.declarator);
      }
      // For expression statements (useEffect, etc.)
      if (
        statement.type === 'ExpressionStatement' &&
        !hook.declarator
      ) {
        return statement.expression === hook.node;
      }
      return false;
    });

    if (containsHook) {
      hookStatements.push(t_factory.cloneNode(statement, true));
    }
  }

  return hookStatements;
}

/**
 * Remove hook statements from a component body
 *
 * @param body - The function body to modify
 * @param hooks - Information about detected hooks
 * @returns Modified body without hook statements
 */
export function removeHookStatements(
  body: t.BlockStatement,
  hooks: HookInfo[]
): t.BlockStatement {
  const clonedBody = t_factory.cloneNode(body, true);

  clonedBody.body = clonedBody.body.filter(statement => {
    // Check if this statement contains a hook
    const containsHook = hooks.some(hook => {
      // For variable declarations with hooks
      if (
        statement.type === 'VariableDeclaration' &&
        hook.declarator
      ) {
        return statement.declarations.some(decl => decl === hook.declarator);
      }
      // For expression statements (useEffect, etc.)
      if (
        statement.type === 'ExpressionStatement' &&
        !hook.declarator
      ) {
        return statement.expression === hook.node;
      }
      return false;
    });

    return !containsHook;
  });

  return clonedBody;
}

/**
 * Substitute props in hook dependency arrays
 *
 * @param hookStatements - Hook statements to modify
 * @param propMapping - Map of prop names to their values
 * @returns Modified hook statements with substituted dependencies
 */
export function substituteDependencies(
  hookStatements: t.Statement[],
  propMapping: PropMapping
): t.Statement[] {
  const substituted: t.Statement[] = [];

  for (const statement of hookStatements) {
    const clonedStatement = t_factory.cloneNode(statement, true);

    // Find dependency arrays in the statement
    visitStatementForDeps(clonedStatement, propMapping);

    substituted.push(clonedStatement);
  }

  return substituted;
}

/**
 * Visit a statement to find and substitute dependency arrays
 */
function visitStatementForDeps(statement: t.Statement, propMapping: PropMapping): void {
  if (statement.type === 'ExpressionStatement') {
    visitExpressionForDeps(statement.expression, propMapping);
  } else if (statement.type === 'VariableDeclaration') {
    for (const declarator of statement.declarations) {
      if (declarator.init) {
        visitExpressionForDeps(declarator.init, propMapping);
      }
    }
  }
}

/**
 * Visit an expression to find and substitute dependency arrays
 */
function visitExpressionForDeps(expr: t.Expression, propMapping: PropMapping): void {
  if (expr.type === 'CallExpression') {
    // Check if this is a hook call with dependency array
    // e.g., useEffect(() => {}, [dep1, dep2])
    const callee = expr.callee;
    if (
      callee.type === 'Identifier' &&
      (callee.name === 'useEffect' ||
        callee.name === 'useCallback' ||
        callee.name === 'useMemo')
    ) {
      // Second argument is the dependency array
      if (expr.arguments.length >= 2) {
        const depsArg = expr.arguments[1];
        if (depsArg && depsArg.type === 'ArrayExpression') {
          // Substitute each dependency
          for (let i = 0; i < depsArg.elements.length; i++) {
            const element = depsArg.elements[i];
            if (element && element.type === 'Identifier') {
              const propValue = propMapping.get(element.name);
              if (propValue) {
                depsArg.elements[i] = t_factory.cloneNode(propValue, true);
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Insert hook statements into parent function body
 *
 * Hooks are inserted at the beginning of the parent function,
 * before any other statements (following Rules of Hooks).
 *
 * @param parentBody - The parent function body
 * @param hookStatements - Hook statements to insert
 * @returns Modified parent body with hooks inserted
 */
export function insertHooksIntoParent(
  parentBody: t.BlockStatement,
  hookStatements: t.Statement[]
): t.BlockStatement {
  const clonedBody = t_factory.cloneNode(parentBody, true);

  // Insert hooks at the beginning
  clonedBody.body = [...hookStatements, ...clonedBody.body];

  return clonedBody;
}
