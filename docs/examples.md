# Examples

Comprehensive examples demonstrating Regrafter's APIs in real-world scenarios.

## Move Examples

### Basic Element Move

Move a JSX element from one location to another within the same file.

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
          <Footer />
        </div>
      );
    }
  `
}];

// Move <Counter /> inside <Header />
const result = move(
  files,
  { file: 'App.tsx', line: 7, column: 11 },  // from: Counter element
  { file: 'App.tsx', line: 6, column: 11 },  // to: Header element
  Move.Inside
);

if (isOk(result)) {
  console.log('Transformed code:', result.value[0].content);
  // Header now contains Counter with automatic prop threading
}
```

---

### Move with Dependencies

Moving an element that has local dependencies automatically hoists them.

```typescript
import { move, Move, isOk } from 'regrafter';

const files = [{
  path: 'Dashboard.tsx',
  content: `
    function Dashboard() {
      const [data, setData] = useState([]);
      const [filter, setFilter] = useState('');

      const filteredData = useMemo(() =>
        data.filter(item => item.name.includes(filter)),
        [data, filter]
      );

      return (
        <div>
          <Sidebar />
          <MainContent>
            <DataTable data={filteredData} />
          </MainContent>
        </div>
      );
    }
  `
}];

// Move DataTable to Sidebar - dependencies will be hoisted
const result = move(
  files,
  { file: 'Dashboard.tsx', line: 14, column: 13 },  // DataTable
  { file: 'Dashboard.tsx', line: 12, column: 11 },  // Sidebar
  Move.Inside
);

if (isOk(result)) {
  // filteredData, data, setData, filter, setFilter are automatically
  // made available to Sidebar via props
  console.log(result.value[0].content);
}
```

---

### Cross-File Move

Move elements between files with automatic import management.

```typescript
import { move, Move, isOk } from 'regrafter';

const files = [
  {
    path: 'Dashboard.tsx',
    content: `
      import { UserProfile } from './UserProfile';

      function Dashboard() {
        return (
          <div>
            <UserProfile userId="123" />
            <MainContent />
          </div>
        );
      }
    `
  },
  {
    path: 'Sidebar.tsx',
    content: `
      function Sidebar() {
        return <nav>Navigation</nav>;
      }
    `
  }
];

// Move UserProfile from Dashboard to Sidebar
const result = move(
  files,
  { file: 'Dashboard.tsx', line: 6, column: 13 },  // UserProfile
  { file: 'Sidebar.tsx', line: 3, column: 16 },    // Sidebar nav
  Move.Before
);

if (isOk(result)) {
  // Sidebar.tsx now imports UserProfile automatically
  // Dashboard.tsx import is updated/removed if unused
  const sidebar = result.value.find(f => f.file === 'Sidebar.tsx');
  console.log('Sidebar with import:', sidebar?.content);
}
```

---

### Move Text Nodes

Move text content between elements.

```typescript
import { move, Move, isOk } from 'regrafter';

const files = [{
  path: 'Component.tsx',
  content: `
    function Component() {
      return (
        <div>
          <h1>Hello World</h1>
          <p>Welcome</p>
        </div>
      );
    }
  `
}];

// Move "Hello World" text from h1 to p
const result = move(
  files,
  { file: 'Component.tsx', line: 5, column: 15 },  // "Hello World" text
  { file: 'Component.tsx', line: 6, column: 14 },  // <p> element
  Move.Inside
);

if (isOk(result)) {
  console.log(result.value[0].content);
  // <p> now contains "Hello World"
  // <h1> is empty or removed
}
```

---

### Move Expressions

Move expression containers between elements.

```typescript
import { move, Move, isOk } from 'regrafter';

const files = [{
  path: 'Component.tsx',
  content: `
    function Component() {
      const name = "World";
      const greeting = "Hello";

      return (
        <div>
          <h1>{greeting}</h1>
          <p>{name}</p>
        </div>
      );
    }
  `
}];

// Move {name} expression from p to h1
const result = move(
  files,
  { file: 'Component.tsx', line: 9, column: 14 },  // {name}
  { file: 'Component.tsx', line: 8, column: 15 },  // {greeting} in h1
  Move.After
);

if (isOk(result)) {
  // <h1> now contains both expressions
  console.log(result.value[0].content);
}
```

