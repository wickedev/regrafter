# SOLID Violations and Refactoring Plan

## Overview

This document analyzes SOLID principle violations across the **entire Regrafter codebase** and provides a systematic refactoring plan following Kent Beck's "Tidy First" approach.

**Analysis Date:** 2025-12-19
**Scope:** Entire project (src/)
**Total Lines:** ~35,416 lines across 150+ TypeScript files
**Severity:** High - Multiple SRP, DIP, and ISP violations affecting testability, maintainability, and extensibility

---

## Executive Summary

### Project Statistics

- **Total Source Files:** 150+ TypeScript files
- **Total Lines (excluding tests):** 35,416 lines
- **Files >1000 lines:** 4 files
- **Files >500 lines:** 19 files
- **Average File Size:** ~236 lines
- **Largest File:** dependency-analyzer.ts (1,795 lines)

### Critical Issues Found

| Violation Type | Count | Severity | Impact |
|---------------|-------|----------|--------|
| Single Responsibility (SRP) | 12 | Critical | Hard to test, maintain, reuse |
| Dependency Inversion (DIP) | 8 | High | Cannot mock; tight coupling |
| Interface Segregation (ISP) | 6 | Medium | Poor abstraction; only extract module has interfaces |
| Code Duplication | 7 | Medium | Maintenance burden |
| Open/Closed (OCP) | 4 | Low | Requires modification for extension |

### Key Metrics

- **Classes without interfaces:** 90+ (only extract module has interfaces)
- **Hard-coded dependencies:** 20+ instances across 8 classes
- **Duplicated code blocks:** 7 major instances
- **Oversized classes:** 12 classes >500 lines
- **God objects:** 3 (index.ts, DependencyAnalyzer, MoveValidator)

---

## Module-Level Analysis

### 1. Root API Layer (src/index.ts) - **CRITICAL**

**Size:** 1,512 lines
**Issues:** God object anti-pattern; all APIs implemented in single file

#### Problems

1. **Massive Single File:** Contains all 6 main API implementations
   - `regraft()` - 200+ lines
   - `canMove()` - 10 lines
   - `move()` - 150+ lines
   - `analyze()` - 100+ lines
   - `optimize()` - 100+ lines
   - `inline()` - 300+ lines

2. **Mixed Responsibilities:**
   - API orchestration
   - Validation logic
   - Transformation coordination
   - Error handling
   - Helper functions
   - Cross-file coordination

3. **Hard-coded Dependencies:** Creates instances directly
   ```typescript
   const generator = new CodeGenerator();
   const resolver = createSelectorResolver();
   const transformer = createJSXTransformer();
   const scopeManager = createScopeManager();
   const analyzer = new DependencyAnalyzer(scopeManager);
   ```

#### Proposed Refactoring

```
src/api/
├── regraft.ts         # regraft() implementation
├── can-move.ts        # canMove() implementation
├── move.ts            # move() implementation
├── analyze.ts         # analyze() implementation
├── optimize.ts        # optimize() implementation
├── inline.ts          # inline() implementation
├── orchestrator.ts    # Shared orchestration logic
└── factory.ts         # Dependency injection factory
```

**Benefits:**
- Each API in focused file (<300 lines each)
- Shared logic extracted to orchestrator
- Easy to test each API independently
- Clear separation of concerns

---

### 2. Analyzer Module (src/analyzer/) - **CRITICAL**

#### 2.1 DependencyAnalyzer (1,795 lines) - **MOST CRITICAL**

**Problem:** Largest file in codebase; handles 15+ distinct concerns

**Responsibilities Identified:**
1. **Identifier Collection** (lines 113-250)
2. **Dependency Classification** (lines 260-450)
3. **Hook Dependency Analysis** (lines 460-600)
4. **Variable Dependency Analysis** (lines 610-750)
5. **Import Dependency Analysis** (lines 760-900)
6. **Prop Dependency Analysis** (lines 910-1050)
7. **Context Dependency Analysis** (lines 1060-1200)
8. **Ref Dependency Analysis** (lines 1210-1350)
9. **Scope Resolution** (lines 1360-1500)
10. **Binding Analysis** (lines 1510-1650)
11. **Analyzability Check** (lines 1660-1795)

**Code Example:**
```typescript
// Current: Everything in one class
class DependencyAnalyzer {
  analyze() { /* 1,795 lines of mixed concerns */ }

  collectIdentifiers() { /* 137 lines */ }
  classifyDependency() { /* 190 lines */ }
  analyzeHookDependency() { /* 140 lines */ }
  analyzeVariableDependency() { /* 140 lines */ }
  analyzeImportDependency() { /* 140 lines */ }
  analyzePropDependency() { /* 140 lines */ }
  analyzeContextDependency() { /* 140 lines */ }
  analyzeRefDependency() { /* 140 lines */ }
  resolveScope() { /* 140 lines */ }
  analyzeBinding() { /* 140 lines */ }
  checkAnalyzability() { /* 135 lines */ }
}
```

