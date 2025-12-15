# Regrafter

Programmatic AST transformation library for relocating React/JSX elements with automatic dependency management.

## Features

- **Safe Element Relocation**: Move JSX elements within and across files
- **Automatic Dependency Analysis**: Tracks variable, hook, and prop dependencies
- **Smart Hoisting**: Automatically hoists dependencies to common ancestor scopes
- **React Rules Compliance**: Ensures Hook rules are maintained during transformations
- **Optimization**: Sinks over-hoisted dependencies to optimal locations
- **Cross-file Support**: Move elements between different files with import management

## Installation

```bash
npm install regrafter
```

## Quick Start

```typescript
import { regraft, Move } from 'regrafter';

const files = [{
  path: 'App.tsx',
  content: `
    function App() {
      const [count, setCount] = useState(0);
      return (
        <div>
          <Header />
          <Counter value={count} onChange={setCount} />
          <Footer />
        </div>
      );
    }
  `
}];

// Move <Counter /> inside <Header />
const result = regraft(
  files,
  { file: 'App.tsx', line: 7, column: 11 },  // from: Counter element
  { file: 'App.tsx', line: 6, column: 11 },  // to: Header element
  Move.Inside
);

if (result.success) {
  console.log('Transformed code:', result.codes[0].content);
  console.log('Dependencies hoisted:', result.analysis.hoistedDeps);
}
```

## API Reference

### Main Functions

#### `regraft(files, from, to, mode, options?): Result`

The main entry point for element relocation.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `files` | `FileInput[]` | Array of files to transform |
| `from` | `Selector` | Source element location |
| `to` | `Selector` | Target location |
| `mode` | `Move` | Positioning relative to target |
| `options` | `Options` | Optional configuration |

**Returns:** `Result` object with transformed code and analysis.

```typescript
interface Result {
  success: boolean;
  codes: Code[];
  analysis: MoveAnalysis;
}
```

#### `analyze(files, from, to, mode): MoveAnalysis`

Analyze a proposed move without executing it.

```typescript
const analysis = analyze(files, from, to, Move.Inside);

if (analysis.canMove) {
  console.log('Dependencies:', analysis.dependencies);
  console.log('Would hoist:', analysis.hoistedDeps);
} else {
  console.log('Cannot move:', analysis.reason);
}
```

#### `canMove(files, from, to, mode): boolean`

Quick check if a move is possible.

```typescript
if (canMove(files, from, to, Move.Inside)) {
  // Safe to proceed
}
```

#### `optimize(files): Code[]`

Optimize files by sinking over-hoisted dependencies.

```typescript
const optimized = optimize(files);
```

### Types

#### `Selector`

Position-based or AST path-based element selection.

```typescript
// Position selector (IDE integration)
const posSelector: PositionSelector = {
  file: 'src/App.tsx',
  line: 10,
  column: 5
};

// Path selector (programmatic)
const pathSelector: PathSelector = {
  file: 'src/App.tsx',
  path: 'Program.body[0].declaration.body.body[2]'
};
```

#### `Move`

Element positioning mode.

```typescript
enum Move {
  Inside = 'inside',   // As child of target
  Before = 'before',   // As sibling before target
  After = 'after'      // As sibling after target
}
```

#### `Options`

Configuration options.

```typescript
interface Options {
  optimize?: boolean;       // Run sinking optimization (default: true)
  dryRun?: boolean;         // Preview only (default: false)
  preserveComments?: boolean; // Keep comments (default: true)
  formatOutput?: boolean;   // Format with Prettier (default: false)
}
```

### Error Handling

Regrafter provides structured error handling with detailed recovery suggestions.

```typescript
import {
  regraft,
  RegraffError,
  isValidationError,
  ErrorCategory
} from 'regrafter';

try {
  const result = regraft(files, from, to, Move.Inside);
} catch (error) {
  if (error instanceof RegraffError) {
    console.error(`[${error.code}] ${error.message}`);

    // Check error category
    if (error.category === ErrorCategory.Validation) {
      console.log('Validation failed:', error.toFormattedString());
    }

    // Get suggested fixes
    for (const fix of error.suggestions) {
      console.log(`Suggested: ${fix.description}`);
      if (fix.automatic) {
        console.log('  (can be auto-fixed)');
      }
    }
  }
}
```

