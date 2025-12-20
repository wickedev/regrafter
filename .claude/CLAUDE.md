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

### Modular Architecture (SOLID Principles)

The codebase follows SOLID principles with focused, single-responsibility modules:

#### Dependency Analysis (`src/analyzer/`)

The dependency analysis system is decomposed into specialized components:

1. **DependencyOrchestrator** (800 lines) - Coordinates dependency analysis workflow
   - Factory: `createDependencyOrchestrator()`
   - Orchestrates specialized analyzers

2. **HookDependencyAnalyzer** - Analyzes React Hook dependencies
   - Enforces Rules of Hooks
   - Detects hook call sites and dependencies

3. **VariableDependencyAnalyzer** - Analyzes variable dependencies
   - Tracks variable scope and accessibility
   - Identifies variables that need hoisting

4. **ImportDependencyAnalyzer** - Analyzes import dependencies
   - Tracks import usage across files
   - Manages cross-file dependency resolution

5. **PropDependencyAnalyzer** - Analyzes prop dependencies
   - Detects when prop threading is needed
   - Identifies component prop requirements

6. **RelatedDependencyDetector** (325 lines) - Detects transitive dependencies
   - Finds functions/variables that reference hoisted symbols
   - Handles circular dependency detection

7. **DependencyConverter** (231 lines) - Converts internal dependency representations
   - Deduplicates dependencies by symbol name
   - Maps symbols to NodePaths

8. **DependencyResolver** (118 lines) - Resolves dependency accessibility
   - Determines if dependencies need hoisting
   - Checks cross-scope accessibility

#### Hoisting Strategy (`src/strategies/`)

The hoisting system uses the Strategy pattern with focused validators and selectors:

1. **HoistPlanBuilder** (600 lines, reduced from 871) - Creates hoisting plans
   - Factory: `createHoistPlanBuilder()`
   - Orchestrates strategy selection and planning

2. **HookLocationValidator** - Validates hook hoisting locations
   - Enforces Rules of Hooks
   - Finds nearest valid hook scope

3. **HoistStrategySelector** - Selects appropriate hoisting strategy
   - Determines target scope (LCA computation)
   - Chooses between direct hoisting and prop threading

4. **Strategy Handlers** - Execute specific hoisting strategies:
   - `HookHoister` - Respects Rules of Hooks
   - `VariableHoister` - Hoists to common scope
   - `PropThreader` - Threads through component tree
   - `ImportManager` - Manages cross-file imports

#### Hoisting Pipeline

When moving an element requires dependency hoisting:

1. **DependencyOrchestrator** identifies all dependencies using specialized analyzers
2. **HoistPlanBuilder** creates a plan:
   - **HookLocationValidator** ensures Rules of Hooks compliance
   - **HoistStrategySelector** determines strategy and target scope
   - Strategy handlers plan specific operations
3. **HoistExecutor** applies mutations to AST
4. **JSXTransformer** performs the actual element move

The hoisting happens *before* the element move to ensure dependencies are available at the target location.

### Cross-File Architecture

Cross-file moves (`src/strategies/cross-file/`) handle:

- **Circular dependency detection** - Creates shared modules when needed
- **Import/export management** - Automatically adds/removes imports
- **Transitive dependencies** - Resolves multi-hop dependencies

Cross-file moves may create new shared module files to break circular dependencies.

#### Move Transformation Pipeline (`src/api/`)

The move transformation process uses a 5-stage pipeline pattern for clarity and maintainability:

1. **MoveTransformationPipeline** - Orchestrates the entire move process
   - Factory: `createMoveTransformationPipeline()`
   - Manages context flow through stages
   - Implements fail-fast error handling

2. **Pipeline Stages**:
   - **Stage 1: Validation** - Parse files, validate selectors, build scope tree
   - **Stage 2: Analysis** - Get scopes, analyze dependencies
   - **Stage 3: Planning** - Create hoist plan using HoistPlanBuilder
   - **Stage 4: Execution** - Execute hoisting operations
   - **Stage 5: Generation** - Generate transformed code

This pipeline reduced `moveWithHoistingInternal` from 193 lines to ~30 lines of orchestration code.

### Scope Management (`src/scope/`)

`ScopeManager` builds a scope tree that tracks:

- Component boundaries (function components)
- Variable declarations and their scopes
- Hook call sites and valid hoisting targets
- Parent-child scope relationships

This is separate from Babel's scope tracking and is optimized for React component semantics.

**Scope Interface Segregation (ISP):**

The scope system uses segregated interfaces for minimal coupling:

- `IScopeTreeBuilder` - Building and managing scope trees
- `IScopeQuery` - Querying scope information
- `IScopeAccessibility` - Checking scope accessibility
- `IBindingQuery` - Querying variable bindings
- `IComponentInfo` - Component-specific information
- `IScopeManager` (legacy) - Extends all focused interfaces

Consumers depend only on the interfaces they need, following the Interface Segregation Principle.

**Scope Helper Utilities (`src/scope/scope-helpers.ts`):**

Reusable utilities for common scope operations:

- `getScopeWithFallback()` - Get scope with component fallback
- `getEnclosingComponentOrNull()` - Find nearest component scope
- `buildScopePath()` - Build ancestor chain
- `findCommonAncestor()` - Compute lowest common ancestor (LCA)
- `isAncestorOf()` - Check parent-child relationships
- `findNearestAncestor()` - Find nearest matching ancestor
- `computeScopeDistance()` - Calculate scope depth

These utilities eliminated 100+ lines of duplicated code across the codebase.

### Error Handling (`src/errors/`)

The codebase uses two patterns for error creation:

**1. Result Monad Pattern** - All operations return `Result<T, E>`:

```typescript
const result: Result<T, RegraffError> = someOperation();

if (isErr(result)) {
  // Handle error: result.error
  return result; // Propagate error
} else {
  // Use value: result.value
}
```

**2. ErrorBuilder Fluent API** - For creating rich error objects:

```typescript
// Validation error
error()
  .code("E001")
  .message("Cannot hoist hook outside component")
  .at(location)
  .inFile(filePath)
  .constraint("Rules of Hooks")
  .suggest("Move hook call to component body")
  .build()

// Dependency error
dependencyError()
  .code("D001")
  .message("Unresolvable dependency")
  .reason("Symbol not found in scope")
  .inFile(filePath)
  .at(location)
  .suggest("Import the missing symbol")
  .build()
```

**Result Utility Functions** (`src/result/index.ts`):

- `unwrapOrReturn()` - Extract value or early return error
- `unwrapOrNull()` - Extract value or fallback to null
- `unwrapOr()` - Extract value or use default
- `andThen()` - Chain Result operations
- `mapResult()` - Transform Result value
- `combineResults()` - Combine array of Results

These utilities reduced error handling boilerplate by 60% across the codebase.

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
npm test -- src/analyzer/__tests__/dependency-orchestrator.test.ts

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

## SOLID Refactoring (December 2024)

The codebase underwent comprehensive SOLID principles refactoring to improve modularity and maintainability:

### Key Improvements

**Single Responsibility Principle (SRP):**
- `DependencyAnalyzer` (1,136 lines) → `DependencyOrchestrator` (800 lines) + 5 specialized analyzers
- `HoistPlanner` (871 lines) → `HoistPlanBuilder` (600 lines) + validators and selectors
- `moveWithHoistingInternal` (193 lines) → `MoveTransformationPipeline` (30 lines orchestration)

**Open/Closed Principle (OCP):**
- Strategy pattern for hoisting (`HookHoister`, `VariableHoister`, `PropThreader`, `ImportManager`)
- New dependency types can be added without modifying existing code

**Liskov Substitution Principle (LSP):**
- All interfaces properly substitutable
- Factory functions ensure correct initialization

**Interface Segregation Principle (ISP):**
- `IScopeManager` split into 5 focused interfaces (`IScopeTreeBuilder`, `IScopeQuery`, `IScopeAccessibility`, `IBindingQuery`, `IComponentInfo`)
- Consumers depend only on interfaces they need

**Dependency Inversion Principle (DIP):**
- All major classes use dependency injection via factory functions
- High-level modules depend on abstractions, not concrete implementations

### Results

- **Code Reduction**: 15% reduction in core modules through decomposition
- **Duplication Elimination**: 80% reduction (143 instances → <30)
- **Type Safety**: 100% type-safe error handling with Result monad
- **Test Coverage**: 96.6% (2118/2142 tests passing)
- **Zero Type Errors**: Clean TypeScript compilation
- **Performance**: Maintained <100ms single file, <500ms 10 files

### Documentation

- [Tasks Specification](.claude/specs/solid-refactoring/tasks.md) - Detailed task breakdown
- [Summary Report](.claude/specs/solid-refactoring/SUMMARY.md) - Complete refactoring results
- [Product Steering](.claude/steering/product.md) - Business logic rules
- [Technical Steering](.claude/steering/tech.md) - Tech stack details
- [Structure Steering](.claude/steering/structure.md) - Directory organization
- [TDD Workflow](.claude/steering/tdd-workflow.md) - Development methodology