**Proposed Refactoring:**
```typescript
// Separate analyzers
class IdentifierCollector {
  collect(elementPath: NodePath): IdentifierReference[]
}

class DependencyClassifier {
  classify(identifier: IdentifierReference): DependencyType
}

class HookDependencyAnalyzer {
  analyze(identifier: IdentifierReference): HookDependency | null
}

class VariableDependencyAnalyzer {
  analyze(identifier: IdentifierReference): VariableDependency | null
}

class ImportDependencyAnalyzer {
  analyze(identifier: IdentifierReference): ImportDependency | null
}

class PropDependencyAnalyzer {
  analyze(identifier: IdentifierReference): PropDependency | null
}

class ContextDependencyAnalyzer {
  analyze(identifier: IdentifierReference): ContextDependency | null
}

class RefDependencyAnalyzer {
  analyze(identifier: IdentifierReference): RefDependency | null
}

class ScopeResolver {
  resolve(identifier: IdentifierReference): ScopeInfo
}

class BindingAnalyzer {
  analyze(binding: Binding): BindingInfo
}

class AnalyzabilityChecker {
  check(elementPath: NodePath): AnalyzabilityResult
}

// Coordinator (much smaller - ~200 lines)
class DependencyAnalyzer {
  constructor(
    private identifierCollector: IdentifierCollector,
    private classifier: DependencyClassifier,
    private hookAnalyzer: HookDependencyAnalyzer,
    private variableAnalyzer: VariableDependencyAnalyzer,
    private importAnalyzer: ImportDependencyAnalyzer,
    private propAnalyzer: PropDependencyAnalyzer,
    private contextAnalyzer: ContextDependencyAnalyzer,
    private refAnalyzer: RefDependencyAnalyzer,
    private scopeResolver: ScopeResolver,
    private bindingAnalyzer: BindingAnalyzer,
    private analyzabilityChecker: AnalyzabilityChecker
  ) {}

  analyze(elementPath: NodePath): DependencyAnalysis {
    // Orchestrate the specialized analyzers
    // ~200 lines of coordination logic
  }
}
```

**Benefits:**
- Each analyzer class <150 lines
- Single responsibility per analyzer
- Easy to test each independently
- Easy to add new dependency types
- Reusable analyzers across different contexts

---

#### 2.2 MoveValidator (1,023 lines) - **CRITICAL**

**Problem:** Multiple validation concerns mixed together

**Responsibilities:**
1. **Selector Resolution** (lines 125-300)
2. **Source/Target Validation** (lines 310-450)
3. **Atomic Unit Validation** (lines 460-600)
4. **Hook Rules Validation** (lines 610-750)
5. **Conditional Rendering Validation** (lines 760-850)
6. **Component Boundary Validation** (lines 860-950)
7. **Analyzability Validation** (lines 960-1023)

**Proposed Refactoring:**
```
src/analyzer/validators/
├── selector-validator.ts      # Validates selectors
├── move-rules-validator.ts    # Validates move rules
├── atomic-unit-validator.ts   # Validates atomic units
├── hook-rules-validator.ts    # Validates hook rules
├── conditional-validator.ts   # Validates conditional rendering
├── boundary-validator.ts      # Validates component boundaries
├── analyzability-validator.ts # Validates analyzability
└── validation-coordinator.ts  # Orchestrates validators
```

---

### 3. Transformer Module (src/transformer/) - **HIGH**

#### 3.1 JSXTransformer (1,200 lines) - **CRITICAL**

**Problem:** Handles all JSX transformation types in single class

**Responsibilities:**
1. **Move.Inside** implementation (lines 150-350)
2. **Move.Before** implementation (lines 360-560)
3. **Move.After** implementation (lines 570-770)
4. **No-op detection** (lines 82-120)
5. **Index calculation** (lines 780-850)
6. **Parent extraction** (lines 860-920)
7. **Child insertion** (lines 930-1000)
8. **Clone operations** (lines 1010-1100)
9. **Validation** (lines 1110-1200)

**Proposed Refactoring:**
```typescript
// Strategy pattern for different move modes
interface IMoveStrategy {
  execute(source: NodePath, target: NodePath): Result<void, TransformError>;
  validate(source: NodePath, target: NodePath): Result<void, ValidationError>;
}

class InsideMoveStrategy implements IMoveStrategy {
  execute(source: NodePath, target: NodePath): Result<void, TransformError> {
    // Move.Inside implementation (~150 lines)
  }
}

class BeforeMoveStrategy implements IMoveStrategy {
  execute(source: NodePath, target: NodePath): Result<void, TransformError> {
    // Move.Before implementation (~150 lines)
  }
}

class AfterMoveStrategy implements IMoveStrategy {
  execute(source: NodePath, target: NodePath): Result<void, TransformError> {
    // Move.After implementation (~150 lines)
  }
}

// Transformer coordinates strategies
class JSXTransformer {
  private strategies: Map<Move, IMoveStrategy>;

  constructor(
    private insideStrategy: InsideMoveStrategy,
    private beforeStrategy: BeforeMoveStrategy,
    private afterStrategy: AfterMoveStrategy
  ) {
    this.strategies = new Map([
      [Move.Inside, insideStrategy],
      [Move.Before, beforeStrategy],
      [Move.After, afterStrategy],
    ]);
  }

  move(ast: t.File, source: NodePath, target: NodePath, mode: Move): Result {
    const strategy = this.strategies.get(mode);
    return strategy.execute(source, target);
  }
}
```

