/**
 * Error Category Taxonomy
 *
 * Defines error categories and the base error class for Regrafter.
 * All errors follow a consistent structure with category, code, and location.
 */

import type { SourceLocation } from '../types/internal.js';
import type { SuggestedFix, Selector, Dependency } from '../types/public.js';

// ===============================================================================
// Error Category Enum
// ===============================================================================

/**
 * Classification of error types for structured error handling.
 */
export enum ErrorCategory {
  /** File parsing errors (syntax errors, invalid tokens) */
  Parse = 'PARSE',
  /** Selector resolution errors (element not found, invalid path) */
  Selector = 'SELECTOR',
  /** Dependency analysis errors (unanalyzable code, unresolved refs) */
  Dependency = 'DEPENDENCY',
  /** Validation errors (Hook rules, scope constraints) */
  Validation = 'VALIDATION',
  /** Transformation errors (insertion failures, AST corruption) */
  Transform = 'TRANSFORM',
  /** Circular dependency errors (import cycles) */
  Circular = 'CIRCULAR',
  /** Internal errors (unexpected states, assertion failures) */
  Internal = 'INTERNAL',
}

// ===============================================================================
// Base Error Class
// ===============================================================================

/**
 * Base error class for all Regrafter errors.
 * Provides consistent error structure with category, code, and metadata.
 */
export class RegraffError extends Error {
  /** Error category for classification */
  readonly category: ErrorCategory;
  /** Unique error code (e.g., E001, E010) */
  readonly code: string;
  /** File path where error occurred */
  readonly file?: string;
  /** Source location within the file */
  readonly location?: SourceLocation;
  /** Suggested fixes for recovery */
  readonly suggestions: SuggestedFix[];
  /** Whether the error is recoverable */
  readonly recoverable: boolean;

  constructor(params: {
    category: ErrorCategory;
    code: string;
    message: string;
    file?: string;
    location?: SourceLocation;
    suggestions?: SuggestedFix[];
    recoverable?: boolean;
    cause?: Error;
  }) {
    super(params.message);
    this.name = 'RegraffError';
    this.category = params.category;
    this.code = params.code;
    this.file = params.file;
    this.location = params.location;
    this.suggestions = params.suggestions ?? [];
    this.recoverable = params.recoverable ?? false;
    if (params.cause) {
      this.cause = params.cause;
    }

    // Maintains proper stack trace for where our error was thrown (only in V8)
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, RegraffError);
    }
  }

  /**
   * Creates a formatted error string with location information.
   */
  toFormattedString(): string {
    let result = `[${this.code}] ${this.message}`;

    if (this.file !== undefined && this.file !== '') {
      result += `\n  at ${this.file}`;
      if (this.location) {
        result += `:${this.location.start.line}:${this.location.start.column}`;
      }
    }

    if (this.suggestions.length > 0) {
      result += '\n\nSuggested fixes:';
      for (const fix of this.suggestions) {
        const autoLabel = fix.automatic ? ' [auto]' : '';
        result += `\n  - ${fix.description}${autoLabel}`;
      }
    }

    return result;
  }

  /**
   * Converts to a plain object for serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      category: this.category,
      code: this.code,
      message: this.message,
      file: this.file,
      location: this.location,
      suggestions: this.suggestions,
      recoverable: this.recoverable,
    };
  }
}

// ===============================================================================
// Specialized Error Classes
// ===============================================================================

/**
 * Error thrown when file parsing fails.
 */
export class ParseError extends RegraffError {
  /** The syntax error message from the parser */
  readonly syntaxError: string;
  /** Hint for recovery, if available */
  readonly recoveryHint?: string;

  constructor(params: {
    code: string;
    message: string;
    syntaxError: string;
    file: string;
    location?: SourceLocation;
    recoveryHint?: string;
    suggestions?: SuggestedFix[];
    cause?: Error;
  }) {
    super({
      category: ErrorCategory.Parse,
      ...params,
      recoverable: false,
    });
    this.name = 'ParseError';
    this.syntaxError = params.syntaxError;
    this.recoveryHint = params.recoveryHint;
  }
}

/**
 * Error thrown when selector resolution fails.
 */
export class SelectorError extends RegraffError {
  /** The selector that failed to resolve */
  readonly selector: Selector;
  /** Nearest matching element, if found */
  readonly nearestMatch?: string;

