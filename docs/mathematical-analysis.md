# Regrafter - Mathematical Implementation Feasibility Analysis

> **Regrafter**: React Element Rearrangement Library Through Programmatic AST Transformation

> **📝 Document Status**: Updated to reflect actual implementation (v3.1, 2025-12-18)
> - API updated to use Result<T, E> pattern
> - Functions are now independent (not namespaced under regraft)
> - Added TransformedCode and RegraffError types

---

## 1. Problem Definition

### 1.1 Target API

```typescript
import { regraft, canMove, analyze, optimize, Move } from 'regrafter';
import type { Result } from 'regrafter/result';

// Unified API (canMove + move + analyze + optimize)
regraft(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result<TransformedCode, RegraffError>

interface Options {
  optimize?: boolean;        // Sinking optimization (default: true)
  dryRun?: boolean;          // Analysis only without actual transformation (default: false)
  preserveComments?: boolean; // Preserve comments (default: true)
  formatOutput?: boolean;    // Prettier formatting (default: true)
}

// Result pattern (functional error handling)
type Result<T, E> = Ok<T> | Err<E>

interface TransformedCode {
  codes: Code[];           // Transformed code
  analysis: MoveAnalysis;  // Analysis results
}

enum Move {
  Inside = 'inside',  // As a child of 'to'
  Before = 'before',  // As a previous sibling of 'to'
  After = 'after'     // As a next sibling of 'to'
}

// Individual APIs (independent functions)
canMove(files, from, to, mode): boolean
analyze(files, from, to, mode): MoveAnalysis
optimize(files, options?): Code[]
```

### 1.2 Core Requirements

```
1. When moving an element, dependencies must also move
   - Hooks like useState, useEffect, etc.
   - Variable declarations (const, let)
   - Import statements

2. Code must build successfully after the move

3. Impossible moves must be detectable in advance
```

### 1.3 Mathematical Representation

```
regraft: (Files, From, To, Mode) → Code[] | ⊥

where:
  Files = Source file set
  From  = Selector for element to move
  To    = Destination selector
  Mode  = Inside | Before | After
  ⊥     = Move impossible (validated in advance by canRegraft)
```

---

## 2. Dependency Graph Model

### 2.1 Dependency Definition

The set of all symbols referenced by element E:

```
deps(E) = { s | E references symbol s }

Symbol types:
├── Hook: useState, useEffect, useContext, ...
├── Variable: const, let declarations
├── Import: External modules
└── Prop: Values passed from parent
```

### 2.2 Example

```tsx
function Parent() {
  const [count, setCount] = useState(0);  // ← Dependency D1
  const label = "Count: ";                 // ← Dependency D2

  return (
    <div>
      <Child count={count} label={label} />  // ← Target element E to move
    </div>
  );
}
```

```
deps(E) = { count, label }
origin(count) = useState(0)  → Hook
origin(label) = "Count: "    → Variable
```

### 2.3 Dependency Graph

```
G = (V, E)

V = All symbols + All JSX elements
E = { (a, b) | b references a }

Example:
  useState(0) ← count ← <Child />
  "Count: "   ← label ← <Child />
```

---

## 3. Move Operation Definition

### 3.1 Move.Inside

```
move_inside(E, T): Move E as a child of T

Before:                    After:
<Parent>                   <Parent>
  <E />      ──────→         <T>
  <T />                        <E />
</Parent>                    </T>
                           </Parent>
```

### 3.2 Move.Before

```
move_before(E, T): Move E as a previous sibling of T

Before:                    After:
<Parent>                   <Parent>
  <T />      ──────→         <E />
  <E />                      <T />
</Parent>                  </Parent>
```

### 3.3 Move.After

```
move_after(E, T): Move E as a next sibling of T

Before:                    After:
<Parent>                   <Parent>
  <E />      ──────→         <T />
  <T />                      <E />
</Parent>                  </Parent>
```

---

## 4. Dependency Movement Algorithm

### 4.1 Core Principle

When element E moves, deps(E) must also be in a valid scope.

```
∀ d ∈ deps(E): scope(d) ⊇ scope(E')

where E' = New position of E after move
```

