# Requirements Document: SOLID Principles Refactoring

## Introduction

This document outlines the requirements for a comprehensive refactoring of the Regrafter codebase to improve adherence to SOLID principles, reduce code duplication, and enhance maintainability. The refactoring is based on findings from a detailed code review conducted on 2025-12-20.

The current codebase has an overall assessment of 7/10, with strong architectural foundations but critical issues in class design, code duplication, and SOLID principle violations. The primary concerns are:

- **DependencyAnalyzer** (1,136 lines) and **HoistPlanner** (871 lines) violate the Single Responsibility Principle (SRP)
- 143 instances of duplicated scope/binding helper patterns across 22 files
- 162 instances of repeated error handling boilerplate across 48 files
- Interface Segregation Principle (ISP) violations in IScopeManager
- High cyclomatic complexity in several core methods

This refactoring will be conducted incrementally using Test-Driven Development (TDD) and the "Tidy First" approach, separating structural changes from behavioral changes.

**Success Metrics**:
- Reduce average class size from 600 lines to <300 lines
- Eliminate 80%+ of identified code duplication
- Improve test coverage to 95%+ for refactored modules
- Maintain or improve performance benchmarks (<100ms for single file operations)
- Zero regression in existing test suite

---

## Requirements

### Requirement 1: DependencyAnalyzer Class Decomposition (Priority 1 - Critical)

**User Story:** As a developer, I want the DependencyAnalyzer to be decomposed into smaller, focused classes, so that each class has a single responsibility and is easier to understand, test, and maintain.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL contain a DependencyOrchestrator class with the sole responsibility of coordinating dependency analysis workflow
2. WHEN the refactoring is complete THEN the system SHALL contain a DependencyConverter class with the sole responsibility of converting and deduplicating dependencies
3. WHEN the refactoring is complete THEN the system SHALL contain a DependencyResolver class with the sole responsibility of checking dependency resolvability at target locations
4. WHEN the refactoring is complete THEN the system SHALL contain a RelatedDependencyDetector class with the sole responsibility of detecting transitive and related dependencies
5. WHEN a class is created THEN the class SHALL NOT exceed 300 lines of code
6. WHEN the refactoring is complete THEN each extracted class SHALL have focused unit tests covering all public methods
7. WHEN the refactoring is complete THEN the existing test suite SHALL pass without modification (zero regression)
8. WHEN the refactoring is implemented THEN the system SHALL maintain performance targets of <100ms for single file dependency analysis

**Current State**: DependencyAnalyzer has 1,136 lines with 15+ responsibilities including collection, detection, analysis, deduplication, resolution checking, and orchestration.

**Estimated Effort**: 2-3 days

---

### Requirement 2: HoistPlanner Class Decomposition (Priority 1 - Critical)

**User Story:** As a developer, I want the HoistPlanner to be decomposed into smaller, focused classes, so that planning logic, validation logic, and scope traversal are separated and independently testable.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL contain a HookLocationValidator class with the sole responsibility of validating hook locations according to Rules of Hooks
2. WHEN the refactoring is complete THEN the system SHALL contain a HoistStrategySelector class with the sole responsibility of selecting appropriate hoisting strategies based on dependency type and context
3. WHEN the refactoring is complete THEN the system SHALL contain a HoistPlanBuilder class with the sole responsibility of constructing HoistPlan objects
4. WHEN a hook location is validated THEN the HookLocationValidator SHALL return a Result type with clear error messages when validation fails
5. WHEN the refactoring is complete THEN each extracted class SHALL have comprehensive unit tests including edge cases
6. WHEN the refactoring is complete THEN the existing test suite SHALL pass without modification
7. WHEN a class is created THEN the class SHALL NOT exceed 300 lines of code

**Current State**: HoistPlanner has 871 lines with 9+ responsibilities including planning for all dependency types, hook validation, scope traversal, purity checking, and path computation.

**Estimated Effort**: 2-3 days

