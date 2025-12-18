# Result Pattern Documentation

## Overview

The Result pattern is a functional approach to error handling that makes errors explicit in function signatures. Instead of throwing exceptions, functions return a `Result<T, E>` type that represents either success (`Ok`) or failure (`Err`).

This approach provides:

- **Explicit Error Handling**: Errors are part of the type signature
- **Type Safety**: TypeScript ensures all error cases are handled
- **Referential Transparency**: Functions are pure and predictable
- **Composability**: Chain operations using map, flatMap, and other helpers
- **No Hidden Control Flow**: No exceptions to catch or forget about

## Core Concepts

### The Result Type

A `Result<T, E>` is a discriminated union with two variants:

```typescript
type Result<T, E> = Ok<T> | Err<E>;

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err<E> {
  readonly ok: false;
  readonly error: E;
}
```

The `ok` boolean field is the discriminant, enabling TypeScript to automatically narrow types:

```typescript
const result: Result<number, string> = divide(10, 2);

if (result.ok) {
  // TypeScript knows result is Ok<number>
  console.log(result.value); // 5
} else {
  // TypeScript knows result is Err<string>
  console.error(result.error); // error message
}
```

### Creating Results

Use the `ok()` and `err()` constructor functions:

```typescript
import { ok, err } from '@regrafter/result';

// Success case
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}

// Usage
const result1 = divide(10, 2);  // Ok(5)
const result2 = divide(10, 0);  // Err('Division by zero')
```

### Type Guards

Use `isOk()` and `isErr()` to check Result variants:

```typescript
import { isOk, isErr } from '@regrafter/result';

const result = divide(10, 2);

if (isOk(result)) {
  console.log('Success:', result.value);
}

if (isErr(result)) {
  console.error('Error:', result.error);
}
```

## Helper Functions Reference

### Mapping Operations

#### map

Transforms the value inside an `Ok` variant. Passes `Err` through unchanged.

```typescript
function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E>
```

**Example:**

```typescript
import { ok, err, map } from '@regrafter/result';

// Transform a number
const result = ok(5);
const doubled = map(result, x => x * 2);
// doubled: Ok(10)

// Transform an object
const user = ok({ id: 1, name: 'Alice' });
const name = map(user, u => u.name);
// name: Ok('Alice')

// Err passes through
const error = err('Not found');
const mapped = map(error, x => x * 2);
// mapped: Err('Not found')
```

#### flatMap

Chains operations that return Results, flattening nested Results.

```typescript
function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E>
```

**Example:**

```typescript
import { flatMap } from '@regrafter/result';

function divide(a: number, b: number): Result<number, string> {
  return b === 0 ? err('Division by zero') : ok(a / b);
}

// Chain operations
const result = flatMap(
  divide(10, 2),    // Ok(5)
  x => divide(x, 2)  // Ok(2.5)
);
// result: Ok(2.5)

// First error propagates
const error1 = flatMap(
  divide(10, 0),     // Err('Division by zero')
  x => divide(x, 2)
);
// error1: Err('Division by zero')

// Second error propagates
const error2 = flatMap(
  divide(10, 2),     // Ok(5)
  x => divide(x, 0)  // Err('Division by zero')
);
// error2: Err('Division by zero')
```

#### mapErr

Transforms the error inside an `Err` variant. Passes `Ok` through unchanged.

```typescript
function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F>
```

**Example:**

```typescript
import { mapErr } from '@regrafter/result';

// Transform error message
const result = err('not found');
const mapped = mapErr(result, e => e.toUpperCase());
// mapped: Err('NOT FOUND')

// Add context to error
const error = err('File not found');
const withContext = mapErr(error, msg => ({
  code: 'E404',
  message: msg,
  timestamp: Date.now()
}));
// withContext: Err<{ code: string, message: string, timestamp: number }>

// Ok passes through
const success = ok(42);
const mapped2 = mapErr(success, e => e.toUpperCase());
// mapped2: Ok(42)
```

### Unwrapping Operations

#### unwrap

Extracts the `Ok` value or throws an error if `Err`.

```typescript
function unwrap<T, E>(result: Result<T, E>): T
```

**Warning**: This function can throw exceptions. Use with caution. Prefer `unwrapOr` or `unwrapOrElse` in production code.

**Example:**

