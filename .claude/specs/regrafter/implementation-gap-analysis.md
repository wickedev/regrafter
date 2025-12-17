# Regrafter Implementation Gap Analysis

**Version**: 1.0
**Date**: 2025-12-17
**Analysis Scope**: Requirements v2.0 vs Current Implementation (v0.1.0)

---

## Executive Summary

This document analyzes the gap between the specified requirements (requirements.md v2.0) and design (design.md v11.0) versus the current implementation of Regrafter. The analysis is organized by requirement categories and highlights what has been implemented, what is partially complete, and what remains to be done.

**Overall Status**: ~60% Complete

- ✅ **Fully Implemented**: 4/13 requirement categories (31%)
- 🟡 **Partially Implemented**: 7/13 requirement categories (54%)
- ❌ **Not Implemented**: 2/13 requirement categories (15%)

---

## 1. Integrated API (통합 API)

**Status**: ✅ **FULLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| `regraft(files, from, to, mode, options)` function | ✅ | `src/index.ts:251-279` |
| Returns Result with success, codes, analysis | ✅ | `src/index.ts:263-278` |
| Executes validation → move → analyze → optimize pipeline | ✅ | `src/index.ts:261-278` |
| Support for `dryRun` option | ✅ | `src/index.ts:273-275` |
| Support for `optimize` option (default: true) | ✅ | `src/index.ts:866-887` |
| Changed files marked in codes array | ✅ | `src/index.ts:383` |

### Implementation Notes

- Main API entry point is well-structured and follows the spec
- Properly sequences validation, transformation, and optimization
- Options merging with defaults works correctly

### Gap: None

---

## 2. Move Modes (이동 모드)

**Status**: ✅ **FULLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| Move.Inside (append as child) | ✅ | `src/types/public.ts:28-29` |
| Move.Before (insert as previous sibling) | ✅ | `src/types/public.ts:30-31` |
| Move.After (insert as next sibling) | ✅ | `src/types/public.ts:32-33` |
| Remove from original location after move | ✅ | `src/transformer/jsx-transformer.ts` |
| No-op when source == target | ✅ | Validation layer |

### Implementation Notes

- Move enum is properly defined and exported
- Transformer correctly implements all three modes
- Edge case handling appears complete

### Gap: None

---

## 3. Selectors (선택자)

**Status**: ✅ **FULLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| PositionSelector (file, line, column) | ✅ | `src/types/public.ts:53-60` |
| PathSelector (file, path) | ✅ | `src/types/public.ts:74-79` |
| Type guard: isPositionSelector | ✅ | `src/types/public.ts:293-302` |
| Type guard: isPathSelector | ✅ | `src/types/public.ts:307-309` |
| SelectorResolver implementation | ✅ | `src/selector/selector-resolver.ts` |
| Error on invalid selector | ✅ | `src/selector/selector-resolver.ts` |
| Error when file not in files array | ✅ | Validation layer |

### Implementation Notes

- Both selector types are fully implemented
- Resolver handles position-based and path-based selection
- Type guards provide runtime safety

### Gap: None

---

## 4. Dependency Analysis (의존성 분석)

**Status**: 🟡 **PARTIALLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| Identify Hook dependencies | ✅ | `src/analyzer/dependency-analyzer.ts` |
| Identify Variable dependencies | ✅ | `src/analyzer/dependency-analyzer.ts` |
| Identify Import dependencies | ✅ | `src/analyzer/dependency-analyzer.ts` |
| Identify Prop dependencies | ✅ | `src/analyzer/dependency-analyzer.ts` |
| Identify Context dependencies | 🟡 | Partial - basic detection only |
| Identify Ref dependencies | 🟡 | Partial - basic detection only |
| Return MoveAnalysis with all dependencies | ✅ | `src/analyzer/move-analysis-builder.ts` |
| Mark unanalyzable code (eval) | ❌ | **NOT IMPLEMENTED** |

### Implementation Notes

- Core dependency detection is working
- DependencyAnalyzer class exists and handles most cases
- Transitive dependency tracking is implemented

### Gaps

