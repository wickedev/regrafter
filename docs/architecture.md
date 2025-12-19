# Architecture

Technical architecture, design patterns, and implementation details of Regrafter.

## Tech Stack

### Core Technologies

- **Language**: TypeScript 5.x (strict mode, ES2022 target)
- **AST Parsing**: @babel/parser with JSX, TypeScript, and modern JS plugins
- **AST Traversal**: @babel/traverse for AST navigation
- **AST Types**: @babel/types for AST manipulation
- **Code Generation**: @babel/generator for code output
- **Testing**: Vitest with coverage reporting
- **Build**: tsup for ESM/CJS bundling

### Build Outputs

Regrafter generates three distribution formats:

- **ESM** (`dist/esm/`) - ES modules for modern bundlers
- **CJS** (`dist/cjs/`) - CommonJS for Node.js
- **Types** (`dist/types/`) - TypeScript declarations

---

## High-Level Architecture

### Pipeline Architecture

Regrafter uses a 5-stage transformation pipeline:

```
┌─────────────┐
│   Parse     │  Files → ASTs (Babel parser)
└──────┬──────┘
       │
┌──────▼──────┐
│   Select    │  Position/Path → AST nodes
└──────┬──────┘
       │
┌──────▼──────┐
│   Analyze   │  Node → Dependencies
└──────┬──────┘
       │
┌──────▼──────┐
│ Plan & Exec │  Dependencies → Hoisting operations
└──────┬──────┘
       │
┌──────▼──────┐
│  Transform  │  AST mutations → Code
└─────────────┘
```

### Stage Details

**1. Parse** (`src/parser/`)
- Parses source code into ASTs using Babel
- Caches ASTs in `ASTStore` for performance
- Handles TypeScript, JSX, and modern JavaScript

**2. Select** (`src/selector/`)
- Resolves position or path selectors to AST nodes
- Supports line/column positions (IDE-friendly)
- Supports AST paths (programmatic control)

**3. Analyze** (`src/analyzer/`)
- Analyzes element dependencies
- Classifies dependency types (Hook, Variable, Import, etc.)
- Detects atomic units that must move together
- Validates move constraints

**4. Plan & Execute** (`src/strategies/`)
- Creates hoisting plan using strategy handlers
- Executes hoisting mutations
- Manages cross-file dependencies
- Handles circular dependencies

**5. Transform & Generate** (`src/transformer/`, `src/generator/`)
- Performs element move
- Generates transformed code
- Formats output with Prettier
- Returns transformed files

---

## Result Monad Pattern

### Why Result Monad?

Regrafter uses a Result monad for error handling instead of exceptions:

**Benefits:**
- Error paths are explicit in type signatures
- Forces callers to handle errors
- Enables functional composition
- Prevents uncaught exceptions
- Better TypeScript integration

### Result Type

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

### Usage Pattern

```typescript
function doSomething(): Result<Value, RegraffError> {
  if (error) {
    return err(createError(...));
  }
  return ok(value);
}

const result = doSomething();

if (isOk(result)) {
  // result.value
} else {
  // result.error
}
```

---

## Dependency Analysis

### DependencyAnalyzer

The core dependency analysis engine:

```typescript
class DependencyAnalyzer {
  constructor(private scopeManager: ScopeManager) {}

  analyzeElement(
    element: NodePath,
    targetScope: ScopeInfo
  ): Dependency[] {
    // 1. Traverse element AST
    // 2. Find identifier references
    // 3. Resolve to declarations
    // 4. Classify dependency type
    // 5. Track usage locations
  }
}
```

### Dependency Classification

Dependencies are classified by analyzing:

- **Hooks**: `use*` function calls → Hook
- **Variables**: Local declarations → Variable
- **Imports**: Import statements → Import
- **Props**: Component parameters → Prop
- **Context**: `useContext` calls → Context
- **Refs**: `useRef`, `createRef` calls → Ref

### Transitive Analysis

Dependencies can have their own dependencies:

