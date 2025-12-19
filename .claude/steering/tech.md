# Tech Steering

## Tech Stack

- **Language**: TypeScript (strict mode, ES2022 target)
- **AST Parsing**: @babel/parser (JSX, TypeScript, modern JS plugins)
- **AST Traversal**: @babel/traverse
- **AST Types**: @babel/types
- **Code Generation**: @babel/generator
- **Testing**: Vitest with coverage, property-based testing with @fast-check/vitest
- **Build**: TypeScript compiler with dual ESM/CJS output

## Project Configuration

### Babel Parser Configuration
Configure with plugins: jsx, typescript, decorators, classProperties, dynamicImport, optionalChaining, nullishCoalescingOperator, topLevelAwait

### TypeScript Configuration
- Enable strict mode
- Target ES2022
- Module: ES2022 for ESM, CommonJS for CJS
- Separate tsconfig files for ESM, CJS, and types

### Code Quality Tools
- ESLint with TypeScript plugin
- Prettier for formatting
- Vitest for unit, integration, E2E, and benchmark tests

## Architecture Layers

### 1. Public API Layer (`src/api/`)
- Type definitions for public APIs
- Result helpers for error handling
- Batch operation support

### 2. Core APIs (`src/index.ts`)
- `regraft()` - Unified element relocation API
- `extract()` - Component extraction API
- `inline()` - Component inlining API
- `canMove()` - Move validation
- `analyze()` - Dependency analysis
- `optimize()` - Dependency sinking

### 3. Result Monad (`src/result/`)
Result type for type-safe error handling:
- Core types: `Result<T, E>`, `Ok<T>`, `Err<E>`
- Functional helpers: `map`, `flatMap`, `mapErr`, `unwrap`, `unwrapOr`
- Type guards: `isOk`, `isErr`
- Async support: `tryCatchAsync`, `mapAsync`, `flatMapAsync`
- Batch processing: `processBatch`, `all`, `any`

### 4. Extraction Module (`src/extract/`)
Interface-driven component extraction system:
- **Orchestrator**: Coordinates extraction pipeline
- **Planner**: Creates extraction plans
- **Executor**: Executes extraction operations
- **Component Builder**: Generates component code with types
- **Dependency Analyzer**: Analyzes dependencies for extraction
- **Import Manager**: Manages import/export statements
- **Code Replacer**: Replaces extracted code with component usage
- **Name Generator**: Generates semantic component names
- **Type Inferrer**: Infers TypeScript types for props

Interfaces define contracts:
- `IExtractOrchestrator`
- `IExtractPlanner`
- `IExtractExecutor`
- `IComponentBuilder`
- `ICodeReplacer`
- `IImportManager`
- `IInputValidator`
- `ICodeFormatter`

### 5. Transformation Engine (`src/transformer/`)
- JSX transformer for element movement
- Component inliner for inline operations
- AST mutation operations

### 6. Dependency Analysis (`src/analyzer/`)
- Dependency analyzer for identifying references
- Move validator for checking operation validity
- Atomic unit detector for identifying indivisible units
- Component detector for finding component definitions
- Dynamic code detector for eval/Function detection

### 7. Hoisting Strategies (`src/strategies/`)
Pluggable strategies for dependency resolution:
- **Hook Hoister**: Hoist React hooks following Rules of Hooks
- **Variable Hoister**: Hoist variable declarations
- **Prop Threader**: Thread props through component tree
- **Import Manager**: Manage cross-file imports
- **Context Handler**: Handle React context dependencies
- **Suspense Handler**: Handle Suspense boundaries
- **Cross-File**: Handle cross-file transformations and circular dependencies

### 8. Scope Management (`src/scope/`)
- Scope manager for tracking variable scopes
- Component scope tracking
- Scope tree building and traversal

### 9. Selector Resolution (`src/selector/`)
- Position-based selector resolution (line, column)
- Path-based selector resolution (AST path)
- Element data extraction

### 10. Code Generation (`src/generator/`)
- Code generator wrapping @babel/generator
- Comment preservation
- Formatting options

### 11. Optimization (`src/optimizer/`)
- Performance optimizer for dependency sinking
- Fast validation for canMove operations
- Benchmark utilities

### 12. Error Handling (`src/errors/`)
- Error categories: Parse, Selector, Dependency, Validation, Circular, Transform, Internal
- Error codes: E001-E099
- Error factories for creating typed errors
- Suggested fixes with recovery strategies
- Error recovery system

