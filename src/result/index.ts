/**
 * Result Type System for Functional Error Handling
 *
 * This module provides a complete Result<T, E> type system for handling errors
 * in a functional, type-safe manner without throwing exceptions. The Result pattern
 * makes error handling explicit in function signatures, improving code reliability
 * and maintainability.
 *
 * ## Core Concepts
 *
 * A `Result<T, E>` represents either:
 * - **Ok(value)**: A successful computation with a value of type T
 * - **Err(error)**: A failed computation with an error of type E
 *
 * Results are discriminated unions using the `ok` boolean field, enabling
 * TypeScript to narrow types automatically.
 *
 * ## Benefits
 *
 * - **Explicit Error Handling**: Errors are part of the type signature
 * - **Type Safety**: TypeScript ensures all error cases are handled
 * - **Referential Transparency**: Functions are pure and predictable
 * - **Composability**: Chain operations using map, flatMap, and other helpers
 * - **No Hidden Control Flow**: No exceptions to catch or forget about
 *
 * ## Basic Usage
 *
 * ### Creating Results
 *
 * ```typescript
 * import { ok, err, type Result } from '@regrafter/result';
 *
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) {
 *     return err('Division by zero');
 *   }
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log('Success:', result.value); // 5
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 *
 * ### Transforming Results
 *
 * ```typescript
 * import { map, flatMap } from '@regrafter/result';
 *
 * // Transform success values
 * const doubled = map(divide(10, 2), x => x * 2);
 * // doubled is Ok(10)
 *
 * // Chain operations that return Results
 * const result = flatMap(
 *   divide(10, 2),
 *   x => divide(x, 2)
 * );
 * // result is Ok(2.5)
 * ```
 *
 * ### Unwrapping Results Safely
 *
 * ```typescript
 * import { unwrapOr, unwrapOrElse } from '@regrafter/result';
 *
 * // Provide a default value
 * const value = unwrapOr(divide(10, 0), 0);
 * // value is 0
 *
 * // Compute fallback from error
 * const value2 = unwrapOrElse(
 *   divide(10, 0),
 *   (error) => {
 *     console.error('Error:', error);
 *     return 0;
 *   }
 * );
 * ```
 *
 * ### Combining Multiple Results
 *
 * ```typescript
 * import { all, any } from '@regrafter/result';
 *
 * // All must succeed
 * const results = [divide(10, 2), divide(20, 4), divide(30, 6)];
 * const combined = all(results);
 * // combined is Ok([5, 5, 5])
 *
 * // First success wins
 * const alternatives = [divide(10, 0), divide(20, 4), divide(30, 0)];
 * const firstOk = any(alternatives);
 * // firstOk is Ok(5)
 * ```
 *
 * ### Converting Exceptions to Results
 *
 * ```typescript
 * import { tryCatch, tryCatchAsync } from '@regrafter/result';
 *
 * // Wrap synchronous throwing code
 * const parsed = tryCatch(() => JSON.parse(input));
 * if (parsed.ok) {
 *   console.log('Parsed:', parsed.value);
 * }
 *
 * // Wrap asynchronous throwing code
 * const data = await tryCatchAsync(async () => {
 *   const response = await fetch('/api/data');
 *   return response.json();
 * });
 * ```
 *
 * ### Async Operations
 *
 * ```typescript
 * import { mapAsync, flatMapAsync } from '@regrafter/result';
 *
 * // Transform with async function
 * const result = await mapAsync(ok(userId), async (id) => {
 *   const user = await fetchUser(id);
 *   return user.name;
 * });
 *
 * // Chain async operations
 * const validated = await flatMapAsync(ok(userId), async (id) => {
 *   const user = await fetchUser(id);
 *   return user.active ? ok(user) : err('User is inactive');
 * });
 * ```
 *
 * ## Type Exports
 *
 * - `Result<T, E>` - Discriminated union of Ok<T> | Err<E>
 * - `Ok<T>` - Success variant interface
 * - `Err<E>` - Failure variant interface
 *
 * ## Function Exports
 *
 * ### Constructors
 * - `ok(value)` - Create an Ok result
 * - `err(error)` - Create an Err result
 *
 * ### Type Guards
 * - `isOk(result)` - Check if result is Ok
 * - `isErr(result)` - Check if result is Err
 *
 * ### Mapping Operations
 * - `map(result, fn)` - Transform Ok value
 * - `flatMap(result, fn)` - Chain Result-returning operations
 * - `mapErr(result, fn)` - Transform Err value
 *
 * ### Unwrapping Operations
 * - `unwrap(result)` - Extract value or throw (use with caution)
 * - `unwrapOr(result, default)` - Extract value or return default
 * - `unwrapOrElse(result, fn)` - Extract value or compute from error
 *
 * ### Combining Operations
 * - `all(results)` - Combine array of Results (all must be Ok)
 * - `any(results)` - Find first Ok result
 *
 * ### Exception Conversion
 * - `tryCatch(fn)` - Wrap throwing function
 * - `tryCatchAsync(fn)` - Wrap async throwing function
 *
 * ### Async Operations
 * - `mapAsync(result, fn)` - Transform with async function
 * - `flatMapAsync(result, fn)` - Chain async Result-returning operations
 *
 * @module result
 */