### 4.2 Dependency Movement Strategy

```
Strategy: ResolveDependencies(E, target)

FOR EACH d IN deps(E):
  IF d is not accessible in target scope:
    CASE d.type:
      Hook     → hoist_to_common_ancestor(d, E, target)
      Variable → hoist_or_pass_as_prop(d, E, target)
      Import   → add_import_to_target_file(d)
      Prop     → thread_through_ancestors(d, E, target)
```

### 4.3 Hook Hoisting

React Hooks can only be called at component top level:

```tsx
// Before: E uses count inside Parent
function Parent() {
  const [count, setCount] = useState(0);
  return <E count={count} />;
}

// After: E moves to GrandParent
function GrandParent() {
  const [count, setCount] = useState(0);  // ← Hook also hoisted
  return (
    <E count={count} />
    <Parent />
  );
}
```

### 4.4 Variable Hoisting or Prop Passing

```tsx
// Strategy 1: Hoisting (for pure values)
const label = "Count: ";  // Move to parent

// Strategy 2: Prop passing (for context-dependent values)
<Parent label={label}>
  <E label={label} />     // Pass as prop
</Parent>
```

---

## 5. Impossible Move Conditions

### 5.1 Impossible Case Definition

```typescript
regraft.canMove(files, from, to, mode): boolean

// All cases are resolvable (treated as atomic units)
return true;
```

### 5.2 Case 1: Structural Inversion (Resolvable)

```tsx
// Before: Parent wraps Child
<Parent>
  <Child />
</Parent>

// After: Child wraps Parent (inverted)
<Child>
  <Parent />
</Child>
```

```
At AST level, this is simply a nesting structure change
= Completely possible

regraft.canMove = true
```

### 5.3 Case 2: Conditional Rendering (Resolvable)

```tsx
// Treat entire conditional as one unit
{condition && <E />}  // This entire expression is one move unit

// Before:
<Parent>
  {show && <Modal />}
</Parent>

// After: Entire conditional moves
<Container>
  {show && <Modal />}  // Condition + component move together
</Container>
<Parent />
```

```
Resolution strategy:
- Treat entire conditional expression as atomic unit
- Condition and component move together
- Even with Hooks, maintain conditional call structure

regraft.canMove = true (move entire conditional as a unit)
```

### 5.4 Case 3: Dynamic Lists (Resolvable)

```tsx
// Treat entire map expression as one unit
{list.map((item) => <Card key={item.id}>{item.name}</Card>)}

// Before:
<Parent>
  {users.map((u) => <UserCard key={u.id} user={u} />)}
</Parent>

// After: Entire map moves
<Container>
  {users.map((u) => <UserCard key={u.id} user={u} />)}
</Container>
<Parent />
```

```
Resolution strategy:
- Treat entire map/filter/reduce expression as atomic unit
- Iteration logic + rendering move together
- Dependencies (users) are hoisted + passed as props using existing patterns

regraft.canMove = true (move entire dynamic list as a unit)
```

### 5.5 Case 4: Context Dependencies (Resolvable)

```tsx
// Before: Child uses ThemeContext
<ThemeProvider>
  <Parent>
    <Child />  // Uses useContext(ThemeContext)
  </Parent>
</ThemeProvider>

// Problem: What if Child moves outside ThemeProvider?
```

**Resolution Strategy A: Provider Hoisting**
```tsx
// Move Provider up to wrap the new position
<ThemeProvider>
  <Child />      // Moved position
  <Parent />
</ThemeProvider>
```

**Resolution Strategy B: Context → Props Conversion**
```tsx
// Convert context usage to props
function Parent() {
  const theme = useContext(ThemeContext);  // Parent extracts
  return <Child theme={theme} />;          // Pass as props
}

function Child({ theme }) {  // Props instead of useContext
  return <div style={{ color: theme.primary }}>...</div>;
}
```

```
regraft.canMove = true (Provider hoisting or props conversion)
```

### 5.6 Case 5: Suspense/Lazy Components (Resolvable)

```tsx
// Before: LazyComponent is inside Suspense
<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>

// Problem: Error if LazyComponent moves outside Suspense
```

