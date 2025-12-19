/**
 * Move Rules Validator
 *
 * Validates basic move rules such as self-moves, descendant relationships,
 * and target child support.
 */

import type { NodePath } from '@babel/traverse';

import type { ResolveResult } from '../../types/internal.js';
import { Move } from '../../types/public.js';

/**
 * Result from a validation rule
 */
export interface ValidationRuleResult {
  valid: boolean;
  reason?: string;
  errorCode?: MoveRulesError;
  warning?: string;
}

/**
 * Error codes for move rules validation failures
 */
export enum MoveRulesError {
  /** Cannot move element to itself */
  SELF_MOVE = 'SELF_MOVE',
  /** Target is a descendant of source */
  TARGET_IS_DESCENDANT = 'TARGET_IS_DESCENDANT',
  /** Source is a descendant of target (for Inside mode) */
  SOURCE_IS_DESCENDANT = 'SOURCE_IS_DESCENDANT',
  /** Target does not support children (for Inside mode) */
  TARGET_NO_CHILDREN = 'TARGET_NO_CHILDREN',
}

/**
 * Rule: Moving element to itself is allowed (will be handled as no-op)
 */
export function validateSelfMove(
  source: ResolveResult,
  target: ResolveResult
): ValidationRuleResult {
  if (source.node === target.node) {
    // Allow self-moves as no-ops
    return {
      valid: true,
      warning: 'Moving element to itself (will be no-op)',
    };
  }
  return { valid: true };
}

/**
 * Rule: Target cannot be a descendant of source (only for Move.Inside)
 */
export function validateTargetNotDescendant(
  source: ResolveResult,
  target: ResolveResult,
  mode: Move
): ValidationRuleResult {
  // This rule only applies to Move.Inside
  // For Move.Before/After, it's valid to move an element before/after its own descendant
  if (mode !== Move.Inside) {
    return { valid: true };
  }

  if (!source.path || !target.path) {
    return { valid: true };
  }

  // Skip check if source and target are the same (will be handled as no-op)
  if (source.node === target.node) {
    return { valid: true };
  }

  // Check if target is a descendant of source
  let current: NodePath | null = target.path.parentPath; // Start from parent to exclude target itself
  while (current) {
    // If we find the source node while walking up from target, target is a descendant
    if (current.node === source.node) {
      return {
        valid: false,
        reason: 'Cannot move element into its own descendant',
        errorCode: MoveRulesError.TARGET_IS_DESCENDANT,
      };
    }
    current = current.parentPath;
  }

  return { valid: true };
}

/**
 * Rule: Source cannot already be a descendant of target (for Inside mode)
 */
export function validateSourceNotDescendant(
  source: ResolveResult,
  target: ResolveResult,
  mode: Move
): ValidationRuleResult {
  if (mode !== Move.Inside) {
    return { valid: true };
  }

  if (!source.path || !target.path) {
    return { valid: true };
  }

  // Skip check if source and target are the same (will be handled as no-op)
  if (source.node === target.node) {
    return { valid: true };
  }

  // Check if source is a descendant of target
  let current: NodePath | null = source.path;
  while (current) {
    if (current.node === target.node) {
      return {
        valid: false,
        reason: 'Source is already a descendant of target',
        errorCode: MoveRulesError.SOURCE_IS_DESCENDANT,
      };
    }
    current = current.parentPath;
  }

  return { valid: true };
}

/**
 * Rule: Target must support children for Inside mode
 */
export function validateTargetSupportsChildren(
  target: ResolveResult,
  mode: Move
): ValidationRuleResult {
  if (mode !== Move.Inside) {
    return { valid: true };
  }

  if (!target.node || !target.path) {
    return { valid: true };
  }

  // Target should already be normalized to JSXElement by validateMove
  if (target.node.type !== 'JSXElement') {
    return { valid: true };
  }

  // Check for self-closing elements that don't support children
  const element = target.node;
  const openingElement = element.openingElement;

  // Get element name
  let elementName = '';
  if (openingElement.name.type === 'JSXIdentifier') {
    elementName = openingElement.name.name;
  }

  // Known void elements that don't support children
  const voidElements = [
    'input', 'img', 'br', 'hr', 'meta', 'link',
    'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr',
  ];

  if (voidElements.includes(elementName.toLowerCase())) {
    return {
      valid: false,
      reason: `<${elementName}> is a void element and cannot have children`,
      errorCode: MoveRulesError.TARGET_NO_CHILDREN,
    };
  }

  // Also check if the element is self-closing (has no children and is self-closed)
  if (openingElement.selfClosing && element.children.length === 0) {
    // This is a self-closing element, check if it's a known void element or custom component
    // For lowercase (HTML) elements that are self-closing, they shouldn't accept children
    if (elementName && /^[a-z]/.test(elementName)) {
      return {
        valid: false,
        reason: `<${elementName} /> is self-closing and cannot have children`,
        errorCode: MoveRulesError.TARGET_NO_CHILDREN,
      };
    }
  }

  return { valid: true };
}