```typescript
import { unwrap } from '@regrafter/result';

// Success case
const result = ok(42);
const value = unwrap(result);
// value: 42

// Error case - throws!
const error = err('Something went wrong');
unwrap(error);
// throws Error: Cannot unwrap Err variant: Something went wrong

// Safe usage with type guard
const result: Result<number, string> = ok(42);
if (result.ok) {
  const value = unwrap(result); // Safe - we know it's Ok
}
```

#### unwrapOr

Returns the `Ok` value or a default value if `Err`.

```typescript
function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T
```

**Example:**

```typescript
import { unwrapOr } from '@regrafter/result';

// Ok case - returns value
const result = ok(42);
const value = unwrapOr(result, 0);
// value: 42

// Err case - returns default
const error = err('Not found');
const value2 = unwrapOr(error, 0);
// value2: 0

// Practical usage
function getConfig(key: string): Result<string, string> {
  const value = process.env[key];
  return value ? ok(value) : err(`Config ${key} not found`);
}

const port = unwrapOr(getConfig('PORT'), '3000');
// port will be the config value or '3000'
```

#### unwrapOrElse

Returns the `Ok` value or computes a fallback from the error.

```typescript
function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T
```

**Example:**

```typescript
import { unwrapOrElse } from '@regrafter/result';

// Ok case - returns value
const result = ok(42);
const value = unwrapOrElse(result, () => 0);
// value: 42

// Err case - computes fallback
const error = err('Not found');
const value2 = unwrapOrElse(error, (e) => {
  console.error('Error:', e);
  return 0;
});
// value2: 0

// Using error information
type AppError = { code: string; severity: number };
const result: Result<number, AppError> = err({ code: 'E001', severity: 5 });
const value3 = unwrapOrElse(result, (error) => {
  if (error.severity > 3) {
    console.error('Critical error:', error.code);
    return -1;
  }
  return 0;
});
// value3: -1
```

### Combining Operations

#### all

Combines an array of Results into a single Result containing an array of values.

```typescript
function all<T, E>(results: Result<T, E>[]): Result<T[], E>
```

Returns `Ok` with an array of all values if all Results are `Ok`.
Returns the first `Err` if any Result is `Err`.

**Example:**

```typescript
import { all } from '@regrafter/result';

// All Ok - success
const results = [ok(1), ok(2), ok(3)];
const combined = all(results);
// combined: Ok([1, 2, 3])

// Any Err - returns first error
const results2 = [ok(1), err('error'), ok(3), err('another error')];
const combined2 = all(results2);
// combined2: Err('error')

// Empty array
const results3 = [];
const combined3 = all(results3);
// combined3: Ok([])

// Practical usage - validate multiple fields
function validateUser(data: unknown): Result<User, string> {
  const nameResult = validateName(data.name);
  const emailResult = validateEmail(data.email);
  const ageResult = validateAge(data.age);

  return flatMap(
    all([nameResult, emailResult, ageResult]),
    ([name, email, age]) => ok({ name, email, age })
  );
}
```

#### any

Returns the first `Ok` result, or all errors if all Results are `Err`.

```typescript
function any<T, E>(results: Result<T, E>[]): Result<T, E[]>
```

Returns the first `Ok` value if any Result is `Ok`.
Returns `Err` with an array of all errors if all Results are `Err`.

**Example:**

```typescript
import { any } from '@regrafter/result';

// First Ok wins
const results = [err('error 1'), ok(42), err('error 2')];
const combined = any(results);
// combined: Ok(42)

// All Err - collects all errors
const results2 = [err('error 1'), err('error 2'), err('error 3')];
const combined2 = any(results2);
// combined2: Err(['error 1', 'error 2', 'error 3'])

// Empty array
const results3 = [];
const combined3 = any(results3);
// combined3: Err([])

// Practical usage - try multiple fallback strategies
function loadConfig(): Result<Config, string> {
  return any([
    loadFromEnv(),
    loadFromFile('.env'),
    loadFromFile('config.json'),
    ok(getDefaultConfig())
  ]);
}
```

### Exception Conversion

#### tryCatch

Wraps a function that may throw an exception and converts it to a Result.

```typescript
function tryCatch<T>(fn: () => T): Result<T, Error>
```

Executes the provided function and returns `Ok` with the result if successful.
If the function throws an exception, returns `Err` with the error.

**Example:**

