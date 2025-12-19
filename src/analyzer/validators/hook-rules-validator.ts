/**
 * Hook Rules Validator
 *
 * Validates React Hook rules when moving elements.
 * Ensures hooks are not placed inside conditionals or loops.
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import type { ResolveResult } from '../../types/internal.js';

/**
 * Result from a validation rule
 */
export interface ValidationRuleResult {
  valid: boolean;
  reason?: string;
  errorCode?: HookRulesError;
  warning?: string;
}

/**
 * Error codes for hook rules validation failures
 */
export enum HookRulesError {
  /** Move would break hook rules */
  HOOK_RULES_VIOLATION = 'HOOK_RULES_VIOLATION',
}

/**
 * Rule: Validate hook rules (hooks cannot be called conditionally)
 */
export function validateHookRules(
  source: ResolveResult,
  target: ResolveResult
): ValidationRuleResult {
  if (!source.path || !target.path) {
    return { valid: true };
  }

  // Check if source contains hooks by traversing from the source path
  // (source.path is guaranteed to be non-null due to check at function entry)
  // Use object wrapper to avoid ESLint unnecessary-condition warning
  const hooksCheck: { hasHooks: boolean } = { hasHooks: false };

  // Traverse from the source path to find hook calls
  source.path.traverse({
    CallExpression(path: NodePath<t.CallExpression>): void {
      const callee = path.node.callee;
      if (callee.type === 'Identifier' && callee.name.startsWith('use')) {
        hooksCheck.hasHooks = true;
        path.stop();
      }
    },
  });

  // Extract hasHooks from wrapper
  const hasHooks = hooksCheck.hasHooks;
  if (!hasHooks) {
    return { valid: true };
  }

  // Check if target is inside a conditional context
  let current: NodePath | null = target.path;
  while (current) {
    const node = current.node;

    // Check for conditional contexts
    if (
      node.type === 'IfStatement' ||
      node.type === 'ConditionalExpression' ||
      node.type === 'LogicalExpression'
    ) {
      return {
        valid: false,
        reason: 'Moving this element would place hooks inside a conditional context, violating React hook rules',
        errorCode: HookRulesError.HOOK_RULES_VIOLATION,
      };
    }

    // Check for loop contexts
    if (
      node.type === 'ForStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement' ||
      node.type === 'WhileStatement' ||
      node.type === 'DoWhileStatement'
    ) {
      return {
        valid: false,
        reason: 'Moving this element would place hooks inside a loop, violating React hook rules',
        errorCode: HookRulesError.HOOK_RULES_VIOLATION,
      };
    }

    current = current.parentPath;
  }

  return { valid: true };
}
