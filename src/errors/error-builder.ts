/**
 * ErrorBuilder - Fluent API for Building ValidationError Objects
 *
 * This module provides an ergonomic fluent API for creating ValidationError instances.
 * Instead of passing a large object with many properties to createValidationError(),
 * the ErrorBuilder allows for readable, chainable method calls.
 *
 * @module error-builder
 */

import type { SourceLocation } from '@babel/types';

import type { SuggestedFix } from '../types/public.js';

import { createValidationError, type ValidationErrorType } from './error-category.js';
import { createSuggestedFix } from './suggested-fixes.js';

/**
 * Parameters for building a ValidationError.
 *
 * All fields are optional during building and are validated when build() is called.
 */
interface ValidationErrorParams {
  code?: string;
  message?: string;
  constraint?: string;
  details?: string;
  file?: string;
  location?: SourceLocation;
  suggestions?: string[];
  recoverable?: boolean;
}

/**
 * Fluent API for building ValidationError objects.
 *
 * Reduces verbosity of error creation while maintaining type safety.
 * All methods return `this` for chaining. Call `build()` to create the final error.
 *
 * @example
 * ```typescript
 * const err = new ErrorBuilder()
 *   .code('INVALID_SELECTOR')
 *   .message('Could not resolve selector')
 *   .constraint('selector_valid')
 *   .details('Selector path does not match any JSX element')
 *   .inFile('src/Component.tsx')
 *   .at(node.loc)
 *   .suggest('Check selector syntax')
 *   .suggest('Verify element exists at specified path')
 *   .build();
 * ```
 */
export class ErrorBuilder {
  private readonly params: ValidationErrorParams = {
    suggestions: [],
  };

  /**
   * Set the error code.
   *
   * @param code - The error code (e.g., 'INVALID_SELECTOR')
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.code('HOOK_LOCATION_INVALID')
   * ```
   */
  code(code: string): this {
    this.params.code = code;
    return this;
  }

  /**
   * Set the error message.
   *
   * @param message - Human-readable error message
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.message('Hook cannot be placed in conditional scope')
   * ```
   */
  message(message: string): this {
    this.params.message = message;
    return this;
  }

  /**
   * Set the constraint that was violated.
   *
   * @param constraint - Constraint identifier (e.g., 'hooks_top_level', 'selector_valid')
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.constraint('hooks_top_level')
   * ```
   */
  constraint(constraint: string): this {
    this.params.constraint = constraint;
    return this;
  }

  /**
   * Set detailed explanation of the error.
   *
   * @param details - Detailed description of what went wrong
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.details('Hook useState is inside a conditional block which violates Rules of Hooks')
   * ```
   */
  details(details: string): this {
    this.params.details = details;
    return this;
  }

  /**
   * Set the source location where the error occurred.
   *
   * @param location - Babel SourceLocation or null/undefined
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.at(node.loc)
   * builder.at(path.node.loc ?? undefined)
   * ```
   */
  at(location: SourceLocation | null | undefined): this {
    this.params.location = location ?? undefined;
    return this;
  }

  /**
   * Set the file path where the error occurred.
   *
   * @param file - File path (absolute or relative)
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.inFile('src/Component.tsx')
   * builder.inFile(this.currentFile)
   * ```
   */
  inFile(file: string): this {
    this.params.file = file;
    return this;
  }

  /**
   * Add a single suggestion for how to fix the error.
   *
   * Can be called multiple times to add multiple suggestions.
   *
   * @param suggestion - Suggested fix
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .suggest('Move hook to component top level')
   *   .suggest('Use prop threading to pass hook result down')
   * ```
   */
  suggest(suggestion: string): this {
    this.params.suggestions ??= [];
    this.params.suggestions.push(suggestion);
    return this;
  }

  /**
   * Set multiple suggestions at once.
   *
   * Replaces any existing suggestions set via suggest().
   *
   * @param suggestions - Array of suggested fixes
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.suggestions([
   *   'Move hook to component top level',
   *   'Use prop threading to pass hook result down'
   * ])
   * ```
   */
  suggestions(suggestions: string[]): this {
    this.params.suggestions = suggestions;
    return this;
  }

  /**
   * Set whether the error is recoverable.
   *
   * @param recoverable - True if error can be recovered from
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.recoverable(true)
   * ```
   */
  recoverable(recoverable: boolean): this {
    this.params.recoverable = recoverable;
    return this;
  }

  /**
   * Build the ValidationError.
   *
   * Validates that required fields (code and message) are set.
   * Converts string suggestions to SuggestedFix objects.
   *
   * @returns The constructed ValidationError
   * @throws Error if code or message are missing
   *
   * @example
   * ```typescript
   * const error = builder
   *   .code('ERROR_CODE')
   *   .message('Error message')
   *   .constraint('constraint')
   *   .details('details')
   *   .build();
   * ```
   */
  build(): ValidationErrorType {
    // Validate required fields - destructure to enable type narrowing
    const { code, message } = this.params;

    if (code === undefined || code === '') {
      throw new Error('ErrorBuilder: code is required');
    }
    if (message === undefined || message === '') {
      throw new Error('ErrorBuilder: message is required');
    }

    // At this point, TypeScript knows code and message are non-empty strings
    // Ensure constraint and details have defaults for ValidationError
    const constraint = this.params.constraint ?? '';
    const details = this.params.details ?? '';

    // Convert string suggestions to SuggestedFix objects
    const suggestedFixes: SuggestedFix[] | undefined = this.params.suggestions?.map(
      (suggestion) => createSuggestedFix(suggestion, 'fix_syntax', false)
    );

    // Create the ValidationError
    return createValidationError({
      code,
      message,
      constraint,
      details,
      file: this.params.file,
      location: this.params.location,
      suggestions: suggestedFixes,
      recoverable: this.params.recoverable,
    });
  }
}

/**
 * Create an ErrorBuilder instance.
 *
 * Factory function for creating ErrorBuilder with fluent API.
 * This is a convenience function that's shorter to type than `new ErrorBuilder()`.
 *
 * @returns A new ErrorBuilder instance
 *
 * @example
 * ```typescript
 * const err = error()
 *   .code('INVALID_HOOK')
 *   .message('Hook cannot be hoisted')
 *   .constraint('hooks_top_level')
 *   .details('Hook is in conditional scope')
 *   .build();
 * ```
 */
export function error(): ErrorBuilder {
  return new ErrorBuilder();
}