---

## Extract Examples

### Basic Component Extraction

Extract JSX into a reusable component.

```typescript
import { extract, isOk } from 'regrafter';

const files = [{
  path: 'App.tsx',
  content: `
    function App() {
      const [user, setUser] = useState(null);

      return (
        <div>
          <header>
            <img src={user?.avatar} alt={user?.name} />
            <h1>{user?.name}</h1>
            <p>{user?.email}</p>
          </header>
          <main>Content</main>
        </div>
      );
    }
  `
}];

// Extract user profile section
const result = extract(
  files,
  { file: 'App.tsx', line: 7, column: 13 },  // Select <img> to <p>
  'UserProfile',
  { exportComponent: true }
);

if (isOk(result)) {
  console.log(result.value[0].content);
  // Creates UserProfile component with user prop
  // Replaces selected JSX with <UserProfile user={user} />
}
```

---

### Extract to Separate File

Extract component to a new file.

```typescript
import { extract, isOk } from 'regrafter';

const files = [{
  path: 'Dashboard.tsx',
  content: `
    function Dashboard() {
      const stats = useStats();

      return (
        <div>
          <div className="stats-card">
            <h2>{stats.title}</h2>
            <p className="value">{stats.value}</p>
            <p className="change">{stats.change}%</p>
          </div>
        </div>
      );
    }
  `
}];

// Extract to new file
const result = extract(
  files,
  { file: 'Dashboard.tsx', line: 7, column: 11 },
  'StatsCard',
  {
    targetFile: 'components/StatsCard.tsx',
    exportComponent: true,
    memo: true  // Wrap in React.memo
  }
);

if (isOk(result)) {
  const codes = result.value;

  // Find new file
  const newFile = codes.find(c => c.file === 'components/StatsCard.tsx');
  if (newFile) {
    console.log('Created StatsCard.tsx:', newFile.content);
  }

  // Original file updated with import
  const dashboard = codes.find(c => c.file === 'Dashboard.tsx');
  console.log('Updated Dashboard.tsx:', dashboard?.content);
}
```

---

### Extract with forwardRef

Extract component that needs ref forwarding.

```typescript
import { extract, isOk } from 'regrafter';

const files = [{
  path: 'Form.tsx',
  content: `
    function Form() {
      const inputRef = useRef(null);

      return (
        <form>
          <label>Name:</label>
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter name"
          />
        </form>
      );
    }
  `
}];

// Extract input with ref forwarding
const result = extract(
  files,
  { file: 'Form.tsx', line: 8, column: 11 },
  'TextInput',
  {
    exportComponent: true,
    forwardRef: true  // Enable ref forwarding
  }
);

if (isOk(result)) {
  console.log(result.value[0].content);
  // Creates TextInput with forwardRef
  // Original ref is forwarded to the component
}
```

---

## Inline Examples

### Basic Component Inlining

Inline a simple component at all call sites.

```typescript
import { inline, isOk } from 'regrafter';

const files = [{
  path: 'components.tsx',
  content: `
    function Button({ label, onClick }) {
      return (
        <button className="btn" onClick={onClick}>
          {label}
        </button>
      );
    }

    function App() {
      return (
        <div>
          <Button label="Click me" onClick={() => alert('Hi')} />
          <Button label="Submit" onClick={handleSubmit} />
        </div>
      );
    }
  `
}];

// Inline Button component
const result = inline(
  files,
  { file: 'components.tsx', name: 'Button' }
);

if (isOk(result)) {
  const { codes, inlinedCallSites, removedDefinition } = result.value;

  console.log(`Inlined ${inlinedCallSites} call sites`);
  console.log(`Definition removed: ${removedDefinition}`);
  console.log('Result:', codes[0].content);

  // Both <Button /> calls are replaced with inline <button> elements
  // Button definition is removed
}
```

---

### Selective Inlining

Inline only specific call sites.

