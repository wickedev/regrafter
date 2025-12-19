# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Regrafter is a programmatic AST transformation library for relocating React/JSX elements with automatic dependency management. It safely moves components within and across files while automatically managing dependencies (hooks, variables, imports, props, context, refs).

## Development Commands

### Testing
```bash
# Run all tests
npm test

# Watch mode (use this during TDD)
npm run test:watch

# Run a specific test file
npm test -- src/analyzer/__tests__/dependency-analyzer.test.ts

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Building
```bash
# Full build (ESM + CJS + types)
npm run build

# Type checking only (fast)
npm run typecheck
```

### Code Quality
```bash
# Lint and auto-fix
npm run lint:fix

# Format code
npm run format

# Check formatting without changes
npm run format:check
```

### Performance
```bash
# Run benchmarks
npm run bench

# Memory profiling
npm run bench:memory

# Generate flamegraph
npm run bench:flamegraph
```

## TDD Methodology

This project strictly follows Kent Beck's Test-Driven Development:

1. **Write failing test first** - Define behavior through tests (Red)
2. **Implement minimum code to pass** - No extra features (Green)
3. **Refactor only when tests pass** - Improve structure safely
4. **Run all tests after each change** - Except long-running benchmarks

Use `npm run test:watch` during development to get immediate feedback.

## Tidy First Approach

Separate all commits into two types:

1. **STRUCTURAL CHANGES**: Rearranging code without changing behavior
   - Renaming, extracting methods, moving code
   - Must not alter test outcomes
   - Commit separately with "refactor:" prefix

2. **BEHAVIORAL CHANGES**: Adding or modifying functionality
   - New features, bug fixes, API changes
   - Must have passing tests
   - Commit separately with "feat:" or "fix:" prefix

**Never mix structural and behavioral changes in the same commit.**

## High-Level Architecture

### Result Monad Pattern

The codebase uses a Result monad for error handling throughout:

```typescript
// Success: ok(value)
// Failure: err(error)
const result: Result<T, RegraffError> = someOperation();

if (isErr(result)) {
  // Handle error: result.error
} else {
  // Use value: result.value
}
```

All core functions return `Result<T, RegraffError>` instead of throwing exceptions. This makes error paths explicit and type-safe.

### Pipeline Architecture

The transformation pipeline has 5 main stages:

1. **Parse** (`src/parser/`) - Files → ASTs using Babel parser
2. **Select** (`src/selector/`) - Position/path → AST nodes
3. **Analyze** (`src/analyzer/`) - Node → Dependencies (hooks, variables, imports)
4. **Plan & Execute** (`src/strategies/`) - Dependencies → Hoisting operations
5. **Transform & Generate** (`src/transformer/`, `src/generator/`) - AST mutations → Code

### Hoisting Pipeline

When moving an element requires dependency hoisting:

1. **DependencyAnalyzer** identifies all dependencies and their types
2. **HoistPlanner** creates a plan using strategy handlers:
   - `HookHoister` - Respects Rules of Hooks
   - `VariableHoister` - Hoists to common scope
   - `PropThreader` - Threads through component tree
   - `ImportManager` - Manages cross-file imports
3. **HoistExecutor** applies mutations to AST
4. **JSXTransformer** performs the actual element move

The hoisting happens *before* the element move to ensure dependencies are available at the target location.

### Cross-File Architecture

Cross-file moves (`src/strategies/cross-file/`) handle:

- **Circular dependency detection** - Creates shared modules when needed
- **Import/export management** - Automatically adds/removes imports
- **Transitive dependencies** - Resolves multi-hop dependencies

Cross-file moves may create new shared module files to break circular dependencies.

### Scope Management

`ScopeManager` (`src/scope/`) builds a scope tree that tracks:

- Component boundaries (function components)
- Variable declarations and their scopes
- Hook call sites and valid hoisting targets
- Parent-child scope relationships

This is separate from Babel's scope tracking and is optimized for React component semantics.

## Key Design Patterns

### Atomic Unit Detection

Elements that must move together are detected as atomic units:
- Conditional expressions: `{cond && <Element />}`
- Map expressions: `{items.map(item => <Item />)}`
- Ternary expressions: `{cond ? <A /> : <B />}`
- Compound components: `<Tabs.Panel>`

These are detected in `src/analyzer/atomic-unit-detector.ts`.

### Strategy Pattern for Hoisting

Each dependency type has its own strategy handler in `src/strategies/`:
- Hook dependencies → `hook-hoister.ts`
- Variable dependencies → `variable-hoister.ts`
- Prop dependencies → `prop-threader.ts`
- Import dependencies → `import-manager.ts`

New dependency types can be added by implementing `IHoistStrategy`.

### Component Inlining

The `inline()` API (`src/index.ts`) uses a different pipeline:
1. Find component definition
2. Clone component body
3. Substitute props at call sites
4. Copy transitive imports
5. Remove original definition and imports

This is implemented in `ComponentInliner` (`src/transformer/component-inliner.ts`).

## Steering Documents

Detailed guidance is available in `.claude/steering/`:

- **[Product](.claude/steering/product.md)**: Business logic rules, atomic units, API design principles
- **[Tech](.claude/steering/tech.md)**: Tech stack, build configuration, performance targets
- **[Structure](.claude/steering/structure.md)**: Directory organization, naming conventions, module architecture
- **[TDD Workflow](.claude/steering/tdd-workflow.md)**: Test-driven development and Tidy First methodology

Refer to these documents for detailed context on design decisions and development workflow.

## Common Development Tasks

### Adding a New Dependency Type

1. Write failing test in `src/strategies/__tests__/`
2. Create strategy handler implementing `IHoistStrategy`
3. Register in `createStrategies()` in `src/strategies/index.ts`
4. Update `DependencyType` enum in `src/types/public.ts`

### Adding a New Error Type

1. Add error code to `ERROR_CODES` in `src/errors/error-codes.ts`
2. Create factory function in `src/errors/index.ts`
3. Update error category mapping if needed
4. Add suggested fixes in `src/errors/suggested-fixes.ts`

### Running a Single Test During TDD

```bash
# Specific test file
npm test -- src/analyzer/__tests__/dependency-analyzer.test.ts

# Specific test case (use .only in code)
describe.only('specific feature', () => { ... })
```

### Debugging Test Failures

The codebase uses structured error types with detailed context:

```typescript
if (isErr(result)) {
  console.log(result.error.toFormattedString());
  // Shows: code, message, stack trace, suggestions
}
```

Error objects include `suggestions` array with recovery hints.

## Performance Considerations

- ASTs are cached in `ASTStore` to avoid re-parsing
- Scope trees are built once per file
- Dependency analysis uses memoization
- Target: <100ms for single file, <500ms for 10 files

Run `npm run bench` to verify performance after changes.
