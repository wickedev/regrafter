# API Reference

Complete reference for all Regrafter APIs.

## Core APIs

### move()

Move JSX elements, text nodes, or expressions to a new location with automatic dependency management.

```typescript
function move(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result<TransformedCode[], RegraffError>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `files` | `FileInput[]` | Array of files to transform |
| `from` | `Selector` | Source element location |
| `to` | `Selector` | Target location |
| `mode` | `Move` | Positioning relative to target (`Inside`, `Before`, `After`) |
| `options` | `Options?` | Optional configuration |

**Returns:** `Result<TransformedCode[], RegraffError>`

**Example:**

```typescript
import { move, Move, isOk } from 'regrafter';

const result = move(
  files,
  { file: 'App.tsx', line: 10, column: 5 },
  { file: 'App.tsx', line: 20, column: 5 },
  Move.Inside
);

if (isOk(result)) {
  console.log('Transformed code:', result.value);
} else {
  console.error('Move failed:', result.error);
}
```

**Cross-file moves:**

```typescript
const result = move(
  files,
  { file: 'Dashboard.tsx', line: 15, column: 9 },
  { file: 'Sidebar.tsx', line: 10, column: 5 },
  Move.Inside
);

if (isOk(result)) {
  const codes = result.value;
  const newFiles = codes.filter(c => c.isNew);
  if (newFiles.length > 0) {
    console.log('Created shared modules:', newFiles.map(f => f.file));
  }
}
```

---

### extract()

Extract selected JSX into a new reusable component with automatic dependency lifting.

```typescript
function extract(
  files: FileInput[],
  selection: Selector,
  componentName: string,
  options?: ExtractOptions
): Result<TransformedCode[], RegraffError>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `files` | `FileInput[]` | Array of files to transform |
| `selection` | `Selector` | JSX to extract |
| `componentName` | `string` | Name for the new component |
| `options` | `ExtractOptions?` | Optional configuration |

**ExtractOptions:**

```typescript
interface ExtractOptions {
  targetFile?: string;        // Target file (defaults to same file)
  insertPosition?: Selector;  // Where to insert component (defaults to before current component)
  exportComponent?: boolean;  // Export the component (default: false)
  memo?: boolean;            // Wrap in React.memo (default: false)
  forwardRef?: boolean;      // Use forwardRef (default: false)
}
```

**Returns:** `Result<TransformedCode[], RegraffError>`

**Example:**

```typescript
import { extract, isOk } from 'regrafter';

// Extract JSX into a new component
const result = extract(
  files,
  { file: 'App.tsx', line: 15, column: 9 },  // Selection
  'UserProfile',                               // Component name
  { exportComponent: true, memo: true }
);

if (isOk(result)) {
  console.log('Created component UserProfile');
  console.log('Transformed code:', result.value);
}
```

**Extract to different file:**

```typescript
const result = extract(
  files,
  { file: 'Dashboard.tsx', line: 20, column: 5 },
  'DashboardCard',
  {
    targetFile: 'components/DashboardCard.tsx',
    exportComponent: true
  }
);
```

---

### inline()

Inline a component definition, replacing all call sites with the component's implementation.

```typescript
function inline(
  files: FileInput[],
  component: Component | string,
  options?: InlineOptions
): Result<InlineResult, RegraffError>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `files` | `FileInput[]` | Array of files to transform |
| `component` | `Component \| string` | Component to inline (selector or name) |
| `options` | `InlineOptions?` | Optional configuration |

**Component Selector:**

```typescript
type Component = {
  file: string;
  name: string;
} | Selector;
```

**InlineOptions:**

```typescript
interface InlineOptions {
  callSites?: Selector[];     // Specific call sites to inline (defaults to all)
  preserveDefinition?: boolean; // Keep original definition (default: false)
  simplifyJSX?: boolean;       // Simplify resulting JSX (default: true)
}
```

**Returns:** `Result<InlineResult, RegraffError>`

```typescript
interface InlineResult {
  codes: TransformedCode[];
  inlinedCallSites: number;
  removedDefinition: boolean;
}
```

**Example:**

```typescript
import { inline, isOk } from 'regrafter';

