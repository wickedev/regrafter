# Error Handling Style Guide

## Introduction

This style guide provides best practices, recommended patterns, and common pitfalls for using the Result pattern in the Regrafter codebase. Following these guidelines ensures consistent, maintainable, and type-safe error handling throughout the project.

## Core Principles

### 1. Use Generic Result<T, E> Consistently

Always use the generic `Result<T, E>` pattern instead of creating domain-specific wrapper types.

**Do:**
```typescript
// Use generic Result with type aliases for readability
type ParseResult = Result<BabelFile, ParseError>;
type MoveResult = Result<Move, RegraffError>;

function parseFile(filename: string): Result<BabelFile, ParseError> {
  // ...
}
```

**Don't:**
```typescript
// Don't create custom wrapper types
interface ParseResult {
  success: boolean;
  ast?: BabelFile;
  error?: ParseError;
}
```

**Rationale:** Generic `Result<T, E>` allows all helper functions (map, flatMap, etc.) to work with any Result type, eliminating code duplication and ensuring consistency.

### 2. Never Throw Exceptions

Result-returning functions must never throw exceptions. All errors should be returned as `Err` variants.

**Do:**
```typescript
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}
```

**Don't:**
```typescript
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    throw new Error('Division by zero'); // NEVER throw!
  }
  return ok(a / b);
}
```

**Rationale:** Throwing exceptions defeats the purpose of the Result pattern by reintroducing hidden control flow.

### 3. Wrap External Throwing Code

Use `tryCatch()` or `tryCatchAsync()` to wrap external library code that throws exceptions.

**Do:**
```typescript
function parseJSON(input: string): Result<unknown, Error> {
  return tryCatch(() => JSON.parse(input));
}

async function fetchData(url: string): Promise<Result<Data, Error>> {
  return tryCatchAsync(async () => {
    const response = await fetch(url);
    return response.json();
  });
}
```

**Don't:**
```typescript
function parseJSON(input: string): Result<unknown, Error> {
  try {
    return ok(JSON.parse(input));
  } catch (e) {
    return err(e as Error);
  }
}
```

**Rationale:** `tryCatch` and `tryCatchAsync` are specifically designed for this purpose and handle edge cases properly.

### 4. Make Error Types Specific

Use specific error types instead of generic `Error` or `string` whenever possible.

**Do:**
```typescript
function parseFile(filename: string, source: string): Result<BabelFile, ParseError> {
  if (!source.trim()) {
    return err(createParseError({
      code: 'E004',
      message: 'Empty source file',
      syntaxError: 'Source file is empty',
      file: filename,
      suggestions: [],
    }));
  }
  // ...
}
```

**Don't:**
```typescript
function parseFile(filename: string, source: string): Result<BabelFile, string> {
  if (!source.trim()) {
    return err('Empty source file');
  }
  // ...
}
```

**Rationale:** Specific error types provide better context, enable type-safe error handling, and support better error recovery strategies.

### 5. Include Context in Errors

Always include relevant context in error objects (file paths, element identifiers, etc.).

**Do:**
```typescript
return err(createSelectorError({
  code: 'E101',
  message: `Element '${selector.path}' not found`,
  selector,
  file: filename,
  location: node.loc,
  nearestMatch: findNearestMatch(ast, selector),
  suggestions: generateSuggestions(selector),
}));
```

**Don't:**
```typescript
return err(createSelectorError({
  code: 'E101',
  message: 'Element not found',
  selector,
  file: '',
  suggestions: [],
}));
```

**Rationale:** Rich error context helps users understand and fix issues quickly.

## Recommended Patterns

### Pattern 1: Early Return for Readability

For imperative code style, use early returns to check Results.

```typescript
function processFile(filename: string, source: string): Result<Code, RegraffError> {
  // Parse the file
  const parseResult = parseFile(filename, source);
  if (!parseResult.ok) return parseResult;

  // Resolve selector
  const selectorResult = resolveSelector(parseResult.value, selector);
  if (!selectorResult.ok) return selectorResult;

  // Analyze dependencies
  const analysisResult = analyzeDependencies(selectorResult.value);
  if (!analysisResult.ok) return analysisResult;

  // Transform element
  return transformElement(selectorResult.value, analysisResult.value);
}
```

**When to use:**
- Linear, step-by-step processing
- Each step depends on the previous step
- Code reads like a procedural algorithm
- You want maximum readability for imperative-style code

**Advantages:**
- Very readable for developers familiar with imperative code
- Clear control flow
- Easy to debug with breakpoints
- Low cognitive overhead

