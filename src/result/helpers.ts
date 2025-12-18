/**
 * Result Helper Functions
 *
 * Helper functions for working with Result types, including unwrapping operations and exception conversion.
 */

import type { Result } from './types.js';
import { ok, err } from './types.js';

/**
 * Unwraps a Result, extracting the Ok value or throwing an error if Err.
 *
 * This function is useful for debugging but should be used with caution
 * as it can throw exceptions. Prefer unwrapOr or unwrapOrElse in production code.
 *
 * @param result - The Result to unwrap
 * @returns The value if Result is Ok
 * @throws Error if Result is Err
 *
 * @example
 * ```typescript
 * const result = ok(42);
 * const value = unwrap(result); // 42
 *
 * const errResult = err('error');
 * unwrap(errResult); // throws Error: Cannot unwrap Err variant: error
 * ```
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }

  // Format error message based on error type
  const errorMessage = typeof result.error === 'string'
    ? result.error
    : result.error instanceof Error
    ? result.error.message
    : JSON.stringify(result.error);

  throw new Error(`Cannot unwrap Err variant: ${errorMessage}`);
}

/**
 * Wraps a function that may throw an exception and converts it to a Result
 *
 * Executes the provided function and returns Ok with the result if successful.
 * If the function throws an exception, returns Err with the error.
 * Non-Error exceptions (strings, objects, etc.) are wrapped in an Error.
 *
 * @param fn - The function to execute
 * @returns Ok with the function result, or Err with the caught error
 *
 * @example
 * ```typescript
 * // Success case
 * const result = tryCatch(() => JSON.parse('{"valid": true}'));
 * if (result.ok) {
 *   console.log(result.value); // { valid: true }
 * }
 *
 * // Error case
 * const result = tryCatch(() => JSON.parse('invalid json'));
 * if (!result.ok) {
 *   console.error(result.error.message); // Parse error message
 * }
 * ```
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    const value = fn();
    return ok(value);
  } catch (e) {
    // If the thrown value is already an Error, use it directly
    if (e instanceof Error) {
      return err(e);
    }

    // For non-Error exceptions, wrap them in an Error
    // Handle different types of thrown values
    if (typeof e === 'string') {
      return err(new Error(e));
    }

    if (typeof e === 'number') {
      return err(new Error(String(e)));
    }

    if (typeof e === 'object' && e !== null) {
      // Try to create a meaningful error message from the object
      const message = JSON.stringify(e);
      return err(new Error(message));
    }

    // For any other type, convert to string
    return err(new Error(String(e)));
  }
}
