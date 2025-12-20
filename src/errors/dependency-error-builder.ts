/**
 * DependencyErrorBuilder - Fluent API for Building DependencyError Objects
 *
 * This module provides an ergonomic fluent API for creating DependencyError instances.
 * Instead of passing a large object with many properties to createDependencyError(),
 * the DependencyErrorBuilder allows for readable, chainable method calls.
 *
 * @module dependency-error-builder
 */

import type { SourceLocation } from '../types/internal.js';
import type { Dependency } from '../types/public.js';

import { createDependencyError, type DependencyErrorType } from './error-category.js';

/**
 * Parameters for building a DependencyError.
 *
 * All fields are optional during building and are validated when build() is called.
 */
interface DependencyErrorParams {
  code?: string;
  message?: string;
  unresolvableReason?: string;
  dependency?: Dependency;
  file?: string;
  location?: SourceLocation;
  suggestions?: string[];
  recoverable?: boolean;
}

/**
 * Fluent API for building DependencyError objects.
 *
 * Reduces verbosity of error creation while maintaining type safety.
 * All methods return `this` for chaining. Call `build()` to create the final error.
 *
 * @example
 * ```typescript
 * const err = new DependencyErrorBuilder()
 *   .code('E031')
 *   .message('Cannot resolve all dependencies')
 *   .reason('Hook cannot be hoisted to target scope')
 *   .inFile('src/Component.tsx')
 *   .at(node.loc)
 *   .suggest('Move element to same scope as hook')
 *   .build();
 * ```
 */
export class DependencyErrorBuilder {
  private readonly params: DependencyErrorParams = {
    suggestions: [],
  };

  /**
   * Set the error code.
   *
   * @param code - The error code (e.g., 'E030', 'E031', 'E032')
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.code('E031')
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
   * builder.message('Cannot resolve all dependencies')
   * ```
   */
  message(message: string): this {
    this.params.message = message;
    return this;
  }

  /**
   * Set the reason why the dependency cannot be resolved.
   *
   * @param reason - Explanation of why dependency cannot be resolved
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.reason('Hook cannot be hoisted to target scope')
   * ```
   */
  reason(reason: string): this {
    this.params.unresolvableReason = reason;
    return this;
  }

  /**
   * Set the problematic dependency.
   *
   * @param dependency - The dependency that caused the error
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.dependency(hookDependency)
   * ```
   */
  dependency(dependency: Dependency): this {
    this.params.dependency = dependency;
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
   *   .suggest('Move element to same scope as hook')
   *   .suggest('Use prop threading to pass dependency down')
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
   *   'Move element to same scope as hook',
   *   'Use prop threading to pass dependency down'
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
   * builder.recoverable(false)
   * ```
   */
  recoverable(recoverable: boolean): this {
    this.params.recoverable = recoverable;
    return this;
  }

  /**
   * Build the DependencyError.
   *
   * Validates that required fields (code, message, and unresolvableReason) are set.
   *
   * @returns The constructed DependencyError
   * @throws Error if code, message, or unresolvableReason are missing
   *
   * @example
   * ```typescript
   * const error = builder
   *   .code('E031')
   *   .message('Cannot resolve dependencies')
   *   .reason('Hook cannot be hoisted')
   *   .build();
   * ```
   */
  build(): DependencyErrorType {
    // Validate required fields - destructure to enable type narrowing
    const { code, message, unresolvableReason } = this.params;

    if (code === undefined || code === '') {
      throw new Error('DependencyErrorBuilder: code is required');
    }
    if (message === undefined || message === '') {
      throw new Error('DependencyErrorBuilder: message is required');
    }
    if (unresolvableReason === undefined || unresolvableReason === '') {
      throw new Error('DependencyErrorBuilder: unresolvableReason (reason) is required');
    }

    // Create the DependencyError
    return createDependencyError({
      code,
      message,
      unresolvableReason,
      dependency: this.params.dependency,
      file: this.params.file,
      location: this.params.location,
      suggestions: this.params.suggestions?.map((s) => ({
        description: s,
        action: 'fix_syntax',
        automatic: false,
      })),
      recoverable: this.params.recoverable,
    });
  }
}

/**
 * Create a DependencyErrorBuilder instance.
 *
 * Factory function for creating DependencyErrorBuilder with fluent API.
 * This is a convenience function that's shorter to type than `new DependencyErrorBuilder()`.
 *
 * @returns A new DependencyErrorBuilder instance
 *
 * @example
 * ```typescript
 * const err = dependencyError()
 *   .code('E031')
 *   .message('Cannot resolve dependencies')
 *   .reason('Hook cannot be hoisted')
 *   .build();
 * ```
 */
export function dependencyError(): DependencyErrorBuilder {
  return new DependencyErrorBuilder();
}
