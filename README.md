# Regrafter

Programmatic AST transformation library for relocating React/JSX elements, text nodes, and expressions with automatic dependency management.

Regrafter empowers you to safely move React components, elements, text, and expressions within and across files while automatically managing all their dependencies—hooks, variables, imports, props, context, and refs. Transform your codebase with confidence.

## Why Regrafter?

- **Safety First**: Transformed code always compiles and maintains semantic correctness
- **Fully Automated**: Dependencies are analyzed and resolved automatically—no manual tracking needed
- **Predictable**: Invalid moves are detectable before execution via `canMove()` API
- **Developer-Friendly**: Rich TypeScript support with comprehensive error handling and recovery

## Features

### Core Capabilities

- **Safe Element Relocation**: Move JSX elements, text nodes, and expression containers as children (Inside), before, or after target elements
- **Automatic Dependency Analysis**: Tracks Hook, Variable, Import, Prop, Context, and Ref dependencies
- **Smart Hoisting**: Automatically hoists dependencies to valid scopes following React Hook rules
- **Cross-File Movement**: Move elements between files with automatic import/export management
- **Dependency Optimization**: Sink over-hoisted dependencies back to minimal scopes
- **React Rules Compliance**: Ensures Hook rules are maintained during transformations

### Advanced Features

- Position-based and AST path-based selectors for flexible targeting
- Dry-run mode for safe preview of transformations
- Atomic unit detection (conditionals, map expressions, compound components)
- Support for JSX elements, text nodes, and expression containers (`{expression}`)
- Circular dependency detection and resolution
- Structured error handling with automatic recovery suggestions
- Performance optimized for files <1000 lines in <100ms

## Installation


npm install regrafter


**Requirements:**
- Node.js ≥18
- TypeScript ≥4.7.0 (optional peer dependency)

## Quick Start


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


## API Reference

### Main Functions

#### `regraft(files, from, to, mode, options?): Result`

The main entry point for element relocation with automatic dependency management.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `files` | `FileInput[]` | Array of files to transform |
| `from` | `Selector` | Source element location |
| `to` | `Selector` | Target location |
| `mode` | `Move` | Positioning relative to target (`Inside`, `Before`, `After`) |
| `options` | `Options?` | Optional configuration |

**Returns:** `Result` object with transformed code and analysis.


interface Result {
  success: boolean;
  codes: Code[];
  analysis: MoveAnalysis;
}


#### `canMove(files, from, to, mode): boolean`

Quick validation check without executing the transformation. Use this for IDE feedback or before expensive operations.


if (canMove(files, from, to, Move.Inside)) {
  // Safe to proceed with transformation
}


#### `analyze(files, from, to, mode): MoveAnalysis`

Detailed dependency analysis without performing transformation. Returns information about what hoisting would be required.


const analysis = analyze(files, from, to, Move.Inside);

if (analysis.canMove) {
  console.log('Dependencies:', analysis.dependencies);
  console.log('Would hoist:', analysis.hoistedDeps);
  console.log('Statistics:', analysis.stats);
} else {
  console.log('Cannot move:', analysis.reason);
  console.log('Suggested fixes:', analysis.suggestedFixes);
}


#### `move(files, from, to, mode): Code[]`

Lower-level API that executes movement without validation or optimization. For advanced workflows where you've already validated the operation.


const codes = move(files, from, to, Move.Inside);


#### `optimize(files, options?): Code[]`

Optimize files by sinking over-hoisted dependencies to their minimal necessary scopes.


const optimized = optimize(files, {
  aggressive: false  // Conservative optimization by default
});


### Types

#### `Selector`

Element selection using either position or AST path.


// Position selector (ideal for IDE integration)
const posSelector: PositionSelector = {
  file: 'src/App.tsx',
  line: 10,
  column: 5
};

// Path selector (for programmatic usage)
const pathSelector: PathSelector = {
  file: 'src/App.tsx',
  path: 'Program.body[0].declaration.body.body[2]'
};


#### `Move`

Element positioning mode relative to target.


enum Move {
  Inside = 'inside',   // Insert as child of target
  Before = 'before',   // Insert as sibling before target
  After = 'after'      // Insert as sibling after target
}


