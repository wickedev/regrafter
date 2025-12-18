/**
 * Batch Processing for Result Types
 *
 * This module provides utilities for processing multiple operations that return Results,
 * collecting both successes and failures.
 *
 * @module result/batch
 */

import type { Result } from './types.js';

/**
 * Result of batch processing operations.
 *
 * Contains separate arrays for successful results and errors, allowing
 * partial success scenarios to be handled gracefully.
 *
 * @typeParam T - The type of successful values
 * @typeParam E - The type of error values
 *
 * @example
 * ```typescript
 * const result: BatchResult<User, ValidationError> = processBatch(
 *   users,
 *   validateUser
 * );
 *
 * console.log(`${result.successes.length} users validated successfully`);
 * console.log(`${result.failures.length} validation errors`);
 * ```
 */
export interface BatchResult<T, E> {
  /** Array of successfully processed values */
  successes: T[];
  /** Array of errors from failed operations */
  failures: E[];
}

/**
 * Process a batch of items, collecting both successes and failures.
 *
 * Executes a processor function on each item in the array and separates
 * successful results from errors. This is useful for operations where you
 * want to process as many items as possible and handle failures separately
 * rather than short-circuiting on the first error.
 *
 * @typeParam T - The type of input items
 * @typeParam U - The type of successful output values
 * @typeParam E - The type of error values
 * @param items - Array of items to process
 * @param processor - Function that processes each item and returns a Result
 * @returns BatchResult containing separate arrays of successes and failures
 *
 * @example
 * ```typescript
 * // Validate multiple user inputs
 * const users = [
 *   { name: 'Alice', email: 'alice@example.com' },
 *   { name: '', email: 'invalid' },
 *   { name: 'Bob', email: 'bob@example.com' }
 * ];
 *
 * const result = processBatch(users, (user) => {
 *   if (!user.name) {
 *     return err({ field: 'name', message: 'Name is required' });
 *   }
 *   if (!isValidEmail(user.email)) {
 *     return err({ field: 'email', message: 'Invalid email' });
 *   }
 *   return ok(user);
 * });
 *
 * // result.successes contains valid users (Alice, Bob)
 * // result.failures contains validation errors for the second user
 * ```
 *
 * @example
 * ```typescript
 * // Parse multiple files
 * const filePaths = ['a.json', 'b.json', 'invalid.json'];
 *
 * const result = processBatch(filePaths, (path) =>
 *   tryCatch(() => JSON.parse(readFileSync(path, 'utf-8')))
 * );
 *
 * console.log(`Successfully parsed ${result.successes.length} files`);
 * console.log(`Failed to parse ${result.failures.length} files`);
 * ```
 */
export function processBatch<T, U, E>(
  items: T[],
  processor: (item: T) => Result<U, E>
): BatchResult<U, E> {
  const successes: U[] = [];
  const failures: E[] = [];

  for (const item of items) {
    const result = processor(item);
    if (result.ok) {
      successes.push(result.value);
    } else {
      failures.push(result.error);
    }
  }

  return { successes, failures };
}