  constructor(params: {
    code: string;
    message: string;
    selector: Selector;
    file: string;
    location?: SourceLocation;
    nearestMatch?: string;
    suggestions?: SuggestedFix[];
  }) {
    super({
      category: ErrorCategory.Selector,
      ...params,
      recoverable: false,
    });
    this.name = 'SelectorError';
    this.selector = params.selector;
    this.nearestMatch = params.nearestMatch;
  }
}

/**
 * Error thrown when dependency analysis fails.
 */
export class DependencyError extends RegraffError {
  /** The problematic dependency */
  readonly dependency?: Dependency;
  /** Why the dependency cannot be resolved */
  readonly unresolvableReason: string;

  constructor(params: {
    code: string;
    message: string;
    unresolvableReason: string;
    dependency?: Dependency;
    file?: string;
    location?: SourceLocation;
    suggestions?: SuggestedFix[];
    recoverable?: boolean;
  }) {
    super({
      category: ErrorCategory.Dependency,
      ...params,
    });
    this.name = 'DependencyError';
    this.dependency = params.dependency;
    this.unresolvableReason = params.unresolvableReason;
  }
}

/**
 * Error thrown when validation constraints are violated.
 */
export class ValidationError extends RegraffError {
  /** The constraint that was violated */
  readonly constraint: string;
  /** Additional details about the violation */
  readonly details: string;

  constructor(params: {
    code: string;
    message: string;
    constraint: string;
    details: string;
    file?: string;
    location?: SourceLocation;
    suggestions?: SuggestedFix[];
    recoverable?: boolean;
  }) {
    super({
      category: ErrorCategory.Validation,
      ...params,
    });
    this.name = 'ValidationError';
    this.constraint = params.constraint;
    this.details = params.details;
  }
}

/**
 * Error thrown when AST transformation fails.
 */
export class TransformError extends RegraffError {
  /** The operation that failed */
  readonly operation: string;

  constructor(params: {
    code: string;
    message: string;
    operation: string;
    file?: string;
    location?: SourceLocation;
    suggestions?: SuggestedFix[];
    cause?: Error;
  }) {
    super({
      category: ErrorCategory.Transform,
      ...params,
      recoverable: false,
    });
    this.name = 'TransformError';
    this.operation = params.operation;
  }
}

/**
 * Error thrown when circular dependencies are detected.
 */
export class CircularError extends RegraffError {
  /** The dependency cycle path */
  readonly cycle: string[];

  constructor(params: {
    code: string;
    message: string;
    cycle: string[];
    file?: string;
    suggestions?: SuggestedFix[];
  }) {
    super({
      category: ErrorCategory.Circular,
      ...params,
      recoverable: true,
    });
    this.name = 'CircularError';
    this.cycle = params.cycle;
  }
}

/**
 * Error thrown for internal/unexpected errors.
 */
export class InternalError extends RegraffError {
  constructor(params: {
    code?: string;
    message: string;
    file?: string;
    location?: SourceLocation;
    cause?: Error;
  }) {
    super({
      category: ErrorCategory.Internal,
      code: params.code ?? 'E099',
      message: params.message,
      file: params.file,
      location: params.location,
      recoverable: false,
      cause: params.cause,
    });
    this.name = 'InternalError';
  }
}

// ===============================================================================
// Type Guards
// ===============================================================================

/**
 * Type guard to check if an error is a RegraffError.
 */
export function isRegraffError(error: unknown): error is RegraffError {
  return error instanceof RegraffError;
}

/**
 * Type guard to check if an error is a ParseError.
 */
export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError;
}

/**
 * Type guard to check if an error is a SelectorError.
 */
export function isSelectorError(error: unknown): error is SelectorError {
  return error instanceof SelectorError;
}

/**
 * Type guard to check if an error is a DependencyError.
 */
export function isDependencyError(error: unknown): error is DependencyError {
  return error instanceof DependencyError;
}

/**
 * Type guard to check if an error is a ValidationError.
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is a TransformError.
 */
export function isTransformError(error: unknown): error is TransformError {
  return error instanceof TransformError;
}

/**
 * Type guard to check if an error is a CircularError.
 */
export function isCircularError(error: unknown): error is CircularError {
  return error instanceof CircularError;
}

/**
 * Type guard to check if an error is an InternalError.
 */
export function isInternalError(error: unknown): error is InternalError {
  return error instanceof InternalError;
}