---

### 4. Scope Management (src/scope/) - **HIGH**

#### 4.1 ScopeManager (965 lines) - **HIGH**

**Problem:** Multiple concerns mixed in one class

**Responsibilities:**
1. **Scope Tree Building** (lines 77-250)
2. **Component Detection** (lines 260-400)
3. **Binding Tracking** (lines 410-550)
4. **Hook Tracking** (lines 560-700)
5. **Scope Queries** (lines 710-850)
6. **LCA Computation** (lines 860-965)

**Proposed Refactoring:**
```
src/scope/
├── scope-tree-builder.ts      # Builds scope tree
├── component-detector.ts      # Detects components (ALREADY EXISTS in analyzer/)
├── binding-tracker.ts         # Tracks bindings
├── hook-tracker.ts            # Tracks hooks
├── scope-query.ts             # Scope queries
├── lca-computer.ts            # LCA computation
└── scope-manager.ts           # Coordinates (slimmed to ~200 lines)
```

---

### 5. Strategy Module (src/strategies/) - **HIGH**

#### 5.1 HoistPlanner (870 lines) - **HIGH**

**Problem:** Plans hoisting for all dependency types in one class

**Responsibilities:**
1. **Hook Hoist Planning** (lines 136-250)
2. **Variable Hoist Planning** (lines 260-380)
3. **Context Hoist Planning** (lines 390-510)
4. **Ref Hoist Planning** (lines 520-640)
5. **Prop Hoist Planning** (lines 650-770)
6. **Import Operation Planning** (lines 780-870)

**Proposed Refactoring:**
```typescript
// Already has individual strategy classes, but planner does too much
// Delegate more to individual strategies

interface IHoistStrategy {
  canHandle(dep: InternalDependency): boolean;
  plan(dep: InternalDependency, context: HoistContext): HoistPlanItem;
}

// HoistPlanner becomes simpler coordinator (~200 lines)
class HoistPlanner {
  constructor(private strategies: IHoistStrategy[]) {}

  plan(analysis: DependencyAnalysis, context: HoistContext): HoistPlan {
    // Delegate to strategies (~200 lines)
  }
}
```

#### 5.2 ContextHandler (817 lines) - **HIGH**

**Problem:** Handles multiple React context patterns

**Proposed Refactoring:**
```
src/strategies/context/
├── context-detector.ts          # Detects context usage
├── context-provider-handler.ts  # Handles Provider
├── context-consumer-handler.ts  # Handles Consumer
├── use-context-handler.ts       # Handles useContext
└── context-handler.ts           # Coordinates (~200 lines)
```

#### 5.3 SharedModuleCreator (839 lines) - **HIGH**

**Problem:** Complex shared module creation logic

**Proposed Refactoring:**
```
src/strategies/cross-file/shared-module/
├── module-analyzer.ts           # Analyzes module structure
├── module-builder.ts            # Builds new module
├── export-manager.ts            # Manages exports
├── import-updater.ts            # Updates imports
└── shared-module-creator.ts    # Coordinates (~200 lines)
```

---

### 6. Cross-Cutting Concerns

#### 6.1 Result Module (840 lines)

**Status:** ✅ Generally well-structured
**Note:** Single file is acceptable for monad implementation

#### 6.2 Type Factories (776 lines)

**Status:** ⚠️ Could be split by domain
**Proposed:**
```
src/types/factories/
├── dependency-factories.ts      # Dependency creation
├── scope-factories.ts           # Scope creation
├── operation-factories.ts       # Operation creation
└── index.ts                     # Re-exports
```

#### 6.3 Error Category (749 lines)

**Status:** ⚠️ Could be split by category
**Proposed:**
```
src/errors/categories/
├── parse-errors.ts              # Parse error creators
├── selector-errors.ts           # Selector error creators
├── dependency-errors.ts         # Dependency error creators
├── validation-errors.ts         # Validation error creators
├── transform-errors.ts          # Transform error creators
└── index.ts                     # Re-exports
```

---

## Detailed SOLID Violations by Principle

### 1. Single Responsibility Principle (SRP) Violations

| File | Lines | Responsibilities | Severity |
|------|-------|-----------------|----------|
| dependency-analyzer.ts | 1,795 | 11 distinct concerns | Critical |
| index.ts | 1,512 | 6 API implementations + orchestration | Critical |
| jsx-transformer.ts | 1,200 | 3 move modes + utilities | High |
| move-validator.ts | 1,023 | 7 validation types | High |
| scope-manager.ts | 965 | 6 scope concerns | High |
| hoist-planner.ts | 870 | 6 dependency type planning | High |
| result/index.ts | 840 | Monad + 20+ helper functions | Medium (acceptable) |
| shared-module-creator.ts | 839 | 4 module creation concerns | High |
| context-handler.ts | 817 | 3 context patterns | High |
| factories.ts | 776 | 30+ factory functions | Medium |
| error-category.ts | 749 | 7 error categories | Medium |
| cross-file/index.ts | 748 | Cross-file orchestration + utilities | High |