### 13. Parser (`src/parser/`)
- File parser wrapping @babel/parser
- AST store for caching parsed ASTs
- Parser configuration

### 14. Validation (`src/validation/`)
- Input validation for all public APIs
- Type guards and assertions
- Validation result types

### 15. Types (`src/types/`)
- Public types exported to users
- Internal types for implementation
- Type factories and guards

### 16. Utilities (`src/utils/`)
- Babel loader for handling ESM/CJS interop
- Logger for debugging
- Helper functions

## Common Commands

```bash
# Build
npm run build              # Full build (clean + esm + cjs + types)
npm run build:esm          # ESM build only
npm run build:cjs          # CJS build only
npm run build:types        # Type definitions only

# Test
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
npm run test:e2e           # End-to-end tests only
npm run test:e2e:watch     # E2E tests in watch mode

# Benchmarks
npm run bench              # Run performance benchmarks
npm run bench:memory       # Memory usage benchmarks
npm run bench:profile      # CPU profiling
npm run bench:flamegraph   # Generate flamegraph

# Code Quality
npm run lint               # Run ESLint
npm run lint:fix           # Fix ESLint issues
npm run format             # Format with Prettier
npm run format:check       # Check formatting
npm run typecheck          # Type checking

# Release
npm run prepublishOnly     # Pre-publish checks
npm run version            # Version bump
npm run release            # Publish to npm
```

## Development Principles

### TDD Methodology
Follow strict Red → Green → Refactor cycle:
1. Write failing test first (Red)
2. Implement minimum code to pass (Green)
3. Refactor only when tests pass
4. Run all tests after each change (except long-running benchmarks)

### Tidy First Approach
Separate structural changes from behavioral changes:
- **Structural commits**: Rename, extract methods, move code (no behavior change)
- **Behavioral commits**: Add/modify functionality
- NEVER mix structural and behavioral changes in the same commit
- Always validate structural changes don't alter behavior (run tests before/after)

### Commit Discipline
Only commit when:
1. ALL tests are passing
2. ALL compiler/linter warnings resolved
3. Change represents single logical unit
4. Commit message clearly states structural vs behavioral

### Code Quality Standards
- Eliminate duplication ruthlessly
- Express intent clearly through naming
- Keep methods small and focused
- Minimize state and side effects
- Use simplest solution that could work
- Write one test at a time, make it run, improve structure

### Interface-Driven Design
Extract module demonstrates interface-driven architecture:
- Define interfaces before implementations
- Enable dependency injection for testing
- Support multiple implementations
- Clear separation of concerns

### Type Safety
- Use strict TypeScript mode
- Prefer Result monad over throw/catch
- Provide comprehensive type definitions
- Export both value and type exports

## Performance Targets

- **Single file** (<1000 lines): <100ms
- **Multi-file** (10 files): <500ms
- **Validation** (`canMove`, `canExtract`): <20% of full operation time
- **Memory**: <10x file size
- **AST Parsing**: Cached and reused within operations

## Testing Strategy

### Unit Tests (`src/**/__tests__/*.test.ts`)
Test individual functions and classes in isolation.

### Integration Tests (`src/__tests__/integration/*.test.ts`)
Test complete workflows across multiple modules.

### E2E Tests (`src/__tests__/e2e/*.test.ts`)
Test entire API from user perspective.

### Property-Based Tests (`src/__tests__/property/*.test.ts`)
Test invariants with generated inputs using @fast-check/vitest.

### Regression Tests (`src/__tests__/regression/*.test.ts`)
Prevent previously fixed bugs from reoccurring.

### Benchmarks (`src/__tests__/benchmarks/*.bench.ts`)
Measure and track performance over time.

## Build System

### Dual Package Support
Build both ESM and CJS for maximum compatibility:
- ESM: `dist/esm/` with `.js` extensions
- CJS: `dist/cjs/` with `.cjs` extensions
- Types: `dist/types/` with `.d.ts` files

### Package Exports
Use package.json exports field for conditional exports:
- Main export: `regrafter`
- Subpath exports: `regrafter/errors`, `regrafter/validation`
- Conditional exports for import/require

### File Structure
```
dist/
├── esm/           # ES modules
├── cjs/           # CommonJS modules
└── types/         # TypeScript definitions
```
