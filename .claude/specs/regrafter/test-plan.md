# Regrafter Test Plan

## Overview

This document outlines the comprehensive testing strategy for Regrafter, covering unit tests, integration tests, and end-to-end tests. The test suite validates all functional requirements and ensures the reliability of AST transformations for React element relocation.

---

## Test Categories

### 1. Unit Tests

Unit tests focus on individual components in isolation, using mocks for dependencies.

| Component | Test File | Coverage Target |
|-----------|-----------|-----------------|
| Types & Type Guards | `src/__tests__/types.test.ts` | 100% |
| Parser | `src/__tests__/parser.test.ts` | 100% |
| Selector Resolver | `src/__tests__/selector-resolver.test.ts` | 100% |
| Dependency Analyzer | `src/__tests__/dependency-analyzer.test.ts` | 100% |
| Scope Manager | `src/__tests__/scope-manager.test.ts` | 100% |
| Transformation Engine | `src/__tests__/transformation-engine.test.ts` | 100% |
| Code Generator | `src/__tests__/code-generator.test.ts` | 100% |
| Optimizer | `src/__tests__/optimizer.test.ts` | 85% |

### 2. Integration Tests

Integration tests verify component interactions and complete move operations.

| Scenario Category | Test File | Description |
|-------------------|-----------|-------------|
| Move.Before | `src/__tests__/integration/move-before.test.ts` | Sibling movement (before target) |
| Move.After | `src/__tests__/integration/move-after.test.ts` | Sibling movement (after target) |
| Move.Inside | `src/__tests__/integration/move-inside.test.ts` | Child insertion |
| Hook Hoisting | `src/__tests__/integration/hook-hoisting.test.ts` | Hook dependency hoisting |
| Cross-File | `src/__tests__/integration/cross-file.test.ts` | Multi-file operations |
| Optimization | `src/__tests__/integration/optimization.test.ts` | Dependency sinking |

### 3. End-to-End Tests

E2E tests validate complete workflows with real-world scenarios.

| Scenario | Test File | Description |
|----------|-----------|-------------|
| Full Pipeline | `src/__tests__/e2e/full-pipeline.test.ts` | Complete regraft() operations |
| Error Recovery | `src/__tests__/e2e/error-recovery.test.ts` | Error handling and recovery |
| Real-World | `src/__tests__/e2e/real-world.test.ts` | Complex realistic scenarios |

---

## Test Fixtures

Located in `test/fixtures/`:

| Fixture File | Purpose | Key Scenarios |
|--------------|---------|---------------|
| `simple-component.tsx` | Basic JSX movement | Simple selectors, basic moves |
| `component-with-hooks.tsx` | Hook dependencies | useState, useEffect, useRef, custom hooks |
| `nested-components.tsx` | Deep hierarchies | Parent-child moves, LCA computation |
| `component-with-context.tsx` | Context dependencies | useContext, Provider boundaries |
| `conditional-rendering.tsx` | Atomic unit detection | `&&` conditionals, ternaries |
| `list-rendering.tsx` | Map expressions | array.map(), filter chains |

---

## Test Scenarios by Requirement

### Requirement 1: Unified API (`regraft()`)

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| API-01 | regraft with valid parameters | Integration | Returns Result with success: true |
| API-02 | regraft with dryRun: true | Integration | Returns analysis only, codes empty |
| API-03 | regraft with optimize: false | Integration | Skips sinking optimization |
| API-04 | regraft with invalid selector | Integration | Returns success: false with error |
| API-05 | regraft returns changed files | Integration | codes array contains all modified files |

### Requirement 2: Move Modes

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| MODE-01 | Move.Inside inserts as child | Integration | Element becomes child of target |
| MODE-02 | Move.Before inserts as prev sibling | Integration | Element precedes target |
| MODE-03 | Move.After inserts as next sibling | Integration | Element follows target |
| MODE-04 | Move removes from original | Integration | Source location is empty |
| MODE-05 | Same position returns unchanged | Integration | success: true, no changes |