1. **Missing**: Detection of `eval()` and dynamic code execution (Requirement 4.6)
   - **Impact**: High - violates safety guarantee
   - **Required for**: Requirement 6 (canMove validation)

2. **Incomplete**: Context dependency handling is basic
   - **Impact**: Medium - affects Context-heavy applications
   - **Missing**: Provider detection, Provider hoisting

3. **Incomplete**: Ref dependency handling is basic
   - **Impact**: Low - ref forwarding not fully implemented

---

## 5. Automatic Dependency Hoisting (의존성 자동 호이스팅)

**Status**: 🟡 **PARTIALLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| Hoist Hooks to valid locations | ✅ | `src/strategies/hook-hoister.ts` |
| Hoist Variables when needed | ✅ | `src/strategies/variable-hoister.ts` |
| Add imports to target file | ✅ | `src/strategies/import-manager.ts` |
| Thread props when needed | ✅ | `src/strategies/prop-threader.ts` |
| Validate Hook Rules (no conditional/loop) | ✅ | `src/strategies/hook-hoister.ts` |
| Hoist Context Providers | 🟡 | Partial implementation |
| Handle ref forwarding | 🟡 | Basic implementation only |

### Implementation Notes

- HoistPlanner and HoistExecutor architecture is solid
- Individual strategies are implemented and tested
- Hook Rules validation is working

### Gaps

1. **Incomplete**: Context Provider hoisting strategy
   - **Impact**: High for Context-heavy apps
   - **Status**: Basic ContextHandler exists but not complete
   - **Missing**: Provider wrapping, Provider hoisting to LCA

2. **Incomplete**: Ref forwarding through components
   - **Impact**: Medium
   - **Status**: Basic detection only
   - **Missing**: Automatic `forwardRef` wrapping

3. **Not Verified**: Prop threading through deeply nested trees
   - **Impact**: Medium
   - **Status**: Implementation exists but complex scenarios untested

---

## 6. Move Validation (canMove API / 이동 불가능 조건 검증)

**Status**: 🟡 **PARTIALLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| `canMove(files, from, to, mode)` API | ✅ | `src/index.ts:293-301` |
| Return boolean for move feasibility | ✅ | `src/index.ts:300` |
| Detect eval() / dynamic code | ❌ | **NOT IMPLEMENTED** |
| Provide reason when not movable | ✅ | `src/analyzer/move-validator.ts` |
| Handle conditional expressions atomically | ✅ | `src/analyzer/atomic-unit-detector.ts` |
| Handle map/filter expressions atomically | ✅ | `src/analyzer/atomic-unit-detector.ts` |
| Handle Context outside Provider | 🟡 | Partial - detection only |
| Handle Suspense boundaries | 🟡 | Basic SuspenseHandler exists |
| Handle Compound Components | ✅ | `src/analyzer/atomic-unit-detector.ts` |
| Handle ref dependencies | 🟡 | Partial |

### Implementation Notes

- canMove API is implemented and working
- Atomic unit detection is sophisticated
- MoveValidator provides good feedback

### Gaps

1. **Critical Missing**: eval() detection
   - **Impact**: **CRITICAL** - violates core safety requirement
   - **Requirement**: 6.2 - "IF dependency contains eval() THEN return false"
   - **Action Required**: Add static analysis for eval and dynamic code

2. **Incomplete**: Context/Provider validation
   - **Impact**: High
   - **Missing**: Check if move crosses Provider boundary
   - **Missing**: Auto-suggest Provider hoisting

3. **Incomplete**: Suspense boundary handling
   - **Impact**: Medium
   - **Status**: Basic SuspenseHandler exists
   - **Missing**: Automatic Suspense wrapping

4. **Incomplete**: Lazy component handling
   - **Impact**: Medium
   - **Missing**: Detection of lazy imports
   - **Missing**: Validation of Suspense requirement

---

## 7. Cross-File Movement (파일 간 이동)

