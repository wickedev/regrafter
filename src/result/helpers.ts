/**
 * Result Helper Functions
 *
 * Helper functions for working with Result types, including unwrapping operations and exception conversion.
 */

import type { Result, Err } from './types.js';
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
 * Unwraps a Result, returning the Ok value or null if Err.
 *
 * This is a safe alternative to unwrap() that never throws and returns null
 * instead of providing a custom default value. This is particularly useful
 * in test contexts where you want to check if a Result is Ok and get its value,
 * or get null if it's Err.
 *
 * @param result - The Result to unwrap
 * @returns The value if Result is Ok, or null if Result is Err
 *
 * @example
 * ```typescript
 * // Ok case - returns value
 * const result = ok(42);
 * const value = unwrapResult(result);
 * // value: number | null = 42
 *
 * // Err case - returns null
 * const error = err('Not found');
 * const value2 = unwrapResult(error);
 * // value2: number | null = null
 *
 * // Practical usage in tests
 * const result = parseInput('valid');
 * const value = unwrapResult(result);
 * if (value) {
 *   expect(value.id).toBe(123);
 * }
 * ```
 */
export function unwrapResult<T, E>(result: Result<T, E>): T | null {
  if (!result.ok) {
    return null;
  }
  return result.value;
}

/**
 * Unwraps a Result, returning the Ok value or a default value if Err.
 *
 * This is a safe alternative to unwrap() that never throws.
 * If the Result is Ok, returns the contained value.
 * If the Result is Err, returns the provided default value.
 *
 * @param result - The Result to unwrap
 * @param defaultValue - The value to return if Result is Err
 * @returns The Ok value or the default value
 *
 * @example
 * ```typescript
 * const okResult = ok(42);
 * unwrapOr(okResult, 0); // 42
 *
 * const errResult = err('error');
 * unwrapOr(errResult, 0); // 0
 * ```
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Unwraps a Result, returning the Ok value or computing a fallback from the error.
 *
 * This is a safe alternative to unwrap() that never throws.
 * If the Result is Ok, returns the contained value.
 * If the Result is Err, calls the provided function with the error and returns its result.
 *
 * @param result - The Result to unwrap
 * @param fn - Function that takes the error and returns a fallback value
 * @returns The Ok value or the result of calling fn with the error
 *
 * @example
 * ```typescript
 * const okResult = ok(42);
 * unwrapOrElse(okResult, () => 0); // 42
 *
 * const errResult = err('not found');
 * unwrapOrElse(errResult, (e) => {
 *   console.error(e);
 *   return 0;
 * }); // 0
 *
 * // Using error information
 * const result = err({ code: 'E001', severity: 5 });
 * unwrapOrElse(result, (error) => {
 *   return error.severity > 3 ? -1 : 0;
 * }); // -1
 * ```
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  if (result.ok) {
    return result.value;
  }
  return fn(result.error);
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

/**
 * Wraps an async function that may throw or reject and converts it to a Promise<Result>
 *
 * Executes the provided async function and returns Promise<Ok> with the result if successful.
 * If the function throws an exception or the promise rejects, returns Promise<Err> with the error.
 * Non-Error exceptions (strings, objects, etc.) are wrapped in an Error.
 *
 * @param fn - The async function to execute
 * @returns Promise<Ok> with the function result, or Promise<Err> with the caught error
 *
 * @example
 * ```typescript
 * // Success case
 * const result = await tryCatchAsync(async () => {
 *   const response = await fetch('/api/data');
 *   return response.json();
 * });
 * if (result.ok) {
 *   console.log(result.value); // Parsed JSON data
 * }
 *
 * // Error case
 * const result = await tryCatchAsync(async () => {
 *   throw new Error('Network error');
 * });
 * if (!result.ok) {
 *   console.error(result.error.message); // 'Network error'
 * }
 * ```
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (e) {
    // If the thrown/rejected value is already an Error, use it directly
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

/**
 * Combines an array of Results into a single Result
 *
 * Returns Ok with an array of all values if all Results are Ok.
 * Returns the first Err if any Result is Err.
 * Returns Ok with an empty array if the input array is empty.
 *
 * @param results - Array of Results to combine
 * @returns Ok with array of values if all Results are Ok, or the first Err
 *
 * @example
 * ```typescript
 * // All Ok case
 * const results = [ok(1), ok(2), ok(3)];
 * const combined = all(results);
 * if (combined.ok) {
 *   console.log(combined.value); // [1, 2, 3]
 * }
 *
 * // Any Err case
 * const results = [ok(1), err('error'), ok(3)];
 * const combined = all(results);
 * if (!combined.ok) {
 *   console.log(combined.error); // 'error'
 * }
 *
 * // Empty array case
 * const results = [];
 * const combined = all(results);
 * if (combined.ok) {
 *   console.log(combined.value); // []
 * }
 * ```
 */