### Requirement 3: Selectors

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| SEL-01 | Position selector finds element | Unit | Correct JSX element returned |
| SEL-02 | Path selector navigates AST | Unit | Correct node at path |
| SEL-03 | Invalid position returns error | Unit | SelectorError returned |
| SEL-04 | File not in array returns error | Unit | File not found error |

### Requirement 4: Dependency Analysis

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| DEP-01 | Detects useState hook | Unit | Hook dependency identified |
| DEP-02 | Detects useEffect hook | Unit | Hook dependency identified |
| DEP-03 | Detects variable declarations | Unit | Variable dependency identified |
| DEP-04 | Detects imports | Unit | Import dependency identified |
| DEP-05 | Detects props | Unit | Prop dependency identified |
| DEP-06 | Detects useContext | Unit | Context dependency identified |
| DEP-07 | Detects eval() as unanalyzable | Unit | Returns canMove: false |

### Requirement 5: Dependency Hoisting

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| HOIST-01 | Hoists useState to ancestor | Integration | Hook at valid location |
| HOIST-02 | Hoists useEffect with deps | Integration | Dependencies preserved |
| HOIST-03 | Hoists variable to common ancestor | Integration | Variable accessible |
| HOIST-04 | Adds missing imports | Integration | Import statements added |
| HOIST-05 | Threads props through tree | Integration | Props passed correctly |
| HOIST-06 | Validates Hook rules | Integration | No hooks in conditionals |

### Requirement 6: Move Validation (canMove)

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| CAN-01 | canMove returns boolean | Unit | true or false |
| CAN-02 | eval() returns false | Unit | canMove: false |
| CAN-03 | Invalid move returns reason | Unit | reason field populated |
| CAN-04 | Conditional as atomic unit | Unit | canMove: true |
| CAN-05 | Map expression as atomic | Unit | canMove: true |
| CAN-06 | Context outside Provider | Unit | canMove: true (with hoisting) |

### Requirement 7: Cross-File Movement

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| XFILE-01 | Different files detected | Integration | Cross-file mode activated |
| XFILE-02 | Creates shared module | Integration | New file in codes array |
| XFILE-03 | Updates imports in both files | Integration | Imports added correctly |
| XFILE-04 | Prevents circular deps | Integration | No cycles in result |
| XFILE-05 | New file marked as new | Integration | isNew: true flag set |

### Requirement 8: Optimization (Sinking)

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| OPT-01 | Sinks single-consumer dep | Integration | Dependency at optimal scope |
| OPT-02 | Preserves shared deps | Integration | Shared deps not sunk |
| OPT-03 | Removes orphaned props | Integration | Unused props removed |
| OPT-04 | Respects Hook rules | Integration | Hooks at valid locations |

### Requirement 10: Code Generation

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| GEN-01 | Preserves comments | Unit | Comments intact |
| GEN-02 | Adjusts indentation | Unit | Proper indentation |
| GEN-03 | Output parses correctly | Unit | No syntax errors |

### Requirement 11: Error Handling

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| ERR-01 | Parse error returns details | Unit | Location and message |
| ERR-02 | Selector error with info | Unit | Selector in error |
| ERR-03 | Suggests fixes | Unit | suggestedFixes array |
| ERR-04 | Circular dep path in error | Unit | Cycle array populated |

### Requirement 12: Performance

| Case ID | Description | Test Type | Expected Result |
|---------|-------------|-----------|-----------------|
| PERF-01 | Single file < 100ms | Performance | P95 latency met |
| PERF-02 | Multi-file < 500ms | Performance | P95 latency met |
| PERF-03 | canMove < 20% of full | Performance | Relative time met |
| PERF-04 | Memory < 10x file size | Performance | Memory limit met |

---

## Detailed Test Steps

### Unit Tests: Types (`src/__tests__/types.test.ts`)

#### TYPE-01: Move enum values

**Test Purpose**: Verify Move enum has correct string values

**Test Data Preparation**:
- Import Move enum from types module

