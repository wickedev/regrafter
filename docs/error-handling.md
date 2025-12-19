# Error Handling

Regrafter provides comprehensive error handling with structured error types, recovery suggestions, and a Result monad pattern.

## Error Handling Philosophy

Regrafter **never throws exceptions** from its public APIs. Instead, all operations return a `Result<T, RegraffError>` that explicitly represents success or failure.

This approach:
- Makes error paths explicit and type-safe
- Forces callers to handle errors
- Enables better composition and error recovery
- Prevents uncaught exceptions

## Basic Error Handling

```typescript
import { move, Move, isOk, isErr } from 'regrafter';

const result = move(files, from, to, Move.Inside);

if (isOk(result)) {
  // Success path
  const codes = result.value;
  console.log('Transformed:', codes);
} else {
  // Error path
  const error = result.error;
  console.error('Move failed:', error.message);
  console.error('Error code:', error.code);
}
```

## RegraffError Structure

All errors are instances of `RegraffError` with rich metadata:

```typescript
interface RegraffError {
  code: string;              // Error code (e.g., 'E020')
  message: string;           // Human-readable message
  category: ErrorCategory;   // Error category
  suggestions: SuggestedFix[]; // Recovery suggestions
  context?: Record<string, unknown>; // Additional context
  stack?: string;            // Stack trace
}
```

## Error Categories

Errors are organized into categories:

```typescript
enum ErrorCategory {
  Parse = 'Parse',
  Selector = 'Selector',
  Dependency = 'Dependency',
  Validation = 'Validation',
  Circular = 'Circular',
  Transform = 'Transform',
  Internal = 'Internal'
}
```

### Parse Errors (E001-E009)

File parsing failures due to syntax errors.

```typescript
import { isParseError } from 'regrafter';

if (isErr(result) && isParseError(result.error)) {
  console.error('Syntax error in file:', result.error.context?.file);
  console.error('Line:', result.error.context?.line);
  console.error('Column:', result.error.context?.column);
}
```

**Common codes:**
- `E001`: Syntax error in source file
- `E002`: Invalid JSX syntax
- `E003`: TypeScript parsing error

---

### Selector Errors (E010-E019)

Element selection failures.

```typescript
import { isSelectorError } from 'regrafter';

if (isErr(result) && isSelectorError(result.error)) {
  const error = result.error;

  if (error.code === 'E010') {
    console.error('Element not found at position');
  } else if (error.code === 'E011') {
    console.error('Path does not point to valid element');
  } else if (error.code === 'E012') {
    console.error('Ambiguous selection - multiple elements match');
  }
}
```

**Common codes:**
- `E010`: Element not found
- `E011`: Invalid AST path
- `E012`: Ambiguous selection
- `E013`: Selected node is not movable

---

### Dependency Errors (E020-E029)

Unresolvable dependency issues.

```typescript
import { isDependencyError } from 'regrafter';

if (isErr(result) && isDependencyError(result.error)) {
  console.error('Dependency issue:', result.error.message);
  console.error('Affected symbols:', result.error.context?.symbols);

  // Check suggested fixes
  for (const fix of result.error.suggestions) {
    console.log('Suggestion:', fix.description);
    if (fix.automatic) {
      console.log('  (can be auto-fixed)');
    }
  }
}
```

**Common codes:**
- `E020`: Unresolvable dependency
- `E021`: Missing import
- `E022`: Context provider not found
- `E023`: Ref forwarding not possible

---

### Validation Errors (E030-E039)

Constraint violations (React Hook rules, invalid moves).

```typescript
import { isValidationError } from 'regrafter';

if (isErr(result) && isValidationError(result.error)) {
  const error = result.error;

  if (error.code === 'E030') {
    console.error('Hook rules violation');
    console.error('Hook:', error.context?.hookName);
    console.error('Reason:', error.message);
  } else if (error.code === 'E031') {
    console.error('Cannot move element to this location');
  } else if (error.code === 'E032') {
    console.error('Self-move detected');
  }
}
```

**Common codes:**
- `E030`: Hook rules violation
- `E031`: Invalid move target
- `E032`: Self-move (from === to)
- `E033`: Move would break component hierarchy

