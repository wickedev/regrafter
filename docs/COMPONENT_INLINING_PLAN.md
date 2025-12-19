# React Component Inlining Feature - Implementation Plan

> **Document Version**: 1.0
> **Date**: December 19, 2024
> **Status**: Planning Phase
> **Estimated Effort**: 6-8 weeks (240-320 hours)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Feature Overview](#feature-overview)
3. [Complexity Assessment](#complexity-assessment)
4. [Implementation Phases](#implementation-phases)
5. [Technical Architecture](#technical-architecture)
6. [Risk Analysis](#risk-analysis)
7. [Success Criteria](#success-criteria)
8. [Implementation Timeline](#implementation-timeline)
9. [Resources Required](#resources-required)

---

## Executive Summary

This document outlines the implementation plan for adding **component inlining** capability to regrafter - a feature that allows developers to "unpack" React components by replacing component calls with their inline implementation, effectively flattening component hierarchies.

### Key Metrics

| Metric | Value |
|--------|-------|
| **Complexity** | High (8/10) |
| **Duration** | 6-8 weeks |
| **Effort** | 240-320 hours |
| **New Files** | 13 |
| **Modified Files** | 4 |
| **Risk Level** | Medium-High |

### Strategic Value

- **Use Case**: Refactoring workflow to flatten component hierarchies
- **Target Users**: Developers optimizing component structure
- **Integration**: Builds on existing regrafter infrastructure (30-40% code reuse)

---

## Feature Overview

### What is Component Inlining?

Component inlining transforms this:

```tsx
// Before
function Button({ text, onClick }) {
  return <button onClick={onClick}>{text}</button>;
}

function App() {
  return <Button text="Click me" onClick={handleClick} />;
}
```

Into this:

```tsx
// After
function App() {
  return <button onClick={handleClick}>Click me</button>;
}
// Button component removed
```

### User Requirements

Based on stakeholder input:

- ✅ **Refactoring workflow**: Flatten component hierarchy
- ✅ **All component types**: Simple, hooks, state/effects, cross-file
- ✅ **Prop handling**: Keep as inline expressions (no variable extraction)
- ✅ **Cleanup**: Always remove original component (aggressive mode)

### Scope

#### In Scope
- ✅ Simple presentational components
- ✅ Components with React Hooks (useState, useEffect, useRef, etc.)
- ✅ Components with complex state and effects
- ✅ Cross-file component inlining
- ✅ Aggressive component removal
- ✅ Transitive dependency resolution

#### Out of Scope
- ❌ Class components (focus on functional components)
- ❌ HOC unwrapping
- ❌ React.memo/forwardRef inlining (explicitly rejected for safety)

---

## Complexity Assessment

### Complexity Matrix

| Component | Complexity | Impact | Priority |
|-----------|------------|--------|----------|
| Hook Merging | 9/10 | High | P0 |
| Cross-File Operations | 8/10 | High | P0 |
| Prop Substitution | 7/10 | High | P0 |
| Component Removal | 6/10 | Medium | P1 |
| Validation | 6/10 | Medium | P1 |

### High Complexity Factors

#### 1. Hook Merging (Complexity: 9/10)

**Challenges**:
- Must preserve React Hook rules (top-level only, consistent order)
- Dependency array substitution (props → actual values)
- State variable naming conflict resolution
- Effect timing preservation
- Cleanup function handling

**Example**:
```tsx
// Child Component
function Modal({ isOpen, onClose }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    // Effect using props
  }, [isOpen, onClose]);
}

// After inlining into Parent (which already has 'count')
function Parent() {
  const showModal = true;
  const handleClose = () => {};

  // Renamed to avoid conflict
  const [count_Modal, setCount_Modal] = useState(0);

  // Dependency array substituted
  useEffect(() => {
    // Effect body
  }, [showModal, handleClose]); // Props replaced with actual values

  // ... rest of component
}
```

#### 2. Cross-File Operations (Complexity: 8/10)

**Challenges**:
- Multi-file parsing and transformation coordination
- Transitive import resolution
- Import conflict detection and resolution
- Aggressive component removal with usage detection
- File deletion when empty

**Example**:
```tsx
// components/Button.tsx
import { Icon } from './Icon';
export const Button = ({ text }) => <button><Icon />{text}</button>;

// pages/Home.tsx
import { Button } from '../components/Button';

// After inlining:
// - Button implementation moved to Home.tsx
// - Icon import added to Home.tsx
// - Button.tsx deleted (if no other exports)
```

#### 3. Prop Substitution (Complexity: 7/10)

**Challenges**:
- Inline expression substitution without variables
- Destructuring patterns
- Default values
- Spread operators
- Complex expressions in props

**Example**:
```tsx
// Component with default values and destructuring
function Card({ title = "Default", children, ...rest }) {
  return <div {...rest}><h1>{title}</h1>{children}</div>;
}

// Usage
<Card title={user.name} className="card">{content}</Card>

// After inline (props substituted directly)
<div className="card"><h1>{user.name}</h1>{content}</div>
```

### Existing Infrastructure (Complexity Reducers)

The following existing components significantly reduce implementation complexity:

| Component | Provides | Reduces |
|-----------|----------|---------|
| JSXTransformer | Element manipulation patterns | 20% effort |
| DependencyAnalyzer | 6 dependency types tracked | 15% effort |
| HookHoister | Hook Rules enforcement | 25% effort |
| ScopeManager | Component boundary tracking | 15% effort |
| ImportManager | Import statement management | 10% effort |
| Strategy Pattern | Pluggable architecture | 15% effort |

**Total Complexity Reduction**: ~30-40%

---

## Implementation Phases

### Phase 1: Simple Component Inlining (3 weeks)

**Duration**: 15 days (3 weeks)
**Team**: 1 engineer
**Deliverable**: Basic component inlining for presentational components

#### Components to Build

1. **`src/analyzer/component-detector.ts`** (3 days)
   - Identify React components (function/arrow)
   - Classify components (simple, hooks, complex)
   - Detect inlineability (no hooks, no state, etc.)
   - Extract component metadata

2. **`src/transformer/prop-substituter.ts`** (4 days)
   - Extract prop values from JSX call site
   - Handle destructuring patterns
   - Handle default values
   - Handle spread operators
   - Substitute props in component JSX

3. **`src/transformer/component-inliner.ts`** (3 days)
   - Orchestrate inlining operation
   - Replace component call with inline JSX
   - Remove component definition
   - Coordinate with validators

4. **`src/analyzer/inline-validator.ts`** (2 days)
   - Pre-validation checks
   - Component type validation
   - Inlineability checks
   - Error message generation

5. **Public API** (`src/index.ts`) (1 day)
   ```typescript
   export function inline(
     files: FileInput[],
     component: Component
   ): Result<InlineResult, RegraffError>;

   // Component type definition
   interface Component {
     file: string;   // File path containing the component definition
     name: string;   // Name of the component to inline
   }

   // Usage example
   const result = inline(files, { file: 'App.tsx', name: 'Greeting' });
   ```

6. **Integration Tests** (2 days)
   - Test simple component inlining
   - Test prop substitution
   - Test component removal
   - Test error cases

#### Acceptance Criteria

- ✅ Can inline presentational components
- ✅ Props correctly substituted
- ✅ Component definition removed
- ✅ 90%+ test coverage
- ✅ All tests pass

---

### Phase 2: Complex Component Inlining (3.5 weeks)

**Duration**: 18 days (3.5 weeks)
**Team**: 1 engineer
**Deliverable**: Support for components with hooks and state

#### Components to Build

1. **`src/strategies/hook-merger.ts`** (5 days)
   - Find hook insertion point (before parent's first hook)
   - Clone and rename hook bindings
   - Merge hook sequences preserving order
   - Handle hook return value destructuring

2. **`src/strategies/name-resolver.ts`** (3 days)
   - Detect naming conflicts
   - Generate unique names (suffix strategy)
   - Update all references
   - Track substitutions

3. **Hook-specific operations** in `component-inliner.ts` (4 days)
   - useState handling
   - useEffect handling (with cleanup)
   - useRef handling
   - useMemo/useCallback handling
   - Custom hook handling

4. **Dependency array substitution** (3 days)
   - Identify props in dependency arrays
   - Substitute with actual values from call site
   - Handle complex expressions
   - Validate correctness

5. **Integration Tests** (3 days)
   - Test components with useState
   - Test components with useEffect
   - Test naming conflicts
   - Test dependency array substitution
   - Test custom hooks

#### Key Challenges

| Challenge | Solution |
|-----------|----------|
| Hook placement | Insert before parent's first hook |
| Naming conflicts | Suffix with component name (`count_Modal`) |
| Dependency substitution | AST traversal and replacement |
| Effect timing | Preserve original order |
| Cleanup functions | Clone with hook |

#### Acceptance Criteria

- ✅ Can inline components with useState
- ✅ Can inline components with useEffect
- ✅ Can inline components with multiple hooks
- ✅ Naming conflicts resolved correctly
- ✅ Hook rules preserved
- ✅ 90%+ test coverage

---

### Phase 3: Cross-File Inlining (3 weeks)

**Duration**: 15 days (3 weeks)
**Team**: 1 engineer
**Deliverable**: Full cross-file inlining with cleanup

#### Components to Build

1. **`src/strategies/inline/inline-executor.ts`** (4 days)
   - Multi-file transformation orchestration
   - Coordinate AST modifications
   - Atomic operation execution
   - Rollback on failure

2. **`src/strategies/inline/usage-detector.ts`** (3 days)
   - Project-wide usage search
   - Static import analysis
   - JSX usage detection
   - Usage count and locations

3. **`src/strategies/inline/import-resolver.ts`** (3 days)
   - Extract component's imports
   - Resolve relative paths
   - Detect import conflicts
   - Resolve conflicts (renaming)
   - Add transitive imports

4. **`src/strategies/inline/component-remover.ts`** (2 days)
   - Remove export statements
   - Remove component definition
   - Handle type exports
   - Delete file if empty
   - Update import references

5. **Integration Tests** (3 days)
   - Test cross-file inlining
   - Test import resolution
   - Test component removal
   - Test file deletion
   - Test conflict resolution

#### Architecture

```
┌─────────────────┐
│ Usage Detector  │──┐
└─────────────────┘  │
                     ├──> ┌──────────────────┐
┌─────────────────┐  │    │ Inline Executor  │
│ Import Resolver │──┤    │   (Orchestrator) │
└─────────────────┘  │    └──────────────────┘
                     │              │
┌─────────────────┐  │              ↓
│Component Remover│──┘    ┌──────────────────┐
└─────────────────┘       │ Multi-file       │
                          │ Transformation   │
                          └──────────────────┘
```

#### Acceptance Criteria

- ✅ Can inline components from other files
- ✅ Transitive imports added correctly
- ✅ Import conflicts resolved
- ✅ Component removed from source file
- ✅ Empty files deleted
- ✅ 90%+ test coverage

---

## Technical Architecture

### New Module Structure

```
src/
├── analyzer/
│   ├── component-detector.ts       # NEW: Component classification
│   └── inline-validator.ts         # NEW: Validation logic
├── transformer/
│   ├── prop-substituter.ts         # NEW: Prop substitution
│   └── component-inliner.ts        # NEW: Main orchestration
├── strategies/
│   ├── hook-merger.ts              # NEW: Hook merging logic
│   ├── name-resolver.ts            # NEW: Conflict resolution
│   └── inline/                     # NEW: Cross-file support
│       ├── inline-executor.ts
│       ├── usage-detector.ts
│       ├── import-resolver.ts
│       └── component-remover.ts
└── types/
    └── public.ts                   # MODIFIED: Add Component, InlineResult types
```

### Data Flow

```
┌─────────────┐
│ inline()    │ Entry point
│ API call    │
└──────┬──────┘
       │
       ↓
┌─────────────────────┐
│ Component Detector  │ Analyze component
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│ Inline Validator    │ Check safety
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│ Prop Substituter    │ Replace props
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│ Hook Merger         │ (if hooks present)
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│ Component Inliner   │ Replace call with JSX
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│ Component Remover   │ Delete definition
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│ Code Generation     │ Output transformed code
└─────────────────────┘
```

### Key Interfaces

```typescript
// Component Detection
interface ComponentInfo {
  name: string;
  path: NodePath;
  definition: NodePath;
  params: ComponentParams;
  hasHooks: boolean;
  hasState: boolean;
  isInlineable: boolean;
  inlineabilityIssues: string[];
}

// Hook Merging
interface HookMergeResult {
  hooks: t.Statement[];
  substitutions: Map<string, string>;
}

// Cross-File Context
interface InlineContext {
  componentFile: string;
  componentName: string;
  componentAst: t.Node;
  usageSites: UsageSite[];
  allAsts: Map<string, t.File>;
  transitiveDeps: InternalDependency[];
  aggressiveRemoval: boolean;
}
```

---

## Risk Analysis

### Risk Matrix

| Risk | Probability | Impact | Severity | Mitigation |
|------|-------------|--------|----------|------------|
| Hook rule violations | Medium | High | **High** | Extensive testing, validation |
| Circular imports | Low | High | Medium | Pre-flight detection |
| Multi-usage conflicts | Medium | Medium | Medium | Batch inline strategy |
| Import conflicts | Medium | Medium | Medium | Automatic renaming |
| Type export issues | Low | Medium | Low | Keep types in original |

### High-Risk Areas

#### 1. Hook Dependency Array Substitution

**Risk**: Incorrect substitution breaks React effects

**Mitigation**:
- Extensive unit tests with real-world scenarios
- AST-level validation of substitutions
- Fallback: Error out if substitution is ambiguous

**Example Test Cases**:
```typescript
// Test 1: Simple prop substitution
[isOpen, onClose] → [showModal, handleClose]

// Test 2: Nested prop access
[user.name, user.id] → [currentUser.name, currentUser.id]

// Test 3: Complex expressions
[isOpen && isValid] → [showModal && checkValid()]
```

#### 2. Cross-File Circular Imports

**Risk**: Inlining creates circular dependency cycles

**Mitigation**:
- Pre-flight circular detection using import graph
- Reject operation with clear error message
- Suggest alternative approaches

**Detection Algorithm**:
```typescript
function checkCircularity(
  componentFile: string,
  usageSites: UsageSite[],
  allFiles: Map<string, t.File>
): CircularCheckResult {
  const importGraph = buildImportGraph(allFiles);

  // Simulate inlining: component's imports become parent's imports
  for (const site of usageSites) {
    for (const imp of getImports(componentFile)) {
      importGraph.addEdge(site.file, imp);
    }
  }

  return detectCycles(importGraph);
}
```

### Medium-Risk Areas

#### 3. Multi-Usage Component Removal

**Risk**: Component used elsewhere but aggressively removed

**Mitigation**:
- Usage detection across workspace
- Batch inline all usages before removal
- User confirmation dialog (optional)

#### 4. Import Name Conflicts

**Risk**: Imported symbols with same name from different sources

**Mitigation**:
- Automatic renaming with suffix/counter
- Conflict detection before transformation
- Clear error messages with suggestions

**Conflict Resolution**:
```typescript
// Conflict detected
import { Icon } from './Icon';      // Existing
import { Icon } from '../Button';   // New (conflict!)

// Resolved
import { Icon } from './Icon';      // Keep
import { Icon as Icon2 } from '../Button'; // Rename
```

---

## Success Criteria

### Functional Requirements

| Requirement | Priority | Status |
|-------------|----------|--------|
| Inline simple components | P0 | To Do |
| Inline components with hooks | P0 | To Do |
| Inline components with effects | P0 | To Do |
| Cross-file inlining | P0 | To Do |
| Aggressive removal | P0 | To Do |
| Inline prop expressions | P0 | To Do |

### Quality Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Coverage | >90% | Jest coverage report |
| Passing Tests | 100% | CI/CD pipeline |
| Linter Warnings | 0 | ESLint report |
| Performance | <50ms per operation | Benchmark suite |
| Error Messages | Clear & actionable | User testing |

### Safety Requirements

| Requirement | Validation |
|-------------|------------|
| Preserves Hook rules | AST analysis + runtime tests |
| Detects circular imports | Static analysis |
| Validates before removal | Usage detection |
| Atomic operations | Transaction rollback tests |

### Performance Targets

| Operation | Target | Acceptable | Unacceptable |
|-----------|--------|------------|--------------|
| Single inline | <50ms | <100ms | >200ms |
| Validation | <10ms | <20ms | >50ms |
| Conflict detection | O(n) | O(n log n) | O(n²) |
| Hook merging | O(m) | O(m log m) | O(m²) |
| Usage search | O(f×l) | O(f×l×log l) | O(f²×l²) |

*where: n = bindings, m = hooks, f = files, l = lines per file*

---

## Implementation Timeline

### Gantt Chart

```
Week 1  [████████] Component Detector, Prop Substituter
Week 2  [████████] Component Inliner, Validator
Week 3  [████████] Integration Tests, Refinement
Week 4  [████████] Hook Merger Infrastructure
Week 5  [████████] Hook Operations, Dependency Substitution
Week 6  [████████] Complex Scenarios, Integration Tests
Week 7  [████████] Cross-File Foundation
Week 8  [████████] Cleanup, Polish, Documentation
```

### Milestones

| Milestone | Date | Deliverable |
|-----------|------|-------------|
| M1: Simple Inlining | Week 3 | Basic feature complete |
| M2: Hook Support | Week 6 | Full hook support |
| M3: Cross-File | Week 8 | Production ready |

### Critical Path

```
Component Detector → Prop Substituter → Component Inliner
                                              ↓
                                        Hook Merger
                                              ↓
                                     Cross-File Executor
                                              ↓
                                        Final Testing
```

### Dependencies

- **Parallel**: Component Detector ∥ Validator
- **Sequential**: Detector → Inliner → Hook Merger
- **Blocking**: Hook Merger blocks Cross-File work

---

## Resources Required

### Team Structure

**Option A: Single Senior Engineer** (Recommended)
- **Duration**: 6-8 weeks full-time
- **Requirements**:
  - Expert in React Hooks and Rules of Hooks
  - AST manipulation experience (Babel)
  - TypeScript advanced types
  - TDD methodology
- **Responsibilities**:
  - Implementation
  - Architecture
  - Testing
  - Documentation

**Option B: Mid-level + Senior Reviewer**
- **Duration**: 8-10 weeks
- **Team**:
  - 1 Mid-level engineer (implementation)
  - 1 Senior engineer (review, 25% time)
- **Requirements**:
  - Mid: React, TypeScript, testing
  - Senior: React expert, architecture review

### Infrastructure

- **CI/CD**: Existing GitHub Actions
- **Testing**: Existing Jest setup
- **Code Quality**: Existing ESLint/Prettier
- **Documentation**: Markdown + TSDoc

### Dependencies

**No new external dependencies required**

Existing dependencies sufficient:
- `@babel/core`: AST manipulation
- `@babel/traverse`: AST traversal
- `@babel/types`: Type checking
- Existing regrafter infrastructure

---

## TDD Implementation Sequence

Following codebase TDD principles (Red → Green → Refactor):

### Iteration 1: Basic Inlining (3 days)
```
❌ Test: Inline simple component, no props
✅ Implement: Component detection and JSX replacement
♻️  Refactor: Extract inline strategy
```

### Iteration 2: Prop Substitution (4 days)
```
❌ Test: Inline component with props
✅ Implement: Prop expression substitution
♻️  Refactor: Extract prop substituter
```

### Iteration 3: Component Removal (2 days)
```
❌ Test: Remove component after inlining
✅ Implement: Safe removal with export handling
♻️  Refactor: Extract removal strategy
```

### Iteration 4: Hook Inlining (5 days)
```
❌ Test: Inline component with useState
✅ Implement: Hook merging and renaming
♻️  Refactor: Extract hook merger
```

### Iteration 5: Dependency Arrays (3 days)
```
❌ Test: Substitute props in useEffect deps
✅ Implement: Dependency array substitution
♻️  Refactor: Optimize substitution algorithm
```

### Iteration 6: Cross-File (5 days)
```
❌ Test: Inline component from another file
✅ Implement: Multi-file coordination
♻️  Refactor: Extract cross-file executor
```

### Iteration 7: Edge Cases (3 days)
```
❌ Test: All edge cases and error scenarios
✅ Implement: Edge case handlers
♻️  Refactor: Consolidate error handling
```

---

## Alternative Approaches (Rejected)

### 1. Keep Hooks in Original Location
**Rejected**: Violates React Rules of Hooks (hooks must be at top level)

### 2. Generate Unique IDs for Conflicts
**Rejected**: Loses semantic meaning (`count_1234` vs `count_Modal`)

### 3. Only Inline Hookless Components
**Rejected**: Too restrictive, doesn't meet requirements for full hook support

### 4. Transform Effects to Functions
**Rejected**: Changes React semantics and effect timing

### 5. Manual Conflict Resolution
**Rejected**: Poor UX, violates aggressive mode requirement

---

## Appendix

### A. Example Transformations

#### Example 1: Simple Component

```tsx
// Before
function Card({ title, children }) {
  return <div className="card"><h2>{title}</h2>{children}</div>;
}

<Card title="Hello">Content</Card>

// After
<div className="card"><h2>Hello</h2>Content</div>
```

#### Example 2: Component with Hooks

```tsx
// Before
function Counter({ initial = 0 }) {
  const [count, setCount] = useState(initial);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

<Counter initial={5} />

// After (in parent component)
const [count_Counter, setCount_Counter] = useState(5);
<button onClick={() => setCount_Counter(count_Counter + 1)}>{count_Counter}</button>
```

#### Example 3: Cross-File

```tsx
// components/Button.tsx
import { Icon } from './Icon';
export const Button = ({ icon, text }) => (
  <button><Icon name={icon} />{text}</button>
);

// pages/Home.tsx
import { Button } from '../components/Button';
<Button icon="check" text="Submit" />

// After inlining into Home.tsx
import { Icon } from '../components/Icon'; // Added
<button><Icon name="check" />Submit</button>
// Button.tsx deleted (if no other exports)
```

### B. Test Plan

- **Unit Tests**: ~50 tests per module
- **Integration Tests**: ~30 tests
- **E2E Tests**: ~10 tests
- **Total**: ~200+ tests

### C. Documentation Plan

- API documentation (TSDoc)
- User guide with examples
- Migration guide
- Architecture decision records (ADRs)

---

## Conclusion

This implementation plan provides a comprehensive roadmap for adding React component inlining to regrafter. The phased approach allows for early delivery of value while managing risk through incremental complexity.

**Key Takeaways**:
- **Substantial feature** requiring 6-8 weeks
- **Strong foundation** from existing architecture (30-40% code reuse)
- **Phased delivery** enables early feedback
- **Risk mitigation** through TDD and validation
- **Production ready** by Week 8

**Recommendation**: Proceed with implementation, starting with Phase 1 (simple components) to validate approach and gather user feedback before investing in complex scenarios.

---

**Document Metadata**:
- Created: 2024-12-19
- Author: Implementation Planning Team
- Version: 1.0
- Next Review: After Phase 1 completion