**Resolution Strategy: Automatic Suspense Wrapping**
```tsx
// Move Suspense along with component or create new one
<NewParent>
  <Suspense fallback={<Loading />}>
    <LazyComponent />
  </Suspense>
</NewParent>
```

```
regraft.canMove = true (automatic Suspense boundary creation/movement)
```

### 5.7 Case 6: Compound Components (Resolvable)

```tsx
// Tabs pattern that shares internal state via Context
<Tabs>
  <Tabs.List>
    <Tabs.Tab>One</Tabs.Tab>  // Internally uses Tabs Context
  </Tabs.List>
  <Tabs.Panel>Content</Tabs.Panel>
</Tabs>

// Context connection breaks if Tabs.Tab moves outside Tabs
```

**Resolution Strategy: Same as Context Dependencies**
```
- Move Tabs together (atomic unit)
- Or apply Context dependency resolution pattern

regraft.canMove = true (treat entire Compound Component as a unit)
```

### 5.8 Case 7: Ref Forwarding (Resolvable)

```tsx
// Before: Parent holds Child's ref
function Parent() {
  const childRef = useRef(null);
  return (
    <div>
      <Child ref={childRef} />
      <button onClick={() => childRef.current.focus()}>Focus</button>
    </div>
  );
}

// Need childRef access when Child moves out
```

**Resolution Strategy: Same as Scope Escape**
```tsx
// Hoist ref to parent + inject as props
function GrandParent() {
  const childRef = useRef(null);
  return (
    <div>
      <Child ref={childRef} />
      <Parent childRef={childRef} />  // Pass ref as props
    </div>
  );
}
```

```
regraft.canMove = true (ref hoisting + props injection)
```

### 5.9 Case 8: Scope Escape (Resolvable)

```tsx
// Before: E uses localFn inside Parent
function Parent() {
  const localFn = () => { console.log('click'); };
  return (
    <div>
      <E onClick={localFn} />
      <Other onClick={localFn} />  // Existing code also uses localFn
    </div>
  );
}

// After: E moves to GrandParent
// 1. Hoist localFn to parent
// 2. Inject into Parent as props
function GrandParent() {
  const localFn = () => { console.log('click'); };  // ← Hoisted
  return (
    <div>
      <E onClick={localFn} />
      <Parent localFn={localFn} />  // ← Injected as props
    </div>
  );
}

function Parent({ localFn }) {  // ← Received as props
  return (
    <div>
      <Other onClick={localFn} />  // Existing code works normally
    </div>
  );
}
```

```
Resolution strategy:
1. Hoist dependency (localFn) to common ancestor
2. If still used in original location (Parent), inject as props
3. All references remain valid

regraft.canMove = true (resolved by hoisting + props injection)
```

### 5.10 Case 9: Cross-File Movement (Resolvable)

```tsx
// Before: file-a.tsx
const secret = "local";
const other = secret + "!";  // secret used elsewhere

export function ComponentA() {
  return <E text={secret} />;  // Want to move E to file-b.tsx
}

// After:
// shared.ts (or file-b.tsx)
export const secret = "local";  // ← Moved to shared module

// file-a.tsx
import { secret } from './shared';  // ← Added import
const other = secret + "!";  // Existing code works normally

export function ComponentA() {
  // E is removed
}

// file-b.tsx
import { secret } from './shared';  // ← Added import

export function ComponentB() {
  return <E text={secret} />;  // ← E moved here
}
```

```
Resolution strategy:
1. Move dependency (secret) to shared module + export
2. Add import to original file (file-a)
3. Add import to target file (file-b)
4. Same pattern as scope escape (file level)

regraft.canMove = true (resolved by shared module + imports)
```

---

## 6. Algorithm

### 6.1 Overall Flow

```
Algorithm: Regraft(files, from, to, mode)

1. PARSE files → AST[]
2. FIND source_element ← select(AST, from)
3. FIND target_element ← select(AST, to)
4. COMPUTE deps ← analyze_dependencies(source_element)
5. VALIDATE can_move(source_element, target_element, deps)
6. IF not valid: RETURN ⊥
7. RESOLVE dependency_moves ← resolve_dependencies(deps, target)
8. APPLY moves to AST
9. GENERATE code from AST
10. RETURN code[]
```

