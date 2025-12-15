# Optimization Integration Test Cases

## Test File

`src/__tests__/integration/optimization.test.ts`

## Test Purpose

Verify dependency sinking optimization after hoisting operations. This test suite ensures that hoisted dependencies are moved to optimal scope locations, respecting Hook rules, and cleaning up orphaned props.

## Test Cases Overview

| Case ID | Feature Description | Test Type     |
| ------- | ------------------- | ------------- |
| OPT-01  | Sink single-consumer dependency to optimal scope | Positive Test |
| OPT-02  | Preserve shared dependency at common ancestor | Positive Test |
| OPT-03  | Remove orphaned props after sinking | Positive Test |
| OPT-04  | Respect Hook rules during sinking | Positive Test |
| OPT-05  | Sink variable to single consumer scope | Positive Test |
| OPT-06  | Preserve parent-child shared dependency | Positive Test |
| OPT-07  | Preserve sibling shared dependency | Positive Test |
| OPT-08  | Remove prop threading after sinking | Positive Test |
| OPT-09  | Prevent sinking into conditional scope | Positive Test |
| OPT-10  | Prevent sinking into loop scope | Positive Test |
| OPT-11  | Optimize multiple dependencies together | Positive Test |
| OPT-12  | Detect and remove dead code after optimization | Positive Test |
| OPT-13  | Sink useCallback to single consumer | Positive Test |
| OPT-14  | Sink useMemo to single consumer | Positive Test |
| OPT-15  | Calculate LCA correctly for sinking | Positive Test |

## Detailed Test Steps

### OPT-01: Sink single-consumer dependency to optimal scope

**Test Purpose**: Verify dependency sinks to the only consumer

**Test Data Preparation**:
- Component with hoisted state at parent level
- State only used by single child component
- Props thread state from parent to child

**Test Steps**:
1. Analyze component with hoisted state
2. Detect state is only used in one child
3. Apply optimization
4. Verify state moved to child scope
5. Verify props removed from parent-child interface

**Expected Results**:
- State hoisted from parent to child
- Props removed from parent-child interface
- Code remains functionally equivalent

---

### OPT-02: Preserve shared dependency at common ancestor

**Test Purpose**: Verify shared deps stay at parent

**Test Data Preparation**:
- Component with state shared by multiple children
- Two sibling components both using the state
- Props thread state to both children

**Test Steps**:
1. Analyze component with shared state
2. Detect state used by multiple children
3. Apply optimization
4. Verify state remains at parent

**Expected Results**:
- State remains at parent level
- Props maintained for both children
- No sinking occurs for shared dependency

---

### OPT-03: Remove orphaned props after sinking

**Test Purpose**: Verify unused props are removed

**Test Data Preparation**:
- Component with prop threading through intermediate component
- Intermediate component passes props but doesn't use them
- After sinking, props become unnecessary

**Test Steps**:
1. Analyze component with prop threading
2. Sink dependency to consumer
3. Detect props no longer needed in intermediate component
4. Remove orphaned props

**Expected Results**:
- Intermediate component no longer has unused props
- Props removed from function signature
- Prop spreading removed from JSX

---

### OPT-04: Respect Hook rules during sinking

**Test Purpose**: Verify hooks don't sink into invalid locations

**Test Data Preparation**:
- Component with conditional rendering
- Hook hoisted at component top-level
- Only consumer is inside conditional block

**Test Steps**:
1. Analyze component with conditional rendering
2. Detect hook would sink into conditional
3. Check Hook rules
4. Prevent sinking
5. Keep hook at valid location

**Expected Results**:
- Hook remains at component top-level
- No Rules of Hooks violations
- Conditional rendering maintained

---

### OPT-05: Sink variable to single consumer

**Test Purpose**: Verify variables sink like hooks

**Test Data Preparation**:
- Component with computed variable at parent
- Variable only used by single child
- Variable is pure (no side effects)

**Test Steps**:
1. Detect pure variable at parent
2. Find single consumer
3. Sink variable to consumer scope
4. Remove prop from interface

**Expected Results**:
- Variable moved to optimal scope
- Props cleaned up

---

### OPT-06: Preserve parent-child shared dependency

**Test Purpose**: Verify deps shared between parent and child

**Test Data Preparation**:
- Parent uses the dependency in its own render
- Child also uses the same dependency
- Dependency cannot sink to child

**Test Steps**:
1. Analyze parent and child usage
2. Detect shared usage
3. Determine LCA is parent
4. Preserve at parent

**Expected Results**:
- Dependency stays at parent
- Both parent and child can access it

---

### OPT-07: Preserve sibling shared dependency

**Test Purpose**: Verify deps shared between siblings

**Test Data Preparation**:
- Two sibling components share dependency
- Dependency at common parent
- Cannot sink to either sibling

**Test Steps**:
1. Analyze both siblings
2. Detect shared usage
3. Determine LCA is parent
4. Preserve at parent

**Expected Results**:
- Dependency stays at parent
- Both siblings receive via props

