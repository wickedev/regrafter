/**
 * Result Type System
 *
 * Core Result<T, E> type definitions for functional error handling.
 * Provides Ok and Err variants with type-safe discrimination.
 */

/**
 * Success variant containing a value of type T
 */
export interface Ok<T> {
  /** Discriminant: always true for Ok */
  readonly ok: true;
  /** The success value */
  readonly value: T;
}

/**
 * Failure variant containing an error of type E
 */
export interface Err<E> {
  /** Discriminant: always false for Err */
  readonly ok: false;
  /** The error value */
  readonly error: E;
}

/**
 * Result type representing either success (Ok) or failure (Err)
 *
 * This is a discriminated union that ensures type-safe access to values.
 * The 'ok' field is the discriminant.
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Creates an Ok variant with the given value
 *
 * @param value - The success value
 * @returns Ok variant containing the value
 *
 * @example
 * ```typescript
 * const result = ok(42);
 * if (result.ok) {
 *   console.log(result.value); // 42
 * }
 * ```
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Creates an Err variant with the given error
 *
 * @param error - The error value
 * @returns Err variant containing the error
 *
 * @example
 * ```typescript
 * const result = err('error message');
 * if (!result.ok) {
 *   console.log(result.error); // 'error message'
 * }
 * ```
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard to check if a Result is Ok
 *
 * @param result - The Result to check
 * @returns true if the Result is Ok, false otherwise
 *
 * @example
 * ```typescript
 * const result: Result<number, string> = ok(42);
 * if (isOk(result)) {
 *   // TypeScript knows result is Ok<number>
 *   console.log(result.value);
 * }
 * ```
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard to check if a Result is Err
 *
 * @param result - The Result to check
 * @returns true if the Result is Err, false otherwise
 *
 * @example
 * ```typescript
 * const result: Result<number, string> = err('error');
 * if (isErr(result)) {
 *   // TypeScript knows result is Err<string>
 *   console.log(result.error);
 * }
 * ```
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}
