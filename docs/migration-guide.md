# Migration Guide: Result-Based Error Handling

## Overview

This guide explains how to migrate code from exception-based error handling to the Result pattern. The Result pattern makes error handling explicit, type-safe, and composable.

### Why the Result Pattern?

#### Problems with Exceptions

1. **Hidden Control Flow**: Exceptions aren't part of function signatures, so callers don't know what errors to expect
2. **Not Type-Safe**: TypeScript can't verify that you've handled all error cases
3. **Not Composable**: Difficult to chain operations that may fail
4. **Performance**: Exception throwing/catching can be expensive
5. **Referential Transparency**: Functions that throw are not pure

#### Benefits of Result Pattern

1. **Explicit Errors**: Function signatures declare what errors can occur
2. **Type Safety**: TypeScript ensures all error cases are handled
3. **Composability**: Easy to chain operations with `map` and `flatMap`
4. **Performance**: No exception overhead in the success path
5. **Pure Functions**: Results maintain referential transparency

### Migration Timeline

The migration to Result-based error handling is being done in phases:

- **Phase 1** (Completed): Result type system and helpers
- **Phase 2** (Completed): Error type refactoring with discriminated unions
- **Phase 3** (In Progress): Core component migration (parser, selector, analyzer, transformer)
- **Phase 4** (Planned): Strategy and support module migration
- **Phase 5** (Planned): Public API migration (breaking change)
- **Phase 6** (Planned): Final cleanup and validation

## Before and After Examples

### Example 1: Simple Error Handling

#### Before (Exception-Based)

```typescript
function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

// Usage
try {
  const result = divide(10, 2);
  console.log('Result:', result);
} catch (error) {
  console.error('Error:', error.message);
}
```

#### After (Result-Based)

```typescript
import { ok, err, type Result } from '@regrafter/result';

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}

// Usage
const result = divide(10, 2);
if (result.ok) {
  console.log('Result:', result.value);
} else {
  console.error('Error:', result.error);
}
```

**Key Changes:**
- Function returns `Result<T, E>` instead of `T`
- Errors are returned with `err()` instead of `throw`
- Success values are wrapped with `ok()`
- Callers use `if (result.ok)` instead of `try-catch`

### Example 2: Error Propagation

#### Before (Exception-Based)

```typescript
function parseAndProcess(input: string): ProcessedData {
  try {
    const parsed = JSON.parse(input);
    const validated = validate(parsed);
    return process(validated);
  } catch (error) {
    throw new Error(`Processing failed: ${error.message}`);
  }
}

// Usage
try {
  const data = parseAndProcess(input);
  console.log('Processed:', data);
} catch (error) {
  console.error('Error:', error.message);
}
```

#### After (Result-Based) - Early Return Pattern

```typescript
import { ok, err, tryCatch, type Result } from '@regrafter/result';

function parseAndProcess(input: string): Result<ProcessedData, string> {
  // Parse JSON
  const parseResult = tryCatch(() => JSON.parse(input));
  if (!parseResult.ok) {
    return err(`Parse failed: ${parseResult.error.message}`);
  }

  // Validate
  const validateResult = validate(parseResult.value);
  if (!validateResult.ok) {
    return validateResult;
  }

  // Process
  return process(validateResult.value);
}

// Usage
const result = parseAndProcess(input);
if (result.ok) {
  console.log('Processed:', result.value);
} else {
  console.error('Error:', result.error);
}
```

#### After (Result-Based) - flatMap Chaining Pattern

```typescript
import { flatMap, tryCatch, mapErr, type Result } from '@regrafter/result';

function parseAndProcess(input: string): Result<ProcessedData, string> {
  return flatMap(
    mapErr(tryCatch(() => JSON.parse(input)), e => `Parse failed: ${e.message}`),
    (parsed) => flatMap(
      validate(parsed),
      (validated) => process(validated)
    )
  );
}
```

**Key Changes:**
- `try-catch` replaced with Result returns
- Errors propagate explicitly through return values
- `tryCatch()` wraps exception-throwing code
- Choose between early return (imperative) or flatMap (functional) style

### Example 3: File Operations

#### Before (Exception-Based)

```typescript
function readAndParse(filename: string): Data {
  try {
    const content = fs.readFileSync(filename, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    throw new Error(`Failed to read ${filename}: ${error.message}`);
  }
}
```