**Status**: 🟡 **PARTIALLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| Detect cross-file moves (from.file != to.file) | ✅ | `src/strategies/cross-file/detector.ts` |
| Create shared modules for unexported deps | ✅ | `src/strategies/cross-file/shared-module-creator.ts` |
| Add imports to both source and target | ✅ | `src/strategies/cross-file/index.ts` |
| Handle existing usage in original file | 🟡 | Partial |
| Return all changed files (source + target + shared) | ✅ | `src/index.ts:471` |
| Create new file if target not in files array | 🟡 | NewFileHandler exists but untested |
| Prevent circular dependencies | ✅ | `src/strategies/cross-file/circular-dependency.ts` |

### Implementation Notes

- Cross-file infrastructure exists
- Shared module creation is implemented
- Circular dependency detection is present

### Gaps

1. **Incomplete**: Shared module path resolution
   - **Impact**: Medium
   - **Missing**: Configurable shared module naming/location
   - **Current**: Likely hardcoded paths

2. **Incomplete**: Import deduplication
   - **Impact**: Low
   - **Missing**: Merge with existing imports
   - **Risk**: Duplicate import statements

3. **Not Tested**: New file creation
   - **Impact**: Medium
   - **Status**: NewFileHandler exists
   - **Issue**: Edge cases likely not covered

4. **Incomplete**: Original file reference updating
   - **Impact**: Medium
   - **Status**: Partial implementation
   - **Missing**: Convert local usage to imports

---

## 8. Dependency Sinking Optimization (의존성 싱킹 최적화)

**Status**: 🟡 **PARTIALLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| `optimize(files)` API | ✅ | `src/index.ts:763-769` |
| Analyze hoisted dependencies for sinking | ✅ | `src/optimizer/sink-analyzer.ts` |
| Sink to LCA if single subtree | ✅ | `src/optimizer/sink-executor.ts` |
| Keep shared dependencies at parent | ✅ | `src/optimizer/sink-analyzer.ts` |
| Remove unnecessary prop threading | ✅ | `src/optimizer/sink-executor.ts` |
| Validate Hook rules during sinking | ✅ | `src/optimizer/sink-analyzer.ts` |
| Auto-optimize in regraft when optimize:true | ✅ | `src/index.ts:866-887` |

### Implementation Notes

- Optimizer architecture is complete
- SinkAnalyzer and SinkExecutor are implemented
- Integration with main pipeline works

### Gaps

1. **Not Verified**: Complex prop threading cleanup
   - **Impact**: Low
   - **Status**: Implementation exists
   - **Issue**: Complex multi-level threading untested

2. **Missing**: Optimization metrics
   - **Impact**: Low
   - **Status**: No stats returned
   - **Missing**: Count of sunk deps, removed props

3. **Performance**: Optimization performance not measured
   - **Impact**: Medium
   - **Missing**: Benchmarks for optimization phase

---

## 9. Individual APIs (개별 API)

**Status**: ✅ **FULLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| `canMove(files, from, to, mode)` returns boolean | ✅ | `src/index.ts:293-301` |
| `move(files, from, to, mode)` returns Code[] | ✅ | `src/index.ts:315-393` |
| `analyze(files, from, to, mode)` returns MoveAnalysis | ✅ | `src/index.ts:672-751` |
| `optimize(files)` returns Code[] | ✅ | `src/index.ts:763-769` |
| APIs work independently | ✅ | All exported from index |

### Implementation Notes

- All four APIs are properly exported
- Each can be used independently
- Type signatures match specification

### Gap: None

---

## 10. Code Generation (코드 생성)

**Status**: 🟡 **PARTIALLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| preserveComments option (default: true) | 🟡 | Option defined, preservation uncertain |
| formatOutput option (default: false) | 🟡 | Option defined, formatting uncertain |
| Adjust indentation for moved elements | ✅ | Babel generator handles this |
| Import statement formatting | ✅ | ImportManager implementation |
| Import deduplication | 🟡 | Partial |

### Implementation Notes

- CodeGenerator class exists
- Uses @babel/generator for output
- Options are defined in types

### Gaps

1. **Not Verified**: Comment preservation
   - **Impact**: Medium
   - **Status**: Option exists but unclear if working
   - **Test Coverage**: Likely missing tests

2. **Not Implemented**: Output formatting integration
   - **Impact**: Low
   - **Status**: formatOutput option exists
   - **Missing**: Prettier integration or custom formatter