```typescript
const a = useState();
const b = useMemo(() => a);  // Depends on a
const c = useCallback(() => b);  // Depends on b, transitively a
```

Analyzer resolves transitively to find all dependencies.

---

## Hoisting Pipeline

### HoistPlanner

Creates execution plan for dependency hoisting:

```typescript
class HoistPlanner {
  plan(
    dependencies: Dependency[],
    context: HoistContext
  ): HoistPlan {
    // 1. Group dependencies by type
    // 2. Select strategy for each type
    // 3. Generate hoisting operations
    // 4. Order operations (dependencies first)
    // 5. Return execution plan
  }
}
```

### Strategy Pattern

Each dependency type has a specialized handler:

```typescript
interface IHoistStrategy {
  canHandle(dependency: Dependency): boolean;
  plan(dependency: Dependency, context: HoistContext): HoistPlanItem[];
}
```

**Strategies:**
- `HookHoister` - Hoists hooks following React rules
- `VariableHoister` - Hoists variables to common scope
- `PropThreader` - Threads props through component tree
- `ImportManager` - Manages imports/exports
- `ContextHandler` - Handles context dependencies
- `SuspenseHandler` - Handles suspense boundaries

### HoistExecutor

Executes the hoisting plan:

```typescript
class HoistExecutor {
  execute(
    plan: HoistPlan,
    context: HoistExecutionContext
  ): void {
    // Execute operations in order
    for (const item of plan.items) {
      this.executeItem(item, context);
    }
  }
}
```

---

## Scope Management

### ScopeManager

Builds and manages scope trees for dependency resolution:

```typescript
class ScopeManager {
  buildScopeTree(ast: Node, filePath: string): void {
    // 1. Traverse AST
    // 2. Identify scope boundaries
    // 3. Track variable declarations
    // 4. Build parent-child relationships
  }

  getScope(path: NodePath): ScopeInfo | null {
    // Find scope for given node
  }

  findCommonAncestorScope(
    scope1: ScopeInfo,
    scope2: ScopeInfo
  ): ScopeInfo | null {
    // Find common ancestor for hoisting target
  }
}
```

### Scope Types

```typescript
enum ScopeType {
  Module = 'Module',        // File scope
  Function = 'Function',    // Function scope
  Component = 'Component',  // React component
  Block = 'Block'          // Block scope (if, for, etc.)
}
```

### Component Scope

React components are special scopes that:
- Can contain hooks
- Have props
- Can have state
- Define rendering boundaries

```typescript
interface ComponentScope extends ScopeInfo {
  isComponent: true;
  props: string[];
  hooks: string[];
  state: string[];
}
```

---

## Cross-File Architecture

### Cross-File Move Strategy

Moving elements between files requires:

1. **Dependency analysis** - Find all cross-file dependencies
2. **Import management** - Add/remove imports
3. **Export management** - Add/remove exports
4. **Circular detection** - Detect circular imports
5. **Shared module creation** - Break circular dependencies

### Circular Dependency Resolution

When A imports B and B needs to import A:

```
Before:
A.tsx → B.tsx

After move:
A.tsx ↘
       shared.tsx
B.tsx ↗
```

Create shared module to break the cycle.

### Import Manager

```typescript
class ImportManager implements IHoistStrategy {
  plan(dependency: Dependency, context: HoistContext) {
    // 1. Check if cross-file
    // 2. Add import to target file
    // 3. Add export to source file
    // 4. Handle circular imports
  }
}
```

---

## Atomic Unit Detection

### Atomic Units

Some JSX must move as a unit:

**Conditional Expression:**
```jsx
{condition && <Element />}
```

**Ternary Expression:**
```jsx
{condition ? <A /> : <B />}
```

**Map Expression:**
```jsx
{items.map(item => <Item key={item.id} />)}
```

**Compound Component:**
```jsx
<Tabs.Panel />
```

### Detection

