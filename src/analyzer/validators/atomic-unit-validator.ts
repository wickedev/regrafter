/**
 * Atomic Unit Validator
 *
 * Validates atomic unit integrity when moving elements.
 * Provides warnings for compound components and map expressions.
 */

import { AtomicUnitType } from '../../types/internal.js';
import type { ResolveResult } from '../../types/internal.js';

/**
 * Result from a validation rule
 */
export interface ValidationRuleResult {
  valid: boolean;
  reason?: string;
  errorCode?: AtomicUnitError;
  warning?: string;
}

/**
 * Error codes for atomic unit validation failures
 */
export enum AtomicUnitError {
  /** Invalid atomic unit move */
  INVALID_ATOMIC_UNIT = 'INVALID_ATOMIC_UNIT',
}

/**
 * Rule: Validate atomic unit integrity
 */
export function validateAtomicUnit(source: ResolveResult): ValidationRuleResult {
  if (!source.atomicUnit) {
    return { valid: true };
  }

  const atomicUnit = source.atomicUnit;

  // Compound components should ideally be moved with their parent
  if (atomicUnit.type === AtomicUnitType.CompoundComponent) {
    return {
      valid: true,
      warning: 'Moving a compound component sub-element. Consider moving the entire compound component group.',
    };
  }

  // Map expressions contain closures that might reference outer scope
  if (atomicUnit.type === AtomicUnitType.MapExpression) {
    return {
      valid: true,
      warning: 'Moving a map expression. Ensure iterator variables remain in scope.',
    };
  }

  return { valid: true };
}