// ============================================================================
// Type Exports
// ============================================================================

export type { Result, Ok, Err } from './types.js';

// ============================================================================
// Constructor Functions
// ============================================================================

/**
 * Creates an Ok variant with the given value.
 *
 * @typeParam T - The type of the success value
 * @param value - The success value to wrap
 * @returns An Ok result containing the value
 *
 * @example
 * ```typescript
 * const result = ok(42);
 * // result: Ok<number> = { ok: true, value: 42 }
 *
 * const user = ok({ id: 1, name: 'Alice' });
 * // user: Ok<{ id: number, name: string }>
 * ```
 */
export { ok } from './types.js';

/**
 * Creates an Err variant with the given error.
 *
 * @typeParam E - The type of the error value
 * @param error - The error value to wrap
 * @returns An Err result containing the error
 *
 * @example
 * ```typescript
 * const result = err('Not found');
 * // result: Err<string> = { ok: false, error: 'Not found' }
 *
 * const error = err({ code: 'E001', message: 'Invalid input' });
 * // error: Err<{ code: string, message: string }>
 * ```
 */
export { err } from './types.js';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a Result is Ok.
 *
 * This function narrows the type to Ok<T>, allowing type-safe access to the value.
 *
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param result - The Result to check
 * @returns true if the Result is Ok, false otherwise
 *
 * @example
 * ```typescript
 * const result: Result<number, string> = ok(42);
 *
 * if (isOk(result)) {
 *   // TypeScript knows result is Ok<number>
 *   console.log(result.value); // 42
 * }
 * ```
 */
export { isOk } from './types.js';

/**
 * Type guard to check if a Result is Err.
 *
 * This function narrows the type to Err<E>, allowing type-safe access to the error.
 *
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param result - The Result to check
 * @returns true if the Result is Err, false otherwise
 *
 * @example
 * ```typescript
 * const result: Result<number, string> = err('Invalid input');
 *
 * if (isErr(result)) {
 *   // TypeScript knows result is Err<string>
 *   console.error(result.error); // 'Invalid input'
 * }
 * ```
 */
export { isErr } from './types.js';

// ============================================================================
// Mapping Operations
// ============================================================================

/**
 * Transforms the value inside an Ok variant using the provided function.
 *
 * If the Result is Err, passes it through unchanged. This is useful for
 * transforming success values while preserving error information.
 *
 * @typeParam T - The type of the original success value
 * @typeParam U - The type of the transformed success value
 * @typeParam E - The type of the error value
 * @param result - The Result to map over
 * @param fn - Function to transform the Ok value
 * @returns A new Result with the transformed value, or the original Err
 *
 * @example
 * ```typescript
 * // Transform a number
 * const result = ok(5);
 * const doubled = map(result, x => x * 2);
 * // doubled: Ok<number> = { ok: true, value: 10 }
 *
 * // Transform an object
 * const user = ok({ id: 1, name: 'Alice' });
 * const name = map(user, u => u.name);
 * // name: Ok<string> = { ok: true, value: 'Alice' }
 *
 * // Err passes through
 * const error = err('Not found');
 * const mapped = map(error, x => x * 2);
 * // mapped: Err<string> = { ok: false, error: 'Not found' }
 * ```
 */