### 6.2 Dependency Analysis

```
Algorithm: AnalyzeDependencies(element)

deps = {}
FOR EACH identifier IN element.references:
  binding ← find_binding(identifier)
  deps.add({
    symbol: identifier,
    origin: binding,
    type: classify(binding),  // Hook | Variable | Import | Prop
    scope: binding.scope
  })
RETURN deps
```

### 6.3 Move Feasibility Validation

```
Algorithm: CanMove(source, target, deps)

// Atomic unit strategy: Treat conditionals/loops as whole units
// → Most cases are movable

// Only constraint: Code not statically analyzable like eval
FOR EACH d IN deps:
  IF is_eval_or_dynamic_code(d): RETURN false

RETURN true
```

---

## 7. Complexity Analysis

### 7.1 Time Complexity

```
Parse:           O(n)      n = Total code length
Dependency:      O(v + e)  v = Number of symbols, e = Number of references
Validation:      O(d)      d = Number of dependencies
Transformation:  O(n)
Generation:      O(n)
─────────────────────────
Total:           O(n + v + e)
```

### 7.2 Space Complexity

```
AST:             O(n)
Dependency Graph: O(v + e)
Output Code:     O(n)
─────────────────────────
Total:           O(n + v + e)
```

---

## 8. Mathematical Theorems

### Theorem 1: Necessary and Sufficient Condition for Dependency Preservation

> **"For a move to be possible, all dependencies must be accessible in the new scope."**

```
canRegraft(E, T) ⟺ ∀d ∈ deps(E): resolvable(d, scope(T))
```

### Theorem 2: Safety of Hook Hoisting

> **"Hooks can only be hoisted to common ancestors outside conditionals/loops."**

```
safe_hoist(hook, target) ⟺
  is_component_top_level(target) ∧
  ¬is_conditional(path(hook, target)) ∧
  ¬is_loop(path(hook, target))
```

### Theorem 3: Determinism of Move Operation

> **"For the same input, regraft always generates the same output."**

```
regraft(F, from, to, mode) = regraft(F, from, to, mode)  (referential transparency)
```

---

## 9. API Design

### 9.1 Core API

```typescript
import { regraft, canMove, analyze, optimize, Move } from 'regrafter';
import type { Result } from 'regrafter/result';
import type { FileInput, TransformedCode, RegraffError } from 'regrafter';

// ═══════════════════════════════════════════════
// Unified API (Recommended)
// ═══════════════════════════════════════════════
regraft(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result<TransformedCode, RegraffError>;

interface Options {
  optimize?: boolean;        // Sinking optimization (default: true)
  dryRun?: boolean;          // Analysis only (default: false)
  preserveComments?: boolean; // Preserve comments (default: true)
  formatOutput?: boolean;    // Prettier formatting (default: true)
}

// Result pattern (functional error handling)
type Result<T, E> = Ok<T> | Err<E>

interface TransformedCode {
  codes: Code[];           // Transformed code
  analysis: MoveAnalysis;  // Analysis results
}

// ═══════════════════════════════════════════════
// Individual APIs (Independent functions)
// ═══════════════════════════════════════════════
canMove(files: FileInput[], from: Selector, to: Selector, mode: Move): boolean;
analyze(files: FileInput[], from: Selector, to: Selector, mode: Move): MoveAnalysis;
optimize(files: FileInput[], options?: OptimizeOptions): Code[];
```

### 9.2 Type Definitions

```typescript
enum Move {
  Inside = "inside",
  Before = "before",
  After = "after"
}

// Selector types (position-based or path-based)
type PositionSelector = {
  file: string;
  line: number;    // 1-based
  column: number;  // 1-based
}

type PathSelector = {
  file: string;
  path: string;    // AST path (e.g., "Program.body[0].declaration")
}

type Selector = PositionSelector | PathSelector;

// File input
interface FileInput {
  path: string;
  content: string;
}

// Code result
interface Code {
  file: string;
  content: string;
  changed: boolean;
  isNew?: boolean;     // Newly created file (shared modules, etc.)
  original?: string;   // Original before change (when changed: true)
}

// Analysis result
interface MoveAnalysis {
  canMove: boolean;
  reason?: string;
  dependencies: Dependency[];
  hoistedDeps: Dependency[];        // Dependencies to be hoisted
  sunkDeps?: Dependency[];          // Sunk dependencies (optimize: true)
  suggestedFixes?: SuggestedFix[];
  stats?: AnalysisStats;
}
```