**Test Steps**:
1. Access Move.Inside, Move.Before, Move.After
2. Assert each equals expected string value

**Expected Results**:
- Move.Inside === 'inside'
- Move.Before === 'before'
- Move.After === 'after'

#### TYPE-02: Selector type guards

**Test Purpose**: Verify type guards correctly identify selector types

**Test Data Preparation**:
- Create PositionSelector object
- Create PathSelector object

**Test Steps**:
1. Call isPositionSelector with each object
2. Call isPathSelector with each object

**Expected Results**:
- isPositionSelector returns true for position, false for path
- isPathSelector returns true for path, false for position

#### TYPE-03: DependencyType enum completeness

**Test Purpose**: Verify all dependency types are defined

**Test Steps**:
1. Access all DependencyType values

**Expected Results**:
- Hook, Variable, Import, Prop, Context, Ref all defined

---

### Integration Tests: Move.Before (`src/__tests__/integration/move-before.test.ts`)

#### BEFORE-01: Move sibling element before target

**Test Purpose**: Verify element moves to position before target sibling

**Test Data Preparation**:
- Load `simple-component.tsx` fixture
- Parse AST
- Identify source element (span.Inline text)
- Identify target element (p.Content paragraph)

**Test Steps**:
1. Call regraft with Move.Before mode
2. Parse result code
3. Find parent element
4. Check children order

**Expected Results**:
- span element precedes p element
- Original span location is empty

#### BEFORE-02: Move deeply nested element

**Test Purpose**: Verify element can move from deep nesting to before target

**Test Data Preparation**:
- Load `nested-components.tsx` fixture
- Select deeply nested element
- Select shallower target

**Test Steps**:
1. Call regraft with Move.Before mode
2. Verify element at new position
3. Verify dependencies handled

**Expected Results**:
- Element at correct position
- All dependencies accessible

#### BEFORE-03: Move with hook dependency

**Test Purpose**: Verify hook is hoisted when moving element with state

**Test Data Preparation**:
- Load `component-with-hooks.tsx` fixture
- Select element using useState value
- Select target in different component scope

**Test Steps**:
1. Analyze dependencies
2. Call regraft
3. Verify hook location

**Expected Results**:
- Hook hoisted to common ancestor
- Element displays correct value

---

### Integration Tests: Move.After (`src/__tests__/integration/move-after.test.ts`)

#### AFTER-01: Move sibling element after target

**Test Purpose**: Verify element moves to position after target sibling

**Test Data Preparation**:
- Load `simple-component.tsx` fixture
- Parse AST
- Identify source element (p.Content paragraph)
- Identify target element (span.Inline text)

**Test Steps**:
1. Call regraft with Move.After mode
2. Parse result code
3. Find parent element
4. Check children order

**Expected Results**:
- p element follows span element
- Original p location is empty

#### AFTER-02: Move last child after another

**Test Purpose**: Edge case - moving the last child

**Test Data Preparation**:
- Load fixture with known last child element
- Select last child as source
- Select first child as target

**Test Steps**:
1. Call regraft with Move.After mode
2. Verify new order

**Expected Results**:
- Last child now second
- No array index errors

---

### Integration Tests: Move.Inside (`src/__tests__/integration/move-inside.test.ts`)

#### INSIDE-01: Move element inside empty container

**Test Purpose**: Verify element becomes child of empty container

**Test Data Preparation**:
- Load `simple-component.tsx` fixture
- Select element to move
- Select EmptyContainer div as target

**Test Steps**:
1. Call regraft with Move.Inside mode
2. Verify element is now child of container

**Expected Results**:
- Container has one child
- Child is the moved element

#### INSIDE-02: Move element inside container with children

**Test Purpose**: Verify element appends to existing children

**Test Data Preparation**:
- Load fixture with container having children
- Select external element
- Select container as target

**Test Steps**:
1. Call regraft with Move.Inside mode
2. Verify children count increased
3. Verify moved element is last child

**Expected Results**:
- Children count = original + 1
- Moved element at end

#### INSIDE-03: Move with context dependency

