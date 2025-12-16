/**
 * Error Codes Reference
 *
 * Comprehensive error code definitions for Regrafter.
 * Error codes are organized by category (E0XX for Parse, E0XX for Selector, etc.)
 */

import type { SourceLocation } from '../types/internal.js';
import type { Selector, SuggestedFix, Dependency } from '../types/public.js';

import {
  ErrorCategory,
  ParseError,
  SelectorError,
  DependencyError,
  ValidationError,
  TransformError,
  CircularError,
  InternalError,
} from './ErrorCategory.js';

// ===============================================================================
// Error Code Definitions
// ===============================================================================

/**
 * Error code registry with metadata.
 */
export interface ErrorCodeDefinition {
  /** Error code (e.g., E001) */
  code: string;
  /** Error category */
  category: ErrorCategory;
  /** Message template with placeholders */
  template: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Documentation description */
  description: string;
}

/**
 * All error codes organized by category.
 */
export const ERROR_CODES: Record<string, ErrorCodeDefinition> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Parse Errors (E001 - E009)
  // ═══════════════════════════════════════════════════════════════════════════
  E001: {
    code: 'E001',
    category: ErrorCategory.Parse,
    template: 'Failed to parse {file}: {message}',
    recoverable: false,
    description: 'General parse error for files that cannot be parsed',
  },
  E002: {
    code: 'E002',
    category: ErrorCategory.Parse,
    template: 'Unexpected token at {file}:{line}:{column}',
    recoverable: false,
    description: 'Syntax error due to unexpected token in source',
  },
  E003: {
    code: 'E003',
    category: ErrorCategory.Parse,
    template: 'Unterminated string literal in {file} at line {line}',
    recoverable: false,
    description: 'String literal not properly closed',
  },
  E004: {
    code: 'E004',
    category: ErrorCategory.Parse,
    template: 'Invalid JSX syntax in {file}: {message}',
    recoverable: false,
    description: 'JSX-specific syntax error',
  },
  E005: {
    code: 'E005',
    category: ErrorCategory.Parse,
    template: 'TypeScript syntax error in {file}: {message}',
    recoverable: false,
    description: 'TypeScript-specific syntax error',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Selector Errors (E010 - E019)
  // ═══════════════════════════════════════════════════════════════════════════
  E010: {
    code: 'E010',
    category: ErrorCategory.Selector,
    template: 'No JSX element found at {file}:{line}:{column}',
    recoverable: false,
    description: 'Position selector did not resolve to a JSX element',
  },
  E011: {
    code: 'E011',
    category: ErrorCategory.Selector,
    template: 'Invalid AST path: {path}',
    recoverable: false,
    description: 'AST path selector is malformed or invalid',
  },
  E012: {
    code: 'E012',
    category: ErrorCategory.Selector,
    template: 'File not in input: {file}',
    recoverable: false,
    description: 'Selector references a file not provided in input',
  },
  E013: {
    code: 'E013',
    category: ErrorCategory.Selector,
    template: 'Element at position is not movable: {reason}',
    recoverable: false,
    description: 'Selected element cannot be moved due to constraints',
  },
  E014: {
    code: 'E014',
    category: ErrorCategory.Selector,
    template: 'Source and target selectors point to the same element',
    recoverable: false,
    description: 'Move operation would be a no-op',
  },
  E015: {
    code: 'E015',
    category: ErrorCategory.Selector,
    template: 'Cannot move element into itself or its descendants',
    recoverable: false,
    description: 'Attempted to move element into its own subtree',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Dependency Errors (E020 - E029)
  // ═══════════════════════════════════════════════════════════════════════════
  E020: {
    code: 'E020',
    category: ErrorCategory.Dependency,
    template: 'Cannot analyze: eval() detected at {file}:{line}:{column}',
    recoverable: false,
    description: 'Code contains eval() which prevents static analysis',
  },
  E021: {
    code: 'E021',
    category: ErrorCategory.Dependency,
    template: 'Cannot analyze: dynamic code execution at {file}:{line}:{column}',
    recoverable: false,
    description: 'Code contains dynamic code execution (new Function, etc.)',
  },
  E022: {
    code: 'E022',
    category: ErrorCategory.Dependency,
    template: 'Unresolvable external reference: {symbol} in {file}',
    recoverable: true,
    description: 'Reference to undefined or external symbol that cannot be resolved',
  },
  E023: {
    code: 'E023',
    category: ErrorCategory.Dependency,
    template: 'Dependency cycle detected in {symbol}: {cycle}',
    recoverable: true,
    description: 'Circular dependency chain within dependencies',
  },
  E024: {
    code: 'E024',
    category: ErrorCategory.Dependency,
    template: 'Cannot determine scope for {symbol}',
    recoverable: false,
    description: 'Unable to determine the scope of a dependency',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Validation Errors (E030 - E039)
  // ═══════════════════════════════════════════════════════════════════════════
  E030: {
    code: 'E030',
    category: ErrorCategory.Validation,
    template: 'Cannot hoist Hook "{hook}" to conditional scope',
    recoverable: true,
    description: 'Hook would be placed inside conditional, violating Rules of Hooks',
  },
  E031: {
    code: 'E031',
    category: ErrorCategory.Validation,
    template: 'Cannot hoist Hook "{hook}" to loop scope',
    recoverable: true,
    description: 'Hook would be placed inside loop, violating Rules of Hooks',
  },
  E032: {
    code: 'E032',
    category: ErrorCategory.Validation,
    template: 'Move would violate React Hook rules for "{hook}"',
    recoverable: true,
    description: 'The move operation would result in invalid Hook usage',
  },
  E033: {
    code: 'E033',
    category: ErrorCategory.Validation,
    template: 'Cannot move Hook call outside of React component or custom Hook',
    recoverable: false,
    description: 'Hook must remain within component or custom Hook scope',
  },
  E034: {
    code: 'E034',
    category: ErrorCategory.Validation,
    template: 'Invalid target scope for dependency "{symbol}"',
    recoverable: false,
    description: 'Target scope cannot accept the dependency',
  },
  E035: {
    code: 'E035',
    category: ErrorCategory.Validation,
    template: 'Props threading depth exceeds maximum ({depth} > {max})',
    recoverable: true,
    description: 'Too many intermediate components for prop threading',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Circular Dependency Errors (E040 - E049)
  // ═══════════════════════════════════════════════════════════════════════════
  E040: {
    code: 'E040',
    category: ErrorCategory.Circular,
    template: 'Circular dependency detected: {cycle}',
    recoverable: true,
    description: 'Move would create circular dependency between symbols',
  },
  E041: {
    code: 'E041',
    category: ErrorCategory.Circular,
    template: 'Cross-file circular import would be created: {cycle}',
    recoverable: true,
    description: 'Move would create circular import between files',
  },
  E042: {
    code: 'E042',
    category: ErrorCategory.Circular,
    template: 'Cannot break circular dependency: {reason}',
    recoverable: false,
    description: 'Automatic circular dependency resolution failed',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Transform Errors (E050 - E059)
  // ═══════════════════════════════════════════════════════════════════════════
  E050: {
    code: 'E050',
    category: ErrorCategory.Transform,
    template: 'Failed to insert at target: {reason}',
    recoverable: false,
    description: 'AST insertion operation failed',
  },
  E051: {
    code: 'E051',
    category: ErrorCategory.Transform,
    template: 'Failed to update references: {reason}',
    recoverable: false,
    description: 'Reference update after move failed',
  },
  E052: {
    code: 'E052',
    category: ErrorCategory.Transform,
    template: 'Failed to remove source element: {reason}',
    recoverable: false,
    description: 'Could not remove element from original location',
  },
  E053: {
    code: 'E053',
    category: ErrorCategory.Transform,
    template: 'Hoisting operation failed for {symbol}: {reason}',
    recoverable: false,
    description: 'Dependency hoisting operation failed',
  },
  E054: {
    code: 'E054',
    category: ErrorCategory.Transform,
    template: 'Import update failed in {file}: {reason}',
    recoverable: false,
    description: 'Could not update import statements',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Internal Errors (E090 - E099)
  // ═══════════════════════════════════════════════════════════════════════════
  E090: {
    code: 'E090',
    category: ErrorCategory.Internal,
    template: 'Assertion failed: {condition}',
    recoverable: false,
    description: 'Internal assertion failure indicating a bug',
  },
  E091: {
    code: 'E091',
    category: ErrorCategory.Internal,
    template: 'Unexpected AST node type: expected {expected}, got {actual}',
    recoverable: false,
    description: 'AST structure does not match expected shape',
  },
  E099: {
    code: 'E099',
    category: ErrorCategory.Internal,
    template: 'Internal error: {message}',
    recoverable: false,
    description: 'Catch-all for unexpected internal errors',
  },
};

// ===============================================================================
// Error Factory Functions
// ===============================================================================

/**
 * Formats an error message template with provided values.
 */
function formatMessage(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined) return `{${key}}`;
    return String(value);
  });
}

/**
 * Creates a ParseError with the appropriate error code.
 */
export function createParseErrorWithCode(
  code: 'E001' | 'E002' | 'E003' | 'E004' | 'E005',
  params: {
    file: string;
    message?: string;
    line?: number;
    column?: number;
    location?: SourceLocation;
    syntaxError?: string;
    suggestions?: SuggestedFix[];
    cause?: Error;
  }
): ParseError {
  const def = ERROR_CODES[code];
  if (!def) throw new Error(`Unknown error code: ${code}`);

  const message = formatMessage(def.template, {
    file: params.file,
    message: params.message ?? params.syntaxError ?? 'unknown error',
    line: params.line ?? params.location?.start.line,
    column: params.column ?? params.location?.start.column,
  });

  return new ParseError({
    code,
    message,
    syntaxError: params.syntaxError ?? params.message ?? '',
    file: params.file,
    location: params.location,
    suggestions: params.suggestions,
    cause: params.cause,
  });
}

/**
 * Creates a SelectorError with the appropriate error code.
 */
export function createSelectorErrorWithCode(
  code: 'E010' | 'E011' | 'E012' | 'E013' | 'E014' | 'E015',
  params: {
    selector: Selector;
    file: string;
    path?: string;
    line?: number;
    column?: number;
    reason?: string;
    location?: SourceLocation;
    nearestMatch?: string;
    suggestions?: SuggestedFix[];
  }
): SelectorError {
  const def = ERROR_CODES[code];
  if (!def) throw new Error(`Unknown error code: ${code}`);

  const message = formatMessage(def.template, {
    file: params.file,
    path: params.path,
    line: params.line ?? params.location?.start.line,
    column: params.column ?? params.location?.start.column,
    reason: params.reason,
  });

  return new SelectorError({
    code,
    message,
    selector: params.selector,
    file: params.file,
    location: params.location,
    nearestMatch: params.nearestMatch,
    suggestions: params.suggestions,
  });
}

/**
 * Creates a DependencyError with the appropriate error code.
 */
export function createDependencyErrorWithCode(
  code: 'E020' | 'E021' | 'E022' | 'E023' | 'E024',
  params: {
    file?: string;
    symbol?: string;
    line?: number;
    column?: number;
    cycle?: string;
    location?: SourceLocation;
    dependency?: Dependency;
    suggestions?: SuggestedFix[];
  }
): DependencyError {
  const def = ERROR_CODES[code];
  if (!def) throw new Error(`Unknown error code: ${code}`);

  const message = formatMessage(def.template, {
    file: params.file,
    symbol: params.symbol,
    line: params.line ?? params.location?.start.line,
    column: params.column ?? params.location?.start.column,
    cycle: params.cycle,
  });

  return new DependencyError({
    code,
    message,
    unresolvableReason: def.description,
    file: params.file,
    location: params.location,
    dependency: params.dependency,
    suggestions: params.suggestions,
    recoverable: def.recoverable,
  });
}

/**
 * Creates a ValidationError with the appropriate error code.
 */
export function createValidationErrorWithCode(
  code: 'E030' | 'E031' | 'E032' | 'E033' | 'E034' | 'E035',
  params: {
    hook?: string;
    symbol?: string;
    depth?: number;
    max?: number;
    file?: string;
    location?: SourceLocation;
    suggestions?: SuggestedFix[];
  }
): ValidationError {
  const def = ERROR_CODES[code];
  if (!def) throw new Error(`Unknown error code: ${code}`);

  const message = formatMessage(def.template, {
    hook: params.hook,
    symbol: params.symbol,
    depth: params.depth,
    max: params.max,
  });

  return new ValidationError({
    code,
    message,
    constraint: code,
    details: def.description,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions,
    recoverable: def.recoverable,
  });
}

/**
 * Creates a CircularError with the appropriate error code.
 */
export function createCircularErrorWithCode(
  code: 'E040' | 'E041' | 'E042',
  params: {
    cycle: string[];
    reason?: string;
    file?: string;
    suggestions?: SuggestedFix[];
  }
): CircularError {
  const def = ERROR_CODES[code];
  if (!def) throw new Error(`Unknown error code: ${code}`);

  const cycleStr = params.cycle.join(' -> ');
  const message = formatMessage(def.template, {
    cycle: cycleStr,
    reason: params.reason,
  });

  return new CircularError({
    code,
    message,
    cycle: params.cycle,
    file: params.file,
    suggestions: params.suggestions,
  });
}

/**
 * Creates a TransformError with the appropriate error code.
 */
export function createTransformErrorWithCode(
  code: 'E050' | 'E051' | 'E052' | 'E053' | 'E054',
  params: {
    reason: string;
    symbol?: string;
    file?: string;
    location?: SourceLocation;
    suggestions?: SuggestedFix[];
    cause?: Error;
  }
): TransformError {
  const def = ERROR_CODES[code];
  if (!def) throw new Error(`Unknown error code: ${code}`);

  const message = formatMessage(def.template, {
    reason: params.reason,
    symbol: params.symbol,
    file: params.file,
  });

  return new TransformError({
    code,
    message,
    operation: code,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions,
    cause: params.cause,
  });
}

/**
 * Creates an InternalError with the appropriate error code.
 */
export function createInternalErrorWithCode(
  code: 'E090' | 'E091' | 'E099',
  params: {
    message?: string;
    condition?: string;
    expected?: string;
    actual?: string;
    file?: string;
    location?: SourceLocation;
    cause?: Error;
  }
): InternalError {
  const def = ERROR_CODES[code];
  if (!def) throw new Error(`Unknown error code: ${code}`);

  const message = formatMessage(def.template, {
    message: params.message,
    condition: params.condition,
    expected: params.expected,
    actual: params.actual,
  });

  return new InternalError({
    code,
    message,
    file: params.file,
    location: params.location,
    cause: params.cause,
  });
}

// ===============================================================================
// Error Code Lookup
// ===============================================================================

/**
 * Gets the error code definition for a given code.
 */
export function getErrorCodeDefinition(code: string): ErrorCodeDefinition | undefined {
  return ERROR_CODES[code];
}

/**
 * Gets all error codes for a given category.
 */
export function getErrorCodesByCategory(category: ErrorCategory): ErrorCodeDefinition[] {
  return Object.values(ERROR_CODES).filter(def => def.category === category);
}

/**
 * Checks if an error code is recoverable.
 */
export function isRecoverableErrorCode(code: string): boolean {
  return ERROR_CODES[code]?.recoverable ?? false;
}