#### `Options`

Configuration options for `regraft()`.


interface Options {
  optimize?: boolean;         // Run dependency sinking optimization (default: true)
  dryRun?: boolean;          // Preview only, no transformation (default: false)
  preserveComments?: boolean; // Preserve code comments (default: true)
  formatOutput?: boolean;     // Format output with Prettier (default: true)
}


#### `FileInput`

Input file with path and content.


interface FileInput {
  path: string;      // File path (relative or absolute)
  content: string;   // Source code content
}


#### `Code`

Output file with transformation metadata.


interface Code {
  file: string;      // File path
  content: string;   // Transformed code
  changed: boolean;  // Whether file was modified
  isNew?: boolean;   // Whether file is newly created
  original?: string; // Original content if changed
}


### Error Handling

Regrafter provides comprehensive error handling with recovery suggestions.


import {
  regraft,
  RegraffError,
  isValidationError,
  isDependencyError,
  ErrorCategory
} from 'regrafter';

try {
  const result = regraft(files, from, to, Move.Inside);
} catch (error) {
  if (error instanceof RegraffError) {
    console.error(`[${error.code}] ${error.message}`);

    // Check error category
    switch (error.category) {
      case ErrorCategory.Parse:
        console.log('Parsing failed:', error.toFormattedString());
        break;
      case ErrorCategory.Validation:
        console.log('Validation failed:', error.toFormattedString());
        break;
      case ErrorCategory.Dependency:
        console.log('Dependency issue:', error.toFormattedString());
        break;
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


#### Error Categories

| Category | Code Range | Description |
|----------|------------|-------------|
| Parse | E001-E009 | File parsing failures |
| Selector | E010-E019 | Element selection failures |
| Dependency | E020-E029 | Dependency analysis issues |
| Validation | E030-E039 | Constraint violations (Hook rules, circular moves) |
| Circular | E040-E049 | Circular dependency detection |
| Transform | E050-E059 | AST transformation failures |
| Internal | E090-E099 | Internal errors (should not occur) |

#### Error Types


// Specialized error classes
ParseError      // Parsing failures (syntax errors)
SelectorError   // Element not found, ambiguous selection
DependencyError // Unresolvable dependencies
ValidationError // Hook rules violations, invalid moves
CircularError   // Circular dependency detected
TransformError  // AST mutation failures
InternalError   // Internal consistency errors


### Input Validation

Runtime validation for API inputs with helpful error messages.


import {
  validateRegraftInput,
  assertRegraftInput,
  validateSelector,
  validateMove,
  InputValidationError
} from 'regrafter/validation';

// Validate without throwing
const result = validateRegraftInput(files, from, to, mode, options);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Assert and throw on failure
try {
  assertRegraftInput(files, from, to, mode, options);
  // Inputs are valid, proceed
} catch (error) {
  if (error instanceof InputValidationError) {
    console.error(`Parameter ${error.parameterName} is invalid`);
    console.error(error.validationErrors);
  }
}

// Validate individual inputs
const selectorValidation = validateSelector(from);
const moveValidation = validateMove(mode);


## Dependency Types

Regrafter automatically tracks and manages these dependency types:

| Type | Description | Resolution Strategy |
|------|-------------|---------------------|
| `Hook` | React hooks (useState, useEffect, useMemo, etc.) | Hoist to ancestor component following Hook rules |
| `Variable` | Local variables (const, let, var) | Hoist to common scope or thread as prop |
| `Import` | External module imports | Add import to target file, manage exports |
| `Prop` | Component props | Thread through component tree |
| `Context` | React context values (useContext) | Hoist provider or extract to shared module |
| `Ref` | React refs (useRef, createRef) | Hoist or implement ref forwarding |

## Examples

### Move Element Within Same Component


const result = regraft(
  [{ path: 'App.tsx', content: appSource }],
  { file: 'App.tsx', line: 10, column: 5 },
  { file: 'App.tsx', line: 20, column: 5 },
  Move.Inside
);


### Move Element to Different File


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

// Check for new shared modules created to avoid circular dependencies
const newFiles = result.codes.filter(c => c.isNew);
if (newFiles.length > 0) {
  console.log('Created shared modules:', newFiles.map(f => f.file));
}


### Dry Run Preview


const result = regraft(
  files, from, to, Move.Inside,
  { dryRun: true }
);

console.log('Would modify:', result.codes.filter(c => c.changed).map(c => c.file));
console.log('Dependencies:', result.analysis.dependencies);
console.log('Hoisting required:', result.analysis.hoistedDeps);


### Handle Complex Dependencies


const analysis = analyze(files, from, to, Move.Inside);

// Check hook dependencies
const hookDeps = analysis.dependencies.filter(d => d.type === 'Hook');
if (hookDeps.length > 0) {
  console.log('Hooks to hoist:', hookDeps.map(d => d.symbol));
}

// Check context dependencies
const contextDeps = analysis.dependencies.filter(d => d.type === 'Context');
if (contextDeps.length > 0) {
  console.log('Context dependencies:', contextDeps);
}

// Review suggested fixes if move is blocked
if (!analysis.canMove && analysis.suggestedFixes) {
  for (const fix of analysis.suggestedFixes) {
    console.log(`Suggestion: ${fix.description}`);
    if (fix.action) {
      console.log(`  Action: ${fix.action}`);
    }
  }
}


### Using Path Selectors


import { regraft, Move } from 'regrafter';

// Use AST paths for precise programmatic control
const result = regraft(
  files,
  {
    file: 'App.tsx',
    path: 'Program.body[0].declaration.body.body[2].argument.children[1]'
  },
  {
    file: 'App.tsx',
    path: 'Program.body[0].declaration.body.body[2].argument.children[0]'
  },
  Move.Inside
);


### Move Text Nodes and Expressions


const files = [{
  path: 'Component.tsx',
  content: `
    function Component() {
      const name = "World";
      return (
        <div>
          <h1>Hello</h1>
          <p>{name}</p>
        </div>
      );
    }
  `
}];

// Move text node "Hello" from <h1> to <p>
const result1 = regraft(
  files,
  { file: 'Component.tsx', line: 6, column: 15 },  // "Hello" text
  { file: 'Component.tsx', line: 7, column: 14 },  // <p> element
  Move.Inside
);

// Move expression container {name} to different location
const result2 = regraft(
  files,
  { file: 'Component.tsx', line: 7, column: 14 },  // {name} expression
  { file: 'Component.tsx', line: 6, column: 11 },  // <h1> element
  Move.Before
);


### Optimization Example


// First, perform multiple moves
let result = regraft(files, from1, to1, Move.Inside);
result = regraft(result.codes, from2, to2, Move.After);
result = regraft(result.codes, from3, to3, Move.Before);

// Then optimize to sink dependencies to their optimal locations
const optimized = optimize(result.codes, {
  aggressive: true  // More aggressive optimization
});

console.log('Final optimized code:', optimized);


## Error Recovery

Regrafter provides automatic recovery for certain error conditions.


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
    console.log('Error is recoverable, attempting recovery...');

    const recovery = await attemptRecovery(error);
    if (recovery.success) {
      console.log('Recovery action:', recovery.action);
      console.log('Result:', recovery.result);

      if (recovery.warnings) {
        console.warn('Warnings:', recovery.warnings);
      }
    } else {
      console.error('Recovery failed:', recovery.reason);
    }
  }
}


## Advanced Usage

### Custom Dependency Analysis


import {
  DependencyAnalyzer,
  createDependencyAnalyzer,
  createScopeManager
} from 'regrafter';

const scopeManager = createScopeManager();
const analyzer = createDependencyAnalyzer(scopeManager);

// Perform custom analysis
const dependencies = analyzer.analyzeElement(elementPath, targetScope);
console.log('All dependencies:', dependencies);


### Hoisting Strategy Control


import {
  HoistPlanner,
  createConfiguredHoistPlanner,
  createHoistExecutor,
  HookHoister,
  VariableHoister,
  PropThreader
} from 'regrafter';

// Create custom hoisting planner with specific strategies
const planner = createConfiguredHoistPlanner({
  hookHoister: createHookHoister(),
  variableHoister: createVariableHoister(),
  propThreader: createPropThreader()
});

const executor = createHoistExecutor();

// Execute custom hoisting plan
const plan = planner.plan(dependencies, context);
executor.execute(plan, executionContext);


### Atomic Unit Detection


import {
  detectAtomicUnit,
  detectConditionalExpression,
  detectMapExpression,
  findEnclosingAtomicUnit
} from 'regrafter';

// Detect atomic units that should move together
const atomicUnit = detectAtomicUnit(jsxPath);
if (atomicUnit) {
  console.log('Atomic unit type:', atomicUnit.type);
  console.log('Should move as single unit');
}

// Find enclosing atomic unit
const enclosing = findEnclosingAtomicUnit(elementPath);


## Tech Stack

Regrafter is built on industry-standard AST manipulation tools:

- **Language**: TypeScript (strict mode, ES2022 target)
- **AST Parsing**: @babel/parser with JSX, TypeScript, and modern JS plugins
- **AST Traversal**: @babel/traverse
- **AST Types**: @babel/types
- **Code Generation**: @babel/generator
- **Testing**: Vitest with coverage

## Project Structure


regrafter/
├── src/
│   ├── index.ts              # Public API exports
│   ├── api/                  # Public API functions
│   │   ├── regraft.ts        # Main regraft() function
│   │   ├── canMove.ts        # canMove() validation
│   │   ├── move.ts           # move() execution
│   │   ├── analyze.ts        # analyze() function
│   │   └── optimize.ts       # optimize() function
│   ├── analyzer/             # Dependency analysis
│   ├── selector/             # Element selection
│   ├── transformer/          # AST transformation
│   ├── strategies/           # Hoisting strategies
│   │   ├── hook-hoister.ts
│   │   ├── variable-hoister.ts
│   │   ├── prop-threader.ts
│   │   ├── import-manager.ts
│   │   ├── context-handler.ts
│   │   └── suspense-handler.ts
│   ├── optimizer/            # Dependency sinking
│   ├── scope/                # Scope management
│   ├── parser/               # Babel parser wrapper
│   ├── generator/            # Code generation
│   ├── errors/               # Error types and handling
│   ├── validation/           # Input validation
│   └── types/                # Type definitions
├── test/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── fixtures/             # Test fixtures
├── config/                   # Build and test configs
└── dist/                     # Built output (ESM, CJS, types)


## Development

### Build


npm run build


### Test


# Run all tests
npm test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage


### Linting & Formatting


# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check

# Type check
npm run typecheck


### Benchmarking


# Run benchmarks
npm run bench

# Memory profiling
npm run bench:memory

# Generate flamegraph
npm run bench:flamegraph


## Performance

Regrafter is optimized for production use:

- **Single file** (<1000 lines): <100ms
- **Multi-file** (10 files): <500ms
- **canMove()**: <20% of full operation time
- **Memory**: <10x source file size

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Test-Driven Development**: Write failing tests first (Red → Green → Refactor)
2. **Tidy First**: Separate structural changes from behavioral changes
3. **Commit Discipline**: Only commit when all tests pass and linter is clean
4. **Small Commits**: Prefer small, focused commits over large changes

### Development Principles

This project follows Kent Beck's Test-Driven Development and "Tidy First" methodologies:

- Write the simplest failing test first
- Implement minimum code to make it pass
- Refactor only when tests are passing
- Never mix structural and behavioral changes in the same commit

## TypeScript Support

Regrafter is written in TypeScript with comprehensive type definitions.


import type {
  // Main types
  FileInput,
  Selector,
  PositionSelector,
  PathSelector,
  Move,
  Options,
  Result,
  Code,

  // Analysis types
  MoveAnalysis,
  AnalysisStats,
  Dependency,
  DependencyType,
  SuggestedFix,

  // Advanced types
  ScopeInfo,
  ComponentScope,
  HoistPlan,
  HoistContext,

  // Error types
  RegraffError,
  ErrorCategory,
  RecoveryResult,
} from 'regrafter';


## License

MIT © [wickedev](https://github.com/wickedev)

## Links

- **Repository**: https://github.com/wickedev/regrafter
- **Issues**: https://github.com/wickedev/regrafter/issues
- **npm**: https://www.npmjs.com/package/regrafter