```typescript
import { tryCatch } from '@regrafter/result';

// Parse JSON safely
const result = tryCatch(() => JSON.parse('{"valid": true}'));
if (result.ok) {
  console.log(result.value); // { valid: true }
}

const result2 = tryCatch(() => JSON.parse('invalid json'));
if (!result2.ok) {
  console.error(result2.error.message); // Syntax error message
}

// Wrap unsafe operations
function readFileSync(path: string): Result<string, Error> {
  return tryCatch(() => fs.readFileSync(path, 'utf-8'));
}

// Convert external library exceptions
function parseXML(xml: string): Result<Document, Error> {
  return tryCatch(() => externalXMLParser.parse(xml));
}
```

#### tryCatchAsync

Wraps an async function that may throw or reject and converts it to a Promise<Result>.

```typescript
function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>>
```

Executes the provided async function and returns `Promise<Ok>` with the result if successful.
If the function throws an exception or the promise rejects, returns `Promise<Err>` with the error.

**Example:**

```typescript
import { tryCatchAsync } from '@regrafter/result';

// Fetch API safely
const result = await tryCatchAsync(async () => {
  const response = await fetch('/api/data');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
});

if (result.ok) {
  console.log('Data:', result.value);
} else {
  console.error('Fetch failed:', result.error.message);
}

// Async file operations
async function readFile(path: string): Promise<Result<string, Error>> {
  return tryCatchAsync(() => fs.promises.readFile(path, 'utf-8'));
}

// Database queries
async function findUser(id: string): Promise<Result<User, Error>> {
  return tryCatchAsync(() => db.users.findById(id));
}
```

## Async Operations Guide

When working with asynchronous code, use `Promise<Result<T, E>>` as the return type. The Result pattern provides two key async helpers: `mapAsync` and `flatMapAsync`.

### Promise<Result<T, E>> Pattern

Functions that perform async operations and can fail should return `Promise<Result<T, E>>`:

```typescript
async function fetchUser(id: number): Promise<Result<User, string>> {
  return tryCatchAsync(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error('User not found');
    return response.json();
  }).then(r => mapErr(r, e => e.message));
}
```

### mapAsync

Transforms the value inside an `Ok` variant asynchronously.

```typescript
function mapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>
): Promise<Result<U, E>>
```

**Example:**

```typescript
import { mapAsync } from '@regrafter/result';

// Transform with async operation
const userId = ok(123);
const user = await mapAsync(userId, async (id) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});
// user: Ok<User> or original Err

// Chain async transformations
const result = ok('user-123');
const transformed = await mapAsync(result, async (id) => {
  const user = await fetchUser(id);
  const profile = await fetchProfile(user.profileId);
  return { user, profile };
});

// Err passes through
const error = err('Not found');
const mapped = await mapAsync(error, async (x) => fetchData(x));
// mapped: Err('Not found')
```

### flatMapAsync

Chains async operations that return Results, flattening nested Results.

```typescript
function flatMapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>
): Promise<Result<U, E>>
```

**Example:**

```typescript
import { flatMapAsync } from '@regrafter/result';

// Chain async operations
function fetchUser(id: number): Promise<Result<User, string>> {
  return tryCatchAsync(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error('User not found');
    return response.json();
  }).then(r => mapErr(r, e => e.message));
}

const userId = ok(123);
const user = await flatMapAsync(userId, fetchUser);
// user: Ok<User> or Err<string>

// Chain multiple async operations
const result = await flatMapAsync(
  ok('user-123'),
  async (id) => {
    const userResult = await fetchUser(id);
    return flatMapAsync(userResult, async (user) => {
      const valid = await validateUser(user);
      return valid ? ok(user) : err('Invalid user');
    });
  }
);

// Err passes through
const error = err('Invalid ID');
const chained = await flatMapAsync(error, fetchUser);
// chained: Err('Invalid ID')
```

### Async Pipeline Example

Here's a complete example of chaining async operations:

```typescript
async function processUserData(userId: string): Promise<Result<ProcessedData, string>> {
  // Step 1: Fetch user
  const userResult = await tryCatchAsync(() => fetchUser(userId))
    .then(r => mapErr(r, e => `Failed to fetch user: ${e.message}`));

  // Step 2: Validate user (only if fetch succeeded)
  const validatedResult = await flatMapAsync(userResult, async (user) => {
    const isValid = await validateUser(user);
    return isValid ? ok(user) : err('User validation failed');
  });

  // Step 3: Process user data (only if validation succeeded)
  const processedResult = await mapAsync(validatedResult, async (user) => {
    const profile = await fetchProfile(user.profileId);
    const preferences = await fetchPreferences(user.id);
    return { user, profile, preferences };
  });

  return processedResult;
}

// Usage
const result = await processUserData('user-123');
if (result.ok) {
  console.log('Processed data:', result.value);
} else {
  console.error('Error:', result.error);
}
```