export function all<T, E>(results: Array<Result<T, E>>): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) {
      // Return the first error encountered
      return result;
    }
    values.push(result.value);
  }

  return ok(values);
}

/**
 * Returns the first Ok result, or all errors if all Results are Err
 *
 * Returns the first Ok value if any Result is Ok.
 * Returns Err with an array of all errors if all Results are Err.
 * Returns Err with an empty array if the input array is empty.
 *
 * @param results - Array of Results to check
 * @returns First Ok result if any, or Err with array of all errors
 *
 * @example
 * ```typescript
 * // Any Ok case
 * const results = [err('error 1'), ok(42), err('error 2')];
 * const combined = any(results);
 * if (combined.ok) {
 *   console.log(combined.value); // 42
 * }
 *
 * // All Err case
 * const results = [err('error 1'), err('error 2')];
 * const combined = any(results);
 * if (!combined.ok) {
 *   console.log(combined.error); // ['error 1', 'error 2']
 * }
 *
 * // Empty array case
 * const results = [];
 * const combined = any(results);
 * if (!combined.ok) {
 *   console.log(combined.error); // []
 * }
 * ```
 */
export function any<T, E>(results: Array<Result<T, E>>): Result<T, E[]> {
  const errors: E[] = [];

  for (const result of results) {
    if (result.ok) {
      // Return the first Ok result encountered
      return result;
    }
    errors.push(result.error);
  }

  // If we get here, all results were Err
  return err(errors);
}

/**
 * Transforms the value inside an Ok variant using the provided function.
 * If the Result is Err, passes it through unchanged.
 *
 * @param result - The Result to map over
 * @param fn - Function to transform the Ok value
 * @returns A new Result with the transformed value, or the original Err
 *
 * @example
 * ```typescript
 * const result = ok(2);
 * const doubled = map(result, x => x * 2);
 * // doubled is Ok(4)
 *
 * const error = err('failed');
 * const mapped = map(error, x => x * 2);
 * // mapped is still Err('failed')
 * ```
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Chains operations that return Results, flattening nested Results.
 * If the Result is Ok, applies the function and returns its Result.
 * If the Result is Err, passes it through unchanged.
 *
 * @param result - The Result to flatMap over
 * @param fn - Function that takes the Ok value and returns a new Result
 * @returns The Result from the function, or the original Err
 *
 * @example
 * ```typescript
 * const result = ok(2);
 * const chained = flatMap(result, x => ok(x * 2));
 * // chained is Ok(4)
 *
 * const error = err('failed');
 * const chained2 = flatMap(error, x => ok(x * 2));
 * // chained2 is still Err('failed')
 * ```
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Transforms the error inside an Err variant using the provided function.
 * If the Result is Ok, passes it through unchanged.
 *
 * @param result - The Result to map the error of
 * @param fn - Function to transform the Err value
 * @returns A new Result with the transformed error, or the original Ok
 *
 * @example
 * ```typescript
 * const result = err('error');
 * const mapped = mapErr(result, e => e.toUpperCase());
 * // mapped is Err('ERROR')
 *
 * const success = ok(42);
 * const mapped2 = mapErr(success, e => e.toUpperCase());
 * // mapped2 is still Ok(42)
 * ```
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (!result.ok) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Unwrap Result value or return error Result for early return pattern.
 *
 * This utility enables clean early returns in Result-returning functions.
 * If the Result is Ok, returns the unwrapped value.
 * If the Result is Err, returns the error Result itself which can be returned directly.
 *
 * The return type uses TypeScript's type narrowing with 'ok' property to distinguish
 * between the unwrapped value and the error Result.
 *
 * @param result - The Result to unwrap
 * @returns The unwrapped value (T) or the error Result (Err<E>)
 *
 * @example
 * ```typescript
 * function process(): Result<Output, Error> {
 *   const input = unwrapOrReturn(getInput());
 *   if (!input.ok) return input;  // Early return with error
 *
 *   // input.value is now typed as Input
 *   const validated = unwrapOrReturn(validate(input.value));
 *   if (!validated.ok) return validated;
 *
 *   return ok(transform(validated.value));
 * }
 * ```
 */