---

### Requirement 3: Scope/Binding Helper Utilities Extraction (Priority 1 - Critical)

**User Story:** As a developer, I want common scope and binding patterns extracted into reusable utilities, so that code duplication is eliminated and consistency is improved across the codebase.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL contain a scope-helpers.ts module in src/scope/
2. WHEN scope-helpers.ts exists THEN it SHALL export a getScopeWithFallback function that handles scope retrieval with component fallback logic
3. WHEN scope-helpers.ts exists THEN it SHALL export a getEnclosingComponentOrNull function that safely unwraps enclosing component Results
4. WHEN scope-helpers.ts exists THEN it SHALL export a buildScopePath function that constructs scope ancestor paths
5. WHEN scope-helpers.ts exists THEN it SHALL export a findCommonAncestor function that computes LCA of two scopes
6. WHEN scope helper utilities are created THEN they SHALL replace all 143 instances of duplicated patterns across the codebase
7. WHEN the refactoring is complete THEN the codebase SHALL have at least 100 fewer lines of duplicated code
8. WHEN scope helper functions are called THEN they SHALL maintain the same behavior as the original duplicated patterns (zero behavioral change)
9. WHEN scope helper utilities are added THEN they SHALL have 100% test coverage with edge cases

**Current State**: 143 instances of duplicated scope traversal patterns across 22 files, primarily in DependencyAnalyzer (13), move.ts (7), and identifier-collector.ts (7).

**Estimated Effort**: 1 day

---

### Requirement 4: Move Operation Pipeline Simplification (Priority 1 - Critical)

**User Story:** As a developer, I want the moveWithHoistingInternal function to be simplified using a pipeline pattern, so that the move operation is broken into clear stages with single responsibilities.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL contain a MoveTransformationPipeline class in src/api/
2. WHEN MoveTransformationPipeline exists THEN it SHALL have dependencies injected for validator, analyzer, planner, executor, and transformer
3. WHEN MoveTransformationPipeline.execute is called THEN it SHALL orchestrate the transformation through distinct stages: validation, analysis, planning, execution, and generation
4. WHEN a pipeline stage fails THEN the pipeline SHALL short-circuit and return an error Result without proceeding to subsequent stages
5. WHEN the pipeline is created THEN the moveWithHoistingInternal function SHALL be reduced to <50 lines
6. WHEN the refactoring is complete THEN each pipeline stage SHALL be independently testable
7. WHEN the refactoring is complete THEN the existing move.test.ts test suite SHALL pass without modification
8. WHEN the pipeline executes THEN it SHALL maintain the same performance characteristics as the original implementation

**Current State**: moveWithHoistingInternal is 193 lines with ~20 decision paths and 9+ responsibilities mixed together.

**Estimated Effort**: 2 days

---

### Requirement 5: Error Handling Ergonomics Improvement (Priority 2 - Medium)

**User Story:** As a developer, I want improved error handling utilities in the Result module, so that common error handling patterns are less verbose and more composable.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the Result module SHALL export an unwrapOrPropagate utility function
2. WHEN the refactoring is complete THEN the Result module SHALL export an unwrapOrNull utility function
3. WHEN the refactoring is complete THEN the Result module SHALL export an andThen utility function for chaining Result-returning operations
4. WHEN the refactoring is complete THEN the system SHALL contain an ErrorBuilder class with fluent API for constructing ValidationError objects
5. WHEN ErrorBuilder is used THEN it SHALL support chaining methods: code(), message(), at(), inFile(), constraint(), details(), suggestions()
6. WHEN Result utilities are added THEN they SHALL reduce at least 50 instances of repeated error handling boilerplate
7. WHEN error utilities are created THEN they SHALL have 100% test coverage
8. WHEN error utilities replace existing patterns THEN all existing tests SHALL pass without modification

**Current State**: 162 instances of repeated isErr checking patterns across 48 files, and 161 instances of verbose error factory calls.