```typescript
import { inline, isOk } from 'regrafter';

const files = [{
  path: 'App.tsx',
  content: `
    function SmallComponent({ text }) {
      return <span className="small">{text}</span>;
    }

    function App() {
      return (
        <div>
          <SmallComponent text="One" />
          <SmallComponent text="Two" />
          <SmallComponent text="Three" />
        </div>
      );
    }
  `
}];

// Inline only first and third call sites
const result = inline(
  files,
  'SmallComponent',
  {
    callSites: [
      { file: 'App.tsx', line: 9, column: 11 },   // First
      { file: 'App.tsx', line: 11, column: 11 }   // Third
    ],
    preserveDefinition: true  // Keep component definition
  }
);

if (isOk(result)) {
  console.log('Inlined 2 out of 3 call sites');
  console.log('Component definition preserved');
}
```

---

### Inline with Complex Props

Handle components with complex prop transformations.

```typescript
import { inline, isOk } from 'regrafter';

const files = [{
  path: 'App.tsx',
  content: `
    function Card({ title, children, footer }) {
      return (
        <div className="card">
          <div className="card-header">
            <h2>{title}</h2>
          </div>
          <div className="card-body">
            {children}
          </div>
          {footer && (
            <div className="card-footer">
              {footer}
            </div>
          )}
        </div>
      );
    }

    function App() {
      return (
        <Card
          title="User Profile"
          footer={<button>Save</button>}
        >
          <p>Content here</p>
        </Card>
      );
    }
  `
}];

// Inline Card component
const result = inline(
  files,
  'Card',
  { simplifyJSX: true }  // Simplify resulting JSX
);

if (isOk(result)) {
  console.log(result.value.codes[0].content);
  // Props are substituted correctly:
  // - title becomes "User Profile"
  // - children becomes <p>Content here</p>
  // - footer becomes <button>Save</button>
}
```

---

## Validation & Analysis Examples

### Check Before Moving

Validate before expensive operations.

```typescript
import { canMove, move, Move, isOk } from 'regrafter';

// Quick check (fast)
if (canMove(files, from, to, Move.Inside)) {
  // Safe to proceed
  const result = move(files, from, to, Move.Inside);

  if (isOk(result)) {
    console.log('Move successful');
  }
} else {
  console.log('Move not possible');
}
```

---

### Detailed Analysis

Get detailed information about dependencies and hoisting.

```typescript
import { analyze, Move, isOk } from 'regrafter';

const result = analyze(files, from, to, Move.Inside);

if (isOk(result)) {
  const analysis = result.value;

  if (analysis.canMove) {
    console.log('Move is possible');
    console.log('Total dependencies:', analysis.stats.totalDeps);
    console.log('Dependencies to hoist:', analysis.stats.hoistedCount);

    // Show hook dependencies
    const hooks = analysis.dependencies.filter(d => d.type === 'Hook');
    console.log('Hooks:', hooks.map(h => h.symbol));

    // Show variable dependencies
    const vars = analysis.dependencies.filter(d => d.type === 'Variable');
    console.log('Variables:', vars.map(v => v.symbol));

    // Show which dependencies will be hoisted
    console.log('Will hoist:', analysis.hoistedDeps.map(d => d.symbol));
  } else {
    console.log('Cannot move:', analysis.reason);

    // Show suggested fixes
    if (analysis.suggestedFixes) {
      for (const fix of analysis.suggestedFixes) {
        console.log(`Suggestion: ${fix.description}`);
      }
    }
  }
}
```

---

### Extract Analysis

Analyze what will be extracted before extraction.

```typescript
import { analyzeExtract, isOk } from 'regrafter';

const result = analyzeExtract(
  files,
  { file: 'App.tsx', line: 10, column: 5 },
  'MyComponent'
);

if (isOk(result)) {
  const analysis = result.value;

  if (analysis.canExtract) {
    console.log('Component props:', analysis.props.map(p => p.name));
    console.log('Dependencies:', analysis.dependencies.map(d => d.symbol));
    console.log('Hooks used:', analysis.hooks);
  } else {
    console.log('Cannot extract:', analysis.reason);
  }
}
```

---

## Optimization Examples

