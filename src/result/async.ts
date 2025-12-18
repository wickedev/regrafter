/**
 * Async Result Operations
 *
 * Helper functions for working with async Result types.
 */

import type { Result } from './types.js';
import { ok } from './types.js';

/**
 * Transforms the value inside an Ok variant asynchronously using the provided function.
 * If the Result is Err, passes it through unchanged.
 *
 * This is the async version of map(). It allows you to chain async transformations
 * on Result values. If the transformation function throws or rejects, the error
 * will propagate (not be caught).
 *
 * @param result - The Result to map over
 * @param fn - Async function to transform the Ok value
 * @returns A Promise of a new Result with the transformed value, or the original Err
 *
 * @example
 * ```typescript
 * const result = ok(42);
 * const transformed = await mapAsync(result, async (num) => {
 *   const data = await fetchData(num);
 *   return data.value;
 * });
 * // transformed is Ok(fetchedValue) or original Err
 *
 * const error = err('failed');
 * const mapped = await mapAsync(error, async (x) => x * 2);
 * // mapped is still Err('failed')
 * ```
 */
export async function mapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>
): Promise<Result<U, E>> {
  if (result.ok) {
    const value = await fn(result.value);
    return ok(value);
  }
  return result;
}

/**
 * Chains async operations that return Results, flattening nested Results.
 * If the Result is Ok, applies the async function and returns its Result.
 * If the Result is Err, passes it through unchanged.
 *
 * This is the async version of flatMap(). It allows you to chain operations
 * that return Promise<Result<T, E>>. If the function throws or rejects,
 * the error will propagate (not be caught).
 *
 * @param result - The Result to flatMap over
 * @param fn - Async function that takes the Ok value and returns a Promise of a new Result
 * @returns A Promise of the Result from the function, or the original Err
 *
 * @example
 * ```typescript
 * const result = ok(42);
 * const chained = await flatMapAsync(result, async (num) => {
 *   const data = await validateNumber(num);
 *   if (data.valid) {
 *     return ok(data.value);
 *   } else {
 *     return err('Invalid number');
 *   }
 * });
 * // chained is Ok(validatedValue) or Err('Invalid number')
 *
 * const error = err('failed');
 * const chained2 = await flatMapAsync(error, async (x) => ok(x * 2));
 * // chained2 is still Err('failed')
 * ```
 */
export async function flatMapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  if (result.ok) {
    return await fn(result.value);
  }
  return result;
}