```typescript
function detectAtomicUnit(path: NodePath): AtomicUnit | null {
  // Check for conditional
  if (isConditionalExpression(path)) {
    return { type: AtomicUnitType.Conditional, ... };
  }

  // Check for ternary
  if (isTernaryExpression(path)) {
    return { type: AtomicUnitType.Ternary, ... };
  }

  // Check for map
  if (isMapExpression(path)) {
    return { type: AtomicUnitType.Map, ... };
  }

  // Check for compound
  if (isCompoundComponent(path)) {
    return { type: AtomicUnitType.Compound, ... };
  }

  return null;
}
```

---

## Optimization

### Dependency Sinking

After multiple moves, dependencies may be over-hoisted:

```typescript
// Over-hoisted
function App() {
  const value = useState();  // Only used deep in tree

  return <A><B><C value={value} /></C></B></A>;
}

// Optimized - sunk to C
function App() {
  return <A><B><C /></B></A>;
}

function C() {
  const value = useState();  // Closer to usage
  return <div>{value}</div>;
}
```

### Optimizer

```typescript
class Optimizer {
  optimize(files: FileInput[]): Code[] {
    // 1. Analyze dependency usage
    // 2. Find over-hoisted dependencies
    // 3. Sink to minimal scope
    // 4. Update prop threading
  }
}
```

---

## Component Extraction

### ExtractStrategy

Extracts JSX into new component:

```typescript
class ComponentExtractor {
  extract(
    selection: NodePath,
    name: string,
    options: ExtractOptions
  ): Result<Code[], RegraffError> {
    // 1. Analyze selected JSX
    // 2. Identify props needed
    // 3. Identify dependencies
    // 4. Create component definition
    // 5. Replace selection with component call
    // 6. Generate code
  }
}
```

### Prop Inference

Automatically infers component props from usage:

```typescript
// Selected JSX uses these
const name = "World";
const count = useState(0);

// Generates component with props
function NewComponent({ name, count }) {
  return <div>{name}: {count}</div>;
}
```

---

## Component Inlining

### InlineStrategy

Replaces component calls with implementation:

```typescript
class ComponentInliner {
  inline(
    component: Component,
    options: InlineOptions
  ): Result<InlineResult, RegraffError> {
    // 1. Find component definition
    // 2. Find all call sites
    // 3. Clone component body for each call
    // 4. Substitute props with actual values
    // 5. Copy transitive imports
    // 6. Remove definition (if not preserved)
  }
}
```

### Prop Substitution

Replace component props with actual values:

```jsx
// Component
function Button({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}

// Call site
<Button label="Click me" onClick={handleClick} />

// Inlined
<button onClick={handleClick}>Click me</button>
```

---

## Error System

### Error Hierarchy

```
RegraffError
├── ParseError (E001-E009)
├── SelectorError (E010-E019)
├── DependencyError (E020-E029)
├── ValidationError (E030-E039)
├── CircularError (E040-E049)
├── TransformError (E050-E059)
└── InternalError (E090-E099)
```

### Error Creation

```typescript
function createError(
  code: string,
  message: string,
  context?: Record<string, unknown>,
  suggestions?: SuggestedFix[]
): RegraffError {
  // Get error definition
  const def = getErrorCodeDefinition(code);

  return new RegraffErrorClass(
    code,
    message,
    def.category,
    suggestions,
    context
  );
}
```

### Error Recovery

Some errors can be automatically recovered:

```typescript
interface RecoveryStrategy {
  canRecover(error: RegraffError): boolean;
  recover(error: RegraffError): RecoveryResult;
}
```

---

## Performance Optimizations

### AST Caching

```typescript
class ASTStore {
  private cache = new Map<string, Node>();

  getOrParse(filePath: string, content: string): Node {
    const cached = this.cache.get(filePath);
    if (cached) return cached;

    const ast = parse(content);
    this.cache.set(filePath, ast);
    return ast;
  }
}
```

### Scope Tree Caching

Scope trees are built once per file and reused.

### Lazy Evaluation

Dependency analysis is only performed when needed.