#### After (Result-Based)

```typescript
import { flatMap, tryCatch, mapErr, type Result } from '@regrafter/result';

function readAndParse(filename: string): Result<Data, string> {
  const readResult = tryCatch(() => fs.readFileSync(filename, 'utf-8'));
  const contentResult = mapErr(readResult, e => `Failed to read ${filename}: ${e.message}`);

  return flatMap(
    contentResult,
    (content) => mapErr(
      tryCatch(() => JSON.parse(content)),
      e => `Failed to parse ${filename}: ${e.message}`
    )
  );
}

// Usage
const result = readAndParse('config.json');
if (result.ok) {
  console.log('Config:', result.value);
} else {
  console.error('Error:', result.error);
}
```

### Example 4: Async Operations

#### Before (Exception-Based)

```typescript
async function fetchUser(id: number): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const user = await response.json();
    return user;
  } catch (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
}

// Usage
try {
  const user = await fetchUser(123);
  console.log('User:', user);
} catch (error) {
  console.error('Error:', error.message);
}
```

#### After (Result-Based)

```typescript
import { tryCatchAsync, mapErr, type Result } from '@regrafter/result';

async function fetchUser(id: number): Promise<Result<User, string>> {
  const result = await tryCatchAsync(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  });

  return mapErr(result, e => `Failed to fetch user: ${e.message}`);
}

// Usage
const result = await fetchUser(123);
if (result.ok) {
  console.log('User:', result.value);
} else {
  console.error('Error:', result.error);
}
```

### Example 5: Combining Multiple Results

#### Before (Exception-Based)

```typescript
function processMultiple(files: string[]): Data[] {
  const results: Data[] = [];
  for (const file of files) {
    try {
      const data = readAndParse(file);
      results.push(data);
    } catch (error) {
      throw new Error(`Failed processing ${file}: ${error.message}`);
    }
  }
  return results;
}
```

#### After (Result-Based) - Fail-Fast with `all()`

```typescript
import { all, type Result } from '@regrafter/result';

function processMultiple(files: string[]): Result<Data[], string> {
  const results = files.map(file => readAndParse(file));
  return all(results);
}

// Usage
const result = processMultiple(['a.json', 'b.json', 'c.json']);
if (result.ok) {
  console.log('All files processed:', result.value);
} else {
  console.error('First error:', result.error);
}
```

#### After (Result-Based) - Collect All with Batch Processing

```typescript
function processMultipleBatch(files: string[]): {
  successes: Data[];
  failures: string[];
} {
  const successes: Data[] = [];
  const failures: string[] = [];

  for (const file of files) {
    const result = readAndParse(file);
    if (result.ok) {
      successes.push(result.value);
    } else {
      failures.push(`${file}: ${result.error}`);
    }
  }

  return { successes, failures };
}
```

## Public API Migration (Breaking Changes)

### Breaking Change: Result Return Type

The public API now returns `Result<T, E>` directly instead of a custom response wrapper.

#### Before (Legacy API)

```typescript
interface MoveResult {
  success: boolean;
  code?: string;
  files?: FileChange[];
  error?: {
    code: string;
    message: string;
    category: string;
    suggestions: SuggestedFix[];
  };
}

function regraft(input: MoveInput): MoveResult {
  try {
    const result = performMove(input);
    return {
      success: true,
      code: result.code,
      files: result.files,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        category: error.category,
        suggestions: error.suggestions,
      },
    };
  }
}

// Usage
const result = regraft(input);
if (result.success) {
  console.log('Code:', result.code);
} else {
  console.error('Error:', result.error.message);
}
```

#### After (New API with Result)

```typescript
import { type Result } from '@regrafter/result';
import { type Move, type RegraffError } from '@regrafter/types';

function regraft(input: MoveInput): Result<Move, RegraffError> {
  return performMove(input);
}

// Usage
const result = regraft(input);
if (result.ok) {
  console.log('Code:', result.value.code);
  console.log('Files:', result.value.files);
} else {
  console.error('Error:', result.error.message);
  console.error('Code:', result.error.code);
  console.error('Suggestions:', result.error.suggestions);
}
```

