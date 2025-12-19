# Structure Steering

## Directory Organization

```
regrafter/
├── src/
│   ├── index.ts                      # Main public API exports
│   │
│   ├── api/                          # Public API layer
│   │   ├── types.ts                  # API type definitions
│   │   └── result-helpers.ts         # Result construction helpers
│   │
│   ├── result/                       # Result monad implementation
│   │   ├── types.ts                  # Result<T,E>, Ok<T>, Err<E>
│   │   ├── helpers.ts                # map, flatMap, unwrap, etc.
│   │   ├── async.ts                  # Async result helpers
│   │   ├── batch.ts                  # Batch processing
│   │   └── index.ts                  # Public exports
│   │
│   ├── extract/                      # Component extraction module
│   │   ├── interfaces/               # Interface definitions
│   │   │   ├── i-extract-orchestrator.ts
│   │   │   ├── i-extract-planner.ts
│   │   │   ├── i-extract-executor.ts
│   │   │   ├── i-component-builder.ts
│   │   │   ├── i-code-replacer.ts
│   │   │   ├── i-import-manager.ts
│   │   │   ├── i-input-validator.ts
│   │   │   ├── i-code-formatter.ts
│   │   │   └── index.ts
│   │   ├── extract.ts                # Main extract() API
│   │   ├── extract-orchestrator.ts   # Orchestrates extraction pipeline
│   │   ├── extract-planner.ts        # Creates extraction plans
│   │   ├── extract-executor.ts       # Executes extraction operations
│   │   ├── component-builder.ts      # Builds component code
│   │   ├── component-name-generator.ts # Generates component names
│   │   ├── extract-dependency-analyzer.ts # Analyzes dependencies
│   │   ├── import-manager.ts         # Manages imports/exports
│   │   ├── code-replacer.ts          # Replaces extracted code
│   │   ├── CodeFormatter.ts          # Formats generated code
│   │   ├── input-validator.ts        # Validates inputs
│   │   ├── node-selector.ts          # Selects nodes for extraction
│   │   ├── type-inferrer.ts          # Infers TypeScript types
│   │   ├── type-stringifier.ts       # Stringifies type annotations
│   │   ├── type-guards.ts            # Type guard utilities
│   │   ├── types.ts                  # Extract module types
│   │   ├── errors.ts                 # Extract-specific errors
│   │   └── index.ts                  # Public exports
│   │
│   ├── analyzer/                     # Dependency and validation analysis
│   │   ├── index.ts                  # Exports DependencyAnalyzer, validators
│   │   ├── types.ts                  # Analysis types
│   │   ├── atomic-unit-detector.ts   # Detects atomic JSX units
│   │   ├── component-detector.ts     # Finds component definitions
│   │   ├── dynamic-code-detector.ts  # Detects eval/Function
│   │   └── move-validator.ts         # Validates move operations
│   │
│   ├── selector/                     # Element selection
│   │   ├── types.ts                  # Selector types
│   │   ├── selector-resolver.ts      # Resolves selectors to nodes
│   │   └── index.ts                  # Public exports
│   │
│   ├── transformer/                  # AST transformation
│   │   ├── types.ts                  # Transformer types
│   │   ├── index.ts                  # JSX transformer exports
│   │   └── component-inliner.ts      # Component inlining logic
│   │
│   ├── strategies/                   # Hoisting and resolution strategies
│   │   ├── types.ts                  # Strategy types
│   │   ├── index.ts                  # Strategy exports
│   │   ├── hoist-planner.ts          # Plans hoisting operations
│   │   ├── hoist-executor.ts         # Executes hoisting plans
│   │   ├── hook-hoister.ts           # Hoists React hooks
│   │   ├── variable-hoister.ts       # Hoists variables
│   │   ├── prop-threader.ts          # Threads props
│   │   ├── import-manager.ts         # Manages imports
│   │   ├── context-handler.ts        # Handles React context
│   │   ├── suspense-handler.ts       # Handles Suspense boundaries
│   │   └── cross-file/               # Cross-file transformations
│   │       ├── index.ts              # Cross-file exports
│   │       ├── detector.ts           # Detects cross-file dependencies
│   │       └── circular-dependency.ts # Resolves circular deps
│   │
│   ├── scope/                        # Scope management
│   │   ├── types.ts                  # Scope types
│   │   └── index.ts                  # ScopeManager exports
│   │
│   ├── parser/                       # AST parsing
│   │   ├── types.ts                  # Parser types
│   │   ├── parser.ts                 # Babel parser wrapper
│   │   ├── parse-file.ts             # File parsing logic
│   │   ├── ast-store.ts              # AST caching
│   │   └── index.ts                  # Parser exports
│   │
│   ├── generator/                    # Code generation
│   │   ├── types.ts                  # Generator types
│   │   ├── index.ts                  # CodeGenerator exports
│   │   └── code-generator.ts         # Babel generator wrapper
│   │
│   ├── optimizer/                    # Dependency optimization
│   │   ├── types.ts                  # Optimizer types
│   │   ├── index.ts                  # Optimizer exports
│   │   ├── optimizer.ts              # Dependency sinking
│   │   ├── performance-optimizer.ts  # Performance optimizations
│   │   └── benchmark.ts              # Benchmark utilities
│   │
│   ├── errors/                       # Error handling system
│   │   ├── index.ts                  # Error exports
│   │   ├── error-category.ts         # Error categories
│   │   ├── error-codes.ts            # Error code definitions
│   │   ├── error-factories.ts        # Error creation functions
│   │   ├── error-recovery.ts         # Recovery strategies
│   │   └── suggested-fixes.ts        # Suggested fix generation
│   │
│   ├── validation/                   # Input validation
│   │   └── index.ts                  # Validation functions
│   │
│   ├── types/                        # Type definitions
│   │   ├── index.ts                  # Type exports
│   │   ├── public.ts                 # Public API types
│   │   ├── internal.ts               # Internal types
│   │   └── factories.ts              # Type factory functions
│   │
│   ├── utils/                        # Utilities
│   │   ├── index.ts                  # Utility exports
│   │   ├── babel-loader.ts           # Babel ESM/CJS interop
│   │   └── logger.ts                 # Logging utilities
│   │
│   └── __tests__/                    # Test files
│       ├── api/                      # API-level tests
│       ├── integration/              # Integration tests
│       ├── e2e/                      # End-to-end tests
│       ├── migration/                # Migration tests
│       ├── property/                 # Property-based tests
│       ├── regression/               # Regression tests
│       └── benchmarks/               # Performance benchmarks
│
├── test/                             # Legacy test directory (if exists)
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   └── fixtures/                     # Test fixture files
│
├── config/                           # Configuration files
│   ├── tsconfig.json                 # Base TypeScript config
│   ├── tsconfig.esm.json             # ESM build config
│   ├── tsconfig.cjs.json             # CJS build config
│   ├── tsconfig.types.json           # Type definitions config
│   ├── vitest.config.ts              # Vitest test config
│   ├── vitest.e2e.config.ts          # E2E test config
│   ├── eslint.config.cjs             # ESLint config
│   └── prettier.config.json          # Prettier config
│
├── scripts/                          # Build scripts
│   └── fix-cjs-extensions.js         # Fix CJS file extensions
│
├── dist/                             # Build output (gitignored)
│   ├── esm/                          # ES modules
│   ├── cjs/                          # CommonJS modules
│   └── types/                        # Type definitions
│
├── .claude/                          # AI steering documents
│   ├── CLAUDE.md                     # Project-specific AI guidance
│   ├── specs/regrafter/              # Specification documents
│   │   ├── requirements.md           # Requirements doc
│   │   ├── design.md                 # Design doc
│   │   └── tasks.md                  # Task breakdown
│   └── steering/                     # Steering documents (this folder)
│       ├── product.md                # Product guidance
│       ├── tech.md                   # Technical guidance
│       ├── structure.md              # Structure guidance (this file)
│       └── tdd-workflow.md           # TDD workflow guidance
│
├── package.json                      # Package configuration
├── tsconfig.json                     # TypeScript config (base)
├── README.md                         # Main documentation
└── LICENSE                           # MIT license
```

