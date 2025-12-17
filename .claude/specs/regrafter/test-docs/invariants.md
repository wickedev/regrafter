# Property-Based Invariants Test Cases

## Test File

`src/__tests__/property/invariants.test.ts`

## Test Purpose

Verify core transformation invariants using property-based testing with fast-check. These tests ensure that the regraft operation maintains fundamental correctness guarantees across a wide range of randomly generated inputs.

## Test Cases Overview

| Case ID | Feature Description | Test Type     |
| ------- | ------------------- | ------------- |
| INV-01  | Idempotency: move then reverse restores original | Property Test |
| INV-02  | Parse validity: output always parses without errors | Property Test |
| INV-03  | Dependency preservation: all deps accessible after move | Property Test |
| INV-04  | canMove accuracy: if canMove=true, move must succeed | Property Test |

## Detailed Test Steps

### INV-01: Idempotency - Move and Reverse Restores Original

**Test Purpose**: Verify that moving an element and then reversing the move restores the original code structure

**Test Data Preparation**:
- Generate random valid React components with various structures
- Generate random valid move modes (Inside, Before, After)
- Generate random valid source and target positions
- Component structures include simple elements, nested elements, and elements with dependencies

**Test Steps**:
1. Generate random component and positions
2. Execute first move: regraft(files, from, to, mode)
3. If first move fails, skip test (not applicable)
4. Calculate reverse mode (Before ↔ After, Inside remains Inside)
5. Execute reverse move: regraft(result1.codes, to, from, reverseMode)
6. If reverse move fails, skip test (not applicable)
7. Normalize both original and final code (remove whitespace differences)
8. Compare normalized versions

**Expected Results**:
- Original and final code are semantically equivalent
- Whitespace-normalized code matches exactly
- All dependencies remain intact
- Component structure is preserved

---

### INV-02: Parse Validity - Output Always Parses

**Test Purpose**: Verify that all output code from successful operations parses without errors

**Test Data Preparation**:
- Generate random valid React components
- Generate random valid selectors (position-based and path-based)
- Generate random valid move modes
- Use parser with full JSX/TSX support

**Test Steps**:
1. Generate random inputs (files, from, to, mode)
2. Execute regraft operation
3. If operation fails (success: false), skip validation (expected failure)
4. For each output file in result.codes:
   a. Parse code using parser
   b. Verify parse succeeds without errors
   c. Verify AST is valid
5. Verify all files parsed successfully

**Expected Results**:
- All successful operations produce parseable code
- No syntax errors in output
- AST structure is valid
- JSX/TSX elements are well-formed

---

### INV-03: Dependency Preservation - All Dependencies Accessible

**Test Purpose**: Verify that all dependencies of a moved element remain accessible after the move

**Test Data Preparation**:
- Generate components with various dependency types:
  - Hooks (useState, useEffect, useContext, etc.)
  - Variables (const, let, function)
  - Imports (React, external libraries)
  - Props (component parameters)
- Generate random valid move operations
- Track dependency symbols before and after

**Test Steps**:
1. Generate component with dependencies
2. Analyze dependencies before move: analyze(files, from, to, mode)
3. Collect all dependency symbols from beforeAnalysis.dependencies
4. If no dependencies, skip test (trivial case)
5. Execute move: regraft(files, from, to, mode)
6. If move fails, skip test (expected failure)
7. Analyze dependencies after move at new location
8. Verify all original dependencies are still resolvable
9. Verify canMove is true for post-move analysis

**Expected Results**:
- All dependencies accessible before move remain accessible after
- Dependency symbols are preserved
- Hoisting/prop threading maintains access
- No dependencies become unresolvable

---

### INV-04: canMove Accuracy - Prediction Matches Reality

**Test Purpose**: Verify that if canMove returns true, the actual move operation must succeed

**Test Data Preparation**:
- Generate random valid React components
- Generate random valid selectors
- Generate random valid move modes
- Test both positive and negative cases

**Test Steps**:
1. Generate random inputs (files, from, to, mode)
2. Call canMove(files, from, to, mode)
3. Record canMove result (true/false)
4. If canMove returns false:
   a. Test passes (no constraint on regraft in this case)
   b. Optionally verify regraft also fails or provides reason
5. If canMove returns true:
   a. Call regraft(files, from, to, mode)
   b. Verify result.success === true
   c. If regraft fails, test fails (violation of canMove guarantee)