### 9.3 Usage Examples

```typescript
import { regraft, canMove, analyze, Move } from 'regrafter';
import fs from 'fs';

// Prepare file inputs
const files = [
  { path: './src/App.tsx', content: fs.readFileSync('./src/App.tsx', 'utf-8') },
  { path: './src/components/Layout.tsx', content: fs.readFileSync('./src/components/Layout.tsx', 'utf-8') }
];

const from = { file: './src/App.tsx', line: 15, column: 4 };
const to = { file: './src/components/Layout.tsx', line: 8, column: 6 };

// ═══════════════════════════════════════════════
// Unified API Usage (Recommended) - Result Pattern
// ═══════════════════════════════════════════════
const result = regraft(files, from, to, Move.Inside);
// → Performs canMove + move + analyze + optimize all at once

if (result.ok) {
  // Success: result.value contains TransformedCode
  result.value.codes.forEach(code => {
    if (code.changed) {
      fs.writeFileSync(code.file, code.content);
    }
  });
  console.log('Hoisted dependencies:', result.value.analysis.hoistedDeps);
} else {
  // Failure: result.error contains RegraffError
  console.error('Error:', result.error.message);
  console.error('Code:', result.error.code);
  console.error('File:', result.error.file);

  // Suggested fixes
  result.error.suggestions.forEach(fix => {
    console.log('Suggestion:', fix.description);
  });
}

// Analysis only (no code transformation)
const preview = regraft(files, from, to, Move.Inside, { dryRun: true });

// Disable optimization
const noOptimize = regraft(files, from, to, Move.Inside, { optimize: false });

// ═══════════════════════════════════════════════
// Individual API Usage (Fine-grained control)
// ═══════════════════════════════════════════════
// 1. Check move feasibility only
if (canMove(files, from, to, Move.Inside)) {
  console.log('Move is possible');
}

// 2. Detailed analysis
const analysis = analyze(files, from, to, Move.Inside);
if (analysis.canMove) {
  console.log('Dependencies:', analysis.dependencies);
  console.log('Will hoist:', analysis.hoistedDeps);
}

// 3. Actual transformation + optimization
const transformed = regraft(files, from, to, Move.Inside);

// Can also select by AST path
const fromPath = { file: './src/App.tsx', path: 'Program.body[0].declaration.body.body[0]' };
const pathResult = regraft(files, fromPath, to, Move.After);
```

---

## 10. Constraints

### 10.1 Resolvable Cases

| Case | Resolution Method |
|------|-------------------|
| Hook dependency | Hoist to common ancestor |
| Pure variable | Hoisting or prop passing |
| Import | Add import to target file |
| Simple Prop | Thread through path |
| Scope escape | Hoisting + inject props at original location |
| Cross-file move | Move to shared module + add imports |
| Structural inversion | Change nesting structure (AST manipulation) |
| Conditional rendering | Treat entire conditional expression as atomic unit |
| Dynamic list | Treat entire map expression as atomic unit |
| Context dependency | Provider hoisting or props conversion |
| Suspense/Lazy | Automatic Suspense boundary creation/movement |
| Compound Components | Move entire as atomic unit |
| Ref forwarding | ref hoisting + props injection |

### 10.2 Irresolvable Cases

| Case | Reason |
|------|--------|
| eval() | Arbitrary code execution - static analysis fundamentally impossible |

※ All cases except eval() are resolvable through dependency analysis + hoisting

**Dynamic import / runtime selection are also resolvable:**
```tsx
// import(variable) → Treat as variable dependency
const path = getPath();
const Component = lazy(() => import(path));
// → Hoist path and entire lazy() together

// components[type] → Same approach
const type = getType();
const Component = components[type];
// → Hoist type and entire selection logic together
```

---

## 11. Optimization: Dependency Sinking