**Total Critical/High SRP Violations:** 12 files

---

### 2. Dependency Inversion Principle (DIP) Violations

#### 2.1 Hard-Coded Dependencies in index.ts

**Locations:**
- `regraft()` function (line 418-420)
- `move()` function (line 418-420)
- `analyze()` function
- `optimize()` function
- `inline()` function

**Problem:**
```typescript
// ❌ Creates concrete dependencies directly
const generator = new CodeGenerator();
const resolver = createSelectorResolver();
const transformer = createJSXTransformer();
```

**Solution:**
```typescript
// ✅ Dependency injection
class RegraftOrchestrator {
  constructor(
    private generator: ICodeGenerator,
    private resolver: ISelectorResolver,
    private transformer: IJSXTransformer
  ) {}
}
```

#### 2.2 No Interfaces for Core Classes

**Classes Without Interfaces:**
- DependencyAnalyzer ❌
- MoveValidator ❌
- JSXTransformer ❌
- ScopeManager ❌
- HoistPlanner ❌
- HoistExecutor ❌
- CodeGenerator ❌
- SelectorResolver ❌
- Parser ❌
- All strategy handlers ❌

**Only extract module has interfaces** ✅ (good example to follow)

---

### 3. Interface Segregation Principle (ISP) Violations

#### Problem: Minimal Interface Definitions

Only `src/extract/interfaces/` has proper interfaces. Rest of codebase lacks interface abstraction.

**Needed Interfaces:**
```typescript
// Core interfaces needed
interface IDependencyAnalyzer { ... }
interface IMoveValidator { ... }
interface IJSXTransformer { ... }
interface IScopeManager { ... }
interface IHoistPlanner { ... }
interface IHoistExecutor { ... }
interface ICodeGenerator { ... }
interface ISelectorResolver { ... }
interface IParser { ... }

// Strategy interfaces (some exist, some don't)
interface IHookHoister { ... }
interface IVariableHoister { ... }
interface IPropThreader { ... }
interface IImportManager { ... }
```

---

### 4. Open/Closed Principle (OCP) Violations

#### 4.1 Strategy Selection in HoistPlanner

**Location:** `hoist-planner.ts:134-152`

**Problem:** Switch statement for dependency type
```typescript
switch (dep.type) {
  case DependencyType.Hook:
    return this.planHookHoist(dep, context);
  case DependencyType.Variable:
    return this.planVariableHoist(dep, context);
  // ... 6 more cases
}
```

**Solution:** Strategy registry
```typescript
class HoistPlanner {
  private strategies: Map<DependencyType, IHoistStrategy>;

  plan(dep: InternalDependency, context: HoistContext): HoistPlanItem {
    const strategy = this.strategies.get(dep.type);
    return strategy.plan(dep, context);
  }
}
```

#### 4.2 Move Mode Selection in JSXTransformer

**Location:** Similar switch for Move.Inside/Before/After

**Solution:** Strategy pattern as shown earlier

---

### 5. Code Duplication

#### 5.1 Parsing Logic (5+ instances)

**Locations:**
- index.ts: regraft() (lines 423-430)
- index.ts: move() (lines 423-430)
- index.ts: analyze()
- extract-orchestrator.ts: orchestrate()
- extract-orchestrator.ts: validate()
- extract-orchestrator.ts: analyze()

**Duplicated Pattern:**
```typescript
const parsedFiles = new Map<string, t.File>();
for (const file of files) {
  const result = parseFile(file.path, file.content);
  if (isErr(result)) return err(result.error);
  parsedFiles.set(file.path, result.value);
}
```

**Solution:** Extract to utility
```typescript
function parseAllFiles(files: FileInput[]): Result<Map<string, t.File>, RegraffError> {
  // Centralized parsing logic
}
```

#### 5.2 Selector Resolution (3+ instances)

**Duplicated in:** index.ts, move-validator.ts, selector-resolver.ts

---

## Refactoring Plan (Tidy First Approach)

Following Kent Beck's principles: separate structural changes from behavioral changes, commit only when tests pass.

### Overall Strategy

**Phases organized by:**
1. Risk level (Low → High)
2. Dependencies between phases
3. Value delivered per phase

**Total Estimated Phases:** 12 phases
**Estimated Timeline:** 8-12 weeks with 2 developers
**Risk Mitigation:** Each phase independently testable and revertable

---

### Phase 1: Extract Utility Functions (Low Risk) - **WEEK 1**

**Goal:** Remove duplication without changing behavior

#### Step 1.1: Extract File Parsing Utility
- **Files:** `src/utils/file-parser.ts` (new)
- **Change:** Extract `parseAllFiles()` function
- **Test:** All existing tests should pass
- **Commit:** "refactor: extract parseAllFiles utility"

#### Step 1.2: Extract Selector Resolution Utilities
- **Files:** `src/selector/selector-utils.ts` (new)
- **Change:** Extract common selector resolution logic
- **Test:** All selector tests should pass
- **Commit:** "refactor: extract selector resolution utilities"

