# TDD Workflow Steering

## Core TDD Philosophy

This project follows Kent Beck's Test-Driven Development and "Tidy First" methodologies strictly. These are not suggestions—they are fundamental to how this codebase evolves.

## The Red-Green-Refactor Cycle

### 1. Red - Write a Failing Test
Write the simplest test that could possibly fail for one small increment of functionality.

**Rules:**
- Write ONLY ONE test at a time
- Test must fail for the right reason (not syntax error, import error, etc.)
- Test name describes behavior, not implementation (e.g., `shouldExtractSimpleComponent`, not `testExtractFunction`)
- Use meaningful test data, not generic "foo" and "bar" unless demonstrating naming

**Example:**
```typescript
test('shouldExtractSimpleJSXElement', () => {
  const files = [{
    path: 'App.tsx',
    content: `
      function App() {
        return <div>Hello World</div>;
      }
    `
  }];

  const result = extract(
    files,
    { file: 'App.tsx', line: 3, column: 16 }, // <div>Hello World</div>
    { componentName: 'Greeting' }
  );

  expect(result.ok).toBe(true);
  expect(result.value.codes[0].content).toContain('function Greeting()');
  expect(result.value.codes[0].content).toContain('<Greeting />');
});
```

Run the test: It should FAIL.

### 2. Green - Make It Pass
Write the MINIMUM code needed to make this ONE test pass. No more, no less.

**Rules:**
- Do not write code for future tests
- Do not optimize prematurely
- Hardcoding is acceptable if it makes THIS test pass
- Duplication is acceptable at this stage
- Focus: Make the test green as quickly as possible

**Anti-patterns to avoid:**
- ❌ "While I'm here, let me also add..."
- ❌ "This might need error handling for..."
- ❌ "Let me make this more general..."

Run the test: It should PASS.

### 3. Refactor - Improve Structure
Now that tests are passing, improve the code structure WITHOUT changing behavior.

**Rules:**
- Run ALL tests before refactoring (except long-running benchmarks)
- Make ONE refactoring change at a time
- Run ALL tests after each refactoring step
- If tests fail, immediately undo the refactoring
- Use established refactoring patterns with their proper names

**Common refactorings:**
- Extract Method
- Extract Variable
- Rename Variable/Function
- Inline Variable/Function
- Move Method
- Extract Interface
- Replace Conditional with Polymorphism

Run all tests: They should ALL PASS.

## Tidy First Principle

Separate ALL changes into two distinct types:

### Structural Changes (Tidy First)
Changes that rearrange code WITHOUT changing behavior.

**Examples:**
- Renaming variables, functions, or files
- Extracting methods or functions
- Moving code between files
- Reordering function parameters (with corresponding call sites)
- Changing code organization
- Adding/removing whitespace
- Reformatting code

**Validation:**
- Run ALL tests BEFORE the structural change
- Make the structural change
- Run ALL tests AFTER the structural change
- Both test runs should produce IDENTICAL results
- Commit with message prefix: `refactor:` or `tidy:`

### Behavioral Changes
Changes that add or modify actual functionality.

**Examples:**
- Adding new features
- Fixing bugs
- Changing business logic
- Adding/modifying error handling
- Performance optimizations that change timing
- Adding new APIs

**Validation:**
- Tests may add new assertions or new test cases
- Existing tests should still pass (unless deliberately changing behavior)
- Commit with message prefix: `feat:`, `fix:`, or `perf:`

### The Golden Rule
**NEVER mix structural and behavioral changes in the same commit.**

If you need both, ALWAYS do structural changes FIRST:
1. Make structural changes
2. Verify tests still pass
3. Commit structural changes
4. Make behavioral changes
5. Verify tests pass (may include new tests)
6. Commit behavioral changes

## Commit Discipline

### When to Commit
Commit when ALL of these conditions are met:
1. ALL tests are passing (run `npm test`)
2. ALL compiler warnings resolved (run `npm run typecheck`)
3. ALL linter issues resolved (run `npm run lint`)
4. Change represents a single logical unit
5. Commit message clearly describes what and why

### When NOT to Commit
Do not commit if:
- Any test is failing
- Any TypeScript error exists
- Any ESLint error exists
- Multiple unrelated changes are staged
- Unclear if change is structural or behavioral

### Commit Message Format
```
<type>: <description>

[optional body]
```

**Types:**
- `feat:` - New behavioral feature
- `fix:` - Bug fix (behavioral change)
- `refactor:` - Structural change only
- `tidy:` - Code organization (structural change)
- `test:` - Adding/modifying tests only
- `docs:` - Documentation changes only
- `chore:` - Build, dependencies, configs

**Examples:**
```
refactor: extract dependency analysis into separate function

Extracted analyzeDependencies from regraft function.
No behavior change - all existing tests pass.
```

```
feat: add component extraction API

Implemented extract() function that creates new components
from selected JSX elements. Includes dependency analysis
and automatic prop inference.
```

## Running Tests

### During Development
```bash
# Run all tests (unit + integration)
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest src/extract/__tests__/extract.test.ts

# Run tests matching pattern
npx vitest -t "shouldExtractSimpleComponent"
```