## File Naming Conventions

- Use kebab-case for filenames: `hook-hoister.ts`, `prop-threader.ts`, `extract-orchestrator.ts`
- Test files: `*.test.ts` in `__tests__/` subdirectories
- E2E test files: `*.e2e.test.ts` in `__tests__/e2e/`
- Benchmark files: `*.bench.ts` in `__tests__/benchmarks/`
- Interface files: `i-*.ts` prefix for interface definitions
- Type-only files: `types.ts` in each module
- Index files: `index.ts` for public exports

## Key File Locations

### Public API
- **Main Entry**: `src/index.ts` - Exports all public APIs
- **Public Types**: `src/types/public.ts` - User-facing types
- **API Types**: `src/api/types.ts` - API-specific types

### Core APIs
- **Regraft**: `src/index.ts` (regraft, canMove, analyze, optimize, move functions)
- **Extract**: `src/extract/extract.ts` (extract, canExtract, analyzeExtract functions)
- **Inline**: `src/index.ts` (inline function)

### Result Monad
- **Types**: `src/result/types.ts` (Result, Ok, Err)
- **Helpers**: `src/result/helpers.ts` (map, flatMap, unwrap, etc.)
- **Async**: `src/result/async.ts` (async operations)
- **Batch**: `src/result/batch.ts` (batch processing)