---

### Circular Errors (E040-E049)

Circular dependency detection.

```typescript
import { isCircularError } from 'regrafter';

if (isErr(result) && isCircularError(result.error)) {
  console.error('Circular dependency:', result.error.message);
  console.error('Cycle:', result.error.context?.cycle);

  // Regrafter may auto-create shared modules to break cycles
  for (const fix of result.error.suggestions) {
    if (fix.automatic) {
      console.log('Auto-fix:', fix.description);
    }
  }
}
```

**Common codes:**
- `E040`: Circular dependency detected
- `E041`: Cannot resolve circular import

---

### Transform Errors (E050-E059)

AST transformation failures.

```typescript
import { isTransformError } from 'regrafter';

if (isErr(result) && isTransformError(result.error)) {
  console.error('Transformation failed:', result.error.message);
  console.error('Operation:', result.error.context?.operation);
}
```

**Common codes:**
- `E050`: AST mutation failed
- `E051`: Code generation failed
- `E052`: Invalid AST structure

---

### Internal Errors (E090-E099)

Internal consistency errors (should not occur in production).

```typescript
import { isInternalError } from 'regrafter';

if (isErr(result) && isInternalError(result.error)) {
  console.error('Internal error:', result.error.message);
  console.error('Please report this issue');
  console.error('Stack:', result.error.stack);
}
```

**Common codes:**
- `E090`: Unexpected internal state
- `E091`: Invariant violation

---

## Error Type Guards

Use type guards to handle specific error types:

```typescript
import {
  isParseError,
  isSelectorError,
  isDependencyError,
  isValidationError,
  isCircularError,
  isTransformError,
  isInternalError
} from 'regrafter';

if (isErr(result)) {
  const error = result.error;

  if (isParseError(error)) {
    // Handle parsing errors
  } else if (isSelectorError(error)) {
    // Handle selection errors
  } else if (isDependencyError(error)) {
    // Handle dependency errors
  } else if (isValidationError(error)) {
    // Handle validation errors
  }
}
```

---

## Suggested Fixes

Every error includes suggested fixes:

```typescript
interface SuggestedFix {
  description: string;  // What to do
  action?: string;      // Specific action to take
  automatic: boolean;   // Whether Regrafter can auto-fix
}
```

**Example:**

```typescript
if (isErr(result)) {
  for (const fix of result.error.suggestions) {
    console.log(`Suggestion: ${fix.description}`);

    if (fix.action) {
      console.log(`  Action: ${fix.action}`);
    }

    if (fix.automatic) {
      console.log('  (This can be automatically fixed)');
    }
  }
}
```

---

## Error Recovery

Some errors are recoverable:

```typescript
import { isRecoverable, attemptRecovery } from 'regrafter';

try {
  const result = move(files, from, to, Move.Inside);

  if (isErr(result)) {
    const error = result.error;

    if (isRecoverable(error)) {
      console.log('Error is recoverable, attempting recovery...');

      const recovery = await attemptRecovery(error);

      if (recovery.success) {
        console.log('Recovery successful:', recovery.result);

        if (recovery.warnings) {
          console.warn('Warnings:', recovery.warnings);
        }
      } else {
        console.error('Recovery failed:', recovery.reason);
      }
    }
  }
} catch (error) {
  // attemptRecovery may throw for unrecoverable errors
  console.error('Unrecoverable error:', error);
}
```

**Recovery Result:**

```typescript
interface RecoveryResult {
  success: boolean;
  result?: any;
  warnings?: string[];
  reason?: string;
}
```

---

## Error Formatting

Errors provide formatted output:

```typescript
if (isErr(result)) {
  // Get formatted error string
  const formatted = result.error.toFormattedString();
  console.error(formatted);

  // Example output:
  // [E020] Unresolvable dependency
  //
  // Cannot move element: dependency 'useState' cannot be hoisted
  //
  // Suggestions:
  //   - Move the element to a location within the same component
  //   - Extract the dependency into a separate component
  //
  // Context:
  //   file: App.tsx
  //   dependency: useState
  //   type: Hook
  //
  // Stack trace:
  //   at DependencyAnalyzer.analyze (...)
  //   ...
}
```