### Pattern 2: flatMap Chaining for Composition

For functional code style, use `flatMap` to chain operations.

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

**When to use:**
- Functional programming style preferred
- Operations can be easily composed
- You want to emphasize function composition
- Chain needs to be reusable

**Advantages:**
- Functional and composable
- No intermediate variables
- Clearly shows data transformation pipeline
- Easy to refactor into smaller functions

### Pattern 3: Combining Multiple Results

Use `all()` when all operations must succeed, or process individually when you need to collect errors.

#### All Must Succeed (Fail-Fast)

```typescript
import { all } from '@regrafter/result';

function validateInputs(inputs: Input[]): Result<ValidInput[], ValidationError> {
  const results = inputs.map(input => validateInput(input));
  return all(results); // Returns first error or all successes
}
```

#### Collect All Results (Batch Processing)

```typescript
function processInputsBatch(inputs: Input[]): {
  successes: Output[];
  failures: Array<{ input: Input; error: Error }>;
} {
  const successes: Output[] = [];
  const failures: Array<{ input: Input; error: Error }> = [];

  for (const input of inputs) {
    const result = processInput(input);
    if (result.ok) {
      successes.push(result.value);
    } else {
      failures.push({ input, error: result.error });
    }
  }

  return { successes, failures };
}
```

**When to use all():**
- All inputs must be valid before proceeding
- First error is sufficient (fail-fast)
- Operation is transactional

**When to use batch processing:**
- Need to report all errors, not just the first
- Partial success is acceptable
- Users need to see all validation errors at once

### Pattern 4: Type Aliases for Readability

Use type aliases for commonly-used Result combinations to improve readability.

```typescript
// Define type aliases for frequently-used combinations
type ParseResult = Result<BabelFile, ParseError>;
type SelectorResult = Result<Element, SelectorError>;
type AnalysisResult = Result<Dependencies, DependencyError>;
type TransformResult = Result<Code, TransformError>;
type MoveResult = Result<Move, RegraffError>;

// Use in function signatures
function parseFile(filename: string, source: string): ParseResult {
  // ...
}

function resolveSelector(ast: BabelFile, selector: Selector): SelectorResult {
  // ...
}

// Or use explicit Result<T, E> for maximum clarity
function regraft(input: MoveInput): Result<Move, RegraffError> {
  // ...
}
```

**When to use type aliases:**
- Result combination is used frequently
- Domain-specific naming improves code readability
- You want to reduce visual noise in signatures

**When to use explicit Result<T, E>:**
- One-off or rarely used combinations
- Maximum clarity is desired
- Type alias doesn't add meaningful information

### Pattern 5: Error Transformation with mapErr

Use `mapErr()` to transform error types or add context.

```typescript
import { mapErr, tryCatch } from '@regrafter/result';

function loadConfig(path: string): Result<Config, AppError> {
  // Parse JSON (returns Result<unknown, Error>)
  const parseResult = tryCatch(() =>
    JSON.parse(fs.readFileSync(path, 'utf-8'))
  );

  // Transform Error to AppError
  const configResult = mapErr(parseResult, (error) => ({
    code: 'E500',
    message: `Failed to load config from ${path}`,
    cause: error,
    severity: 'high',
  }));

  // Continue processing...
  return flatMap(configResult, (data) => validateConfig(data));
}
```

**When to use mapErr:**
- Converting between error types
- Adding context to errors
- Standardizing error format
- Enriching error information

### Pattern 6: Async Result Chaining

Use `mapAsync` and `flatMapAsync` for asynchronous operations.

```typescript
import { flatMapAsync, mapAsync } from '@regrafter/result';

async function processUser(userId: string): Promise<Result<ProcessedUser, string>> {
  // Start with a Result
  const userIdResult = validateUserId(userId);

  // Chain async operations
  const userResult = await flatMapAsync(
    userIdResult,
    async (id) => {
      const fetchResult = await fetchUser(id);
      return fetchResult;
    }
  );

  // Transform asynchronously
  const enrichedResult = await mapAsync(
    userResult,
    async (user) => {
      const profile = await fetchProfile(user.profileId);
      return { ...user, profile };
    }
  );

  return enrichedResult;
}
```

**Key points:**
- Functions return `Promise<Result<T, E>>`
- Use `flatMapAsync` for operations returning `Promise<Result>`
- Use `mapAsync` for operations returning `Promise<T>`
- Errors propagate through the chain

## Common Pitfalls

### Pitfall 1: Forgetting to Check Result

