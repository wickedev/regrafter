# Dependency Types

Regrafter automatically tracks and manages six types of dependencies when moving or extracting React elements.

## Overview

When you move a JSX element to a new location, it may depend on:

- **Hooks** - React hooks like `useState`, `useEffect`, `useMemo`
- **Variables** - Local variables, constants, functions
- **Imports** - External modules and components
- **Props** - Component props
- **Context** - React context values from `useContext`
- **Refs** - React refs from `useRef`, `createRef`

Regrafter analyzes these dependencies and automatically resolves them by:
- Hoisting to valid scopes
- Threading through props
- Managing imports/exports
- Creating shared modules for circular dependencies

---

## Hook Dependencies

### What Are Hook Dependencies?

Any React hook call that an element depends on:

```typescript
function Component() {
  const [count, setCount] = useState(0);  // Hook dependency
  const data = useMemo(() => expensive(), []);  // Hook dependency

  return <Display value={count} data={data} />;  // Depends on hooks
}
```

### Resolution Strategy

Hooks **must** follow the Rules of Hooks:
- Only call hooks at the top level
- Only call hooks from React function components or custom hooks
- Cannot be conditionally called

When moving an element that depends on hooks, Regrafter:

1. **Identifies valid hoisting target** - Finds the nearest ancestor component
2. **Hoists hook to component top level** - Moves hook call to valid location
3. **Threads values through props** - Passes hook values to child components
4. **Maintains hook order** - Preserves hook call order for React

**Example:**

```typescript
// Before move
function App() {
  return (
    <Container>
      <Inner />
    </Container>
  );
}

function Inner() {
  const [count, setCount] = useState(0);
  return <Display value={count} />;
}

// After moving <Display /> to App
function App() {
  const [count, setCount] = useState(0);  // Hoisted
  return (
    <Container>
      <Display value={count} />  // Value threaded through
    </Container>
  );
}

function Inner() {
  // Hook removed, no longer needed
  return null;
}
```

### Hook Categories

Regrafter understands different hook categories:

**State Hooks:**
- `useState`
- `useReducer`

**Effect Hooks:**
- `useEffect`
- `useLayoutEffect`
- `useInsertionEffect`

**Ref Hooks:**
- `useRef`
- `useImperativeHandle`

**Context Hooks:**
- `useContext`

**Memoization Hooks:**
- `useMemo`
- `useCallback`

**Transition Hooks:**
- `useTransition`
- `useDeferredValue`

**ID Hooks:**
- `useId`

**Sync Hooks:**
- `useSyncExternalStore`

**Debug Hooks:**
- `useDebugValue`

---

## Variable Dependencies

### What Are Variable Dependencies?

Local variables, constants, and functions that an element depends on:

```typescript
function Component() {
  const name = "World";  // Variable dependency
  const greeting = `Hello ${name}`;  // Variable dependency
  const handleClick = () => alert(greeting);  // Variable dependency

  return <Button onClick={handleClick}>{greeting}</Button>;
}
```

### Resolution Strategy

Variables can be resolved in multiple ways:

1. **Hoist to common scope** - Move variable to ancestor scope
2. **Thread as prop** - Pass variable value through props
3. **Inline value** - Inline simple literals/constants
4. **Extract to module** - Move to shared module for cross-file moves

**Decision criteria:**

- If variable is used only by moved element → hoist with element
- If variable is used by multiple scopes → hoist to common ancestor
- If variable is simple literal → inline
- If variable is complex → thread as prop

**Example - Hoist to common scope:**

```typescript
// Before
function App() {
  return (
    <Container>
      <Inner />
    </Container>
  );
}

function Inner() {
  const message = "Hello";
  return <Display text={message} />;
}

// After moving <Display /> to App
function App() {
  const message = "Hello";  // Hoisted
  return (
    <Container>
      <Display text={message} />
    </Container>
  );
}
```

**Example - Thread as prop:**

```typescript
// Before
function App() {
  const theme = "dark";
  return <Container><Inner /></Container>;
}

function Inner() {
  return <Display />;  // Needs theme
}

// After moving <Display /> that depends on theme
function App() {
  const theme = "dark";
  return <Container><Inner theme={theme} /></Container>;
}

function Inner({ theme }) {  // Prop threading
  return <Display theme={theme} />;
}
```

### Variable Scope Rules

Regrafter respects JavaScript scoping rules:

- **Block scope** (`const`, `let`) - Cannot escape block
- **Function scope** (`var`) - Can hoist within function
- **Module scope** - Available to entire file
- **Closure capture** - Preserves closure semantics

---

## Import Dependencies

### What Are Import Dependencies?

External modules and components that an element depends on:

```typescript
import { Button } from '@/components/Button';  // Import dependency
import { format } from 'date-fns';  // Import dependency

function Component() {
  return <Button onClick={() => format(new Date())} />;
}
```

### Resolution Strategy

For same-file moves:
- Imports stay in place (already available)

For cross-file moves:
- **Add import to target file** - Import required modules
- **Update source file imports** - Remove unused imports
- **Manage named/default exports** - Handle export types correctly
- **Handle barrel imports** - Re-export from index files

**Example - Cross-file move:**

```typescript
// Before - Dashboard.tsx
import { Card } from '@/components/Card';
import { useStats } from '@/hooks/useStats';

function Dashboard() {
  return <Card title="Stats"><StatsDisplay /></Card>;
}

// Before - Sidebar.tsx
function Sidebar() {
  return <nav>Nav</nav>;
}

// After moving <Card> to Sidebar
// Dashboard.tsx
import { useStats } from '@/hooks/useStats';  // Card import removed

function Dashboard() {
  return <div />;
}

// Sidebar.tsx
import { Card } from '@/components/Card';  // Card import added

function Sidebar() {
  return (
    <nav>
      <Card title="Stats"><StatsDisplay /></Card>
    </nav>
  );
}
```

### Import Types

**Named imports:**
```typescript
import { Button, Input } from './components';
```

**Default imports:**
```typescript
import Button from './Button';
```

**Namespace imports:**
```typescript
import * as Utils from './utils';
```

**Side-effect imports:**
```typescript
import './styles.css';
```

---

## Prop Dependencies

### What Are Prop Dependencies?

Component props that an element depends on:

```typescript
function Component({ title, data, onSave }) {  // Props
  return (
    <div>
      <h1>{title}</h1>
      <Display data={data} onSave={onSave} />
    </div>
  );
}
```

### Resolution Strategy

Props require **prop threading** - passing props through the component tree:

1. **Identify required props** - Find which props are needed
2. **Add props to intermediate components** - Thread through component hierarchy
3. **Maintain type safety** - Preserve TypeScript types
4. **Minimize prop drilling** - Optimize prop paths

**Example:**

```typescript
// Before
function App() {
  const user = useUser();
  return <Container><Inner /></Container>;
}

function Inner() {
  return <UserProfile />;  // Needs user data
}

// After moving <UserProfile /> that depends on user
function App() {
  const user = useUser();
  return <Container><Inner user={user} /></Container>;
}

function Inner({ user }) {  // Prop threading
  return <UserProfile user={user} />;
}

function UserProfile({ user }) {  // Receives prop
  return <div>{user.name}</div>;
}
```

### Prop Threading Optimization

Regrafter optimizes prop threading by:

- **Shortest path** - Threads through minimal components
- **Shared props** - Reuses existing props when possible
- **Prop spreading** - Uses spread operator for multiple props
- **Destructuring** - Maintains clean component signatures

---

## Context Dependencies

### What Are Context Dependencies?

React context values accessed via `useContext`:

```typescript
const ThemeContext = React.createContext('light');

function Component() {
  const theme = useContext(ThemeContext);  // Context dependency
  return <div className={theme}>Content</div>;
}
```

### Resolution Strategy

Context dependencies are resolved by:

1. **Hoist useContext call** - Move hook to valid component
2. **Ensure provider availability** - Verify context provider exists
3. **Thread context value** - Pass value through props if needed
4. **Extract to shared module** - For cross-file context

**Example:**

```typescript
// Before
function App() {
  return (
    <ThemeProvider value="dark">
      <Container><Inner /></Container>
    </ThemeProvider>
  );
}

function Inner() {
  const theme = useContext(ThemeContext);
  return <Display theme={theme} />;
}

// After moving <Display /> to App
function App() {
  const theme = useContext(ThemeContext);  // Hoisted - INVALID!
  return (
    <ThemeProvider value="dark">
      <Container><Display theme={theme} /></Container>
    </ThemeProvider>
  );
}

// Correct resolution - thread through props
function App() {
  return (
    <ThemeProvider value="dark">
      <Container><Inner /></Container>
    </ThemeProvider>
  );
}

function Inner() {
  const theme = useContext(ThemeContext);  // Keep here
  return <Display theme={theme} />;  // Thread as prop
}
```