### Batch Processing

Process multiple operations in a single pass.

---

## Project Structure

```
src/
├── api/                    # Public API functions
│   ├── regraft.ts         # Main regraft() API
│   ├── move.ts            # move(), canMove()
│   ├── analyze.ts         # analyze()
│   ├── extract.ts         # extract API
│   ├── inline.ts          # inline API
│   ├── optimize.ts        # optimize()
│   └── types.ts           # API types
│
├── analyzer/              # Dependency analysis
│   ├── dependency-analyzer.ts
│   ├── atomic-unit-detector.ts
│   ├── move-validator.ts
│   └── analysis-builder.ts
│
├── selector/              # Element selection
│   ├── selector-resolver.ts
│   └── position-resolver.ts
│
├── transformer/           # AST transformation
│   ├── jsx-transformer.ts
│   ├── component-inliner.ts
│   ├── component-extractor.ts
│   └── ast-mutator.ts
│
├── strategies/            # Hoisting strategies
│   ├── hoist-planner.ts
│   ├── hoist-executor.ts
│   ├── hook-hoister.ts
│   ├── variable-hoister.ts
│   ├── prop-threader.ts
│   ├── import-manager.ts
│   ├── context-handler.ts
│   ├── suspense-handler.ts
│   └── cross-file/
│       ├── circular-detector.ts
│       └── shared-module-creator.ts
│
├── optimizer/             # Dependency optimization
│   ├── optimizer.ts
│   └── dependency-sinker.ts
│
├── scope/                # Scope management
│   ├── scope-manager.ts
│   ├── scope-builder.ts
│   └── scope-query.ts
│
├── parser/               # Babel parser wrapper
│   ├── parser.ts
│   └── ast-store.ts
│
├── generator/            # Code generation
│   ├── generator.ts
│   └── formatter.ts
│
├── errors/               # Error handling
│   ├── error-codes.ts
│   ├── error-factory.ts
│   ├── suggested-fixes.ts
│   └── recovery.ts
│
├── validation/           # Input validation
│   ├── validators.ts
│   └── assertions.ts
│
├── result/              # Result monad
│   ├── result.ts
│   ├── helpers.ts
│   └── async.ts
│
├── types/               # Type definitions
│   ├── public.ts       # Public API types
│   ├── internal.ts     # Internal types
│   └── index.ts
│
└── index.ts             # Main exports
```

---

## Design Patterns

### Strategy Pattern

Used for hoisting strategies - each dependency type has its own handler.

### Builder Pattern

Used for building analysis results and error objects.

### Factory Pattern

Used for creating errors, analyzers, and managers.

### Visitor Pattern

Used for AST traversal and mutation.

### Chain of Responsibility

Used for selector resolution and error recovery.

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Single file (<1000 lines) | <100ms | ~80ms |
| Multi-file (10 files) | <500ms | ~400ms |
| canMove() overhead | <20% | ~15% |
| Memory usage | <10x source | ~6x |
| AST cache hit rate | >80% | ~90% |

---

## Testing Strategy

### Unit Tests

Test individual functions and classes:
- Dependency analysis
- Scope management
- Hoisting strategies
- Error handling

### Integration Tests

Test module interactions:
- Pipeline stages
- Cross-file moves
- Error recovery

### E2E Tests

Test full transformations:
- Real-world React code
- Complex dependency scenarios
- Edge cases

### Coverage

- Line coverage: >90%
- Branch coverage: >85%
- Function coverage: >95%

---

## Future Architecture

### Planned Improvements

1. **Plugin System** - Custom hoisting strategies
2. **Streaming Parser** - Handle large files
3. **Incremental Analysis** - Only re-analyze changed parts
4. **Parallel Processing** - Process multiple files in parallel
5. **Language Server Protocol** - IDE integration

---

## See Also

- [API Reference](./api-reference.md) - Complete API documentation
- [Contributing](./contributing.md) - Development guidelines
- [Examples](./examples.md) - Usage examples
