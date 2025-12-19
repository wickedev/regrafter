/**
 * Move Validator Coordinator
 *
 * Coordinates validation of move operations by delegating to specialized validators.
 * Acts as the main entry point for move validation.
 */

import * as t from '@babel/types';

import type { Parser} from '../parser/index.js';
import { createParser } from '../parser/index.js';
import type { ResolveResult, AnalyzabilityResult } from '../types/internal.js';
import type { FileInput, Selector } from '../types/public.js';
import { Move } from '../types/public.js';

import { checkAnalyzability } from './validators/analyzability-validator.js';
import { validateAtomicUnit } from './validators/atomic-unit-validator.js';
import { validateBoundary } from './validators/boundary-validator.js';
import { validateConditional } from './validators/conditional-validator.js';
import { validateHookRules } from './validators/hook-rules-validator.js';
import {
  validateSelfMove,
  validateSourceNotDescendant,
  validateTargetNotDescendant,
  validateTargetSupportsChildren,
} from './validators/move-rules-validator.js';
import {
  resolveSelector,
  normalizeToJSXElement,
} from './validators/selector-validator.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of move validation
 */
export interface MoveValidationResult {
  /** Whether the move is valid */
  valid: boolean;
  /** Human-readable reason if invalid */
  reason?: string;
  /** Error code for programmatic handling */
  errorCode?: MoveValidationError;
  /** Warnings that don't prevent the move but should be noted */
  warnings: string[];
  /** The resolved source element */
  source?: ResolveResult;
  /** The resolved target element */
  target?: ResolveResult;
  /** Analyzability information */
  analyzability?: AnalyzabilityResult;
}

/**
 * Validation rule function type
 */
export type ValidationRule = (
  source: ResolveResult,
  target: ResolveResult,
  mode: Move,
  context: ValidationContext
) => ValidationRuleResult;

/**
 * Result from a single validation rule
 */
interface ValidationRuleResult {
  valid: boolean;
  reason?: string;
  errorCode?: MoveValidationError;
  warning?: string;
}

/**
 * Context passed to validation rules
 */
interface ValidationContext {
  files: Map<string, t.File>;
  parser: Parser;
  sourceFile: string;
  targetFile: string;
}

/**
 * Error codes for move validation failures
 */
export enum MoveValidationError {
  /** Source selector could not be resolved */
  SOURCE_NOT_FOUND = 'SOURCE_NOT_FOUND',
  /** Target selector could not be resolved */
  TARGET_NOT_FOUND = 'TARGET_NOT_FOUND',
  /** Source file not found in inputs */
  SOURCE_FILE_NOT_FOUND = 'SOURCE_FILE_NOT_FOUND',
  /** Target file not found in inputs */
  TARGET_FILE_NOT_FOUND = 'TARGET_FILE_NOT_FOUND',
  /** Cannot move element to itself */
  SELF_MOVE = 'SELF_MOVE',
  /** Target is a descendant of source */
  TARGET_IS_DESCENDANT = 'TARGET_IS_DESCENDANT',
  /** Source is a descendant of target (for Inside mode) */
  SOURCE_IS_DESCENDANT = 'SOURCE_IS_DESCENDANT',
  /** Move would break hook rules */
  HOOK_RULES_VIOLATION = 'HOOK_RULES_VIOLATION',
  /** Move would break conditional rendering rules */
  CONDITIONAL_RENDERING_VIOLATION = 'CONDITIONAL_RENDERING_VIOLATION',
  /** Code contains unanalyzable constructs */
  UNANALYZABLE_CODE = 'UNANALYZABLE_CODE',
  /** Target does not support children (for Inside mode) */
  TARGET_NO_CHILDREN = 'TARGET_NO_CHILDREN',
  /** Invalid atomic unit move */
  INVALID_ATOMIC_UNIT = 'INVALID_ATOMIC_UNIT',
  /** Cannot move outside component boundary */
  COMPONENT_BOUNDARY_VIOLATION = 'COMPONENT_BOUNDARY_VIOLATION',
  /** Parse error in source or target file */
  PARSE_ERROR = 'PARSE_ERROR',
  /** Invalid selector format */
  INVALID_SELECTOR = 'INVALID_SELECTOR',
}

// ============================================================================
// Validation Rules
// ============================================================================

/**
 * Adapt validators to ValidationRule interface
 */
const selfMoveRule: ValidationRule = (source, target, _mode, _context) => {
  return validateSelfMove(source, target);
};

const targetNotDescendantRule: ValidationRule = (source, target, mode, _context) => {
  return validateTargetNotDescendant(source, target, mode);
};

const sourceNotDescendantRule: ValidationRule = (source, target, mode, _context) => {
  return validateSourceNotDescendant(source, target, mode);
};

const targetSupportsChildrenRule: ValidationRule = (_source, target, mode, _context) => {
  return validateTargetSupportsChildren(target, mode);
};

const hookRulesRule: ValidationRule = (source, target, _mode, _context) => {
  return validateHookRules(source, target);
};

const atomicUnitRule: ValidationRule = (source, _target, _mode, _context) => {
  return validateAtomicUnit(source);
};

const conditionalRule: ValidationRule = (source, target, _mode, _context) => {
  return validateConditional(source, target);
};