### Context Provider Requirements

Regrafter validates:
- Provider exists in ancestor tree
- Context is accessible at target location
- Context type compatibility

---

## Ref Dependencies

### What Are Ref Dependencies?

React refs created with `useRef` or `createRef`:

```typescript
function Component() {
  const inputRef = useRef(null);  // Ref dependency

  return (
    <div>
      <input ref={inputRef} />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
    </div>
  );
}
```

### Resolution Strategy

Refs are resolved by:

1. **Hoist ref creation** - Move `useRef` to valid component
2. **Implement ref forwarding** - Use `forwardRef` when needed
3. **Thread ref through props** - Pass ref to child components
4. **Preserve ref semantics** - Maintain mutable reference behavior

**Example - Ref hoisting:**

```typescript
// Before
function Inner() {
  const inputRef = useRef(null);
  return <input ref={inputRef} />;
}

// After moving <input /> to App
function App() {
  const inputRef = useRef(null);  // Hoisted
  return <input ref={inputRef} />;
}
```

**Example - Ref forwarding:**

```typescript
// Before
function App() {
  const inputRef = useRef(null);
  return <Container><Inner /></Container>;
}

function Inner() {
  return <input />;  // Needs ref
}

// After - with forwardRef
function App() {
  const inputRef = useRef(null);
  return <Container><Inner ref={inputRef} /></Container>;
}

const Inner = forwardRef((props, ref) => {
  return <input ref={ref} />;
});
```

### Ref Forwarding

Regrafter automatically uses `forwardRef` when:
- Ref needs to pass through component boundary
- Target component doesn't create the ref
- Ref is used by moved element

---

## Dependency Analysis

### How Dependencies Are Detected

Regrafter performs static analysis to detect dependencies:

1. **AST traversal** - Walk element's AST nodes
2. **Identifier resolution** - Resolve variable references
3. **Scope analysis** - Determine where identifiers are defined
4. **Type classification** - Categorize dependency type
5. **Usage tracking** - Track all usage locations

### Dependency Metadata

Each dependency includes:

```typescript
interface Dependency {
  type: DependencyType;      // Hook, Variable, Import, etc.
  symbol: string;            // Identifier name
  scope: string;             // Where it's defined
  locations: Location[];     // Usage locations
  resolution?: Resolution;   // How it will be resolved
}
```

### Resolution Metadata

```typescript
interface Resolution {
  strategy: ResolutionStrategy;  // Hoist, Thread, Extract
  target?: string;               // Target location
  intermediate?: string[];       // Intermediate components for threading
}
```

---

## Complex Dependency Scenarios

### Transitive Dependencies

Dependencies can have their own dependencies:

```typescript
function Component() {
  const data = fetchData();           // Depends on fetchData
  const filtered = filter(data);      // Depends on data and filter
  const mapped = filtered.map(transform);  // Depends on filtered and transform

  return <Display items={mapped} />;  // Depends on mapped
}
```

Regrafter resolves transitively - all dependencies in the chain are hoisted.

### Circular Dependencies

Cross-file moves can create circular imports:

```typescript
// File A imports from B
// File B needs to import from A

// Regrafter creates shared module:
// shared.ts - contains shared dependencies
// A.ts - imports from shared.ts
// B.ts - imports from shared.ts
```

### Multiple Scope Dependencies

Element depends on variables from different scopes:

```typescript
const moduleVar = "module";

function Outer() {
  const outerVar = "outer";

  function Inner() {
    const innerVar = "inner";
    return <Display a={moduleVar} b={outerVar} c={innerVar} />;
  }
}
```

Regrafter hoists to the deepest common scope that satisfies all dependencies.

---

## Best Practices

1. **Keep dependencies minimal** - Reduce coupling between components
2. **Use props for data flow** - Explicit is better than implicit
3. **Avoid deep prop drilling** - Consider context for deeply nested data
4. **Minimize hook dependencies** - Simpler components are easier to move
5. **Use stable references** - `useCallback`, `useMemo` for stable values
6. **Extract shared logic** - Custom hooks for reusable logic

---

## See Also

- [API Reference](./api-reference.md) - Full API documentation
- [Examples](./examples.md) - Practical usage examples
- [Advanced Usage](./advanced-usage.md) - Custom dependency handling