**Key Changes:**
- Return type changed from `MoveResult` to `Result<Move, RegraffError>`
- Check `result.ok` instead of `result.success`
- Success data in `result.value` instead of top-level properties
- Error data in `result.error` (RegraffError type) instead of `result.error` wrapper

### Step-by-Step Migration Instructions

#### Step 1: Update Import Statements

```typescript
// Remove old imports
// import { regraft, type MoveResult } from '@regrafter/core';

// Add new imports
import { regraft } from '@regrafter/core';
import { type Result } from '@regrafter/result';
import { type Move, type RegraffError } from '@regrafter/types';
```

#### Step 2: Update Type Annotations

```typescript
// Before
const result: MoveResult = regraft(input);

// After
const result: Result<Move, RegraffError> = regraft(input);
```

#### Step 3: Update Success Checks

```typescript
// Before
if (result.success) {
  const code = result.code;
  const files = result.files;
}

// After
if (result.ok) {
  const code = result.value.code;
  const files = result.value.files;
}
```

#### Step 4: Update Error Handling

```typescript
// Before
if (!result.success) {
  console.error(result.error.message);
  console.error(result.error.code);
  for (const suggestion of result.error.suggestions) {
    console.log(suggestion.description);
  }
}

// After
if (!result.ok) {
  console.error(result.error.message);
  console.error(result.error.code);
  for (const suggestion of result.error.suggestions) {
    console.log(suggestion.description);
  }
}
```

#### Step 5: Update Type Guards for Specific Errors

```typescript
import { isParseError, isSelectorError } from '@regrafter/errors';

const result = regraft(input);
if (!result.ok) {
  if (isParseError(result.error)) {
    console.error('Parse error:', result.error.syntaxError);
  } else if (isSelectorError(result.error)) {
    console.error('Selector error:', result.error.selector);
  } else {
    console.error('Other error:', result.error.message);
  }
}
```

### Complete Migration Example

#### Before (Legacy API)

```typescript
import { regraft, type MoveInput, type MoveResult } from '@regrafter/core';

function processMove(input: MoveInput): void {
  const result: MoveResult = regraft(input);

  if (result.success) {
    console.log('Move successful!');
    console.log('Generated code:', result.code);
    console.log('Modified files:', result.files.length);

    for (const file of result.files) {
      console.log(`  - ${file.path}: ${file.changes} changes`);
    }
  } else {
    console.error('Move failed!');
    console.error(`Error [${result.error.code}]: ${result.error.message}`);
    console.error(`Category: ${result.error.category}`);

    if (result.error.suggestions.length > 0) {
      console.log('Suggestions:');
      for (const suggestion of result.error.suggestions) {
        console.log(`  - ${suggestion.description}`);
      }
    }
  }
}
```

#### After (New API with Result)

```typescript
import { regraft, type MoveInput } from '@regrafter/core';
import { type Result } from '@regrafter/result';
import { type Move, type RegraffError } from '@regrafter/types';
import { isParseError, isSelectorError } from '@regrafter/errors';

function processMove(input: MoveInput): void {
  const result: Result<Move, RegraffError> = regraft(input);

  if (result.ok) {
    console.log('Move successful!');
    console.log('Generated code:', result.value.code);
    console.log('Modified files:', result.value.files.length);

    for (const file of result.value.files) {
      console.log(`  - ${file.path}: ${file.changes} changes`);
    }
  } else {
    console.error('Move failed!');
    console.error(`Error [${result.error.code}]: ${result.error.message}`);
    console.error(`Category: ${result.error._tag}`);

    // Use type guards for specific error handling
    if (isParseError(result.error)) {
      console.error(`Syntax error: ${result.error.syntaxError}`);
    } else if (isSelectorError(result.error)) {
      console.error(`Selector: ${result.error.selector.path}`);
      if (result.error.nearestMatch) {
        console.log(`Did you mean: ${result.error.nearestMatch}?`);
      }
    }

    if (result.error.suggestions.length > 0) {
      console.log('Suggestions:');
      for (const suggestion of result.error.suggestions) {
        console.log(`  - ${suggestion.description}`);
      }
    }
  }
}
```

## Migration Checklist

Use this checklist when migrating code to the Result pattern:

### Function Migration

