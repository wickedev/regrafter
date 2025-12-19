# Product Steering

## Purpose

Regrafter is a programmatic AST transformation library for relocating and extracting React/JSX elements with automatic dependency management. It enables safe movement and extraction of components within and across files.

## Core Value Proposition

- **Safety**: Transformed code always compiles and maintains semantic correctness
- **Automation**: Dependencies are analyzed and resolved automatically (hooks, variables, imports, props)
- **Predictability**: Invalid operations are detectable before execution via validation APIs
- **Type Safety**: Full TypeScript support with Result monad pattern for error handling

## Key Features

### 1. Element Relocation (regraft API)
Move JSX elements as children (Inside), before, or after target elements with automatic dependency hoisting.

### 2. Component Extraction (extract API)
Extract JSX elements into new components with automatic:
- Dependency analysis and prop inference
- Component name generation
- Type annotation generation
- Import/export management
- Cross-file extraction support

### 3. Component Inlining (inline API)
Inline component usages by replacing instances with their implementation:
- Same-file and cross-file inlining
- Automatic prop substitution
- Transitive import resolution
- Component definition removal

### 4. Dependency Analysis
Automatically identify and track:
- Hook dependencies (useState, useEffect, useContext, etc.)
- Variable dependencies (const, let declarations)
- Import dependencies (external module references)
- Prop dependencies (component props)
- Context dependencies (React context)
- Ref dependencies (useRef, createRef)

### 5. Automatic Hoisting
Hoist dependencies to valid scopes following React Hook rules:
- Hook hoisting respects Rules of Hooks
- Variable hoisting to common ancestor scopes
- Prop threading through component trees
- Cross-file dependency resolution

### 6. Dependency Optimization
Sink over-hoisted dependencies back to minimal scopes for cleaner code.

### 7. Cross-File Operations
Move and extract elements between files with:
- Automatic import/export management
- Circular dependency detection and resolution
- Shared module creation when needed

## API Design Principles

### Result Monad Pattern (v2.0.0+)
All APIs return `Result<T, RegraffError>` for type-safe error handling:
- Use `result.ok` to check success
- Use `result.value` for success data
- Use `result.error` for error details
- Type guards: `isOk()`, `isErr()`
- Functional helpers: `map()`, `flatMap()`, `unwrap()`, `tryCatch()`

### API Levels
Provide both unified APIs for simple use and individual APIs for fine-grained control:
- **Unified**: `regraft()`, `extract()`, `inline()` - One-call complete operations
- **Individual**: `canMove()`, `move()`, `analyze()`, `optimize()` - Composable building blocks
- **Validation**: `canExtract()`, `analyzeExtract()` - Pre-flight checks

### Error Handling
Comprehensive error system with:
- Categorized errors (Parse, Selector, Dependency, Validation, Circular, Transform, Internal)
- Error codes (E001-E099) for programmatic handling
- Suggested fixes with automatic/manual indicators
- Error recovery strategies where possible

## Business Logic Rules

### Element Movement Rules
- Treat conditional expressions (`{cond && <E />}`) as atomic units
- Treat map expressions (`{items.map(...)}`) as atomic units
- Treat compound components (`<Tabs.Panel>`) as atomic units
- Hook hoisting must respect React Rules of Hooks (no conditionals, no loops)
- Cross-file moves may create shared modules to avoid circular dependencies
- Only `eval()` and dynamic code execution are truly unanalyzable/unmovable

### Component Extraction Rules
- Extract only valid JSX elements, text nodes, or expression containers
- Generate component names based on semantic analysis
- Infer prop types from usage context
- Preserve original formatting and comments
- Support both function and arrow function component styles
- Handle nested extractions with proper scope management

### Component Inlining Rules
- Inline all component usages in all files
- Remove component definition after inlining
- Substitute props with inline expressions
- Copy transitive imports from component file
- Preserve behavior and semantics exactly

## Target Users

1. **IDE/Editor Developers**: Integrate refactoring capabilities via position-based selectors
2. **Codemod Authors**: Build automated refactoring scripts via path-based selectors
3. **Code Review Tools**: Analyze proposed changes before execution
4. **React Developers**: Safely refactor component hierarchies

## Success Metrics

- **Correctness**: 100% of transformations must produce valid, compilable code
- **Performance**: Single file (<1000 lines) in <100ms, multi-file (10 files) in <500ms
- **Validation Speed**: `canMove()` and `canExtract()` in <20% of full operation time
- **Memory Efficiency**: <10x source file size
- **Developer Experience**: Clear error messages with actionable suggestions