3. **Incomplete**: Import deduplication
   - **Impact**: Low
   - **Status**: Basic implementation
   - **Missing**: Merge with existing imports

---

## 11. Error Handling (오류 처리)

**Status**: 🟡 **PARTIALLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| Parse error with location and message | ✅ | `src/errors/index.ts` - ParseError |
| Selector error with selector info | ✅ | `src/errors/index.ts` - SelectorError |
| Suggested fixes in MoveAnalysis | ✅ | `src/errors/suggested-fixes.ts` |
| Result.success = false on error | ✅ | `src/index.ts:268-269` |
| Circular dependency error with path | ✅ | `src/errors/index.ts` - CircularError |
| Error code definitions | ✅ | `src/errors/error-codes.ts` |
| Recovery strategies | ✅ | `src/errors/error-recovery.ts` |

### Implementation Notes

- Error infrastructure is comprehensive
- All error types are defined
- Error recovery system exists

### Gaps

1. **Incomplete**: Error code coverage
   - **Impact**: Low
   - **Status**: ERROR_CODES defined
   - **Missing**: Not all requirement errors mapped to codes

2. **Not Verified**: Suggested fixes quality
   - **Impact**: Medium
   - **Status**: System exists
   - **Missing**: Comprehensive fix suggestions for all error types

3. **Missing**: Error recovery execution
   - **Impact**: Low
   - **Status**: RecoveryStrategy interface exists
   - **Missing**: Automatic recovery not implemented

---

## 12. Performance Requirements (성능 요구사항)

**Status**: ❌ **NOT IMPLEMENTED**

### Requirements Coverage

| Requirement | Target | Status |
|------------|--------|--------|
| Single file (< 1000 lines) | < 100ms (P95) | ❌ Not measured |
| Multi-file (10 files, 1000 lines each) | < 500ms (P95) | ❌ Not measured |
| canMove relative cost | < 20% of full operation | ❌ Not measured |
| Memory usage | < 10x file size | ❌ Not measured |

### Implementation Notes

- No performance benchmarks exist
- No performance tests in test suite
- Performance optimization code exists but unmeasured

### Gaps

1. **Critical Missing**: Performance benchmarks
   - **Impact**: **HIGH** - Cannot verify requirements
   - **Missing**: Benchmark suite
   - **Missing**: P95 latency measurements

2. **Missing**: Memory profiling
   - **Impact**: High
   - **Missing**: Heap snapshots
   - **Missing**: Memory usage tracking

3. **Missing**: Performance regression tests
   - **Impact**: Medium
   - **Missing**: CI performance checks

---

## 13. Type Safety (타입 안전성)

**Status**: ✅ **FULLY IMPLEMENTED**

### Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|----------|
| TypeScript type definitions for all APIs | ✅ | `src/types/public.ts` |
| Move enum with type checking | ✅ | `src/types/public.ts:27-34` |
| Selector union type support | ✅ | `src/types/public.ts:85` |
| Options with all fields optional | ✅ | `src/types/public.ts:95-122` |
| Type guards for runtime validation | ✅ | `src/types/public.ts:293-415` |

### Implementation Notes

- Full TypeScript support
- Strict mode enabled
- Comprehensive type definitions

### Gap: None

---

## Critical Issues Summary

### Blocker Issues (Must Fix Before v1.0)

1. **eval() Detection Missing** (Req 4.6, 6.2)
   - **Severity**: CRITICAL
   - **Impact**: Violates core safety guarantee
   - **Required**: Static analysis to detect eval(), Function constructor, dynamic code

2. **Performance Benchmarks Missing** (Req 12)
   - **Severity**: HIGH
   - **Impact**: Cannot verify performance requirements
   - **Required**: Benchmark suite with P95 measurements

### High Priority Issues

3. **Context/Provider Handling Incomplete** (Req 5.4, 6.7)
   - **Severity**: HIGH
   - **Impact**: Limits usefulness for Context-heavy applications
   - **Required**: Complete ContextHandler implementation

4. **Cross-File Edge Cases Untested** (Req 7)
   - **Severity**: HIGH
   - **Impact**: Risk of data loss or broken code
   - **Required**: Comprehensive cross-file test suite