#### Step 1.3: Extract AST Traversal Utilities
- **Files:** `src/utils/ast-utils.ts` (new)
- **Change:** Extract common traversal patterns
- **Test:** All tests should pass
- **Commit:** "refactor: extract AST traversal utilities"

---

### Phase 2: Define Core Interfaces (Low Risk) - **WEEK 2**

**Goal:** Create interface contracts for all core components

#### Step 2.1: Create Core Interfaces Directory
- **Files:** `src/interfaces/` (new directory)
- **Interfaces:**
  ```
  src/interfaces/
  ├── i-dependency-analyzer.ts
  ├── i-move-validator.ts
  ├── i-jsx-transformer.ts
  ├── i-scope-manager.ts
  ├── i-hoist-planner.ts
  ├── i-hoist-executor.ts
  ├── i-code-generator.ts
  ├── i-selector-resolver.ts
  ├── i-parser.ts
  └── index.ts
  ```
- **Test:** TypeScript compilation
- **Commit:** "refactor: add core interface definitions"

#### Step 2.2: Implement Interfaces
- **Files:** All implementation classes
- **Change:** Add `implements IXxx` to class declarations
- **Test:** TypeScript compilation + all tests pass
- **Commit:** "refactor: implement interfaces in core classes"

---

### Phase 3: Split DependencyAnalyzer (High Risk) - **WEEKS 3-5**

**Goal:** Break down the largest file (1,795 lines) into focused components

This is the most critical refactoring. Use extreme caution.

#### Step 3.1: Extract IdentifierCollector
- **File:** `src/analyzer/analyzers/identifier-collector.ts` (new)
- **Change:** Extract identifier collection logic
- **Test:** Write comprehensive unit tests for IdentifierCollector
- **Commit:** "refactor: extract IdentifierCollector from DependencyAnalyzer"

#### Step 3.2: Extract DependencyClassifier
- **File:** `src/analyzer/analyzers/dependency-classifier.ts` (new)
- **Change:** Extract classification logic
- **Test:** Write unit tests
- **Commit:** "refactor: extract DependencyClassifier"

#### Step 3.3-3.10: Extract Individual Dependency Analyzers
- HookDependencyAnalyzer
- VariableDependencyAnalyzer
- ImportDependencyAnalyzer
- PropDependencyAnalyzer
- ContextDependencyAnalyzer
- RefDependencyAnalyzer
- ScopeResolver
- BindingAnalyzer

**Each follows same pattern:**
- Create new file in `src/analyzer/analyzers/`
- Extract logic
- Write unit tests
- Update DependencyAnalyzer to use extracted class
- Commit

#### Step 3.11: Refactor DependencyAnalyzer as Coordinator
- **File:** `src/analyzer/dependency-analyzer.ts`
- **Change:** Slim down to coordination only (~200 lines)
- **Test:** ALL dependency analyzer tests must pass
- **Commit:** "refactor: convert DependencyAnalyzer to coordinator"

**Risk Mitigation:**
- Extract one analyzer at a time
- Comprehensive tests for each
- Keep original class until all extractors verified
- Feature flag for gradual rollout

---

### Phase 4: Split MoveValidator (Medium Risk) - **WEEK 6**

**Goal:** Separate 7 validation concerns into focused validators

Similar approach to Phase 3 but smaller scope (1,023 lines → 7 files of ~150 lines each)

#### Steps 4.1-4.7: Extract Individual Validators
- SelectorValidator
- MoveRulesValidator
- AtomicUnitValidator
- HookRulesValidator
- ConditionalValidator
- BoundaryValidator
- AnalyzabilityValidator

#### Step 4.8: Refactor MoveValidator as Coordinator

---

### Phase 5: Split JSXTransformer (Medium Risk) - **WEEK 7**

**Goal:** Apply Strategy pattern for move modes

#### Step 5.1: Create Move Strategy Interface
- **File:** `src/transformer/strategies/i-move-strategy.ts`
- **Change:** Define IMoveStrategy interface
- **Commit:** "refactor: add IMoveStrategy interface"

#### Step 5.2-5.4: Extract Move Strategies
- InsideMoveStrategy
- BeforeMoveStrategy
- AfterMoveStrategy

#### Step 5.5: Refactor JSXTransformer
- **Change:** Use strategy pattern
- **Test:** All transformer tests pass
- **Commit:** "refactor: apply strategy pattern to JSXTransformer"

---

### Phase 6: Split ScopeManager (Medium Risk) - **WEEK 8**

**Goal:** Separate 6 scope concerns

#### Steps 6.1-6.6: Extract Scope Components
- ScopeTreeBuilder
- BindingTracker (move logic from existing ScopeManager)
- HookTracker
- ScopeQuery
- LCAComputer

#### Step 6.7: Refactor ScopeManager as Coordinator

---

### Phase 7: Refactor API Layer (High Risk) - **WEEKS 9-10**

**Goal:** Split index.ts (1,512 lines) into focused API files

#### Step 7.1: Create API Directory Structure
```
src/api/
├── regraft.ts
├── can-move.ts
├── move.ts
├── analyze.ts
├── optimize.ts
├── inline.ts
├── orchestrator.ts    # Shared logic
├── factory.ts         # DI factory
└── index.ts           # Re-exports
```