- [ ] Change return type from `T` to `Result<T, E>`
- [ ] Replace `throw` statements with `return err(...)`
- [ ] Replace `return value` with `return ok(value)`
- [ ] Wrap external throwing code with `tryCatch()` or `tryCatchAsync()`
- [ ] Update JSDoc comments to document Result return type

### Call Site Migration

- [ ] Update variable types to `Result<T, E>`
- [ ] Replace `try-catch` with `if (result.ok)` checks
- [ ] Access success values through `result.value`
- [ ] Access error values through `result.error`
- [ ] Consider using `map()` or `flatMap()` for chaining

### Test Migration

- [ ] Update test assertions to check `result.ok`
- [ ] Verify `result.value` for success cases
- [ ] Verify `result.error` for error cases
- [ ] Test error propagation through Result chains
- [ ] Ensure 100% coverage of both Ok and Err paths

### Documentation Migration

- [ ] Update function documentation with Result examples
- [ ] Document what error types can be returned
- [ ] Provide migration examples for callers
- [ ] Update README and guides

## Common Migration Patterns

### Pattern 1: Wrapping External Libraries

```typescript
// Before
function parseJSON(input: string): unknown {
  return JSON.parse(input); // Can throw
}

// After
import { tryCatch, type Result } from '@regrafter/result';

function parseJSON(input: string): Result<unknown, Error> {
  return tryCatch(() => JSON.parse(input));
}
```

### Pattern 2: Converting Custom Errors

```typescript
// Before
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

function validate(data: Data): Data {
  if (!data.email) {
    throw new ValidationError('email', 'Email is required');
  }
  return data;
}

// After
import { ok, err, type Result } from '@regrafter/result';

interface ValidationError {
  field: string;
  message: string;
}

function validate(data: Data): Result<Data, ValidationError> {
  if (!data.email) {
    return err({ field: 'email', message: 'Email is required' });
  }
  return ok(data);
}
```

### Pattern 3: Chaining Validations

```typescript
import { flatMap, type Result } from '@regrafter/result';

function validateUser(data: unknown): Result<User, ValidationError> {
  return flatMap(
    validateName(data.name),
    (name) => flatMap(
      validateEmail(data.email),
      (email) => flatMap(
        validateAge(data.age),
        (age) => ok({ name, email, age })
      )
    )
  );
}
```

## Troubleshooting

### Issue: Type inference not working

**Problem:**
```typescript
const result = divide(10, 2);
// TypeScript can't infer the type
```

**Solution:**
```typescript
const result: Result<number, string> = divide(10, 2);
// Or use type aliases
type DivideResult = Result<number, string>;
const result: DivideResult = divide(10, 2);
```

### Issue: Nested Results

**Problem:**
```typescript
const result: Result<Result<number, string>, string> = // nested!
```

**Solution:**
Use `flatMap` instead of `map`:
```typescript
// Wrong: Creates nested Result
const nested = map(result1, x => divide(x, 2));

// Correct: Flattens Results
const flat = flatMap(result1, x => divide(x, 2));
```

### Issue: Mixing exceptions and Results

**Problem:**
```typescript
function process(): Result<Data, Error> {
  const result = someOp();
  if (!result.ok) return result;

  // This can throw! Mixed error handling
  return ok(JSON.parse(result.value));
}
```

**Solution:**
```typescript
import { flatMap, tryCatch } from '@regrafter/result';

function process(): Result<Data, Error> {
  return flatMap(
    someOp(),
    (value) => tryCatch(() => JSON.parse(value))
  );
}
```

## Version Information

- **Breaking Change Introduced**: v2.0.0
- **Migration Period**: v1.x supports legacy API
- **Deprecation Notice**: Legacy API removed in v2.0.0

## Additional Resources

- [Result Pattern Documentation](./result-pattern.md) - Complete guide to the Result pattern
- [Error Handling Style Guide](./error-handling-style-guide.md) - Best practices and patterns
- [API Reference](../README.md) - Full API documentation

## Getting Help

If you encounter issues during migration:

1. Check the [troubleshooting section](#troubleshooting)
2. Review [common patterns](#common-migration-patterns)
3. See [complete examples](#complete-migration-example)
4. Consult the [Result Pattern Documentation](./result-pattern.md)
5. Open an issue on GitHub with your specific case