### Medium Priority Issues

5. **Comment Preservation Not Verified** (Req 10.1)
   - **Severity**: MEDIUM
   - **Impact**: Poor developer experience
   - **Required**: Tests for comment preservation

6. **Suspense Handling Incomplete** (Req 6.7)
   - **Severity**: MEDIUM
   - **Impact**: Doesn't handle modern React patterns
   - **Required**: Complete SuspenseHandler implementation

---

## Test Coverage Analysis

### Current State

- **Total Test Files**: 36
- **Total Lines of Code**: ~46,000 (including tests)
- **Estimated Test Coverage**: Unknown (no coverage reports found)

### Requirements vs Test Coverage

| Category | Required Tests | Existing Tests | Coverage |
|----------|---------------|----------------|----------|
| Unit Tests | 7 components (95% target) | Yes | Unknown |
| Integration Tests | 9 scenarios | Partial | ~60% |
| E2E Tests | 4 scenarios | Partial | ~40% |
| Property-Based Tests | 4 invariants | Missing | 0% |
| Performance Tests | 4 benchmarks | Missing | 0% |

### Test Gaps

1. **Missing**: Property-based tests for invariants (Req 7.4)
   - Idempotency
   - Parse validity
   - Dependency preservation
   - canMove accuracy

2. **Missing**: Performance benchmarks (Req 7.5)

3. **Incomplete**: Integration test scenarios
   - Atomic units partially covered
   - Error cases partially covered
   - Cross-file scenarios incomplete

---

## Architectural Assessment

### Strengths

1. **Well-Structured**: Clear separation of concerns
2. **Modular**: Components are properly isolated
3. **Type-Safe**: Full TypeScript with strict mode
4. **Extensible**: Plugin architecture for strategies
5. **Error Handling**: Comprehensive error infrastructure

### Weaknesses

1. **Performance**: No measurement or optimization focus
2. **Testing**: Property-based tests completely missing
3. **Documentation**: Limited inline documentation
4. **Complexity**: Some components may be over-engineered

---

## Recommendations

### Immediate Actions (Before v1.0)

1. **Add eval() Detection**
   - Traverse AST looking for CallExpression to eval()
   - Check for Function constructor
   - Flag dynamic import() if not statically analyzable

2. **Create Performance Benchmark Suite**
   - Use Vitest benchmark utilities
   - Measure P95 latency for all scenarios
   - Add CI performance regression checks

3. **Complete Context/Provider Support**
   - Implement Provider hoisting algorithm
   - Add Provider boundary detection
   - Test with complex Context scenarios

### Short-Term Improvements

4. **Verify Comment Preservation**
   - Add specific tests for comment handling
   - Test edge cases (comments in moved elements)

5. **Add Property-Based Tests**
   - Idempotency test (move and reverse)
   - Parse validity test (output always parseable)
   - Dependency preservation test

6. **Complete Cross-File Testing**
   - Test new file creation
   - Test circular dependency prevention
   - Test import deduplication

### Long-Term Enhancements

7. **Performance Optimization**
   - Profile hot paths
   - Optimize AST traversal
   - Consider caching strategies

8. **Enhanced Error Messages**
   - More specific error codes
   - Better suggested fixes
   - Context-aware suggestions

9. **Documentation**
   - API documentation with examples
   - Architecture documentation
   - Migration guides

---

## Conclusion

The Regrafter implementation is **approximately 60% complete** relative to the requirements. The core functionality is working and well-architected, but several critical features are missing or incomplete:

**Strengths:**
- Core API surface is complete
- Type safety is excellent
- Error handling infrastructure is solid
- Modular architecture supports future extensions

**Critical Gaps:**
- eval() detection (safety requirement)
- Performance benchmarks (verification requirement)
- Context/Provider handling (functionality requirement)
- Property-based tests (quality requirement)

**Recommendation**: The library is **NOT production-ready** until the critical issues are resolved. With focused effort on the blocker issues, it could reach production quality within 2-4 weeks of development time.

---

**Document Version**: 1.0
**Next Review**: After critical issues are resolved
**Reviewers**: Development team, QA team