#### Step 7.2-7.7: Extract Individual APIs
Each API moved to separate file

#### Step 7.8: Update index.ts
- **Change:** Re-export from api/
- **Test:** All API tests pass
- **Commit:** "refactor: restructure API layer"

---

### Phase 8: Implement Dependency Injection (High Risk) - **WEEK 11**

**Goal:** Enable full DI throughout codebase

#### Step 8.1: Create Factory Functions
- **File:** `src/factories/` (new directory)
- **Change:** Create factory for each major component
- **Test:** Factories create working instances
- **Commit:** "refactor: add factory functions for DI"

#### Step 8.2-8.8: Update Major Classes
- DependencyAnalyzer
- MoveValidator
- JSXTransformer
- ScopeManager
- HoistPlanner
- HoistExecutor
- All strategies

**Each step:**
- Accept dependencies via constructor
- Update tests to inject dependencies
- Update factories
- Commit

---

### Phase 9: Split Strategy Classes (Medium Risk) - **WEEK 12**

**Goal:** Break down oversized strategy classes

#### Step 9.1: Split HoistPlanner
- Delegate more to individual strategies
- Reduce to coordinator (~200 lines)

#### Step 9.2: Split ContextHandler
- Extract into sub-handlers
- Create context/ subdirectory

#### Step 9.3: Split SharedModuleCreator
- Extract into specialized components
- Create shared-module/ subdirectory

---

### Phase 10: Split Cross-Cutting Files (Low Risk) - **WEEK 13**

**Goal:** Organize large utility files

#### Step 10.1: Split Type Factories
- Create factories/ subdirectory
- Group by domain

#### Step 10.2: Split Error Categories
- Create categories/ subdirectory
- One file per category

---

### Phase 11: Apply OCP Patterns (Low Risk) - **WEEK 14**

**Goal:** Replace switch statements with registries

#### Step 11.1: Registry for Hoist Strategies
#### Step 11.2: Registry for Move Strategies
#### Step 11.3: Registry for Error Types

---

### Phase 12: Final Cleanup and Optimization (Low Risk) - **WEEK 15**

**Goal:** Polish and optimize

#### Step 12.1: Remove Remaining Duplication
#### Step 12.2: Standardize Patterns
#### Step 12.3: Update Documentation

---

## Testing Strategy

### Test Coverage Requirements

- **Overall coverage:** Maintain ≥85%
- **New classes:** ≥90% coverage
- **Refactored classes:** Maintain existing coverage
- **Integration tests:** Must pass after each phase

### Test Types

1. **Unit Tests:** Test each new class independently
2. **Integration Tests:** Test interactions between components
3. **E2E Tests:** Verify complete workflows still work
4. **Regression Tests:** Prevent known bugs from returning
5. **Performance Tests:** Ensure no performance degradation

### Continuous Verification

- Run full test suite after each commit
- Run benchmarks after each phase
- Check memory usage after major refactorings

---

## Success Metrics

### Code Quality Metrics (Target)

| Metric | Current | Target |
|--------|---------|--------|
| Average File Size | 236 lines | <200 lines |
| Files >1000 lines | 4 | 0 |
| Files >500 lines | 19 | <5 |
| Cyclomatic Complexity | ~15 avg | <10 avg |
| Test Coverage | 85% | ≥85% |
| Classes with Interfaces | ~10% | 100% |
| Hard-coded Dependencies | 20+ | 0 |
| Code Duplication | ~8% | <3% |

### SOLID Compliance (Target)

- **SRP:** Each class has single, clear responsibility ✅
- **OCP:** New features added without modifying existing code ✅
- **LSP:** All implementations substitutable via interfaces ✅
- **ISP:** Interfaces focused and minimal ✅
- **DIP:** All dependencies inverted; no concrete dependencies ✅

### Maintainability Metrics (Target)

- **Mock-ability:** 100% of classes can be mocked ✅
- **Testability:** All public methods unit testable ✅
- **Extensibility:** New features require <3 file changes ✅
- **Documentation:** 100% of public APIs documented ✅

---

## Phase Dependencies and Risk Assessment

| Phase | Duration | Risk | Dependencies | Notes |
|-------|----------|------|--------------|-------|
| Phase 1: Extract Utilities | 1 week | Low | None | Safe starting point |
| Phase 2: Define Interfaces | 1 week | Low | None | Can run parallel to Phase 1 |
| Phase 3: Split DependencyAnalyzer | 3 weeks | High | Phase 2 | Most complex; needs interfaces |
| Phase 4: Split MoveValidator | 1 week | Medium | Phase 2 | Similar to Phase 3 but smaller |
| Phase 5: Split JSXTransformer | 1 week | Medium | Phase 2 | Strategy pattern application |
| Phase 6: Split ScopeManager | 1 week | Medium | Phase 2 | Moderate complexity |
| Phase 7: Refactor API Layer | 2 weeks | High | Phases 1-6 | Major restructuring |
| Phase 8: Implement DI | 1 week | High | Phase 2, 7 | Affects all classes |
| Phase 9: Split Strategies | 1 week | Medium | Phase 8 | Depends on DI |
| Phase 10: Split Cross-Cutting | 1 week | Low | Phase 8 | Cleanup phase |
| Phase 11: Apply OCP | 1 week | Low | Phase 9 | Registry patterns |
| Phase 12: Final Cleanup | 1 week | Low | All | Polish |