// Inline all usages of a component
const result = inline(
  files,
  { file: 'components/Button.tsx', name: 'Button' }
);

if (isOk(result)) {
  const { codes, inlinedCallSites } = result.value;
  console.log(`Inlined ${inlinedCallSites} call sites`);
}
```

**Inline specific call sites:**

```typescript
const result = inline(
  files,
  'SmallComponent',  // Component name
  {
    callSites: [
      { file: 'App.tsx', line: 10, column: 5 },
      { file: 'App.tsx', line: 25, column: 9 }
    ],
    preserveDefinition: true
  }
);
```

---

## Validation & Analysis APIs

### canMove()

Quick validation check without executing transformation.

```typescript
function canMove(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): boolean
```

**Example:**

```typescript
import { canMove, Move } from 'regrafter';

if (canMove(files, from, to, Move.Inside)) {
  // Safe to proceed
  const result = move(files, from, to, Move.Inside);
}
```

---

### analyze()

Detailed dependency analysis without performing transformation.

```typescript
function analyze(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): Result<MoveAnalysis, RegraffError>
```

**Returns:** `MoveAnalysis` object

```typescript
interface MoveAnalysis {
  canMove: boolean;
  dependencies: Dependency[];
  hoistedDeps: Dependency[];
  stats: AnalysisStats;
  reason?: string;
  suggestedFixes?: SuggestedFix[];
}
```

**Example:**

```typescript
import { analyze, Move, isOk } from 'regrafter';

const result = analyze(files, from, to, Move.Inside);

if (isOk(result)) {
  const analysis = result.value;

  if (analysis.canMove) {
    console.log('Dependencies:', analysis.dependencies);
    console.log('Would hoist:', analysis.hoistedDeps);
    console.log('Statistics:', analysis.stats);
  } else {
    console.log('Cannot move:', analysis.reason);
    console.log('Suggested fixes:', analysis.suggestedFixes);
  }
}
```

---

### canExtract()

Validate if JSX can be extracted into a component.

```typescript
function canExtract(
  files: FileInput[],
  selection: Selector
): boolean
```

---

### analyzeExtract()

Detailed analysis for component extraction.

```typescript
function analyzeExtract(
  files: FileInput[],
  selection: Selector,
  componentName: string
): Result<ExtractAnalysis, RegraffError>
```

**Returns:** `ExtractAnalysis` object

```typescript
interface ExtractAnalysis {
  canExtract: boolean;
  props: PropInfo[];
  dependencies: Dependency[];
  hooks: string[];
  reason?: string;
  suggestedFixes?: SuggestedFix[];
}
```

---

## Optimization APIs

### optimize()

Optimize files by sinking over-hoisted dependencies to minimal necessary scopes.

```typescript
function optimize(
  files: FileInput[],
  options?: OptimizeOptions
): Result<TransformedCode[], RegraffError>
```

**OptimizeOptions:**

```typescript
interface OptimizeOptions {
  aggressive?: boolean;  // More aggressive optimization (default: false)
}
```

**Example:**

```typescript
import { optimize, isOk } from 'regrafter';

const result = optimize(files, { aggressive: true });