## Error Types in Regrafter

Regrafter uses a comprehensive error type hierarchy with discriminated unions. All error types implement the `RegraffError` union type.

### Error Type Hierarchy

```typescript
type RegraffError =
  | ParseError
  | SelectorError
  | DependencyError
  | ValidationError
  | TransformError
  | CircularError
  | InternalError;
```

Each error type has a unique `_tag` field for discrimination.

### ParseError

Represents syntax errors during file parsing.

```typescript
interface ParseError {
  readonly _tag: 'ParseError';
  readonly code: string;
  readonly message: string;
  readonly syntaxError: string;
  readonly file: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
}
```

**When it occurs:**
- Invalid JavaScript/TypeScript syntax
- Malformed JSX
- Empty source files
- Unsupported language features

**Example:**

```typescript
import { createParseError } from '@regrafter/errors';

const parseResult = parseFile('app.tsx', source);
if (!parseResult.ok) {
  const error = parseResult.error;
  // error._tag === 'ParseError'
  console.error(`Parse error in ${error.file}: ${error.syntaxError}`);
  console.error(`Suggestions: ${error.suggestions.map(s => s.description).join(', ')}`);
}
```

### SelectorError

Represents element selection failures.

```typescript
interface SelectorError {
  readonly _tag: 'SelectorError';
  readonly code: string;
  readonly message: string;
  readonly selector: Selector;
  readonly file: string;
  readonly location?: SourceLocation;
  readonly nearestMatch?: string;
  readonly suggestions: SuggestedFix[];
}
```

**When it occurs:**
- Element not found in AST
- Invalid selector syntax
- Ambiguous element matching
- Path resolution failures

**Example:**

```typescript
import { createSelectorError } from '@regrafter/errors';

const selectResult = resolveSelector(ast, selector);
if (!selectResult.ok) {
  const error = selectResult.error;
  // error._tag === 'SelectorError'
  console.error(`Element not found: ${error.selector.path}`);
  if (error.nearestMatch) {
    console.log(`Did you mean: ${error.nearestMatch}?`);
  }
}
```

### DependencyError

Represents dependency analysis failures.

```typescript
interface DependencyError {
  readonly _tag: 'DependencyError';
  readonly code: string;
  readonly message: string;
  readonly dependency: string;
  readonly file: string;
  readonly location?: SourceLocation;
  readonly dependencyChain?: string[];
  readonly suggestions: SuggestedFix[];
}
```

**When it occurs:**
- Unresolvable variable references
- Use of `eval()` or dynamic code
- Missing dependencies in scope
- Invalid dependency chains

**Example:**

```typescript
import { createDependencyError } from '@regrafter/errors';

const analyzeResult = analyzeDependencies(element);
if (!analyzeResult.ok) {
  const error = analyzeResult.error;
  // error._tag === 'DependencyError'
  console.error(`Dependency error: ${error.dependency}`);
  if (error.dependencyChain) {
    console.log(`Chain: ${error.dependencyChain.join(' -> ')}`);
  }
}
```

### ValidationError

Represents constraint violations.

```typescript
interface ValidationError {
  readonly _tag: 'ValidationError';
  readonly code: string;
  readonly message: string;
  readonly constraint: string;
  readonly file: string;
  readonly location?: SourceLocation;
  readonly validationInfo?: Record<string, unknown>;
  readonly suggestions: SuggestedFix[];
}
```

**When it occurs:**
- Hook rules violations
- Scope constraint failures
- Type validation errors
- Custom validation rules

**Example:**

```typescript
import { createValidationError } from '@regrafter/errors';

const validateResult = validateElement(element);
if (!validateResult.ok) {
  const error = validateResult.error;
  // error._tag === 'ValidationError'
  console.error(`Validation failed: ${error.constraint}`);
  console.error(error.validationInfo);
}
```

### TransformError

Represents AST transformation failures.

```typescript
interface TransformError {
  readonly _tag: 'TransformError';
  readonly code: string;
  readonly message: string;
  readonly element: string;
  readonly file: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
}
```

**When it occurs:**
- AST manipulation failures
- Code generation errors
- Invalid insertion points
- Transformation constraint violations