**Estimated Effort**: 1 day

---

### Requirement 6: IScopeManager Interface Segregation (Priority 2 - Medium)

**User Story:** As a developer, I want the IScopeManager interface split into focused interfaces, so that consumers only depend on the methods they actually use (Interface Segregation Principle).

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL contain an IScopeTreeBuilder interface with tree construction methods only
2. WHEN the refactoring is complete THEN the system SHALL contain an IScopeQuery interface with scope lookup methods only
3. WHEN the refactoring is complete THEN the system SHALL contain an IScopeAccessibility interface with accessibility checking methods only
4. WHEN the refactoring is complete THEN the system SHALL contain an IBindingQuery interface with binding-related query methods only
5. WHEN interfaces are split THEN the existing ScopeManager class SHALL implement all four focused interfaces
6. WHEN consumers use scope functionality THEN they SHALL depend on the specific interface they need rather than the full IScopeManager
7. WHEN the refactoring is complete THEN interface changes SHALL not break existing functionality (zero regression)
8. WHEN interfaces are defined THEN each interface SHALL have clear documentation explaining its purpose

**Current State**: IScopeManager has 10+ methods covering tree building, queries, component detection, accessibility, LCA, bindings, and component info.

**Estimated Effort**: 1 day

---

### Requirement 7: AST Traversal Utilities Creation (Priority 2 - Medium)

**User Story:** As a developer, I want reusable AST traversal utilities, so that common traversal patterns are consistent and code duplication is reduced.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL contain an ast-traversal.ts module in src/utils/
2. WHEN ast-traversal.ts exists THEN it SHALL export a traverseIdentifierReferences function with configurable options
3. WHEN traverseIdentifierReferences is called THEN it SHALL support options to skip declarations, property keys, and JSX elements
4. WHEN the refactoring is complete THEN the system SHALL contain an ast-helpers.ts module in src/utils/
5. WHEN ast-helpers.ts exists THEN it SHALL export extractFunctionName, isReactHookName, and isComponentName utility functions
6. WHEN AST utilities are created THEN they SHALL replace all duplicated traversal and name extraction logic
7. WHEN AST utilities are used THEN they SHALL maintain the same behavior as original implementations
8. WHEN AST utilities are created THEN they SHALL have 100% test coverage

**Current State**: Duplicated traversal patterns in dependency-analyzer.ts, hoist-executor.ts, and various analyzer files. Duplicated function name extraction in scope-manager.ts and hoist-planner.ts.

**Estimated Effort**: 1 day

---

### Requirement 8: Test Coverage Enhancement (Priority 2 - Medium)

**User Story:** As a developer, I want comprehensive test coverage for complex and under-tested modules, so that edge cases are caught and confidence in refactoring is high.

#### Acceptance Criteria

1. WHEN test coverage is improved THEN the HoistExecutor module SHALL have at least 95% line coverage
2. WHEN test coverage is improved THEN the HoistExecutor module SHALL have tests for all mutation edge cases
3. WHEN test coverage is improved THEN cross-file move strategies SHALL have integration tests covering circular dependency scenarios
4. WHEN test coverage is improved THEN cross-file move strategies SHALL have tests for transitive dependency resolution
5. WHEN test coverage is improved THEN the optimization module SHALL have comprehensive performance test cases
6. WHEN new tests are added THEN they SHALL follow the existing TDD methodology and naming conventions
7. WHEN test coverage is improved THEN the overall codebase coverage SHALL be at least 95%
8. WHEN tests are run THEN all existing tests SHALL continue to pass

**Current State**: HoistExecutor mutation logic needs more edge case tests, cross-file strategies need more integration tests, optimization module could have better coverage.

**Estimated Effort**: 2-3 days

---

### Requirement 9: Dependency Handler Strategy Pattern (Priority 2 - Medium)