if (isOk(result)) {
  console.log('Optimized code:', result.value);
}
```

---

## Legacy API

### regraft()

High-level API that wraps `move()` with validation and optimization. Maintained for backward compatibility.

```typescript
function regraft(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result<RegraftResult, RegraffError>
```

**Note:** New code should prefer using `move()`, `extract()`, or `inline()` directly for better control.

---

## Types

### Selector

Element selection using position or AST path.

```typescript
type Selector = PositionSelector | PathSelector;

interface PositionSelector {
  file: string;
  line: number;
  column: number;
}

interface PathSelector {
  file: string;
  path: string;  // AST path (e.g., 'Program.body[0].declaration')
}
```

---

### Move

Element positioning mode.

```typescript
enum Move {
  Inside = 'inside',   // Insert as child
  Before = 'before',   // Insert before target
  After = 'after'      // Insert after target
}
```

---

### Options

Configuration options for transformations.

```typescript
interface Options {
  optimize?: boolean;         // Run optimization (default: true)
  dryRun?: boolean;          // Preview only (default: false)
  preserveComments?: boolean; // Preserve comments (default: true)
  formatOutput?: boolean;     // Format with Prettier (default: true)
}
```

---

### FileInput

Input file specification.

```typescript
interface FileInput {
  path: string;      // File path
  content: string;   // Source code
}
```

---

### TransformedCode

Output file with transformation metadata.

```typescript
interface TransformedCode {
  file: string;      // File path
  content: string;   // Transformed code
  changed: boolean;  // Whether modified
  isNew?: boolean;   // Whether newly created
  original?: string; // Original content if changed
}
```

---

### Dependency

Dependency information.

```typescript
interface Dependency {
  type: DependencyType;
  symbol: string;
  scope: string;
  locations: Location[];
}

enum DependencyType {
  Hook = 'Hook',
  Variable = 'Variable',
  Import = 'Import',
  Prop = 'Prop',
  Context = 'Context',
  Ref = 'Ref'
}
```

---

### MoveAnalysis

Analysis result for move operations.

```typescript
interface MoveAnalysis {
  canMove: boolean;
  dependencies: Dependency[];
  hoistedDeps: Dependency[];
  stats: AnalysisStats;
  reason?: string;
  suggestedFixes?: SuggestedFix[];
}

interface AnalysisStats {
  totalDeps: number;
  hoistedCount: number;
  crossFileMove: boolean;
  sharedModulesCreated: number;
}
```

---

### SuggestedFix

Error recovery suggestion.

```typescript
interface SuggestedFix {
  description: string;
  action?: string;
  automatic: boolean;
}
```

---

## Result Monad

All Regrafter APIs use a Result monad for error handling instead of throwing exceptions.

```typescript
type Result<T, E> = Ok<T> | Err<E>;

interface Ok<T> {
  ok: true;
  value: T;
}

interface Err<E> {
  ok: false;
  error: E;
}
```

**Helper functions:**

```typescript
// Type guards
isOk(result): result is Ok<T>
isErr(result): result is Err<E>

// Constructors
ok<T>(value: T): Ok<T>
err<E>(error: E): Err<E>

// Transformations
map<T, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>
flatMap<T, U>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>
mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>

// Extraction
unwrap<T>(result: Result<T, E>): T  // Throws if Err
unwrapOr<T>(result: Result<T, E>, defaultValue: T): T
unwrapOrElse<T>(result: Result<T, E>, fn: (error: E) => T): T

// Combining
all<T>(results: Result<T, E>[]): Result<T[], E>
any<T>(results: Result<T, E>[]): Result<T, E[]>

// Async support
mapAsync<T, U>(result: Result<T, E>, fn: (value: T) => Promise<U>): Promise<Result<U, E>>
flatMapAsync<T, U>(result: Result<T, E>, fn: (value: T) => Promise<Result<U, E>>): Promise<Result<U, E>>

// Error handling
tryCatch<T>(fn: () => T): Result<T, Error>
tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>>
```

**Example usage:**

```typescript
import { move, Move, isOk, isErr, map, unwrapOr } from 'regrafter';

const result = move(files, from, to, Move.Inside);

// Type guard approach
if (isOk(result)) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error);
}

// Transformation approach
const formatted = map(result, codes =>
  codes.map(c => c.content).join('\n')
);

// Default value approach
const codes = unwrapOr(result, []);
```

---

## Batch Processing

Process multiple operations efficiently.

```typescript
interface BatchResult<T, E> {
  successful: T[];
  failed: Array<{ index: number; error: E }>;
  successCount: number;
  failureCount: number;
}

function processBatch<T, E>(
  items: T[],
  processor: (item: T) => Result<T, E>
): BatchResult<T, E>
```

**Example:**

```typescript
import { processBatch, move, Move } from 'regrafter';

const moves = [
  { from: selector1, to: target1 },
  { from: selector2, to: target2 },
  { from: selector3, to: target3 }
];

const batchResult = processBatch(moves, ({ from, to }) =>
  move(files, from, to, Move.Inside)
);

console.log(`Success: ${batchResult.successCount}`);
console.log(`Failed: ${batchResult.failureCount}`);

for (const failure of batchResult.failed) {
  console.error(`Move ${failure.index} failed:`, failure.error);
}
```