**Example:**

```typescript
import { createTransformError } from '@regrafter/errors';

const transformResult = transformElement(element, dependencies);
if (!transformResult.ok) {
  const error = transformResult.error;
  // error._tag === 'TransformError'
  console.error(`Transform failed for ${error.element}: ${error.message}`);
}
```

### CircularError

Represents circular dependency detection.

```typescript
interface CircularError {
  readonly _tag: 'CircularError';
  readonly code: string;
  readonly message: string;
  readonly cycle: string[];
  readonly file: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
}
```

**When it occurs:**
- Circular import chains
- Cyclic dependency graphs
- Recursive hoisting requirements

**Example:**

```typescript
import { createCircularError } from '@regrafter/errors';

const circularCheck = detectCircularDependencies(graph);
if (!circularCheck.ok) {
  const error = circularCheck.error;
  // error._tag === 'CircularError'
  console.error(`Circular dependency detected: ${error.cycle.join(' -> ')}`);
}
```

### InternalError

Represents unexpected internal errors.

```typescript
interface InternalError {
  readonly _tag: 'InternalError';
  readonly code: string;
  readonly message: string;
  readonly file: string;
  readonly location?: SourceLocation;
  readonly suggestions: SuggestedFix[];
}
```

**When it occurs:**
- Assertion failures
- Unexpected states
- Internal bugs

**Example:**

```typescript
import { createInternalError } from '@regrafter/errors';

if (unexpectedCondition) {
  return err(createInternalError({
    code: 'E999',
    message: 'Unexpected internal state',
    file: filePath,
  }));
}
```

### Using Type Guards

Use type guards to discriminate between error types:

```typescript
import { isParseError, isSelectorError } from '@regrafter/errors';

const result = processFile(filePath);
if (!result.ok) {
  const error = result.error;

  if (isParseError(error)) {
    console.error('Parse error:', error.syntaxError);
  } else if (isSelectorError(error)) {
    console.error('Selector error:', error.selector);
  } else {
    console.error('Other error:', error.message);
  }
}
```

## Common Patterns

### Early Return Pattern

The early return pattern is clear and readable:

```typescript
function processFile(filename: string, source: string): Result<Code, RegraffError> {
  const parseResult = parseFile(filename, source);
  if (!parseResult.ok) return parseResult;

  const selectorResult = resolveSelector(parseResult.value, selector);
  if (!selectorResult.ok) return selectorResult;

  const analysisResult = analyzeDependencies(selectorResult.value);
  if (!analysisResult.ok) return analysisResult;

  return transformElement(selectorResult.value, analysisResult.value);
}
```

### flatMap Chaining Pattern

For functional composition, use `flatMap` chaining:

```typescript
function processFile(filename: string, source: string): Result<Code, RegraffError> {
  return flatMap(
    parseFile(filename, source),
    (ast) => flatMap(
      resolveSelector(ast, selector),
      (element) => flatMap(
        analyzeDependencies(element),
        (deps) => transformElement(element, deps)
      )
    )
  );
}
```

### Type Aliases for Readability

Use type aliases for commonly-used Result combinations:

```typescript
// Define type aliases
type ParseResult = Result<BabelFile, ParseError>;
type SelectorResult = Result<Element, SelectorError>;
type MoveResult = Result<Move, RegraffError>;

// Use in function signatures
function parseFile(filename: string, source: string): ParseResult {
  // ...
}

function regraft(input: MoveInput): MoveResult {
  // ...
}
```

## Summary

The Result pattern provides a robust, type-safe approach to error handling:

1. **Use `ok()` and `err()`** to create Results
2. **Check with `isOk()` or `isErr()`** or use the `ok` field directly
3. **Transform with `map()`, `flatMap()`, and `mapErr()`** for functional composition
4. **Unwrap safely with `unwrapOr()` or `unwrapOrElse()`** to extract values
5. **Combine with `all()` and `any()`** to work with multiple Results
6. **Convert exceptions with `tryCatch()` and `tryCatchAsync()`** at integration boundaries
7. **Chain async operations with `mapAsync()` and `flatMapAsync()`** for asynchronous code
8. **Use discriminated unions** to handle specific error types

For more details, see:
- [Migration Guide](./migration-guide.md) - How to migrate existing code to use Results
- [Error Handling Style Guide](./error-handling-style-guide.md) - Best practices and patterns