export { map } from './helpers.js';

/**
 * Chains operations that return Results, flattening nested Results.
 *
 * If the Result is Ok, applies the function and returns its Result.
 * If the Result is Err, passes it through unchanged. This is essential
 * for composing multiple fallible operations.
 *
 * @typeParam T - The type of the original success value
 * @typeParam U - The type of the new success value
 * @typeParam E - The type of the error value
 * @param result - The Result to flatMap over
 * @param fn - Function that takes the Ok value and returns a new Result
 * @returns The Result from the function, or the original Err
 *
 * @example
 * ```typescript
 * // Chain operations
 * function divide(a: number, b: number): Result<number, string> {
 *   return b === 0 ? err('Division by zero') : ok(a / b);
 * }
 *
 * const result = flatMap(
 *   divide(10, 2),
 *   x => divide(x, 2)
 * );
 * // result: Ok<number> = { ok: true, value: 2.5 }
 *
 * // First error propagates
 * const error1 = flatMap(
 *   divide(10, 0),
 *   x => divide(x, 2)
 * );
 * // error1: Err<string> = { ok: false, error: 'Division by zero' }
 *
 * // Second error propagates
 * const error2 = flatMap(
 *   divide(10, 2),
 *   x => divide(x, 0)
 * );
 * // error2: Err<string> = { ok: false, error: 'Division by zero' }
 * ```
 */
export { flatMap } from './helpers.js';

/**
 * Transforms the error inside an Err variant using the provided function.
 *
 * If the Result is Ok, passes it through unchanged. This is useful for
 * transforming error types or adding context to errors.
 *
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the original error value
 * @typeParam F - The type of the transformed error value
 * @param result - The Result to map the error of
 * @param fn - Function to transform the Err value
 * @returns A new Result with the transformed error, or the original Ok
 *
 * @example
 * ```typescript
 * // Transform error message
 * const result = err('not found');
 * const mapped = mapErr(result, e => e.toUpperCase());
 * // mapped: Err<string> = { ok: false, error: 'NOT FOUND' }
 *
 * // Add context to error
 * const error = err('File not found');
 * const withContext = mapErr(error, msg => ({
 *   code: 'E404',
 *   message: msg,
 *   timestamp: Date.now()
 * }));
 * // withContext: Err<{ code: string, message: string, timestamp: number }>
 *
 * // Ok passes through
 * const success = ok(42);
 * const mapped2 = mapErr(success, e => e.toUpperCase());
 * // mapped2: Ok<number> = { ok: true, value: 42 }
 * ```
 */
export { mapErr } from './helpers.js';

// ============================================================================
// Unwrapping Operations
// ============================================================================

/**
 * Unwraps a Result, extracting the Ok value or throwing an error if Err.
 *
 * **Warning**: This function can throw exceptions and should be used with caution.
 * Prefer `unwrapOr` or `unwrapOrElse` in production code. This is primarily useful
 * for debugging or in contexts where you're certain the Result is Ok.
 *
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param result - The Result to unwrap
 * @returns The value if Result is Ok
 * @throws Error if Result is Err
 *
 * @example
 * ```typescript
 * // Success case
 * const result = ok(42);
 * const value = unwrap(result);
 * // value: number = 42
 *
 * // Error case - throws!
 * const error = err('Something went wrong');
 * unwrap(error);
 * // throws Error: Cannot unwrap Err variant: Something went wrong
 *
 * // Safe usage with type guard
 * const result: Result<number, string> = ok(42);
 * if (result.ok) {
 *   const value = unwrap(result); // Safe - we know it's Ok
 * }
 * ```
 */
export { unwrap } from './helpers.js';

