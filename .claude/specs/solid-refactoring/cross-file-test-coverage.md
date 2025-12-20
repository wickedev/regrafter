# Cross-File Strategy Test Coverage Enhancement

## Test File

`src/strategies/cross-file/__tests__/`

## Test Purpose

Achieve ≥95% test coverage for cross-file transformation strategies including circular dependency resolution, transitive dependency handling, multi-file moves, and shared module creation.

## Current Coverage Status

| Module | Line Coverage | Target | Gap |
|--------|--------------|--------|-----|
| circular-dependency.ts | 93.56% | 95% | 1.44% |
| detector.ts | 86.4% | 95% | 8.6% |
| new-file-handler.ts | 88.35% | 95% | 6.65% |
| shared-module-creator.ts | 71.71% | 95% | **23.29%** |
| index.ts | (not shown) | 95% | Unknown |
| **Overall** | **83.7%** | **95%** | **11.3%** |

## Test Cases Overview

### Shared Module Creator Tests (`shared-module-creator.test.ts`)

| Case ID | Feature Description | Test Type | Priority |
|---------|-------------------|-----------|----------|
| SMC-01 | Nested variable declarations in shared module | Edge Case | High |
| SMC-02 | Transitive import collection | Integration | High |
| SMC-03 | Duplicate import handling | Integration | High |
| SMC-04 | Export merging with existing declarations | Integration | High |
| SMC-05 | Complex identifier collection (destructuring) | Edge Case | High |
| SMC-06 | Error handling for missing declarations | Error Test | Medium |
| SMC-07 | TypeScript type preservation in shared modules | Positive Test | High |
| SMC-08 | Multiple declarators in single statement | Edge Case | Medium |

### Integration Tests (`integration.test.ts`)

| Case ID | Feature Description | Test Type | Priority |
|---------|-------------------|-----------|----------|
| INT-01 | Circular dependency A→B→A resolution | Integration | Critical |
| INT-02 | Circular dependency A→B→C→A resolution | Integration | Critical |
| INT-03 | Transitive dependency A depends on B, B depends on C | Integration | Critical |
| INT-04 | Multi-file move (element touches 3+ files) | Integration | Critical |
| INT-05 | Shared module creation with multiple dependencies | Integration | High |
| INT-06 | New file creation in cross-file move | Integration | High |
| INT-07 | Cross-file move with hooks (Rules of Hooks) | Integration | High |
| INT-08 | Circular dependency resolution failure handling | Error Test | Medium |
| INT-09 | Import graph update after transformation | Integration | Medium |
| INT-10 | Multiple shared modules created in single operation | Edge Case | Medium |

### End-to-End Scenarios (`e2e-scenarios.test.ts`)

| Case ID | Feature Description | Test Type | Priority |
|---------|-------------------|-----------|----------|
| E2E-01 | Complete cross-file refactoring workflow | E2E | Critical |
| E2E-02 | Breaking circular deps in real-world structure | E2E | Critical |
| E2E-03 | Moving component tree across files | E2E | High |
| E2E-04 | Shared module with re-exported dependencies | E2E | High |
| E2E-05 | Cross-file move maintaining type safety | E2E | High |

## Detailed Test Steps

### SMC-01: Nested variable declarations in shared module

**Test Purpose**: Verify shared module correctly handles nested destructuring and complex declarations

**Test Data Preparation**:
```typescript
const sourceCode = `
  const { a, b: { c, d } } = complexObject;
  const [x, y, ...rest] = array;
  export const result = a + c + x;
`;
```

**Test Steps**:
1. Create dependencies with nested patterns
2. Call `generateSharedModule()`
3. Verify extracted declarations maintain structure
4. Verify all identifiers are collected

**Expected Results**:
- Shared module contains complete declarations
- Nested identifiers properly identified
- Import collection includes all used symbols

### SMC-02: Transitive import collection

**Test Purpose**: Ensure shared modules collect all transitive imports needed

**Test Data Preparation**:
```typescript
const sourceCode = `
  import { utilA } from './utils';
  import { helperB } from './helpers';
  const myFunc = () => {
    return utilA(helperB());
  };
`;
```

**Test Steps**:
1. Create dependency that uses imported symbols
2. Generate shared module
3. Verify imports from './utils' and './helpers' are included
4. Verify import statements are at top of shared module

**Expected Results**:
- All transitive imports collected
- Import statements properly ordered
- No duplicate imports

### INT-01: Circular dependency A→B→A resolution

**Test Purpose**: Verify detection and resolution of simple circular dependency

**Test Data Preparation**:
```typescript
// File A
import { funcB } from './B';
export const funcA = () => funcB();

// File B
import { funcA } from './A';
export const funcB = () => funcA();
```

**Test Steps**:
1. Create import graph with A→B and B→A edges
2. Call `detectCircularDependencies()`
3. Verify cycle detected
4. Call `resolveCircularDependencies()`
5. Verify shared module created
6. Verify both files now import from shared module

**Expected Results**:
- Circular dependency detected: [A, B, A]
- Resolution creates shared module
- Updated graph has no cycles
- Both files import from shared module path

### INT-02: Circular dependency A→B→C→A resolution

**Test Purpose**: Verify detection and resolution of 3-node circular dependency

**Test Data Preparation**:
```typescript
// File A: imports from B
// File B: imports from C
// File C: imports from A
```

