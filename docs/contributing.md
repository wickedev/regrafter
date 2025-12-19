# Contributing

Thank you for your interest in contributing to Regrafter! This document provides guidelines for contributing to the project.

## Development Philosophy

Regrafter follows two core methodologies:

1. **Test-Driven Development (TDD)** - Kent Beck's approach
2. **Tidy First** - Structural vs behavioral changes

These methodologies ensure code quality, maintainability, and safe refactoring.

---

## Test-Driven Development

### The Red-Green-Refactor Cycle

All code changes must follow this cycle:

1. **🔴 Red** - Write a failing test first
2. **🟢 Green** - Write minimum code to pass the test
3. **🔵 Refactor** - Improve code structure while tests pass

### Rules

- **NEVER write production code without a failing test**
- **NEVER write more of a test than is sufficient to fail**
- **NEVER write more production code than is sufficient to pass the test**
- **RUN tests after every change** (except benchmarks)
- **ONLY refactor when all tests are passing**

### Watch Mode

Use watch mode during development:

```bash
npm run test:watch
```

This provides immediate feedback as you write tests and code.

### Running Specific Tests

```bash
# Single test file
npm test -- src/analyzer/__tests__/dependency-analyzer.test.ts

# Specific test case
# Use .only in code:
describe.only('specific feature', () => {
  it('should work', () => {
    // test
  });
});
```

---

## Tidy First Methodology

### Two Types of Commits

**NEVER mix these in the same commit:**

1. **Structural Changes** (refactoring)
   - Renaming variables, functions, files
   - Extracting methods or modules
   - Moving code between files
   - Changing code organization
   - **Must not alter test outcomes**
   - Commit with `refactor:` prefix

2. **Behavioral Changes** (functionality)
   - Adding new features
   - Fixing bugs
   - Changing APIs
   - **Must have passing tests**
   - Commit with `feat:` or `fix:` prefix

### Commit Discipline

- ✅ **Good**: Small, focused commits
- ✅ **Good**: One type of change per commit
- ✅ **Good**: Tests pass before committing
- ❌ **Bad**: Large commits with multiple concerns
- ❌ **Bad**: Mixed structural and behavioral changes
- ❌ **Bad**: Committing with failing tests

### Example Workflow

```bash
# 1. Structural change
git commit -m "refactor: extract DependencyAnalyzer class"

# 2. Run tests
npm test

# 3. Behavioral change
git commit -m "feat: add support for context dependencies"

# 4. Run tests
npm test

# 5. More structural changes
git commit -m "refactor: rename analyze to analyzeDependencies"
```

---

## Development Setup

### Prerequisites

- Node.js ≥18
- npm ≥9
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/wickedev/regrafter.git
cd regrafter

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

---

## Development Commands

### Testing

```bash
# Run all tests
npm test

# Watch mode (TDD)
npm run test:watch

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage

# Run specific test
npm test -- path/to/test.test.ts
```

### Building

```bash
# Full build (ESM + CJS + types)
npm run build

# Type checking only
npm run typecheck
```

### Code Quality

```bash
# Lint
npm run lint

# Lint and auto-fix
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Benchmarking

```bash
# Run benchmarks
npm run bench

# Memory profiling
npm run bench:memory

# Generate flamegraph
npm run bench:flamegraph
```

---

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/my-bug
```

### 2. Write Tests First

```typescript
// src/analyzer/__tests__/my-feature.test.ts
import { describe, it, expect } from 'vitest';
import { myNewFeature } from '../my-feature';

describe('myNewFeature', () => {
  it('should do something', () => {
    const result = myNewFeature(input);
    expect(result).toBe(expected);
  });
});
```

Run test - it should **fail**:

```bash
npm test -- src/analyzer/__tests__/my-feature.test.ts
```

### 3. Implement Minimum Code

```typescript
// src/analyzer/my-feature.ts
export function myNewFeature(input) {
  // Minimum code to pass test
  return expected;
}
```

Run test - it should **pass**:

```bash
npm test -- src/analyzer/__tests__/my-feature.test.ts
```

### 4. Refactor

Improve code structure:
- Extract functions
- Rename variables
- Add types
- Improve clarity

**ONLY when tests are passing!**

### 5. Run All Tests

```bash
npm test
```

### 6. Commit

```bash
# Behavioral change
git commit -m "feat: add myNewFeature"

# or structural change
git commit -m "refactor: extract helper function"
```

---

## Code Style

### TypeScript

- Use strict mode
- Prefer `const` over `let`
- Use descriptive names
- Add JSDoc for public APIs
- Use `type` for object types, `interface` for extensible contracts

**Example:**

```typescript
/**
 * Analyzes dependencies of a JSX element.
 *
 * @param element - Element to analyze
 * @param scope - Target scope
 * @returns Array of dependencies
 */
export function analyzeDependencies(
  element: NodePath,
  scope: ScopeInfo
): Dependency[] {
  // Implementation
}
```

### Result Pattern

Use Result monad for error handling:

```typescript
import { ok, err, type Result } from './result';

function doSomething(): Result<Value, RegraffError> {
  if (error) {
    return err(createError('E001', 'Failed'));
  }
  return ok(value);
}
```

### Error Handling

Never throw exceptions in public APIs:

```typescript
// ❌ Bad
export function badFunction() {
  throw new Error('Something failed');
}

// ✅ Good
export function goodFunction(): Result<Value, RegraffError> {
  if (condition) {
    return err(createValidationError('E030', 'Validation failed'));
  }
  return ok(value);
}
```

### Naming Conventions