#### Error Categories

| Category | Code Range | Description |
|----------|------------|-------------|
| Parse | E001-E009 | File parsing failures |
| Selector | E010-E019 | Element selection failures |
| Dependency | E020-E029 | Dependency analysis issues |
| Validation | E030-E039 | Constraint violations (Hook rules) |
| Circular | E040-E049 | Circular dependency detection |
| Transform | E050-E059 | AST transformation failures |
| Internal | E090-E099 | Internal errors |

### Input Validation

Runtime validation for API inputs with helpful error messages.

```typescript
import {
  validateRegraftInput,
  assertRegraftInput,
  InputValidationError
} from 'regrafter';

// Validate without throwing
const result = validateRegraftInput(files, from, to, mode, options);
if (!result.valid) {
  console.error('Validation failed:', result.errors);
}

// Assert and throw on failure
try {
  assertRegraftInput(files, from, to, mode, options);
} catch (error) {
  if (error instanceof InputValidationError) {
    console.error(`Parameter ${error.parameterName} is invalid`);
  }
}
```

## Dependency Types

Regrafter tracks and manages different types of dependencies:

| Type | Description | Resolution |
|------|-------------|------------|
| `Hook` | React hooks (useState, useEffect, etc.) | Hoist to ancestor component |
| `Variable` | Local variables (const, let) | Hoist or thread as prop |
| `Import` | External imports | Add to target file |
| `Prop` | Component props | Thread through tree |
| `Context` | React context values | Hoist provider or extract |
| `Ref` | React refs (useRef) | Hoist or forward ref |

## Examples

### Move Element Within Same Component

```typescript
const result = regraft(
  [{ path: 'App.tsx', content: appSource }],
  { file: 'App.tsx', line: 10, column: 5 },
  { file: 'App.tsx', line: 20, column: 5 },
  Move.Inside
);
```

### Move Element to Different File

```typescript
const files = [
  { path: 'Dashboard.tsx', content: dashboardSource },
  { path: 'Sidebar.tsx', content: sidebarSource }
];

const result = regraft(
  files,
  { file: 'Dashboard.tsx', line: 15, column: 9 },
  { file: 'Sidebar.tsx', line: 10, column: 5 },
  Move.Inside
);

// Check for new shared modules
const newFiles = result.codes.filter(c => c.isNew);
```

### Dry Run Preview

```typescript
const result = regraft(
  files, from, to, Move.Inside,
  { dryRun: true }
);

console.log('Would modify:', result.codes.filter(c => c.changed));
console.log('Dependencies:', result.analysis.dependencies);
```

### Handle Complex Dependencies

```typescript
const analysis = analyze(files, from, to, Move.Inside);

// Check if hooks need hoisting
const hookDeps = analysis.dependencies.filter(d => d.type === 'Hook');
if (hookDeps.length > 0) {
  console.log('Hooks to hoist:', hookDeps.map(d => d.symbol));
}

// Check suggested fixes if move is blocked
if (!analysis.canMove && analysis.suggestedFixes) {
  for (const fix of analysis.suggestedFixes) {
    console.log(`Suggestion: ${fix.description}`);
  }
}
```

## Error Recovery

Regrafter can automatically recover from some errors:

```typescript
import {
  regraft,
  isRecoverable,
  attemptRecovery,
  RegraffError
} from 'regrafter';

try {
  const result = regraft(files, from, to, Move.Inside);
} catch (error) {
  if (error instanceof RegraffError && isRecoverable(error)) {
    const recovery = await attemptRecovery(error);
    if (recovery.success) {
      console.log('Recovered:', recovery.action);
      if (recovery.warnings) {
        console.log('Warnings:', recovery.warnings);
      }
    }
  }
}
```

## TypeScript Support

Regrafter is written in TypeScript and exports comprehensive type definitions.

```typescript
import type {
  FileInput,
  Selector,
  PositionSelector,
  PathSelector,
  Move,
  Options,
  Result,
  Code,
  MoveAnalysis,
  Dependency,
  DependencyType,
  SuggestedFix,
} from 'regrafter';
```

## License

MIT