6. Repeat for many random inputs

**Expected Results**:
- Zero false positives: canMove=true always means regraft succeeds
- False negatives acceptable: canMove=false but regraft might still work
- canMove is conservative but accurate
- No surprise failures after canMove approval

---

## Test Generators

### validMoveMode

Generates random valid Move enum values:
- `fc.constantFrom(Move.Inside, Move.Before, Move.After)`

### simpleReactComponent

Generates valid React function components with basic structure:
- Random component name
- Simple JSX tree with 2-5 child elements
- No complex dependencies
- Example: `function Comp() { return <div><span>A</span><span>B</span></div>; }`

### componentWithDependencies

Generates React components with various dependency types:
- useState hooks
- useEffect hooks
- Local variables (const, let)
- Helper functions
- Props usage
- Import statements

### positionSelector

Generates random valid position selectors:
- File from input file list
- Line: random integer 1-100
- Column: random integer 0-80

### validFileInput

Generates random valid file inputs:
- Path: random .tsx file name
- Content: valid React component code

## Test Considerations

### Property-Based Testing Strategy

Use fast-check for:
- Random input generation
- Shrinking on failure (finds minimal failing case)
- Replay capability for debugging
- Configurable iterations (default 100 runs per test)

### Mock Strategy

No mocks needed:
- Tests use actual regraft, canMove, and analyze functions
- Full integration testing of transformation pipeline
- Real AST parsing and generation

### Boundary Conditions

- **Empty Components**: Components with no children
- **Single Element**: Move single element to various positions
- **Deep Nesting**: Deeply nested component trees (5+ levels)
- **No Dependencies**: Elements with zero dependencies
- **Complex Dependencies**: Elements with 5+ dependencies
- **Cross-File**: Some tests cover cross-file scenarios
- **Edge Positions**: First/last child, before first, after last

### Invariant Violation Handling

When an invariant is violated:
1. fast-check automatically shrinks to minimal failing case
2. Test framework reports the simplest input that causes failure
3. Developers can replay exact failure with seed value
4. Fix root cause in transformation logic
5. Re-run tests to verify fix

### Performance Considerations

- Property tests run 100 iterations by default
- Each test should complete in < 10 seconds for all iterations
- Use smaller code samples to keep tests fast
- Complex scenarios tested in integration tests instead

### Code Normalization

For idempotency tests:
- Remove all whitespace: `code.replace(/\s+/g, ' ')`
- Trim leading/trailing whitespace
- Ignore comment differences (optional)
- Focus on semantic equivalence

---

## Related Requirements

- **Requirement 12**: Performance Requirements
  - 12.1: Single file < 100ms (P95)
  - 12.2: Multi-file < 500ms (P95)
  - 12.3: canMove < 20% of full operation

- **Design Section 7.4**: Property-Based Test Invariants
  - Idempotency invariant
  - Parse validity invariant
  - Dependency preservation invariant
  - canMove accuracy invariant

- **TASK-001**: eval() Detection (dependency)
  - Required for canMove accuracy testing
  - Ensures unanalyzable code is properly detected

---

## Implementation Notes

### Test Structure

Each invariant test follows this pattern:

```typescript
import { fc, test } from '@fast-check/vitest';

test.prop([generator1, generator2, ...])(
  'invariant description',
  (input1, input2, ...) => {
    // 1. Setup
    const files = createFiles(input1);

    // 2. Execute operation(s)
    const result = regraft(files, from, to, mode);

    // 3. Assert invariant holds
    expect(invariantCondition).toBe(true);
  }
);
```

### Generator Configuration

- Use `fc.string()` for names with constraints
- Use `fc.constantFrom()` for enums
- Use `fc.record()` for object structure
- Use `fc.integer()` with min/max for positions
- Chain generators with `.map()` for transformations

### Debugging Failed Properties

When a test fails:
1. Note the seed value from test output
2. Add `.verbose()` to generator for more details
3. Use `fc.sample()` to preview generated values
4. Reproduce exact failure with `fc.seed()`
5. Simplify to minimal case manually if needed

---

*Document Version: 1.0*
*Created: 2025-12-17*
*Test File: src/__tests__/property/invariants.test.ts*
*Related Task: TASK-007 from gap-impl-tasks.md*