const boundaryRule: ValidationRule = (source, target, _mode, _context) => {
  return validateBoundary(source, target);
};

/**
 * All validation rules to apply
 */
const validationRules: ValidationRule[] = [
  selfMoveRule,
  targetNotDescendantRule,
  sourceNotDescendantRule,
  targetSupportsChildrenRule,
  hookRulesRule,
  atomicUnitRule,
  conditionalRule,
  boundaryRule,
];

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a proposed move operation
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns Validation result with detailed information
 */
export function validateMove(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): MoveValidationResult {
  const warnings: string[] = [];
  const parser = createParser();

  // Build file map
  const fileMap = new Map<string, string>();
  for (const file of files) {
    fileMap.set(file.path, file.content);
  }

  // Get source and target files
  const sourceFile = from.file;
  const targetFile = to.file;

  // Check source file exists
  const sourceContent = fileMap.get(sourceFile);
  if (sourceContent === undefined) {
    return {
      valid: false,
      reason: `Source file not found: ${sourceFile}`,
      errorCode: MoveValidationError.SOURCE_FILE_NOT_FOUND,
      warnings,
    };
  }

  // Check target file exists
  const targetContent = fileMap.get(targetFile);
  if (targetContent === undefined) {
    return {
      valid: false,
      reason: `Target file not found: ${targetFile}`,
      errorCode: MoveValidationError.TARGET_FILE_NOT_FOUND,
      warnings,
    };
  }

  // Parse source file
  const sourceParseResult = parser.parse(sourceContent, sourceFile);
  if (!sourceParseResult.ok) {
    return {
      valid: false,
      reason: `Failed to parse source file: ${sourceParseResult.error.message}`,
      errorCode: MoveValidationError.PARSE_ERROR,
      warnings,
    };
  }

  // Parse target file (may be same as source)
  let targetAST: t.File;
  if (targetFile !== sourceFile) {
    const targetParseResult = parser.parse(targetContent, targetFile);
    if (!targetParseResult.ok) {
      return {
        valid: false,
        reason: `Failed to parse target file: ${targetParseResult.error.message}`,
        errorCode: MoveValidationError.PARSE_ERROR,
        warnings,
      };
    }
    targetAST = targetParseResult.value;
  } else {
    targetAST = sourceParseResult.value;
  }

  const sourceAST = sourceParseResult.value;

  // Check analyzability
  const sourceAnalyzability = checkAnalyzability(sourceAST);
  if (!sourceAnalyzability.analyzable) {
    return {
      valid: false,
      reason: `Source file contains unanalyzable code: ${sourceAnalyzability.blockers?.[0]?.description}`,
      errorCode: MoveValidationError.UNANALYZABLE_CODE,
      warnings,
      analyzability: sourceAnalyzability,
    };
  }

  if (targetFile !== sourceFile) {
    const targetAnalyzability = checkAnalyzability(targetAST);
    if (!targetAnalyzability.analyzable) {
      return {
        valid: false,
        reason: `Target file contains unanalyzable code: ${targetAnalyzability.blockers?.[0]?.description}`,
        errorCode: MoveValidationError.UNANALYZABLE_CODE,
        warnings,
        analyzability: targetAnalyzability,
      };
    }
  }

  // Resolve source selector
  let source = resolveSelector(from, sourceAST, sourceFile);
  if (source.error !== undefined || !source.node) {
    return {
      valid: false,
      reason: source.error?.message ?? 'Source element not found',
      errorCode: MoveValidationError.SOURCE_NOT_FOUND,
      warnings,
      source,
    };
  }

  // Normalize to JSXElement for consistent validation
  source = normalizeToJSXElement(source);

  // Resolve target selector
  let target = resolveSelector(to, targetAST, targetFile);
  if (target.error !== undefined || !target.node) {
    return {
      valid: false,
      reason: target.error?.message ?? 'Target element not found',
      errorCode: MoveValidationError.TARGET_NOT_FOUND,
      warnings,
      source,
      target,
    };
  }

  // Normalize to JSXElement for consistent validation
  target = normalizeToJSXElement(target);

  // Build AST map
  const astMap = new Map<string, t.File>();
  astMap.set(sourceFile, sourceAST);
  if (targetFile !== sourceFile) {
    astMap.set(targetFile, targetAST);
  }

  // Build validation context
  const context: ValidationContext = {
    files: astMap,
    parser,
    sourceFile,
    targetFile,
  };

  // Run all validation rules
  for (const rule of validationRules) {
    const result = rule(source, target, mode, context);

    if (!result.valid) {
      return {
        valid: false,
        reason: result.reason,
        errorCode: result.errorCode,
        warnings,
        source,
        target,
        analyzability: sourceAnalyzability,
      };
    }

    if (result.warning !== undefined && result.warning !== '') {
      warnings.push(result.warning);
    }
  }

  return {
    valid: true,
    warnings,
    source,
    target,
    analyzability: sourceAnalyzability,
  };
}

/**
 * Check if an element can be moved (simplified boolean API)
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns true if the move is valid, false otherwise
 */
export function canMoveElement(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): boolean {
  const result = validateMove(files, from, to, mode);
  return result.valid;
}
