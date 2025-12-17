# Regrafter Error Code Reference

This document provides detailed information about all error codes in Regrafter.

## Error Code Format

Error codes follow the format `EXXX` where:
- E001-E009: Parse errors
- E010-E019: Selector errors
- E020-E029: Dependency errors
- E030-E039: Validation errors
- E040-E049: Circular dependency errors
- E050-E059: Transform errors
- E090-E099: Internal errors

## Parse Errors (E001-E009)

### E001 - General Parse Error

**Message:** `Failed to parse {file}: {message}`

**Description:** The file could not be parsed due to a syntax error.

**Causes:**
- Invalid JavaScript/TypeScript syntax
- Malformed JSX
- Encoding issues

**Solutions:**
- Check the file for syntax errors
- Ensure the file uses valid JSX/TSX syntax
- Verify the file encoding is UTF-8

### E002 - Unexpected Token

**Message:** `Unexpected token at {file}:{line}:{column}`

**Description:** The parser encountered an unexpected token.

**Causes:**
- Missing or extra punctuation (brackets, parentheses, commas)
- Invalid operator usage
- Incomplete statements

**Solutions:**
- Review the code at the specified location
- Check for missing closing brackets or parentheses
- Verify statement completion

### E003 - Unterminated String

**Message:** `Unterminated string literal in {file} at line {line}`

**Description:** A string literal was not properly closed.

**Causes:**
- Missing closing quote
- Unescaped quotes within string
- Multi-line string without proper template syntax