**Wrong:**
```typescript
const result = divide(10, 2);
console.log(result.value); // Type error! result might be Err
```

**Correct:**
```typescript
const result = divide(10, 2);
if (result.ok) {
  console.log(result.value); // Safe - TypeScript knows it's Ok
} else {
  console.error(result.error);
}
```

### Pitfall 2: Creating Nested Results

**Wrong:**
```typescript
const result = map(divide(10, 2), x => divide(x, 2));
// Type: Result<Result<number, string>, string> - nested!
```

**Correct:**
```typescript
const result = flatMap(divide(10, 2), x => divide(x, 2));
// Type: Result<number, string> - flat!
```

**Rule:** Use `flatMap` when the transformation function returns a Result, use `map` when it returns a plain value.

### Pitfall 3: Mixing Exceptions and Results

**Wrong:**
```typescript
function processData(input: string): Result<Data, Error> {
  const parseResult = parseJSON(input);
  if (!parseResult.ok) return parseResult;

  // This can throw! Mixed error handling
  const transformed = transform(parseResult.value);
  return ok(transformed);
}
```

**Correct:**
```typescript
function processData(input: string): Result<Data, Error> {
  return flatMap(
    parseJSON(input),
    (data) => tryCatch(() => transform(data))
  );
}
```

**Rule:** Always use `tryCatch` or `tryCatchAsync` for operations that might throw.

### Pitfall 4: Using unwrap() in Production

**Wrong:**
```typescript
function getConfig(): Config {
  const result = loadConfig();
  return unwrap(result); // Can throw!
}
```

**Correct:**
```typescript
function getConfig(): Config {
  const result = loadConfig();
  return unwrapOr(result, DEFAULT_CONFIG); // Safe
}

// Or keep Result
function getConfig(): Result<Config, Error> {
  return loadConfig(); // Let caller handle error
}
```

**Rule:** Only use `unwrap()` in tests or when you're absolutely certain the Result is Ok (e.g., after an `if (result.ok)` check).

### Pitfall 5: Ignoring Error Context

**Wrong:**
```typescript
return err(createParseError({
  code: 'E001',
  message: 'Parse error',
  syntaxError: error.message,
  file: '',  // Missing context!
  suggestions: [],  // No suggestions!
}));
```

**Correct:**
```typescript
return err(createParseError({
  code: 'E001',
  message: `Failed to parse ${filename}`,
  syntaxError: error.message,
  file: filename,
  location: error.loc,
  suggestions: generateParseSuggestions(error),
}));
```

**Rule:** Always include file paths, locations, and suggestions when available.

### Pitfall 6: Not Using Type Guards

**Wrong:**
```typescript
if (!result.ok) {
  // Access error properties without type narrowing
  console.log(result.error.syntaxError); // Might not exist!
}
```

**Correct:**
```typescript
import { isParseError, isSelectorError } from '@regrafter/errors';

if (!result.ok) {
  if (isParseError(result.error)) {
    console.log(result.error.syntaxError); // Safe - TypeScript knows it's ParseError
  } else if (isSelectorError(result.error)) {
    console.log(result.error.selector); // Safe - TypeScript knows it's SelectorError
  }
}
```

**Rule:** Use type guards when you need to access error-specific properties.

### Pitfall 7: Over-Chaining with flatMap

**Wrong:**
```typescript
// Hard to read - too deeply nested
return flatMap(a, (x) =>
  flatMap(b(x), (y) =>
    flatMap(c(y), (z) =>
      flatMap(d(z), (w) =>
        e(w)
      )
    )
  )
);
```

**Correct:**
```typescript
// Use early return for better readability
const resultX = a;
if (!resultX.ok) return resultX;

const resultY = b(resultX.value);
if (!resultY.ok) return resultY;

const resultZ = c(resultY.value);
if (!resultZ.ok) return resultZ;

const resultW = d(resultZ.value);
if (!resultW.ok) return resultW;

return e(resultW.value);
```

**Rule:** If flatMap chains become deeply nested (>3 levels), consider using early return pattern instead.

## Do's and Don'ts Summary

### Do's

- **Do** use `Result<T, E>` for all fallible operations
- **Do** use `ok()` for success and `err()` for errors
- **Do** check `result.ok` before accessing `result.value`
- **Do** use `tryCatch()` for external throwing code
- **Do** use `flatMap()` to chain Result-returning operations
- **Do** use `mapErr()` to transform error types
- **Do** include rich context in error objects
- **Do** use type guards for error discrimination
- **Do** use type aliases for commonly-used Result combinations
- **Do** use early return pattern for imperative code
- **Do** use flatMap chaining for functional code
- **Do** provide suggestions in all error types
- **Do** test both Ok and Err paths