### Error Handling
- **Error Types**: `src/errors/index.ts` (RegraffError and subclasses)
- **Error Codes**: `src/errors/error-codes.ts` (E001-E099 definitions)
- **Error Recovery**: `src/errors/error-recovery.ts` (recovery strategies)

### Specifications
- **Requirements**: `.claude/specs/regrafter/requirements.md`
- **Design**: `.claude/specs/regrafter/design.md`
- **Tasks**: `.claude/specs/regrafter/tasks.md`

### Internal Types
- **Internal Types**: `src/types/internal.ts` (DependencyGraph, ASTStore, TransformPlan, ScopeInfo)

## Module Architecture

### Extract Module - Interface-Driven Design
The extract module demonstrates interface-driven architecture:
- All core components implement interfaces defined in `interfaces/`
- Enables dependency injection for testing
- Clear separation of concerns
- Each interface has a single responsibility

**Interface Pattern:**
```
interfaces/
  i-component-builder.ts     → component-builder.ts implements IComponentBuilder
  i-extract-planner.ts       → extract-planner.ts implements IExtractPlanner
  i-extract-executor.ts      → extract-executor.ts implements IExtractExecutor
```

### Result Module - Functional Error Handling
The result module provides functional programming patterns:
- Eliminates try/catch with Result<T, E>
- Composable operations via map/flatMap
- Type-safe error propagation
- Async support with tryCatchAsync

### Strategies Module - Pluggable Architecture
Strategy handlers are pluggable for different dependency types:
- Each strategy implements common interface
- Strategies can be composed and configured
- Cross-file strategies handle complex scenarios
- Hoist planner coordinates multiple strategies

### Parser Module - Caching Layer
Parser caches ASTs for reuse within operations:
- ASTStore maintains parsed AST cache
- Single parse per file per operation
- Reduces parsing overhead significantly

## Testing Structure

### Co-located Tests
Tests live in `__tests__/` subdirectories within each module:
```
src/extract/
  extract.ts
  component-builder.ts
  __tests__/
    extract.test.ts
    extract.e2e.test.ts
    component-builder.test.ts
```

### Top-Level Integration Tests
Complex integration tests in `src/__tests__/`:
```
src/__tests__/
  api/           # API-level tests
  integration/   # Multi-module integration
  e2e/           # End-to-end workflows
  property/      # Property-based tests
  regression/    # Regression test suite
  benchmarks/    # Performance benchmarks
```

## Import Patterns

### Public Imports (Users)
```typescript
import { regraft, extract, inline, Move } from 'regrafter';
import { RegraffError, ErrorCategory } from 'regrafter/errors';
import { validateRegraftInput } from 'regrafter/validation';
```

### Internal Imports (Within Codebase)
```typescript
import { parseFile } from './parser/parse-file.js';
import { createSelectorResolver } from './selector/index.js';
import type { Result } from './result/types.js';
```

**IMPORTANT**: Always use `.js` extension for relative imports in TypeScript source files, even though files are `.ts`. This is required for ESM compatibility.

## Build Artifacts

### Distribution Structure
```
dist/
├── esm/                    # ES Modules (.js)
│   ├── index.js
│   ├── extract/
│   ├── errors/
│   └── ...
├── cjs/                    # CommonJS (.cjs)
│   ├── index.cjs
│   ├── extract/
│   ├── errors/
│   └── ...
└── types/                  # TypeScript definitions (.d.ts)
    ├── index.d.ts
    ├── extract/
    ├── errors/
    └── ...
```

## Package Exports

The package.json exports field defines public API surface:
```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.cjs",
      "types": "./dist/types/index.d.ts"
    },
    "./errors": {
      "import": "./dist/esm/errors/index.js",
      "require": "./dist/cjs/errors/index.cjs",
      "types": "./dist/types/errors/index.d.ts"
    },
    "./validation": {
      "import": "./dist/esm/validation/index.js",
      "require": "./dist/cjs/validation/index.cjs",
      "types": "./dist/types/validation/index.d.ts"
    }
  }
}
```
