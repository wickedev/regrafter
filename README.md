# Regrafter

Programmatic AST transformation library for React/JSX code transformations with automatic dependency management.

Regrafter provides three core APIs for transforming React code:
- **move()** - Relocate JSX elements within and across files
- **extract()** - Extract JSX into reusable components
- **inline()** - Inline components at their call sites

All transformations automatically manage dependencies (hooks, variables, imports, props, context, refs) to ensure code correctness.

## Why Regrafter?

- **Safety First**: Transformed code always compiles and maintains semantic correctness
- **Fully Automated**: Dependencies are analyzed and resolved automatically—no manual tracking needed
- **Type-Safe**: Built with TypeScript, returns `Result<T, E>` instead of throwing exceptions
- **Developer-Friendly**: Rich error messages with automatic recovery suggestions

## Features

- **Safe Transformations**: Move, extract, and inline JSX with dependency management
- **Automatic Dependency Analysis**: Tracks hooks, variables, imports, props, context, and refs
- **Smart Hoisting**: Automatically hoists dependencies to valid scopes following React rules
- **Cross-File Operations**: Transform code across multiple files with import/export management
- **Optimization**: Sink over-hoisted dependencies back to minimal scopes
- **Validation**: Check operations before execution with `canMove()`, `canExtract()`
- **Dry-Run Mode**: Preview transformations without modifying files
- **Error Recovery**: Structured errors with suggested fixes

## Installation

```bash
npm install regrafter
```

**Requirements:**
- Node.js ≥18
- TypeScript ≥4.7.0 (optional peer dependency)

## Quick Start

### Move API

Relocate JSX elements with automatic dependency management:

```typescript
import { move, Move, isOk } from 'regrafter';

const files = [{
  path: 'App.tsx',
  content: `
    function App() {
      const [count, setCount] = useState(0);
      return (
        <div>
          <Header />
          <Counter value={count} onChange={setCount} />
        </div>
      );
    }
  `
}];

// Move <Counter /> inside <Header />
const result = move(
  files,
  { file: 'App.tsx', line: 7, column: 11 },  // from: Counter
  { file: 'App.tsx', line: 6, column: 11 },  // to: Header
  Move.Inside
);

if (isOk(result)) {
  console.log('Transformed:', result.value[0].content);
  // Dependencies (count, setCount) automatically hoisted and threaded
}
```

### Extract API

Extract JSX into a reusable component:

```typescript
import { extract, isOk } from 'regrafter';

const result = extract(
  files,
  { file: 'App.tsx', line: 10, column: 5 },  // Select JSX to extract
  'UserProfile',                              // Component name
  { exportComponent: true, memo: true }
);

if (isOk(result)) {
  console.log('Created component:', result.value[0].content);
  // UserProfile component created with inferred props
}
```

### Inline API

Inline a component at its call sites:

```typescript
import { inline, isOk } from 'regrafter';

const result = inline(
  files,
  { file: 'components.tsx', name: 'Button' }  // Component to inline
);

if (isOk(result)) {
  const { inlinedCallSites } = result.value;
  console.log(`Inlined ${inlinedCallSites} call sites`);
}
```

## Core APIs

### move()

Relocate JSX elements with automatic dependency management.

```typescript
move(files, from, to, mode, options?): Result<TransformedCode[], RegraffError>
```

**See:** [Move API Documentation](./docs/api-reference.md#move)

### extract()

Extract JSX into a reusable component with automatic prop inference.

```typescript
extract(files, selection, componentName, options?): Result<TransformedCode[], RegraffError>
```

**See:** [Extract API Documentation](./docs/api-reference.md#extract)

### inline()

Inline a component at its call sites.

```typescript
inline(files, component, options?): Result<InlineResult, RegraffError>
```

**See:** [Inline API Documentation](./docs/api-reference.md#inline)

### Validation & Analysis

```typescript
canMove(files, from, to, mode): boolean
analyze(files, from, to, mode): Result<MoveAnalysis, RegraffError>
canExtract(files, selection): boolean
analyzeExtract(files, selection, name): Result<ExtractAnalysis, RegraffError>
```

**See:** [Validation APIs](./docs/api-reference.md#validation--analysis-apis)

### Optimization

```typescript
optimize(files, options?): Result<TransformedCode[], RegraffError>
```

**See:** [Optimization API](./docs/api-reference.md#optimization-apis)

## Key Concepts

### Selectors

Select elements by position or AST path:

```typescript
// Position (line/column) - IDE-friendly
{ file: 'App.tsx', line: 10, column: 5 }

// AST path - Programmatic control
{ file: 'App.tsx', path: 'Program.body[0].declaration' }
```

### Move Modes

```typescript
enum Move {
  Inside = 'inside',   // Insert as child
  Before = 'before',   // Insert before target
  After = 'after'      // Insert after target
}
```

### Result Pattern

All APIs return `Result<T, E>` instead of throwing:

```typescript
import { move, isOk, isErr } from 'regrafter';

const result = move(files, from, to, Move.Inside);

if (isOk(result)) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error);
}
```

**See:** [Error Handling Guide](./docs/error-handling.md)

## Dependency Management

Regrafter automatically tracks and resolves six types of dependencies:

- **Hook** - React hooks (useState, useEffect, etc.) → Hoist to valid component
- **Variable** - Local variables → Hoist or thread as props
- **Import** - Module imports → Add/remove imports automatically
- **Prop** - Component props → Thread through component tree
- **Context** - React context → Hoist or thread values
- **Ref** - React refs → Hoist or implement ref forwarding

**See:** [Dependency Types Guide](./docs/dependency-types.md)

## Documentation

- **[API Reference](./docs/api-reference.md)** - Complete API documentation
- **[Examples](./docs/examples.md)** - Comprehensive usage examples
- **[Error Handling](./docs/error-handling.md)** - Error handling patterns
- **[Dependency Types](./docs/dependency-types.md)** - Understanding dependencies
- **[Advanced Usage](./docs/advanced-usage.md)** - Custom strategies and patterns
- **[Architecture](./docs/architecture.md)** - Technical architecture
- **[Contributing](./docs/contributing.md)** - Development guidelines

## Development

```bash
# Install dependencies
npm install

# Run tests (TDD)
npm run test:watch

# Build
npm run build

# Lint & format
npm run lint:fix
npm run format
```

**See:** [Contributing Guide](./docs/contributing.md) for development guidelines

## Performance

- Single file (<1000 lines): <100ms
- Multi-file (10 files): <500ms
- Memory: <10x source file size

**See:** [Architecture](./docs/architecture.md) for technical details

## License

MIT © [wickedev](https://github.com/wickedev)

## Links

- **Repository**: https://github.com/wickedev/regrafter
- **Issues**: https://github.com/wickedev/regrafter/issues
- **npm**: https://www.npmjs.com/package/regrafter