### Optimize After Multiple Moves

Optimize code after performing multiple transformations.

```typescript
import { move, optimize, Move, isOk, flatMap } from 'regrafter';

// Perform multiple moves
let codes = files;

const result1 = move(codes, from1, to1, Move.Inside);
if (isOk(result1)) {
  codes = result1.value;
}

const result2 = move(codes, from2, to2, Move.After);
if (isOk(result2)) {
  codes = result2.value;
}

const result3 = move(codes, from3, to3, Move.Before);
if (isOk(result3)) {
  codes = result3.value;
}

// Optimize to sink dependencies to minimal scopes
const optimized = optimize(codes, { aggressive: true });

if (isOk(optimized)) {
  console.log('Optimized code:', optimized.value);
}
```

---

### Chain Operations

Chain operations using Result monad.

```typescript
import { move, optimize, Move, flatMap, isOk } from 'regrafter';

const result = flatMap(
  move(files, from, to, Move.Inside),
  codes => optimize(codes, { aggressive: false })
);

if (isOk(result)) {
  console.log('Moved and optimized:', result.value);
} else {
  console.error('Operation failed:', result.error);
}
```

---

## Batch Processing Examples

### Process Multiple Moves

Process multiple moves efficiently with batch processing.

```typescript
import { processBatch, move, Move } from 'regrafter';

const moves = [
  {
    from: { file: 'App.tsx', line: 10, column: 5 },
    to: { file: 'App.tsx', line: 20, column: 9 }
  },
  {
    from: { file: 'Dashboard.tsx', line: 15, column: 7 },
    to: { file: 'Sidebar.tsx', line: 10, column: 5 }
  },
  {
    from: { file: 'Form.tsx', line: 25, column: 11 },
    to: { file: 'Form.tsx', line: 30, column: 13 }
  }
];

const batchResult = processBatch(moves, ({ from, to }) =>
  move(files, from, to, Move.Inside)
);

console.log(`Successful: ${batchResult.successCount}`);
console.log(`Failed: ${batchResult.failureCount}`);

// Process successful moves
for (const codes of batchResult.successful) {
  console.log('Move succeeded:', codes[0].file);
}

// Handle failures
for (const failure of batchResult.failed) {
  console.error(`Move ${failure.index} failed:`, failure.error.message);
}
```

---

## Error Handling Examples

### Handle Specific Errors

Handle different error types appropriately.

```typescript
import {
  move,
  Move,
  isErr,
  isValidationError,
  isDependencyError,
  isSelectorError
} from 'regrafter';

const result = move(files, from, to, Move.Inside);

if (isErr(result)) {
  const error = result.error;

  if (isSelectorError(error)) {
    console.error('Element not found or invalid selection');
    console.error('File:', error.context?.file);
    console.error('Position:', error.context?.line, error.context?.column);
  } else if (isValidationError(error)) {
    console.error('Move violates constraints');
    console.error('Reason:', error.message);

    // Show suggested fixes
    for (const fix of error.suggestions) {
      console.log('Try:', fix.description);
    }
  } else if (isDependencyError(error)) {
    console.error('Cannot resolve dependencies');
    console.error('Affected:', error.context?.symbols);
  }
}
```

---

### Recovery Example

Attempt automatic recovery from errors.

```typescript
import { move, Move, isErr, isRecoverable, attemptRecovery } from 'regrafter';

const result = move(files, from, to, Move.Inside);

if (isErr(result)) {
  if (isRecoverable(result.error)) {
    console.log('Attempting automatic recovery...');

    const recovery = await attemptRecovery(result.error);

    if (recovery.success) {
      console.log('Recovery successful!');
      console.log('Result:', recovery.result);

      if (recovery.warnings) {
        console.warn('Warnings:', recovery.warnings);
      }
    } else {
      console.error('Recovery failed:', recovery.reason);
    }
  } else {
    console.error('Error is not recoverable');
  }
}
```

---

## Advanced Examples

See [Advanced Usage](./advanced-usage.md) for:

- Custom dependency analysis
- Hoisting strategy control
- Atomic unit detection
- AST path selectors
- Custom transformations