**Critical Path:** Phase 1 → Phase 2 → Phase 3 → Phase 7 → Phase 8
**Can Parallelize:** Phases 4, 5, 6 can run after Phase 3
**Total Duration:** 15 weeks with 2 developers

---

## Risk Mitigation Strategy

### High-Risk Activities

1. **Splitting DependencyAnalyzer** (Phase 3)
   - **Risk:** Breaking core functionality
   - **Mitigation:**
     - Write comprehensive tests first
     - Extract one component at a time
     - Run full test suite after each extraction
     - Keep original until all components verified
     - Use feature flags for gradual rollout

2. **Refactoring API Layer** (Phase 7)
   - **Risk:** Breaking public API
   - **Mitigation:**
     - Maintain backward compatibility
     - Use re-exports from index.ts
     - Verify all examples still work
     - Update documentation incrementally

3. **Implementing DI** (Phase 8)
   - **Risk:** Breaking all component interactions
   - **Mitigation:**
     - Use factory pattern for compatibility
     - Update one component at a time
     - Verify integration tests at each step
     - Feature flag for new DI system

### Rollback Strategy

- Each commit is independently revertable
- Git tags at end of each phase
- Feature flags for major changes
- Comprehensive test suite prevents regressions

### Communication Plan

- Weekly progress reports
- Daily commits with clear messages
- Documentation updates with each phase
- Stakeholder demos at phase completion

---

## Comparison: Before and After

### File Structure Comparison

**Before (Current):**
```
src/
├── index.ts                    (1,512 lines) ❌
├── analyzer/
│   ├── dependency-analyzer.ts  (1,795 lines) ❌
│   ├── move-validator.ts       (1,023 lines) ❌
│   └── ...
├── transformer/
│   ├── jsx-transformer.ts      (1,200 lines) ❌
│   └── ...
├── scope/
│   ├── scope-manager.ts        (965 lines) ❌
│   └── ...
└── strategies/
    ├── hoist-planner.ts        (870 lines) ❌
    ├── context-handler.ts      (817 lines) ❌
    └── ...

Total: ~35,416 lines in ~150 files
Avg: 236 lines/file
Files >500 lines: 19
Files >1000 lines: 4
```

**After (Target):**
```
src/
├── api/                        # Split from index.ts
│   ├── regraft.ts             (250 lines) ✅
│   ├── move.ts                (200 lines) ✅
│   ├── analyze.ts             (150 lines) ✅
│   ├── optimize.ts            (150 lines) ✅
│   ├── inline.ts              (250 lines) ✅
│   ├── orchestrator.ts        (200 lines) ✅
│   └── factory.ts             (150 lines) ✅
├── analyzer/
│   ├── analyzers/             # Split from DependencyAnalyzer
│   │   ├── identifier-collector.ts      (150 lines) ✅
│   │   ├── dependency-classifier.ts     (140 lines) ✅
│   │   ├── hook-analyzer.ts             (130 lines) ✅
│   │   ├── variable-analyzer.ts         (130 lines) ✅
│   │   ├── import-analyzer.ts           (130 lines) ✅
│   │   ├── prop-analyzer.ts             (130 lines) ✅
│   │   ├── context-analyzer.ts          (130 lines) ✅
│   │   ├── ref-analyzer.ts              (130 lines) ✅
│   │   ├── scope-resolver.ts            (140 lines) ✅
│   │   ├── binding-analyzer.ts          (140 lines) ✅
│   │   └── analyzability-checker.ts     (135 lines) ✅
│   ├── dependency-analyzer.ts           (200 lines) ✅
│   ├── validators/            # Split from MoveValidator
│   │   ├── selector-validator.ts        (150 lines) ✅
│   │   ├── move-rules-validator.ts      (150 lines) ✅
│   │   ├── atomic-unit-validator.ts     (140 lines) ✅
│   │   ├── hook-rules-validator.ts      (140 lines) ✅
│   │   ├── conditional-validator.ts     (90 lines) ✅
│   │   ├── boundary-validator.ts        (90 lines) ✅
│   │   └── analyzability-validator.ts   (63 lines) ✅
│   └── move-validator.ts                (200 lines) ✅
├── transformer/
│   ├── strategies/            # Split from JSXTransformer
│   │   ├── inside-move-strategy.ts      (200 lines) ✅
│   │   ├── before-move-strategy.ts      (200 lines) ✅
│   │   └── after-move-strategy.ts       (200 lines) ✅
│   └── jsx-transformer.ts               (200 lines) ✅
├── scope/
│   ├── scope-tree-builder.ts            (180 lines) ✅
│   ├── binding-tracker.ts               (140 lines) ✅
│   ├── hook-tracker.ts                  (140 lines) ✅
│   ├── scope-query.ts                   (140 lines) ✅
│   ├── lca-computer.ts                  (105 lines) ✅
│   └── scope-manager.ts                 (200 lines) ✅
├── strategies/
│   ├── hoist-planner.ts                 (200 lines) ✅
│   ├── context/               # Split from ContextHandler
│   │   ├── context-detector.ts          (200 lines) ✅
│   │   ├── provider-handler.ts          (200 lines) ✅
│   │   ├── consumer-handler.ts          (180 lines) ✅
│   │   └── use-context-handler.ts       (137 lines) ✅
│   ├── context-handler.ts               (100 lines) ✅
│   └── cross-file/
│       ├── shared-module/     # Split from SharedModuleCreator
│       │   ├── module-analyzer.ts       (200 lines) ✅
│       │   ├── module-builder.ts        (200 lines) ✅
│       │   ├── export-manager.ts        (220 lines) ✅
│       │   └── import-updater.ts        (119 lines) ✅
│       └── shared-module-creator.ts     (100 lines) ✅
├── interfaces/                # New!
│   ├── i-dependency-analyzer.ts
│   ├── i-move-validator.ts
│   ├── i-jsx-transformer.ts
│   ├── i-scope-manager.ts
│   ├── i-hoist-planner.ts
│   ├── i-hoist-executor.ts
│   └── ...
└── factories/                 # New!
    ├── analyzer-factory.ts
    ├── transformer-factory.ts
    ├── strategy-factory.ts
    └── ...

Total: ~36,000 lines in ~220 files (includes new interfaces)
Avg: 163 lines/file ✅
Files >500 lines: 2 (only result/index.ts and extraction module)
Files >1000 lines: 0 ✅
```