/**
 * Unwraps a Result, returning the Ok value or a default value if Err.
 *
 * This is a safe alternative to `unwrap()` that never throws. If the Result is Ok,
 * returns the contained value. If the Result is Err, returns the provided default.
 *
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param result - The Result to unwrap
 * @param defaultValue - The value to return if Result is Err
 * @returns The Ok value or the default value
 *
 * @example
 * ```typescript
 * // Ok case - returns value
 * const result = ok(42);
 * const value = unwrapOr(result, 0);
 * // value: number = 42
 *
 * // Err case - returns default
 * const error = err('Not found');
 * const value2 = unwrapOr(error, 0);
 * // value2: number = 0
 *
 * // Practical usage
 * function getConfig(key: string): Result<string, string> {
 *   const value = process.env[key];
 *   return value ? ok(value) : err(`Config ${key} not found`);
 * }
 *
 * const port = unwrapOr(getConfig('PORT'), '3000');
 * // port will be the config value or '3000'
 * ```
 */
export { unwrapOr } from './helpers.js';

/**
 * Unwraps a Result, returning the Ok value or computing a fallback from the error.
 *
 * This is a safe alternative to `unwrap()` that never throws. If the Result is Ok,
 * returns the contained value. If the Result is Err, calls the provided function
 * with the error and returns its result.
 *
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param result - The Result to unwrap
 * @param fn - Function that takes the error and returns a fallback value
 * @returns The Ok value or the result of calling fn with the error
 *
 * @example
 * ```typescript
 * // Ok case - returns value
 * const result = ok(42);
 * const value = unwrapOrElse(result, () => 0);
 * // value: number = 42
 *
 * // Err case - computes fallback
 * const error = err('Not found');
 * const value2 = unwrapOrElse(error, (e) => {
 *   console.error('Error:', e);
 *   return 0;
 * });
 * // value2: number = 0
 *
 * // Using error information
 * type AppError = { code: string; severity: number };
 * const result: Result<number, AppError> = err({ code: 'E001', severity: 5 });
 * const value3 = unwrapOrElse(result, (error) => {
 *   if (error.severity > 3) {
 *     console.error('Critical error:', error.code);
 *     return -1;
 *   }
 *   return 0;
 * });
 * // value3: number = -1
 * ```
 */
export { unwrapOrElse } from './helpers.js';

// ============================================================================
// Combining Operations
// ============================================================================

/**
 * Combines an array of Results into a single Result containing an array of values.
 *
 * Returns Ok with an array of all values if all Results are Ok.
 * Returns the first Err if any Result is Err.
 * Returns Ok with an empty array if the input array is empty.
 *
 * @typeParam T - The type of the success values
 * @typeParam E - The type of the error values
 * @param results - Array of Results to combine
 * @returns Ok with array of values if all Results are Ok, or the first Err
 *
 * @example
 * ```typescript
 * // All Ok - success
 * const results = [ok(1), ok(2), ok(3)];
 * const combined = all(results);
 * // combined: Ok<number[]> = { ok: true, value: [1, 2, 3] }
 *
 * // Any Err - returns first error
 * const results2 = [ok(1), err('error'), ok(3), err('another error')];
 * const combined2 = all(results2);
 * // combined2: Err<string> = { ok: false, error: 'error' }
 *
 * // Empty array
 * const results3 = [];
 * const combined3 = all(results3);
 * // combined3: Ok<never[]> = { ok: true, value: [] }
 *
 * // Practical usage - validate multiple fields
 * function validateUser(data: unknown): Result<User, string> {
 *   const nameResult = validateName(data.name);
 *   const emailResult = validateEmail(data.email);
 *   const ageResult = validateAge(data.age);
 *
 *   return flatMap(
 *     all([nameResult, emailResult, ageResult]),
 *     ([name, email, age]) => ok({ name, email, age })
 *   );
 * }
 * ```
 */
export { all } from './helpers.js';