### 11.1 Problem: Hoisting Accumulation

```tsx
// After multiple moves - all dependencies accumulate at top
function App() {
  const [a, setA] = useState(0);   // Originally from ComponentA
  const [b, setB] = useState('');  // Originally from ComponentB
  const [c, setC] = useState([]);  // Originally from ComponentC
  const helper = () => { ... };    // Originally from ComponentD

  return (
    <ComponentA a={a} setA={setA}>
      <ComponentB b={b} setB={setB}>
        <ComponentC c={c} setC={setC}>
          <ComponentD helper={helper} />
        </ComponentC>
      </ComponentB>
    </ComponentA>
  );
}
```

### 11.2 Solution: Dependency Sinking

**Inverse of hoisting** - Move dependencies down to the lowest scope where they're actually needed

```
Algorithm: SinkDependencies(ast)

FOR EACH dependency d IN root_scope:
  consumers ← find_all_consumers(d)
  lca ← lowest_common_ancestor(consumers)

  IF lca ≠ current_scope(d):
    move_dependency(d, lca)
    update_references(d)
```

### 11.3 Sinking Example

```tsx
// Before: Dependency unnecessarily at top level
function App() {
  const [count, setCount] = useState(0);  // Only used in Child

  return (
    <Parent>
      <Child count={count} setCount={setCount} />
    </Parent>
  );
}

// After: Sinking optimization applied
function App() {
  return (
    <Parent>
      <Child />  // Props removed
    </Parent>
  );
}

function Child() {
  const [count, setCount] = useState(0);  // Restored to original location
  return <div>{count}</div>;
}
```

### 11.4 Sinking Rules

```
Sinking feasibility conditions:
├── Dependency used only in a single subtree
├── Doesn't violate Hook rules (no conditionals)
└── New location is a valid scope

Sinking priority:
1. Used by single component → Move to that component
2. Shared by siblings → Keep in parent
3. Shared by parent-child → Keep in parent
```

### 11.5 Optimization Pipeline

```
regraft() internal flow:
1. canMove() → Check move feasibility
2. move() → Move + hoist if needed
3. analyze() → Analyze dependency usage
4. optimize() → Sink (when optimize: true)
5. generate() → Generate optimized code

Usage:
// Default (optimize: true)
regraft(files, from, to, mode)

// Without optimization
regraft(files, from, to, mode, { optimize: false })

// Analysis only (no code transformation)
regraft(files, from, to, mode, { dryRun: true })
```

---

## 12. Conclusion

### 12.1 Implementation Feasibility

| Item | Assessment | Notes |
|------|-----------|-------|
| Basic move | ✅ Feasible | AST manipulation |
| Dependency analysis | ✅ Feasible | Scope analysis |
| Conditional/Dynamic | ✅ Feasible | Atomic unit strategy |
| Cross-file move | ✅ Feasible | Shared module + imports |
| Validation API | ✅ Feasible | Pre-analysis |

### 12.2 Core Insights

```
Essence of Regrafter:
├── AST transformation + dependency graph analysis
├── Scope-based move feasibility determination
├── Automated Hook rules compliance
└── Pre-validation of failure cases

Difficulty:
├── Simple move: Easy
├── Dependency hoisting: Medium
├── Conditional/Dynamic: Easy (atomic unit)
└── Cross-file move: Medium (shared module creation)
```

### 12.3 Recommended Implementation Order

1. **Phase 1**: Sibling moves within single file (Before/After)
2. **Phase 2**: Parent-child moves within single file (Inside)
3. **Phase 3**: Automatic dependency hoisting
4. **Phase 4**: Cross-file moves
5. **Phase 5**: Dependency sinking optimization
6. **Phase 6**: Detailed canRegraft analysis API

---

*Document Version: 3.1*
*Analysis Date: 2025-12-18 (Updated)*
*Change History:*
- *v1.x - Runtime move analysis (deprecated)*
- *v2.0 - Slot-based static transformation (deprecated)*
- *v3.0 - Programmatic AST move + dependency analysis (2025-12-15)*
- *v3.1 - API update: Result pattern, independent functions, TransformedCode type (2025-12-18)*