---

## Error Context

Errors include rich context for debugging:

```typescript
if (isErr(result)) {
  const error = result.error;

  console.log('Error code:', error.code);
  console.log('Message:', error.message);
  console.log('Category:', error.category);

  if (error.context) {
    console.log('File:', error.context.file);
    console.log('Line:', error.context.line);
    console.log('Column:', error.context.column);
    console.log('Symbol:', error.context.symbol);
    console.log('Additional:', error.context);
  }
}
```

---

## Working with Result Monad

### Chaining Operations

```typescript
import { map, flatMap, isOk } from 'regrafter';

// Transform success value
const result1 = move(files, from, to, Move.Inside);
const result2 = map(result1, codes =>
  codes.filter(c => c.changed)
);

// Chain dependent operations
const result3 = flatMap(result2, codes =>
  optimize(codes)
);
```

### Error Transformation

```typescript
import { mapErr } from 'regrafter';

const result = move(files, from, to, Move.Inside);

// Transform error to different type
const customResult = mapErr(result, error => ({
  type: 'MOVE_FAILED',
  originalError: error,
  timestamp: Date.now()
}));
```

### Extracting Values

```typescript
import { unwrap, unwrapOr, unwrapOrElse } from 'regrafter';

const result = move(files, from, to, Move.Inside);

// Unwrap (throws if error)
try {
  const codes = unwrap(result);
} catch (error) {
  console.error('Unwrap failed:', error);
}

// Unwrap with default
const codes = unwrapOr(result, []);

// Unwrap with function
const codes = unwrapOrElse(result, error => {
  console.error('Move failed:', error);
  return [];
});
```

### Combining Results

```typescript
import { all, any } from 'regrafter';

const results = [
  move(files, from1, to1, Move.Inside),
  move(files, from2, to2, Move.After),
  move(files, from3, to3, Move.Before)
];

// All must succeed
const allResult = all(results);
if (isOk(allResult)) {
  console.log('All moves succeeded');
}

// At least one must succeed
const anyResult = any(results);
if (isOk(anyResult)) {
  console.log('At least one move succeeded');
}
```

---

## Input Validation

Validate inputs before operations:

```typescript
import {
  validateRegraftInput,
  assertRegraftInput,
  InputValidationError
} from 'regrafter/validation';

// Validate without throwing
const validation = validateRegraftInput(files, from, to, mode, options);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  for (const error of validation.errors) {
    console.error(`  ${error.path}: ${error.message}`);
  }
} else {
  // Inputs are valid, proceed
  const result = move(files, from, to, mode, options);
}

// Assert and throw on failure
try {
  assertRegraftInput(files, from, to, mode, options);
  // Inputs are valid
} catch (error) {
  if (error instanceof InputValidationError) {
    console.error(`Parameter '${error.parameterName}' is invalid`);
    console.error('Errors:', error.validationErrors);
  }
}
```

---

## Best Practices

1. **Always check Result type**
   ```typescript
   if (isOk(result)) {
     // Use result.value
   } else {
     // Handle result.error
   }
   ```

2. **Use type guards for specific errors**
   ```typescript
   if (isErr(result) && isValidationError(result.error)) {
     // Handle validation errors specifically
   }
   ```

3. **Check error suggestions**
   ```typescript
   if (isErr(result)) {
     for (const fix of result.error.suggestions) {
       // Present suggestions to user
     }
   }
   ```

4. **Validate inputs early**
   ```typescript
   const validation = validateRegraftInput(...);
   if (!validation.valid) {
     // Show validation errors before attempting operation
   }
   ```

5. **Use canMove() for quick checks**
   ```typescript
   if (canMove(files, from, to, Move.Inside)) {
     // Proceed with confidence
   }
   ```

6. **Chain operations safely**
   ```typescript
   const result = flatMap(
     move(files, from, to, Move.Inside),
     codes => optimize(codes)
   );
   ```

7. **Provide fallback values**
   ```typescript
   const codes = unwrapOr(result, []);
   ```