- **Functions**: camelCase verbs (`analyzeDependencies`, `createHoistPlan`)
- **Classes**: PascalCase nouns (`DependencyAnalyzer`, `HoistPlanner`)
- **Constants**: UPPER_SNAKE_CASE (`ERROR_CODES`, `DEFAULT_OPTIONS`)
- **Types**: PascalCase (`Dependency`, `HoistContext`)
- **Enums**: PascalCase (`DependencyType`, `ErrorCategory`)
- **Private fields**: prefix with `_` (`_cache`, `_scopeManager`)

---

## Testing Guidelines

### Test Structure

```typescript
describe('FeatureName', () => {
  describe('when condition', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = createInput();

      // Act
      const result = performAction(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Test Coverage

- **Unit tests**: Individual functions and classes
- **Integration tests**: Module interactions
- **E2E tests**: Full transformation flows

Aim for >90% code coverage.

### Test Data

Use fixtures for complex test data:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const fixture = readFileSync(
  join(__dirname, 'fixtures', 'example.tsx'),
  'utf-8'
);
```

---

## Pull Request Process

### Before Submitting

1. ✅ All tests pass (`npm test`)
2. ✅ Code is linted (`npm run lint`)
3. ✅ Code is formatted (`npm run format`)
4. ✅ Types check (`npm run typecheck`)
5. ✅ Build succeeds (`npm run build`)
6. ✅ Benchmarks pass (`npm run bench`) - if performance-related

### PR Guidelines

- **Title**: Clear, descriptive (e.g., "feat: add context dependency support")
- **Description**: What, why, and how
- **Tests**: Include test coverage
- **Docs**: Update docs if API changes
- **Commits**: Small, focused, following Tidy First
- **No breaking changes** without discussion

### PR Template

```markdown
## Description
Brief description of the changes

## Motivation
Why is this change needed?

## Changes
- Added X
- Modified Y
- Removed Z

## Tests
- Added unit tests for X
- Updated integration tests for Y

## Checklist
- [ ] Tests pass
- [ ] Code is linted
- [ ] Types check
- [ ] Docs updated (if needed)
- [ ] Follows TDD methodology
- [ ] Follows Tidy First (structural/behavioral separation)
```

---

## Documentation

### When to Update Docs

Update documentation when:
- Adding new APIs
- Changing existing APIs
- Adding new features
- Fixing bugs that affect usage

### Documentation Structure

- **README.md** - Overview and quick start
- **docs/api-reference.md** - Complete API documentation
- **docs/examples.md** - Usage examples
- **docs/error-handling.md** - Error handling patterns
- **docs/dependency-types.md** - Dependency explanations
- **docs/advanced-usage.md** - Advanced patterns
- **docs/architecture.md** - Technical architecture
- **docs/contributing.md** - This file

### Code Comments

- Add JSDoc for public APIs
- Comment complex logic
- Explain "why" not "what"
- Keep comments up to date

---

## Performance Guidelines

### Targets

- Single file (<1000 lines): <100ms
- Multi-file (10 files): <500ms
- canMove(): <20% of full operation time
- Memory: <10x source file size

### Benchmarking

Run benchmarks before and after changes:

```bash
npm run bench
```

If performance regresses >10%, optimize before merging.

### Optimization Strategies

- Cache ASTs and scope trees
- Use memoization for expensive computations
- Avoid redundant traversals
- Profile with flamegraphs:
  ```bash
  npm run bench:flamegraph
  ```

---

## Error Handling

### Creating Errors

Use error factories:

```typescript
import {
  createParseError,
  createSelectorError,
  createDependencyError,
  createValidationError
} from './errors';

// Create error with suggested fixes
const error = createDependencyError(
  'E020',
  'Cannot resolve dependency',
  {
    file: 'App.tsx',
    symbol: 'useState'
  },
  [
    {
      description: 'Move element to same component',
      action: 'move-to-component',
      automatic: false
    }
  ]
);

return err(error);
```

### Error Codes

Add new error codes to `ERROR_CODES`:

```typescript
export const ERROR_CODES = {
  // ... existing codes
  E050: {
    code: 'E050',
    message: 'New error type',
    category: ErrorCategory.Transform,
    recoverable: false
  }
} as const;
```

---

## Project Structure

```
regrafter/
├── src/
│   ├── api/              # Public APIs
│   ├── analyzer/         # Dependency analysis
│   ├── selector/         # Element selection
│   ├── transformer/      # AST transformation
│   ├── strategies/       # Hoisting strategies
│   ├── optimizer/        # Dependency optimization
│   ├── scope/           # Scope management
│   ├── parser/          # Babel parser wrapper
│   ├── generator/       # Code generation
│   ├── errors/          # Error types
│   ├── validation/      # Input validation
│   ├── result/          # Result monad
│   ├── types/           # Type definitions
│   └── index.ts         # Main exports
├── test/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── fixtures/        # Test fixtures
├── docs/                # Documentation
├── .claude/             # Claude Code config
└── config/              # Build configs
```

---

## Adding New Features

### 1. Plan

- Understand requirements
- Design API
- Consider edge cases
- Review with maintainers

### 2. Write Tests

- Start with simplest case
- Add edge cases
- Test error paths
- Test integration

### 3. Implement

- Follow TDD cycle
- Keep commits small
- Separate structural/behavioral changes
- Add documentation

### 4. Review

- Self-review code
- Run full test suite
- Check performance
- Update docs

---

## Questions?

- **Issues**: https://github.com/wickedev/regrafter/issues
- **Discussions**: https://github.com/wickedev/regrafter/discussions
- **Discord**: [Join our Discord](https://discord.gg/regrafter)

---

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help newcomers
- Focus on the code, not the person

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