/**
 * Returns the first Ok result, or all errors if all Results are Err.
 *
 * Returns the first Ok value if any Result is Ok.
 * Returns Err with an array of all errors if all Results are Err.
 * Returns Err with an empty array if the input array is empty.
 *
 * @typeParam T - The type of the success values
 * @typeParam E - The type of the error values
 * @param results - Array of Results to check
 * @returns First Ok result if any, or Err with array of all errors
 *
 * @example
 * ```typescript
 * // First Ok wins
 * const results = [err('error 1'), ok(42), err('error 2')];
 * const combined = any(results);
 * // combined: Ok<number> = { ok: true, value: 42 }
 *
 * // All Err - collects all errors
 * const results2 = [err('error 1'), err('error 2'), err('error 3')];
 * const combined2 = any(results2);
 * // combined2: Err<string[]> = { ok: false, error: ['error 1', 'error 2', 'error 3'] }
 *
 * // Empty array
 * const results3 = [];
 * const combined3 = any(results3);
 * // combined3: Err<never[]> = { ok: false, error: [] }
 *
 * // Practical usage - try multiple fallback strategies
 * function loadConfig(): Result<Config, string> {
 *   return any([
 *     loadFromEnv(),
 *     loadFromFile('.env'),
 *     loadFromFile('config.json'),
 *     ok(getDefaultConfig())
 *   ]);
 * }
 * ```
 */
export { any } from './helpers.js';

// ============================================================================
// Exception Conversion
// ============================================================================

/**
 * Wraps a function that may throw an exception and converts it to a Result.
 *
 * Executes the provided function and returns Ok with the result if successful.
 * If the function throws an exception, returns Err with the error.
 * Non-Error exceptions (strings, objects, etc.) are wrapped in an Error.
 *
 * @typeParam T - The type of the success value
 * @param fn - The function to execute
 * @returns Ok with the function result, or Err with the caught error
 *
 * @example
 * ```typescript
 * // Parse JSON safely
 * const result = tryCatch(() => JSON.parse('{"valid": true}'));
 * if (result.ok) {
 *   console.log(result.value); // { valid: true }
 * }
 *
 * const result2 = tryCatch(() => JSON.parse('invalid json'));
 * if (!result2.ok) {
 *   console.error(result2.error.message); // Syntax error message
 * }
 *
 * // Wrap unsafe operations
 * function readFileSync(path: string): Result<string, Error> {
 *   return tryCatch(() => fs.readFileSync(path, 'utf-8'));
 * }
 *
 * // Convert external library exceptions
 * function parseXML(xml: string): Result<Document, Error> {
 *   return tryCatch(() => externalXMLParser.parse(xml));
 * }
 * ```
 */
export { tryCatch } from './helpers.js';

/**
 * Wraps an async function that may throw or reject and converts it to a Promise<Result>.
 *
 * Executes the provided async function and returns Promise<Ok> with the result if successful.
 * If the function throws an exception or the promise rejects, returns Promise<Err> with the error.
 * Non-Error exceptions (strings, objects, etc.) are wrapped in an Error.
 *
 * @typeParam T - The type of the success value
 * @param fn - The async function to execute
 * @returns Promise<Ok> with the function result, or Promise<Err> with the caught error
 *
 * @example
 * ```typescript
 * // Fetch API safely
 * const result = await tryCatchAsync(async () => {
 *   const response = await fetch('/api/data');
 *   if (!response.ok) {
 *     throw new Error(`HTTP ${response.status}`);
 *   }
 *   return response.json();
 * });
 *
 * if (result.ok) {
 *   console.log('Data:', result.value);
 * } else {
 *   console.error('Fetch failed:', result.error.message);
 * }
 *
 * // Async file operations
 * async function readFile(path: string): Promise<Result<string, Error>> {
 *   return tryCatchAsync(() => fs.promises.readFile(path, 'utf-8'));
 * }
 *
 * // Database queries
 * async function findUser(id: string): Promise<Result<User, Error>> {
 *   return tryCatchAsync(() => db.users.findById(id));
 * }
 * ```
 */
export { tryCatchAsync } from './helpers.js';

// ============================================================================
// Async Operations
// ============================================================================