---

### OPT-08: Remove prop threading after sinking

**Test Purpose**: Verify prop chains are cleaned up

**Test Data Preparation**:
- Deep component tree with prop threading
- Dependency threaded through multiple levels
- Only consumed at leaf level

**Test Steps**:
1. Sink dependency to leaf
2. Identify intermediate components
3. Remove props from each level
4. Clean up entire chain

**Expected Results**:
- Props removed from entire chain
- Intermediate components simplified

---

### OPT-09: Prevent sinking into conditional scope

**Test Purpose**: Verify hooks stay out of conditionals

**Test Data Preparation**:
- Hook at component level
- Only usage inside conditional block
- Conditional could be false

**Test Steps**:
1. Analyze usage location
2. Detect conditional scope
3. Check Hook rules
4. Prevent sinking

**Expected Results**:
- Hook at component level
- No Rules violations

---

### OPT-10: Prevent sinking into loop scope

**Test Purpose**: Verify hooks stay out of loops

**Test Data Preparation**:
- Hook at component level
- Only usage inside map/loop
- Loop could have variable iterations

**Test Steps**:
1. Analyze usage location
2. Detect loop scope
3. Check Hook rules
4. Prevent sinking

**Expected Results**:
- Hook at component level
- No Rules violations

---

### OPT-11: Optimize multiple dependencies together

**Test Purpose**: Verify batch optimization works

**Test Data Preparation**:
- Multiple dependencies at parent
- Some sinkable, some shared
- Different dependency types (hooks, variables)

**Test Steps**:
1. Analyze all dependencies
2. Classify each (sinkable vs shared)
3. Optimize sinkable ones
4. Preserve shared ones

**Expected Results**:
- All sinkable deps optimized
- Shared deps preserved
- All ops atomic

---

### OPT-12: Detect and remove dead code after optimization

**Test Purpose**: Verify unused code is detected

**Test Data Preparation**:
- Component with unused state
- Component with unused variables
- Legitimate unused declarations

**Test Steps**:
1. Analyze all declarations
2. Find consumers for each
3. Identify zero-consumer declarations
4. Mark as dead code

**Expected Results**:
- Dead code identified
- Option to remove available

---

### OPT-13: Sink useCallback to single consumer

**Test Purpose**: Verify useCallback sinks correctly

**Test Data Preparation**:
- useCallback at parent
- Callback passed to single child
- Callback has dependencies

**Test Steps**:
1. Analyze callback usage
2. Find single consumer
3. Sink useCallback with deps
4. Remove prop

**Expected Results**:
- useCallback at optimal scope
- Dependencies updated

---

### OPT-14: Sink useMemo to single consumer

**Test Purpose**: Verify useMemo sinks correctly

**Test Data Preparation**:
- useMemo at parent
- Memoized value passed to single child
- Has dependency array

**Test Steps**:
1. Analyze memoized value usage
2. Find single consumer
3. Sink useMemo with deps
4. Remove prop

**Expected Results**:
- useMemo at optimal scope
- Dependencies maintained

---

### OPT-15: Calculate LCA correctly for sinking

**Test Purpose**: Verify lowest common ancestor algorithm

**Test Data Preparation**:
- Deep component tree
- Dependency used at multiple leaf nodes
- LCA is intermediate node

**Test Steps**:
1. Build component tree
2. Find all consumers
3. Calculate LCA
4. Verify optimal placement

**Expected Results**:
- LCA computed correctly
- Dependency at LCA scope
- All consumers can access

---

## Test Considerations

### Mock Strategy

The tests use mock implementations for:
- `optimize()` function that simulates dependency analysis
- `regraftWithOptimize()` that combines move and optimization
- `analyzeSinkableDependencies()` for simplified detection

### Boundary Conditions

- **Zero Dependencies**: Component with no sinkable dependencies
- **All Shared**: All dependencies are shared, none sinkable
- **Deep Trees**: Deeply nested component hierarchies
- **Multiple Files**: Cross-file optimization scenarios
- **Mixed Types**: Hooks, variables, and memoization together

### Hook Rules Validation

Special attention to:
- Conditional rendering blocks
- Loop scopes (map, filter, etc.)
- Event handlers
- useEffect callbacks
- Component boundaries

### Performance Considerations

- LCA computation efficiency for large trees
- Batch optimization for multiple dependencies
- Incremental updates vs full reanalysis
- Memory usage for large component graphs

---

## Related Requirements

- **Requirement 8**: Dependency Sinking Optimization
  - 8.1: Analyze all hoisted dependencies
  - 8.2: Sink single-consumer dependencies
  - 8.3: Preserve shared dependencies
  - 8.4: Preserve parent-child shared
  - 8.5: Remove orphaned props
  - 8.6: Respect Hook rules
  - 8.7: Auto-optimize with regraft()

---

*Document Version: 1.0*
*Created: 2025-12-15*
*Test File: src/__tests__/integration/optimization.test.ts*