**Test Steps**:
1. Build import graph with 3-way cycle
2. Detect circular dependencies
3. Resolve using shared module extraction
4. Verify cycle broken at optimal edge

**Expected Results**:
- Cycle detected: [A, B, C, A]
- Shortest cycle correctly identified
- Shared module created
- Graph validation passes after resolution

### INT-03: Transitive dependency resolution

**Test Purpose**: Handle A depends on B, B depends on C scenario

**Test Data Preparation**:
```typescript
// File C
export const BASE = 10;

// File B
import { BASE } from './C';
export const multiply = (x) => x * BASE;

// File A
// Moving element that uses `multiply`
```

**Test Steps**:
1. Create dependency chain A→B→C
2. Move element from A to new file D
3. Analyze transitive dependencies
4. Verify imports added correctly
5. Verify no circular dependencies introduced

**Expected Results**:
- Transitive dependencies detected
- File D imports from B (which imports from C)
- All files have correct import statements
- No circular dependencies created

### INT-04: Multi-file move (3+ files touched)

**Test Purpose**: Verify handling of moves affecting multiple files

**Test Data Preparation**:
- Source file A
- Target file B
- Dependency files C, D, E

**Test Steps**:
1. Create element with dependencies from multiple files
2. Execute cross-file transform
3. Verify all affected files modified
4. Verify import statements added to all necessary files
5. Verify no files have duplicate or missing imports

**Expected Results**:
- All 5 files in result codes
- Correct import/export statements
- No broken references
- Code generation successful for all files

### INT-05: Shared module creation with multiple dependencies

**Test Purpose**: Test shared module with multiple extracted dependencies

**Test Data Preparation**:
```typescript
const sourceCode = `
  const sharedA = 1;
  const sharedB = 2;
  const sharedC = () => sharedA + sharedB;
  // All used in source AND target
`;
```

**Test Steps**:
1. Identify 3+ dependencies needing shared module
2. Generate shared module
3. Verify all dependencies exported
4. Verify source file updated with imports
5. Verify declarations removed from source

**Expected Results**:
- Shared module contains all 3 exports
- Source file imports all 3 from shared module
- Original declarations removed from source
- Shared module path follows naming convention

### INT-06: New file creation in cross-file move

**Test Purpose**: Verify cross-file move can create target file

**Test Data Preparation**:
- Source file exists
- Target file path doesn't exist
- NewFileConfig with component settings

**Test Steps**:
1. Set `isNewTargetFile: true`
2. Execute cross-file transform
3. Verify new file created with correct structure
4. Verify imports added to new file
5. Verify component scaffold generated

**Expected Results**:
- New file in `newFiles` map
- File has proper React component structure
- Import statements from source file included
- TypeScript types preserved if .tsx

### E2E-01: Complete cross-file refactoring workflow

**Test Purpose**: End-to-end test of full transformation pipeline

**Test Data Preparation**:
- Multi-file project structure
- Component to move with dependencies
- Target location specified

**Test Steps**:
1. Parse all source files
2. Select element to move
3. Analyze dependencies
4. Create cross-file context
5. Execute transformation
6. Validate all generated code
7. Verify import graph integrity

**Expected Results**:
- All files generate valid code
- No circular dependencies
- All imports resolve correctly
- Code can be written to filesystem
- Tests would pass if code executed

## Test Considerations

### Mock Strategy

```typescript
// Use real Babel parser and traverse
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

// Create minimal mock dependencies
function createMockDependency(symbol: string, file: string) {
  return createInternalDependency({
    symbol,
    type: DependencyType.Variable,
    origin: createDependencyOrigin({
      node: t.identifier(symbol),
      file,
    }),
    scope: createScopeInfo({
      type: ScopeType.Function,
      path: createMockPath(),
      parent: null,
    }),
  });
}
```

### Boundary Conditions

1. **Empty file handling**: Target or source file is empty
2. **Maximum depth**: Transitive dependencies 5+ levels deep
3. **Large files**: Files with 100+ imports/exports
4. **Name collisions**: Shared module name conflicts with existing file
5. **Path edge cases**: Deeply nested directories, special characters

### Asynchronous Operations

- All transformations are synchronous
- No async/await needed in tests
- Can use standard `expect()` assertions

### Error Scenarios

1. **Invalid AST**: Malformed source code
2. **Missing files**: File not found in ASTs map
3. **Unresolvable cycles**: Circular deps that can't be broken
4. **Export conflicts**: Symbol already exported differently
5. **Import failures**: External module not available

## Coverage Improvement Plan

### Phase 1: Shared Module Creator (Target: 95%)
- Add SMC-01 through SMC-08
- Focus on uncovered lines: 769-774, 828, 834
- Test error paths and edge cases

### Phase 2: Integration Tests (Target: 95%)
- Add INT-01 through INT-10
- Cover main orchestration flow in index.ts
- Test circular dependency resolution end-to-end

### Phase 3: E2E Scenarios (Target: 100%)
- Add E2E-01 through E2E-05
- Verify real-world usage patterns
- Ensure all code paths exercised

## Success Criteria

- ✅ Line coverage ≥95% for all cross-file modules
- ✅ Branch coverage ≥95% for all cross-file modules
- ✅ All integration scenarios pass
- ✅ All E2E workflows complete successfully
- ✅ Error handling tested for all failure modes
- ✅ No regressions in existing tests