export function unwrapOrReturn<T, E>(
  result: Result<T, E>
): T | Err<E> {
  if (!result.ok) {
    return result;  // Return the Err result directly
  }
  return result.value;
}

/**
 * Unwrap Result value or return null if Err.
 *
 * This is an alias for unwrapResult() provided for naming consistency
 * and clarity in different contexts. Use when null is an acceptable
 * fallback value.
 *
 * @param result - The Result to unwrap
 * @returns The value if Result is Ok, or null if Result is Err
 *
 * @example
 * ```typescript
 * const component = unwrapOrNull(
 *   scopeManager.findEnclosingComponent(path)
 * );
 *
 * if (component) {
 *   // Use component
 * } else {
 *   // Handle not found case
 * }
 * ```
 */
export function unwrapOrNull<T, E>(result: Result<T, E>): T | null {
  return unwrapResult(result);
}

/**
 * Chain Result-returning operations (monadic bind).
 *
 * This is an alias for flatMap() provided for naming consistency with
 * other functional programming conventions. The name 'andThen' suggests
 * sequential chaining of operations.
 *
 * If the Result is Ok, applies the function and returns its Result.
 * If the Result is Err, passes it through unchanged. This stops at the
 * first error, making it ideal for composing multiple fallible operations.
 *
 * @param result - The Result to chain from
 * @param fn - Function that takes the Ok value and returns a new Result
 * @returns The Result from the function, or the original Err
 *
 * @example
 * ```typescript
 * const result = andThen(
 *   parseFile(path),
 *   ast => andThen(
 *     buildScopeTree(ast),
 *     scope => analyzeDependencies(scope)
 *   )
 * );
 * // Stops at first error, or returns final success
 * ```
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return flatMap(result, fn);
}

/**
 * Map over Result value (functional transformation).
 *
 * This is an alias for map() provided for naming consistency and clarity.
 * The name 'mapResult' makes it explicit that we're mapping over a Result type.
 *
 * If the Result is Ok, applies the function to transform the value.
 * If the Result is Err, passes it through unchanged.
 *
 * @param result - The Result to map over
 * @param fn - Function to transform the Ok value
 * @returns A new Result with the transformed value, or the original Err
 *
 * @example
 * ```typescript
 * const doubled = mapResult(getNumber(), n => n * 2);
 *
 * const formatted = mapResult(
 *   parseUser(data),
 *   user => `${user.name} <${user.email}>`
 * );
 * ```
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return map(result, fn);
}

/**
 * Combine multiple Results into a single Result of array.
 *
 * This is an alias for all() provided for naming clarity.
 * The name 'combineResults' makes it explicit that we're combining
 * multiple Result values.
 *
 * Returns Ok with an array of all values if all Results are Ok.
 * Returns the first Err if any Result is Err.
 * Returns Ok with an empty array if the input array is empty.
 *
 * @param results - Array of Results to combine
 * @returns Ok with array of values if all Results are Ok, or the first Err
 *
 * @example
 * ```typescript
 * const results = combineResults([
 *   parseFile('a.tsx'),
 *   parseFile('b.tsx'),
 *   parseFile('c.tsx'),
 * ]);
 * // Result<[AST, AST, AST], Error>
 *
 * if (results.ok) {
 *   const [astA, astB, astC] = results.value;
 *   // Process all ASTs
 * }
 * ```
 */
export function combineResults<T, E>(
  results: Array<Result<T, E>>
): Result<T[], E> {
  return all(results);
}