**Solutions:**
- Add the missing closing quote
- Use template literals (\`\`) for multi-line strings
- Escape internal quotes properly

### E004 - Invalid JSX Syntax

**Message:** `Invalid JSX syntax in {file}: {message}`

**Description:** JSX-specific syntax error.

**Causes:**
- Unclosed JSX elements
- Invalid JSX attribute syntax
- Missing JSX closing tags

**Solutions:**
- Ensure all JSX elements have closing tags or are self-closing
- Verify JSX attribute syntax (use camelCase, proper quoting)
- Check JSX expression syntax

### E005 - TypeScript Syntax Error

**Message:** `TypeScript syntax error in {file}: {message}`

**Description:** TypeScript-specific syntax error.

**Causes:**
- Invalid type annotations
- Incorrect generic syntax
- Type-only features in wrong positions

**Solutions:**
- Verify type annotation syntax
- Check generic parameter syntax
- Ensure type imports use `import type`

---

## Selector Errors (E010-E019)

### E010 - No JSX Element at Position

**Message:** `No JSX element found at {file}:{line}:{column}`

**Description:** The position selector did not resolve to a JSX element.

**Causes:**
- Position is outside JSX element boundaries
- Position points to non-JSX code
- Position is at whitespace

**Solutions:**
- Adjust the selector position to be within a JSX element
- Use the analyze API to find valid positions
- Verify the file content matches expected structure

### E011 - Invalid AST Path

**Message:** `Invalid AST path: {path}`

**Description:** The AST path selector is malformed or doesn't exist.

**Causes:**
- Typos in the path string
- Path refers to non-existent nodes
- Array index out of bounds

**Solutions:**
- Use position selector instead
- Verify the AST structure of the file
- Check array indices in the path

### E012 - File Not in Input

**Message:** `File not in input: {file}`

**Description:** The selector references a file not provided in the input.

**Causes:**
- Typo in file path
- Missing file in the files array
- Cross-file reference without including target file

**Solutions:**
- Add the referenced file to the files array
- Verify file path spelling
- Include all relevant files for cross-file operations

### E013 - Element Not Movable

**Message:** `Element at position is not movable: {reason}`

**Description:** The selected element cannot be moved due to constraints.

**Causes:**
- Element is a root component
- Element is part of a Fragment with special semantics
- Element has immovable dependencies

**Solutions:**
- Extract the element to a component first
- Consider the suggested alternatives
- Review the reason provided in the error

### E014 - Same Source and Target

**Message:** `Source and target selectors point to the same element`

**Description:** The move operation would be a no-op.

**Causes:**
- Selector positions resolve to the same element
- Accidental duplicate selectors

**Solutions:**
- Specify different source and target locations
- Verify selector positions are distinct

### E015 - Move Into Self

**Message:** `Cannot move element into itself or its descendants`

**Description:** Attempted to move an element inside its own subtree.

**Causes:**
- Target element is a child of source element
- Circular move structure

**Solutions:**
- Choose a target outside the source element's subtree
- Consider restructuring the component hierarchy

---

## Dependency Errors (E020-E029)

### E020 - eval() Detected

**Message:** `Cannot analyze: eval() detected at {file}:{line}:{column}`

**Description:** Code contains `eval()` which prevents static analysis.

**Causes:**
- Use of `eval()` function
- Dynamic code generation

**Solutions:**
- Remove eval() usage
- Use JSON.parse() for JSON strings
- Consider safer alternatives

**Recoverable:** No

### E021 - Dynamic Code Execution

**Message:** `Cannot analyze: dynamic code execution at {file}:{line}:{column}`

**Description:** Code contains dynamic code execution patterns.

**Causes:**
- `new Function()` usage
- Dynamic property access with computed values
- Indirect eval

**Solutions:**
- Refactor to static patterns
- Use mapping objects instead of dynamic access

**Recoverable:** No

### E022 - Unresolvable Reference

**Message:** `Unresolvable external reference: {symbol} in {file}`

**Description:** Reference to undefined or external symbol.

**Causes:**
- Missing import
- Undefined variable
- External/global reference

**Solutions:**
- Add the missing import
- Define the symbol
- Verify the import source

**Recoverable:** Yes - can add import automatically

### E023 - Dependency Cycle

**Message:** `Dependency cycle detected in {symbol}: {cycle}`

**Description:** Circular dependency chain detected.

**Causes:**
- Mutual dependencies between symbols
- Circular import patterns

**Solutions:**
- Extract shared dependencies to a common module
- Refactor to break the cycle

**Recoverable:** Yes - can create shared module

### E024 - Cannot Determine Scope

**Message:** `Cannot determine scope for {symbol}`

**Description:** Unable to determine the scope of a dependency.

**Causes:**
- Dynamic scoping patterns
- Unusual code structure
- Analysis limitations

**Solutions:**
- Ensure clear lexical scoping
- Refactor for clearer scope boundaries

**Recoverable:** No

---

## Validation Errors (E030-E039)

### E030 - Hook in Conditional

**Message:** `Cannot hoist Hook "{hook}" to conditional scope`

**Description:** Hook would be placed inside conditional, violating Rules of Hooks.

**Causes:**
- Target location is inside if/else block
- Target component is conditionally rendered

**Solutions:**
- Move the hook outside the conditional
- Create a custom hook
- Extract to separate component

**Recoverable:** Yes - can restructure automatically

### E031 - Hook in Loop

**Message:** `Cannot hoist Hook "{hook}" to loop scope`

**Description:** Hook would be placed inside loop, violating Rules of Hooks.

**Causes:**
- Target location is inside a loop
- Hook usage in map callback

**Solutions:**
- Move the hook outside the loop
- Extract loop iteration to separate component

**Recoverable:** Yes - can restructure automatically

### E032 - Hook Rules Violation

**Message:** `Move would violate React Hook rules for "{hook}"`

**Description:** The move operation would result in invalid Hook usage.

**Causes:**
- Conditional hook call would be created
- Hook order would change inconsistently

**Solutions:**
- Restructure to maintain hook rules
- Extract to custom hook
- Use different target location

**Recoverable:** Yes - partial restructuring possible

### E033 - Hook Outside Component

**Message:** `Cannot move Hook call outside of React component or custom Hook`

**Description:** Hook must remain within component or custom Hook scope.

**Causes:**
- Target is not a React component
- Target is a utility function

**Solutions:**
- Move to a valid component scope
- Create a custom hook wrapper

**Recoverable:** No

### E034 - Invalid Target Scope

**Message:** `Invalid target scope for dependency "{symbol}"`

**Description:** Target scope cannot accept the dependency.

**Causes:**
- Scope type mismatch
- Incompatible dependency type for target

**Solutions:**
- Choose different target location
- Convert dependency to prop

**Recoverable:** No

### E035 - Props Threading Depth Exceeded

**Message:** `Props threading depth exceeds maximum ({depth} > {max})`

**Description:** Too many intermediate components for prop threading.

**Causes:**
- Deep component hierarchy
- Many intermediate components

**Solutions:**
- Use React Context instead
- Consider state management library
- Restructure component hierarchy

**Recoverable:** Yes - can create Context automatically

---

## Circular Dependency Errors (E040-E049)

### E040 - Circular Dependency

**Message:** `Circular dependency detected: {cycle}`

**Description:** Move would create circular dependency between symbols.

**Causes:**
- Mutual references between symbols
- Dependency chain forms a cycle

**Solutions:**
- Extract shared dependencies to common module
- Refactor dependency structure

**Recoverable:** Yes - automatic refactoring available

### E041 - Cross-File Circular Import

**Message:** `Cross-file circular import would be created: {cycle}`

**Description:** Move would create circular import between files.

**Causes:**
- Files would mutually import each other
- Import chain forms a cycle

**Solutions:**
- Create shared module for common exports
- Restructure imports
- Use lazy imports (dynamic import)

**Recoverable:** Yes - automatic refactoring available

### E042 - Cannot Break Cycle

**Message:** `Cannot break circular dependency: {reason}`

**Description:** Automatic circular dependency resolution failed.

**Causes:**
- Complex circular structure
- Cannot identify safe extraction point
- All resolution strategies fail

**Solutions:**
- Manual refactoring required
- Consider merging the modules
- Extract interfaces to break type cycles

**Recoverable:** No

---

## Transform Errors (E050-E059)

### E050 - Insertion Failed

**Message:** `Failed to insert at target: {reason}`

**Description:** AST insertion operation failed.

**Causes:**
- Invalid insertion point
- AST structure incompatible
- Internal error

**Solutions:**
- Try simpler move operation
- Verify target location is valid
- Report bug if persistent

**Recoverable:** No

### E051 - Reference Update Failed

**Message:** `Failed to update references: {reason}`

**Description:** Reference update after move failed.

**Causes:**
- Complex reference patterns
- Dynamic references
- Scope resolution failure

**Solutions:**
- Manual reference updates needed
- Simplify reference patterns

**Recoverable:** No

### E052 - Removal Failed

**Message:** `Failed to remove source element: {reason}`

**Description:** Could not remove element from original location.

**Causes:**
- Element is required in original location
- AST modification conflict

**Solutions:**
- Clone element instead of moving
- Review original location constraints

**Recoverable:** No

### E053 - Hoisting Failed

**Message:** `Hoisting operation failed for {symbol}: {reason}`

**Description:** Dependency hoisting operation failed.

**Causes:**
- Invalid hoist target
- Scope incompatibility
- Dependency conflicts

**Solutions:**
- Convert to prop instead of hoisting
- Choose different target scope

**Recoverable:** No

### E054 - Import Update Failed

**Message:** `Import update failed in {file}: {reason}`

**Description:** Could not update import statements.

**Causes:**
- Import conflict
- Module resolution failure
- Circular import created

**Solutions:**
- Manually add required imports
- Check module paths

**Recoverable:** No

---

## Internal Errors (E090-E099)

### E090 - Assertion Failed

**Message:** `Assertion failed: {condition}`

**Description:** Internal assertion failure indicating a bug.

**Action:** Please report this error with reproduction steps.

### E091 - Unexpected AST Node

**Message:** `Unexpected AST node type: expected {expected}, got {actual}`

**Description:** AST structure does not match expected shape.

**Action:** Please report this error with the source code.

### E099 - General Internal Error

**Message:** `Internal error: {message}`

**Description:** Catch-all for unexpected internal errors.

**Action:** Please report this error with full context.

---

## Error Recovery

Some errors support automatic recovery:

```typescript
import { isRecoverable, attemptRecovery } from 'regrafter';

try {
  const result = regraft(files, from, to, mode);
} catch (error) {
  if (error instanceof RegraffError && isRecoverable(error)) {
    const recovery = await attemptRecovery(error);
    console.log(recovery.success ? 'Recovered!' : recovery.action);
  }
}
```

### Recoverable Error Codes

| Code | Auto-Recovery Action |
|------|---------------------|
| E022 | Add missing import |
| E023 | Create shared module |
| E030 | Move hook to valid scope |
| E031 | Extract loop to component |
| E032 | Restructure hook usage |
| E035 | Create Context provider |
| E040 | Create shared module |
| E041 | Restructure imports |

## Programmatic Error Access

```typescript
import {
  ERROR_CODES,
  getErrorCodeDefinition,
  getErrorCodesByCategory,
  ErrorCategory
} from 'regrafter';

// Get single error definition
const e030 = getErrorCodeDefinition('E030');
console.log(e030?.description);

// Get all validation errors
const validationErrors = getErrorCodesByCategory(ErrorCategory.Validation);
```