**User Story:** As a developer, I want dependency type handling to use a comprehensive strategy pattern, so that adding new dependency types doesn't require modifying multiple switch statements (Open/Closed Principle).

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL contain a DependencyHandler interface with getName, plan, and execute methods
2. WHEN the refactoring is complete THEN each dependency type SHALL have a concrete handler class (HookDependencyHandler, VariableDependencyHandler, etc.)
3. WHEN the refactoring is complete THEN the system SHALL contain a DependencyHandlerRegistry class for managing handlers
4. WHEN a new dependency type is added THEN it SHALL only require creating a new handler class and registering it
5. WHEN dependency handlers are implemented THEN all switch statements on DependencyType SHALL be replaced with registry lookups
6. WHEN handlers are used THEN they SHALL maintain the same behavior as the original switch-based implementation
7. WHEN the refactoring is complete THEN adding a new dependency type SHALL require changes to at most 2 files (handler implementation and registration)

**Current State**: Switch statements on DependencyType exist in dependency-analyzer.ts, hoist-planner.ts, and hoist-executor.ts, requiring changes to multiple files when adding new types.

**Estimated Effort**: 2 days

---

### Requirement 10: Factory Function Standardization (Priority 3 - Low)

**User Story:** As a developer, I want consistent factory function usage across all public APIs, so that object creation is uniform and predictable.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN all public API classes SHALL be instantiated through factory functions
2. WHEN a factory function exists THEN it SHALL follow the naming convention create{ClassName}()
3. WHEN factory functions are created THEN direct constructor usage SHALL only be allowed within the factory function itself
4. WHEN factory functions are standardized THEN existing tests SHALL be updated to use factory functions
5. WHEN factory functions are implemented THEN they SHALL support dependency injection for testability

**Current State**: Mix of factory functions (createScopeManager, createHoistPlanner) and direct constructors (new DependencyAnalyzer, new CodeGenerator).

**Estimated Effort**: 1 day

---

### Requirement 11: Option/Maybe Type Integration (Priority 3 - Low)

**User Story:** As a developer, I want an Option/Maybe type for handling nullable values, so that null checking is more composable and type-safe.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL contain an Option type with Some and None variants
2. WHEN Option type exists THEN it SHALL provide map, flatMap, and unwrapOr methods for composition
3. WHEN Option type is used THEN functions currently returning T | null SHALL be migrated to return Option<T>
4. WHEN Option type is introduced THEN it SHALL have comprehensive unit tests
5. WHEN migration occurs THEN it SHALL be done incrementally to avoid breaking existing code
6. IF the Option type proves beneficial in initial modules THEN it SHALL be adopted more broadly

**Current State**: Many functions return T | null requiring repetitive null checking. Example: getScopeForPath, findEnclosingComponent.

**Estimated Effort**: 2-3 days (affects many files, requires careful migration)

---

### Requirement 12: AST Traversal Optimization (Priority 3 - Low)

**User Story:** As a developer, I want optimized AST traversals, so that repeated traversals of the same AST are minimized and performance is improved for large codebases.

#### Acceptance Criteria

1. WHEN traversal optimization is implemented THEN the system SHALL combine scope tree building and initial identifier collection into a single traversal
2. WHEN traversal optimization is implemented THEN intermediate traversal results SHALL be cached when appropriate
3. WHEN optimization is complete THEN dependency analysis SHALL perform at most 3 traversals instead of 6+
4. WHEN optimization is implemented THEN performance benchmarks SHALL show measurable improvement for multi-file operations
5. WHEN optimization is complete THEN all existing tests SHALL pass without modification
6. WHEN optimization is implemented THEN the system SHALL maintain correctness guarantees (no behavioral changes)

**Current State**: During a single move operation, the AST may be traversed 6+ times: scope tree building, identifier collection, dependency analysis, hook detection, related dependency detection, and hoisting execution.

**Estimated Effort**: 2 days

---

## Scope and Constraints

### In Scope