/**
 * Transforms the value inside an Ok variant asynchronously using the provided function.
 *
 * If the Result is Err, passes it through unchanged. This is the async version of `map()`.
 * It allows you to chain async transformations on Result values. If the transformation
 * function throws or rejects, the error will propagate (not be caught).
 *
 * @typeParam T - The type of the original success value
 * @typeParam U - The type of the transformed success value
 * @typeParam E - The type of the error value
 * @param result - The Result to map over
 * @param fn - Async function to transform the Ok value
 * @returns A Promise of a new Result with the transformed value, or the original Err
 *
 * @example
 * ```typescript
 * // Transform with async operation
 * const userId = ok(123);
 * const user = await mapAsync(userId, async (id) => {
 *   const response = await fetch(`/api/users/${id}`);
 *   return response.json();
 * });
 * // user: Ok<User> or original Err
 *
 * // Chain async transformations
 * const result = ok('user-123');
 * const transformed = await mapAsync(result, async (id) => {
 *   const user = await fetchUser(id);
 *   const profile = await fetchProfile(user.profileId);
 *   return { user, profile };
 * });
 *
 * // Err passes through
 * const error = err('Not found');
 * const mapped = await mapAsync(error, async (x) => fetchData(x));
 * // mapped: Err<string> = { ok: false, error: 'Not found' }
 * ```
 */
export { mapAsync } from './async.js';

/**
 * Chains async operations that return Results, flattening nested Results.
 *
 * If the Result is Ok, applies the async function and returns its Result.
 * If the Result is Err, passes it through unchanged. This is the async version
 * of `flatMap()`. It allows you to chain operations that return Promise<Result<T, E>>.
 * If the function throws or rejects, the error will propagate (not be caught).
 *
 * @typeParam T - The type of the original success value
 * @typeParam U - The type of the new success value
 * @typeParam E - The type of the error value
 * @param result - The Result to flatMap over
 * @param fn - Async function that takes the Ok value and returns a Promise of a new Result
 * @returns A Promise of the Result from the function, or the original Err
 *
 * @example
 * ```typescript
 * // Chain async operations
 * function fetchUser(id: number): Promise<Result<User, string>> {
 *   return tryCatchAsync(async () => {
 *     const response = await fetch(`/api/users/${id}`);
 *     if (!response.ok) throw new Error('User not found');
 *     return response.json();
 *   }).then(r => mapErr(r, e => e.message));
 * }
 *
 * const userId = ok(123);
 * const user = await flatMapAsync(userId, fetchUser);
 * // user: Ok<User> or Err<string>
 *
 * // Chain multiple async operations
 * const result = await flatMapAsync(
 *   ok('user-123'),
 *   async (id) => {
 *     const userResult = await fetchUser(id);
 *     return flatMapAsync(userResult, async (user) => {
 *       const valid = await validateUser(user);
 *       return valid ? ok(user) : err('Invalid user');
 *     });
 *   }
 * );
 *
 * // Err passes through
 * const error = err('Invalid ID');
 * const chained = await flatMapAsync(error, fetchUser);
 * // chained: Err<string> = { ok: false, error: 'Invalid ID' }
 * ```
 */
export { flatMapAsync } from './async.js';

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Result of batch processing operations containing successes and failures.
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
 * console.log(`Validated ${result.successes.length} users`);
 * console.log(`Found ${result.failures.length} errors`);
 * ```
 */
export type { BatchResult } from './batch.js';

/**
 * Process a batch of items, collecting both successes and failures.
 *
 * Executes a processor function on each item and separates successful results
 * from errors. Unlike `all()` which fails on the first error, this processes
 * all items and returns both successes and failures.
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
 * // Validate multiple inputs
 * const inputs = ['valid1', 'invalid', 'valid2'];
 *
 * const result = processBatch(inputs, (input) => {
 *   return input.startsWith('valid')
 *     ? ok(input.toUpperCase())
 *     : err(`Invalid input: ${input}`);
 * });
 *
 * // result.successes: ['VALID1', 'VALID2']
 * // result.failures: ['Invalid input: invalid']
 * ```
 *
 * @example
 * ```typescript
 * // Parse multiple files, collecting both successes and errors
 * const files = ['a.json', 'b.json', 'invalid.json'];
 *
 * const result = processBatch(files, (path) =>
 *   tryCatch(() => JSON.parse(readFileSync(path, 'utf-8')))
 * );
 *
 * // Process valid files
 * result.successes.forEach(data => console.log('Parsed:', data));
 *
 * // Report errors without stopping
 * result.failures.forEach(error => console.error('Failed:', error.message));
 * ```
 */
export { processBatch } from './batch.js';