**Test Purpose**: Verify context handling when moving inside Provider

**Test Data Preparation**:
- Load `component-with-context.tsx` fixture
- Select element using context
- Select target inside same Provider

**Test Steps**:
1. Call regraft with Move.Inside mode
2. Verify context access maintained

**Expected Results**:
- Element still accesses context
- No additional hoisting needed

---

## Mock Strategies

### Parser Mocks

For unit tests that don't need real parsing:

```typescript
const mockParseResult = {
  ast: createMockAST(),
  errors: [],
};

jest.mock('../parser', () => ({
  parse: jest.fn().mockReturnValue(mockParseResult),
}));
```

### Babel Traverse Mocks

For testing selector resolution without full traversal:

```typescript
const mockNodePath = {
  node: { type: 'JSXElement', ... },
  parentPath: mockParentPath,
  scope: mockScope,
};
```

### File System Mocks

For cross-file tests without actual file I/O:

```typescript
const mockFiles = new Map([
  ['source.tsx', sourceContent],
  ['target.tsx', targetContent],
]);
```

---

## Boundary Conditions

### Selector Resolution
- Position at exact element start
- Position at element end
- Position in whitespace between elements
- Position in comment
- Deeply nested position (>10 levels)

### Dependencies
- Zero dependencies
- Maximum transitive chain (>5 levels)
- Circular dependency in source
- Unresolvable external reference

### Movement
- Move to same position (no-op)
- Move to adjacent sibling
- Move across file boundary
- Move into fragment
- Move compound component parts

### Hoisting
- Hook at valid location already
- Multiple hooks need hoisting
- Hook inside conditional (error case)
- Hook inside loop (error case)

---

## Asynchronous Operations

### Parsing Large Files

```typescript
test('handles large file parsing', async () => {
  const largeFile = generateLargeComponent(1000); // 1000 elements
  const result = await regraft(
    [{ path: 'large.tsx', content: largeFile }],
    fromSelector,
    toSelector,
    Move.Before
  );
  expect(result.success).toBe(true);
}, 10000); // Extended timeout
```

### Concurrent Operations

```typescript
test('handles concurrent regraft calls', async () => {
  const results = await Promise.all([
    regraft(files1, from1, to1, Move.Before),
    regraft(files2, from2, to2, Move.After),
  ]);
  expect(results.every(r => r.success)).toBe(true);
});
```

---

## Test Environment Setup

### Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['test/fixtures/**'],
    },
    testTimeout: 5000,
  },
});
```

### Test Utilities

```typescript
// test/utils.ts
export function loadFixture(name: string): string {
  return fs.readFileSync(
    path.join(__dirname, 'fixtures', name),
    'utf-8'
  );
}

export function createSelector(
  file: string,
  line: number,
  column: number
): PositionSelector {
  return { file, line, column };
}
```

---

## Test Data Management

### Fixture Naming Convention

- `{feature}-{scenario}.tsx` for specific test scenarios
- `{component-type}.tsx` for general fixtures

### Snapshot Testing

Used sparingly for code generation output:

```typescript
test('generates correct output', () => {
  const result = regraft(files, from, to, Move.Before);
  expect(result.codes[0].content).toMatchSnapshot();
});
```

### Golden Files

For complex transformations, store expected output:

```
test/golden/
  move-before-simple.input.tsx
  move-before-simple.output.tsx
```

---

## Continuous Integration

### Test Pipeline Stages

1. **Lint**: ESLint + TypeScript type checking
2. **Unit Tests**: Fast, isolated tests
3. **Integration Tests**: Component interaction tests
4. **E2E Tests**: Full pipeline tests
5. **Performance Tests**: Benchmark validation
6. **Coverage Report**: Coverage gate (>100%)

### Performance Baseline

Track metrics across commits:
- Single file P95 latency
- Multi-file P95 latency
- Memory peak usage
- Test suite total time

---

*Document Version: 1.0*
*Created: 2025-12-15*
*Based on: requirements.md v2.0, design.md v11.0, tasks.md v4.0*