1. Refactoring internal implementation to improve SOLID adherence
2. Eliminating code duplication through shared utilities
3. Improving test coverage for existing functionality
4. Enhancing error handling ergonomics
5. Optimizing AST traversal patterns
6. All changes must follow TDD and "Tidy First" methodology

### Out of Scope

1. Changes to public API surface (maintain backward compatibility)
2. Adding new features or capabilities
3. Rewriting the Result monad pattern
4. Changes to the overall pipeline architecture
5. Modifications to error code taxonomy
6. Performance optimizations that compromise correctness

### Constraints

1. **Zero Regression**: All existing tests must pass after each refactoring increment
2. **Performance**: Refactored code must maintain or improve existing performance benchmarks (<100ms single file, <500ms 10 files)
3. **Backward Compatibility**: Public APIs must remain unchanged
4. **Incremental**: Changes must be made incrementally with separate commits for structural vs behavioral changes
5. **Test Coverage**: New or refactored code must have 95%+ test coverage
6. **Documentation**: Extracted classes and utilities must be documented with clear JSDoc comments

### Risks

1. **Risk**: Refactoring large classes may introduce subtle behavioral changes
   - **Mitigation**: Comprehensive test suite must pass at each step; use git bisect if regressions occur

2. **Risk**: Performance may degrade with additional abstraction layers
   - **Mitigation**: Run benchmarks after each major refactoring; optimize if needed

3. **Risk**: Scope creep - refactoring may reveal additional issues
   - **Mitigation**: Stick to documented requirements; create separate issues for newly discovered problems

4. **Risk**: Incomplete migration to new patterns may leave codebase inconsistent
   - **Mitigation**: Complete each requirement fully before moving to the next; use linting rules to enforce patterns

---

## Success Criteria

The refactoring project will be considered successful when:

1. ✅ All Priority 1 requirements are implemented and tested
2. ✅ At least 80% of Priority 2 requirements are implemented
3. ✅ DependencyAnalyzer is decomposed into 4+ focused classes, each <300 lines
4. ✅ HoistPlanner is decomposed into 3+ focused classes, each <300 lines
5. ✅ Code duplication is reduced by at least 80% (from 143 instances to <30)
6. ✅ Test coverage is 95%+ for all refactored modules
7. ✅ All existing tests pass without modification
8. ✅ Performance benchmarks are maintained or improved
9. ✅ Code review assessment improves from 7/10 to 9/10
10. ✅ Each refactoring commit follows "Tidy First" separation of structural vs behavioral changes

---

## Dependencies and Assumptions

### Dependencies

1. Existing test suite must be comprehensive and passing
2. Performance benchmarks must be established and documented
3. Development team must be trained on "Tidy First" methodology
4. Git workflow must support incremental commits

### Assumptions

1. Current codebase has stable test coverage that accurately represents behavior
2. Performance benchmarks reflect realistic usage patterns
3. Team has capacity for 2-3 weeks of focused refactoring work
4. Stakeholders understand this is technical debt reduction with no new features

---

## Implementation Phases

### Phase 1: Foundation (Priority 1, Week 1)
- Requirement 1: DependencyAnalyzer decomposition
- Requirement 3: Scope/binding helper utilities

### Phase 2: Core Refactoring (Priority 1, Week 2)
- Requirement 2: HoistPlanner decomposition
- Requirement 4: Move pipeline simplification

### Phase 3: Quality Improvements (Priority 2, Week 3)
- Requirement 5: Error handling ergonomics
- Requirement 6: IScopeManager interface segregation
- Requirement 7: AST traversal utilities
- Requirement 8: Test coverage enhancement
- Requirement 9: Dependency handler strategy pattern

### Phase 4: Polish (Priority 3, Optional)
- Requirement 10: Factory function standardization
- Requirement 11: Option/Maybe type integration
- Requirement 12: AST traversal optimization

---

**Document Version**: 1.0
**Last Updated**: 2025-12-20
**Status**: Initial Draft - Awaiting Review