### Don'ts

- **Don't** throw exceptions in Result-returning functions
- **Don't** create custom wrapper types (use `Result<T, E>`)
- **Don't** use `unwrap()` in production code
- **Don't** forget to handle Err cases
- **Don't** create nested Results (use `flatMap`)
- **Don't** mix exceptions and Results
- **Don't** use generic error types (prefer specific types)
- **Don't** omit error context (file paths, locations)
- **Don't** over-chain flatMap (use early return instead)
- **Don't** access `result.value` without checking `result.ok`
- **Don't** access `result.error` without checking `!result.ok`
- **Don't** forget to add suggestions to errors

## Code Review Checklist

When reviewing code that uses Results, check for:

- [ ] All fallible functions return `Result<T, E>`
- [ ] No `throw` statements in Result-returning functions
- [ ] External throwing code is wrapped with `tryCatch` or `tryCatchAsync`
- [ ] `result.ok` is checked before accessing `result.value`
- [ ] Specific error types are used (not `Error` or `string`)
- [ ] Error objects include file paths and locations
- [ ] Error objects include suggestions when applicable
- [ ] `flatMap` is used for chaining Result-returning operations
- [ ] `map` is used for chaining value-returning operations
- [ ] No nested Results (`Result<Result<...>>`)
- [ ] No use of `unwrap()` in production code
- [ ] Type guards are used for error discrimination
- [ ] Both Ok and Err paths are tested
- [ ] Documentation includes Result examples
- [ ] Type aliases are defined for commonly-used combinations

## Testing Guidelines

### Test Both Paths

Always test both success and error paths for Result-returning functions.

```typescript
describe('divide', () => {
  it('should return Ok for valid division', () => {
    const result = divide(10, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(5);
    }
  });

  it('should return Err for division by zero', () => {
    const result = divide(10, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Division by zero');
    }
  });
});
```

### Test Error Types

Verify error types and context in error cases.

```typescript
import { isParseError } from '@regrafter/errors';

it('should return ParseError for invalid syntax', () => {
  const result = parseFile('test.tsx', 'const x =');
  expect(result.ok).toBe(false);

  if (!result.ok) {
    expect(isParseError(result.error)).toBe(true);
    if (isParseError(result.error)) {
      expect(result.error.code).toBe('E001');
      expect(result.error.file).toBe('test.tsx');
      expect(result.error.syntaxError).toContain('Unexpected token');
      expect(result.error.suggestions.length).toBeGreaterThan(0);
    }
  }
});
```

### Test Error Propagation

Verify that errors propagate correctly through Result chains.

```typescript
it('should propagate parse errors through the pipeline', () => {
  const result = processFile('test.tsx', 'invalid syntax');
  expect(result.ok).toBe(false);

  if (!result.ok) {
    expect(isParseError(result.error)).toBe(true);
  }
});
```

## Performance Considerations

### Result Creation is Cheap

Creating Result objects has minimal overhead:

```typescript
// These are fast operations
const ok1 = ok(42);
const err1 = err('error');
```

### Prefer Early Return for Performance

Early return can be slightly faster than flatMap chains for long pipelines:

```typescript
// Slightly faster for long chains
function process(): Result<T, E> {
  const r1 = step1();
  if (!r1.ok) return r1;

  const r2 = step2(r1.value);
  if (!r2.ok) return r2;

  const r3 = step3(r2.value);
  if (!r3.ok) return r3;

  return step4(r3.value);
}
```

### Avoid Excessive unwrapOr in Loops

```typescript
// Inefficient - creates default values every iteration
for (const item of items) {
  const value = unwrapOr(processItem(item), createDefault());
}

// Better - check once and handle
const results = items.map(processItem);
const values = results.filter(r => r.ok).map(r => r.value);
```

## Additional Resources

- [Result Pattern Documentation](./result-pattern.md) - Complete guide to the Result pattern
- [Migration Guide](./migration-guide.md) - How to migrate existing code to use Results
- [API Reference](../README.md) - Full API documentation

## Summary

Following these guidelines ensures:

1. **Consistency** - All code uses Result pattern uniformly
2. **Type Safety** - TypeScript catches error handling bugs
3. **Readability** - Code clearly shows success and error paths
4. **Maintainability** - Easy to understand and modify
5. **Reliability** - Explicit error handling reduces bugs

When in doubt, refer to existing code in the codebase or consult the [Result Pattern Documentation](./result-pattern.md).
