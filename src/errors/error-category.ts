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
// Base Error Class (Legacy - for backward compatibility)
// ===============================================================================

/**
 * Base error class for all Regrafter errors (legacy).
 * Provides consistent error structure with category, code, and metadata.
 *
 * Note: This class is kept for backward compatibility with existing error classes.
 * For new code, prefer using the RegraffError union type with factory functions.
 */
export class RegraffErrorClass extends Error {
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
      Error.captureStackTrace(this, RegraffErrorClass);
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
export class ParseError extends RegraffErrorClass {
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
 * ParseError interface with _tag discriminant (Task 8.2)
 */
export interface ParseErrorType {
  readonly _tag: 'ParseError';
  readonly code: string;
  readonly message: string;
  readonly syntaxError: string;
  readonly file: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
  readonly recoverable: false;
}

/**
 * Factory function to create ParseError (Task 8.2)
 */
export function createParseError(params: {
  code: string;
  message: string;
  syntaxError: string;
  file: string;
  location?: SourceLocation;
  suggestions?: SuggestedFix[];
}): ParseErrorType {
  return {
    _tag: 'ParseError',
    code: params.code,
    message: params.message,
    syntaxError: params.syntaxError,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions ?? [],
    recoverable: false,
  };
}

/**
 * Error thrown when selector resolution fails.
 */
export class SelectorError extends RegraffErrorClass {
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
 * SelectorError interface with _tag discriminant (Task 8.4)
 */
export interface SelectorErrorType {
  readonly _tag: 'SelectorError';
  readonly code: string;
  readonly message: string;
  readonly selector: Selector;
  readonly file: string;
  readonly location?: SourceLocation;
  readonly nearestMatch?: string;
  readonly suggestions: SuggestedFix[];
  readonly recoverable: false;
}

/**
 * Factory function to create SelectorError (Task 8.4)
 */
export function createSelectorError(params: {
  code: string;
  message: string;
  selector: Selector;
  file: string;
  location?: SourceLocation;
  nearestMatch?: string;
  suggestions?: SuggestedFix[];
}): SelectorErrorType {
  return {
    _tag: 'SelectorError',
    code: params.code,
    message: params.message,
    selector: params.selector,
    file: params.file,
    location: params.location,
    nearestMatch: params.nearestMatch,
    suggestions: params.suggestions ?? [],
    recoverable: false,
  };
}

/**
 * Error thrown when dependency analysis fails.
 */
export class DependencyError extends RegraffErrorClass {
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
 * DependencyError interface with _tag discriminant (Task 8.6)
 */
export interface DependencyErrorType {
  readonly _tag: 'DependencyError';
  readonly code: string;
  readonly message: string;
  readonly unresolvableReason: string;
  readonly dependency?: Dependency;
  readonly file?: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
  readonly recoverable: boolean;
}

/**
 * Factory function to create DependencyError (Task 8.6)
 */
export function createDependencyError(params: {
  code: string;
  message: string;
  unresolvableReason: string;
  dependency?: Dependency;
  file?: string;
  location?: SourceLocation;
  suggestions?: SuggestedFix[];
  recoverable?: boolean;
}): DependencyErrorType {
  return {
    _tag: 'DependencyError',
    code: params.code,
    message: params.message,
    unresolvableReason: params.unresolvableReason,
    dependency: params.dependency,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions ?? [],
    recoverable: params.recoverable ?? false,
  };
}

/**
 * Error thrown when validation constraints are violated.
 */
export class ValidationError extends RegraffErrorClass {
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
 * ValidationError interface with _tag discriminant (Task 8.8)
 */
export interface ValidationErrorType {
  readonly _tag: 'ValidationError';
  readonly code: string;
  readonly message: string;
  readonly constraint: string;
  readonly details: string;
  readonly file?: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
  readonly recoverable: boolean;
}

/**
 * Factory function to create ValidationError (Task 8.8)
 */
export function createValidationError(params: {
  code: string;
  message: string;
  constraint: string;
  details: string;
  file?: string;
  location?: SourceLocation;
  suggestions?: SuggestedFix[];
  recoverable?: boolean;
}): ValidationErrorType {
  return {
    _tag: 'ValidationError',
    code: params.code,
    message: params.message,
    constraint: params.constraint,
    details: params.details,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions ?? [],
    recoverable: params.recoverable ?? false,
  };
}

/**
 * Error thrown when AST transformation fails.
 */
export class TransformError extends RegraffErrorClass {
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
 * TransformError interface with _tag discriminant (Task 8.10)
 */
export interface TransformErrorType {
  readonly _tag: 'TransformError';
  readonly code: string;
  readonly message: string;
  readonly operation: string;
  readonly file?: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
  readonly recoverable: false;
}

/**
 * Factory function to create TransformError (Task 8.10)
 */
export function createTransformError(params: {
  code: string;
  message: string;
  operation: string;
  file?: string;
  location?: SourceLocation;
  suggestions?: SuggestedFix[];
}): TransformErrorType {
  return {
    _tag: 'TransformError',
    code: params.code,
    message: params.message,
    operation: params.operation,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions ?? [],
    recoverable: false,
  };
}

/**
 * Error thrown when circular dependencies are detected.
 */
export class CircularError extends RegraffErrorClass {
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
 * CircularError interface with _tag discriminant (Task 8.12)
 */
export interface CircularErrorType {
  readonly _tag: 'CircularError';
  readonly code: string;
  readonly message: string;
  readonly cycle: string[];
  readonly file?: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
  readonly recoverable: true;
}

/**
 * Factory function to create CircularError (Task 8.12)
 */
export function createCircularError(params: {
  code: string;
  message: string;
  cycle: string[];
  file?: string;
  location?: SourceLocation;
  suggestions?: SuggestedFix[];
}): CircularErrorType {
  return {
    _tag: 'CircularError',
    code: params.code,
    message: params.message,
    cycle: params.cycle,
    file: params.file,
    location: params.location,
    suggestions: params.suggestions ?? [],
    recoverable: true,
  };
}

/**
 * Error thrown for internal/unexpected errors.
 */
export class InternalError extends RegraffErrorClass {
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

/**
 * InternalError interface with _tag discriminant (Task 8.14)
 */
export interface InternalErrorType {
  readonly _tag: 'InternalError';
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
  readonly recoverable: false;
  readonly cause?: Error;
}

/**
 * Factory function to create InternalError (Task 8.14)
 */
export function createInternalError(params: {
  code?: string;
  message: string;
  file?: string;
  location?: SourceLocation;
  cause?: Error;
}): InternalErrorType {
  return {
    _tag: 'InternalError',
    code: params.code ?? 'E099',
    message: params.message,
    file: params.file,
    location: params.location,
    suggestions: [],
    recoverable: false,
    cause: params.cause,
  };
}

// ===============================================================================
// Type Guards
// ===============================================================================

/**
 * Type guard to check if an error is a RegraffErrorClass (legacy class-based error).
 */
export function isRegraffError(error: unknown): error is RegraffErrorClass {
  return error instanceof RegraffErrorClass;
}

/**
 * Type guard to check if an error is a ParseError.
 * Supports both class-based and interface-based ParseError (Task 8.2).
 */
export function isParseError(error: unknown): error is ParseError | ParseErrorType {
  if (error === null || error === undefined) {
    return false;
  }
  // Check for new interface-based ParseError with _tag discriminant
  if (typeof error === 'object' && '_tag' in error && typeof error._tag === 'string') {
    return error._tag === 'ParseError';
  }
  // Fallback to class-based instanceof check for backward compatibility
  return error instanceof ParseError;
}

/**
 * Type guard to check if an error is a SelectorError.
 * Supports both class-based and interface-based SelectorError (Task 8.4).
 */
export function isSelectorError(error: unknown): error is SelectorError | SelectorErrorType {
  if (error === null || error === undefined) {
    return false;
  }
  // Check for new interface-based SelectorError with _tag discriminant
  if (typeof error === 'object' && '_tag' in error && typeof error._tag === 'string') {
    return error._tag === 'SelectorError';
  }
  // Fallback to class-based instanceof check for backward compatibility
  return error instanceof SelectorError;
}

/**
 * Type guard to check if an error is a DependencyError.
 * Updated to check for _tag discriminant (Task 8.6)
 */
export function isDependencyError(error: unknown): error is DependencyError | DependencyErrorType {
  if (error instanceof DependencyError) {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    error._tag === 'DependencyError'
  );
}

/**
 * Type guard to check if an error is a ValidationError.
 * Updated to check for _tag discriminant (Task 8.8)
 */
export function isValidationError(error: unknown): error is ValidationError | ValidationErrorType {
  if (error instanceof ValidationError) {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    error._tag === 'ValidationError'
  );
}

/**
 * Type guard to check if an error is a TransformError.
 * Updated to check for _tag discriminant (Task 8.10)
 */
export function isTransformError(error: unknown): error is TransformError | TransformErrorType {
  if (error instanceof TransformError) {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    error._tag === 'TransformError'
  );
}

/**
 * Type guard to check if an error is a CircularError.
 * Updated to check for _tag discriminant (Task 8.12)
 */
export function isCircularError(error: unknown): error is CircularError | CircularErrorType {
  if (error instanceof CircularError) {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    error._tag === 'CircularError'
  );
}

/**
 * Type guard to check if an error is an InternalError.
 * Updated to check for _tag discriminant (Task 8.14)
 */
export function isInternalError(error: unknown): error is InternalError | InternalErrorType {
  if (error instanceof InternalError) {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    error._tag === 'InternalError'
  );
}

// ===============================================================================
// RegraffError Union Type (Task 9)
// ===============================================================================

/**
 * Union type of all error interface types.
 * This is a discriminated union using the _tag field for type narrowing.
 *
 * This union type represents all possible error types in the new error handling system.
 * Use this type when working with Result<T, RegraffError> patterns.
 *
 * @example
 * ```typescript
 * function handleError(error: RegraffError) {
 *   switch (error._tag) {
 *     case 'ParseError':
 *       console.log('Parse error:', error.syntaxError);
 *       break;
 *     case 'SelectorError':
 *       console.log('Selector error:', error.selector);
 *       break;
 *     // ... handle other error types
 *   }
 * }
 * ```
 */
export type RegraffError =
  | ParseErrorType
  | SelectorErrorType
  | DependencyErrorType
  | ValidationErrorType
  | TransformErrorType
  | CircularErrorType
  | InternalErrorType;