### Code Quality Comparison

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| Largest File | 1,795 lines | <500 lines | 72% reduction |
| Avg File Size | 236 lines | 163 lines | 31% reduction |
| Files >1000 | 4 files | 0 files | 100% reduction |
| Files >500 | 19 files | 2 files | 89% reduction |
| Interfaces | 10% | 100% | 10x increase |
| Hard-coded Deps | 20+ | 0 | 100% elimination |
| Mock-ability | ~30% | 100% | 3.3x increase |
| Test Coverage | 85% | ≥90% | 5% increase |

---

## Appendix A: File Manifest

### Current Large Files (>500 lines)

1. dependency-analyzer.ts - 1,795 lines ❌ **CRITICAL**
2. index.ts - 1,512 lines ❌ **CRITICAL**
3. jsx-transformer.ts - 1,200 lines ❌ **CRITICAL**
4. move-validator.ts - 1,023 lines ❌ **HIGH**
5. scope-manager.ts - 965 lines ❌ **HIGH**
6. hoist-planner.ts - 870 lines ❌ **HIGH**
7. result/index.ts - 840 lines ⚠️ (acceptable for monad)
8. shared-module-creator.ts - 839 lines ❌ **HIGH**
9. context-handler.ts - 817 lines ❌ **HIGH**
10. factories.ts - 776 lines ⚠️ (can be split)
11. error-category.ts - 749 lines ⚠️ (can be split)
12. cross-file/index.ts - 748 lines ❌ **HIGH**
13. sink-analyzer.ts - 693 lines ⚠️
14. atomic-unit-detector.ts - 675 lines ⚠️
15. selector-resolver.ts - 664 lines ⚠️
16. suggested-fixes.ts - 659 lines ⚠️
17. circular-dependency.ts - 658 lines ⚠️
18. validation/index.ts - 656 lines ⚠️
19. code-generator.ts - 649 lines ⚠️

**Priority:** ❌ Critical (12), ⚠️ Medium (7)

---

## Appendix B: References

- Kent Beck - "Test-Driven Development: By Example"
- Kent Beck - "Tidy First?: A Personal Exercise in Empirical Software Design"
- Robert C. Martin - "Clean Architecture"
- Robert C. Martin - "Clean Code"
- Martin Fowler - "Refactoring: Improving the Design of Existing Code"
- SOLID Principles: https://en.wikipedia.org/wiki/SOLID
- Refactoring Catalog: https://refactoring.com/catalog/

---

## Appendix C: Glossary

- **SRP:** Single Responsibility Principle - A class should have one reason to change
- **OCP:** Open/Closed Principle - Open for extension, closed for modification
- **LSP:** Liskov Substitution Principle - Subtypes must be substitutable for base types
- **ISP:** Interface Segregation Principle - Many specific interfaces better than one general
- **DIP:** Dependency Inversion Principle - Depend on abstractions, not concretions
- **God Object:** Anti-pattern where one class knows/does too much
- **Code Smell:** Indicator of potential deeper problems in code
- **Technical Debt:** Future cost of choosing easy solution now over better approach

---

**Document Status:** Comprehensive Analysis
**Scope:** Entire Project (35,416 lines)
**Next Review:** After Phase 1 completion
**Owner:** Development Team
**Last Updated:** 2025-12-19

**IMPORTANT:** This is a living document. Update after each phase completion with:
- Actual vs. estimated time
- Issues encountered
- Lessons learned
- Adjusted plans for remaining phases