### Before Commit
```bash
# Full validation
npm test && npm run typecheck && npm run lint
```

### After Structural Changes
```bash
# Ensure behavior unchanged
npm test
```

## Test Organization

### Test File Naming
- Unit tests: `<module-name>.test.ts`
- E2E tests: `<feature>.e2e.test.ts`
- Integration tests: `<workflow>.test.ts`
- Benchmarks: `<operation>.bench.ts`

### Test Structure
```typescript
import { describe, test, expect } from 'vitest';

describe('ComponentExtractor', () => {
  describe('extract()', () => {
    test('shouldExtractSimpleComponent', () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = extract(input);

      // Assert
      expect(result.ok).toBe(true);
    });

    test('shouldFailWhenElementNotFound', () => {
      // Arrange, Act, Assert
    });
  });

  describe('canExtract()', () => {
    // Validation tests
  });
});
```

### Test Data
- Use realistic examples, not arbitrary data
- Prefer fixture files for complex test cases
- Keep test data inline for simple cases
- Use factories for repeated test data patterns

## Working with Result Monad

### Testing Success Cases
```typescript
test('shouldReturnOkResult', () => {
  const result = operation();

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value).toEqual(expectedValue);
  }
});
```

### Testing Error Cases
```typescript
test('shouldReturnErrResult', () => {
  const result = operation();

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe('EXPECTED_ERROR_CODE');
    expect(result.error.message).toContain('expected message');
  }
});
```

### Using Type Guards
```typescript
import { isOk, isErr } from './result/index.js';

test('shouldHandleResultWithTypeGuards', () => {
  const result = operation();

  if (isOk(result)) {
    // TypeScript knows result.value exists
    expect(result.value.property).toBe(expected);
  } else {
    fail('Expected Ok result');
  }
});
```

## Fixing Bugs (Test-Driven Bug Fixing)

When you encounter a bug:

### 1. Write an API-Level Failing Test
First, write a test at the API level that exposes the bug:
```typescript
test('shouldHandleNestedComponents', () => {
  // Test that currently fails due to the bug
  const result = regraft(files, from, to, Move.Inside);
  expect(result.ok).toBe(true);
});
```

### 2. Write a Minimal Failing Test
Then write the smallest possible test that replicates the problem:
```typescript
test('shouldFindNestedComponentScope', () => {
  // Minimal reproduction of the issue
  const scope = scopeManager.findEnclosingComponent(path);
  expect(scope).not.toBeNull();
});
```

### 3. Fix the Code
Make BOTH tests pass with minimal changes.

### 4. Commit
```
fix: handle nested component scope detection

Added check for nested components in scope manager.
Both API-level and unit-level tests now pass.
```

## Common Workflow Scenarios

### Adding a New Feature
1. Write failing API-level test (Red)
2. Write failing unit tests for new components (Red)
3. Implement minimum code to pass (Green)
4. Refactor for clarity and remove duplication (Refactor)
5. Commit

### Refactoring Existing Code
1. Ensure all tests pass
2. Make ONE structural change
3. Run all tests (should pass)
4. Commit structural change
5. Repeat for next refactoring

### Fixing a Test Failure
1. Read the failure message carefully
2. Do NOT change the test unless it's wrong
3. Fix the code to make test pass
4. If test was wrong, fix test in separate commit

### Optimizing Performance
1. Write benchmark test showing current performance
2. Make optimization (behavioral change)
3. Run benchmark to verify improvement
4. Run all tests to ensure correctness
5. Commit with `perf:` prefix

## Code Quality Checklist

Before committing, verify:
- [ ] All tests passing (`npm test`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] No duplication (DRY principle)
- [ ] Clear, descriptive names
- [ ] Single responsibility per function
- [ ] Commit message describes change clearly
- [ ] Structural and behavioral changes separated

## Anti-Patterns to Avoid

### ❌ Writing Code Before Tests
Don't write implementation code without a failing test.

### ❌ Writing Multiple Tests at Once
One test at a time. Make it pass before writing the next.

### ❌ Skipping Tests
Don't skip tests or mark them as `.todo` without good reason.

### ❌ Mixing Concerns in Commits
Don't combine refactoring with new features.

### ❌ Premature Abstraction
Don't create abstractions until you have 3+ similar cases.

### ❌ Over-Engineering
Don't add complexity for hypothetical future needs.

### ❌ Ignoring Test Failures
Never commit with failing tests "to fix later."

## Pair Programming & Code Review

When pairing or reviewing:
- Ensure TDD cycle is followed
- Check that commits separate structural/behavioral changes
- Verify tests are meaningful and test behavior, not implementation
- Question any code without corresponding tests
- Look for duplication that could be eliminated

## Remember

> "Test-driven development is a way of managing fear during programming."
> — Kent Beck

> "Make the change easy, then make the easy change."
> — Kent Beck (Tidy First)

The discipline of TDD and Tidy First makes changes safer, code cleaner, and development faster in the long run. Trust the process.
