# Regrafter 리팩토링 남은 작업 (Remaining Tasks)

**작성일:** 2025-12-19
**최종 업데이트:** 2025-12-19 20:15
**기준:** SOLID Violations Refactoring Plan

---

## 완료된 작업 (Completed) ✅

### Phase 1: Extract Utility Functions - COMPLETE ✅
- ✅ **Step 1.1**: parseAllFiles() 추출 완료 (`src/api/parse-utils.ts`)
  - 38 unit tests 추가 (100% coverage)
- ✅ **Step 1.2**: ImportManager 통합 완료 (-518 lines 중복 코드 제거)
- ✅ **Step 1.3**: AST Type Guards 통합 완료 (5개 중복 구현 제거)
- ✅ **Step 1.4**: generateCodeForFiles() 추출 완료 (`src/api/generation-utils.ts`)
  - 38 unit tests 추가 (100% coverage)

### Phase 2: Define Core Interfaces - COMPLETE ✅
- ✅ **Step 2.1**: 8개 핵심 인터페이스 정의 완료 (`src/interfaces/`)
  - IDependencyAnalyzer.ts
  - IScopeManager.ts
  - ICodeGenerator.ts
  - IJSXTransformer.ts (351 lines, 13 public methods)
  - IHoistPlanner.ts (160 lines, 3 public methods)
  - IHoistExecutor.ts (102 lines, 1 public method)
  - ISelectorResolver.ts (238 lines, 6 public methods)
  - IParser.ts (230 lines, 5 public methods)
- ✅ **Step 2.2**: 인터페이스 구현 완료
  - DependencyAnalyzer implements IDependencyAnalyzer
  - ScopeManager implements IScopeManager
  - CodeGenerator implements ICodeGenerator
- ✅ **Interface Compliance Tests**: 38 tests 추가 (all passing)

### Phase 4: Split MoveValidator - COMPLETE ✅
- ✅ **코드 감소**: 1,023 lines → 377 lines (63% reduction)
- ✅ **7개 Validator 추출 완료**:
  - SelectorValidator (394 lines)
  - MoveRulesValidator (189 lines)
  - AnalyzabilityValidator (107 lines)
  - HookRulesValidator (101 lines)
  - AtomicUnitValidator (56 lines)
  - ConditionalValidator (41 lines)
  - BoundaryValidator (41 lines)
- ✅ **Step 4.8**: MoveValidator를 Coordinator로 변환 완료

### Phase 5: Split JSXTransformer - COMPLETE ✅
- ✅ **코드 감소**: 1,200 lines → 389 lines (67% reduction)
- ✅ **Strategy Pattern 적용 완료**:
  - IMoveStrategy 인터페이스 정의
  - InsideMoveStrategy (123 lines)
  - BeforeMoveStrategy (147 lines)
  - AfterMoveStrategy (147 lines)
  - MoveHelpers 공통 모듈 (515 lines)
- ✅ **Step 5.5**: JSXTransformer Strategy Pattern 적용 완료

### Phase 6: Split ScopeManager - COMPLETE ✅
- ✅ **코드 감소**: 966 lines → 382 lines (60% reduction)
- ✅ **6개 Component 추출 완료**:
  - ScopeTreeBuilder (14 KB)
  - BindingTracker (4.0 KB)
  - HookTracker (3.8 KB)
  - ScopeQuery (2.6 KB)
  - LCAComputer (2.2 KB)
- ✅ **Step 6.6**: ScopeManager를 Coordinator로 변환 완료

### Phase 7: Refactor API Layer - COMPLETE ✅
- ✅ **Step 7.1-7.8**: src/api/ 모듈 생성 및 API 추출 완료
  - regraft.ts (278 lines)
  - move.ts (649 lines)
  - analyze.ts (87 lines)
  - optimize.ts (33 lines)
  - inline.ts (329 lines)
  - types.ts, result-helpers.ts, index.ts
- ✅ **Step 7.8**: index.ts → 순수 barrel 파일로 변환 (1,512 → 238 lines, 84% 감소)

### 테스트 상태
- ✅ **All 1,876 tests passing** (5 skipped)
- ✅ 76 new unit tests added (interface + utility tests)
- ✅ Zero behavioral changes
- ✅ 100% backward compatibility maintained

---

## 진행 중인 작업 (In Progress) 🔄

### Phase 3: Split DependencyAnalyzer (HIGH RISK) 🟡
**현재 상태:** 1,796 lines → 1,156 lines (36% reduction)
**목표:** ~200 lines coordinator + 10개 전문 analyzer

#### 완료된 Steps ✅
- ✅ **Step 3.1**: IdentifierCollector 추출 완료 (9.1 KB, 18 tests)
- ✅ **Step 3.2**: DependencyClassifier 추출 완료 (4.3 KB, 13 tests)
- ✅ **Step 3.3**: HookDependencyAnalyzer 추출 완료 (6.1 KB, 20 tests)
- ✅ **Step 3.4**: VariableDependencyAnalyzer 추출 완료 (3.4 KB, 7 tests)
- ✅ **Step 3.5**: ImportDependencyAnalyzer 추출 완료 (4.0 KB)
- ✅ **Step 3.6**: PropDependencyAnalyzer 추출 완료 (4.6 KB, 16 tests)

#### 남은 Steps ⏳
- ⏳ **Step 3.7**: ContextDependencyAnalyzer 추출
- ⏳ **Step 3.8**: RefDependencyAnalyzer 추출
- ⏳ **Step 3.9**: ScopeResolver 추출
- ⏳ **Step 3.10**: BindingAnalyzer 추출
- ⏳ **Step 3.11**: DependencyAnalyzer를 Coordinator로 변환 (목표: ~200 lines)

**진행률:** 6/11 steps (55% complete)

---

## 남은 작업 (Remaining Tasks)

---

## Phase 8: Implement Dependency Injection (HIGH RISK) 🔴

**목표:** 전체 codebase에 DI 적용

### Step 8.1: Create Factory Functions
**파일:** `src/factories/` (새 디렉토리)

**작업:**
1. 각 주요 컴포넌트의 factory 함수 생성
2. 의존성 주입 구조 설계
3. Factory 테스트 작성

**구조:**
```
src/factories/
├── analyzer-factory.ts
├── validator-factory.ts
├── transformer-factory.ts
├── scope-factory.ts
├── strategy-factory.ts
└── index.ts
```

**예시:**
```typescript
// analyzer-factory.ts
export function createDependencyAnalyzer(
  scopeManager: IScopeManager,
  options?: AnalyzerOptions
): IDependencyAnalyzer {
  return new DependencyAnalyzer(
    scopeManager,
    createIdentifierCollector(),
    createDependencyClassifier(),
    createHookAnalyzer(),
    // ...
    options
  );
}
```

**커밋:** `refactor(phase8): add factory functions for DI`

---

### Step 8.2-8.8: Update Major Classes for DI

각 클래스별로 다음 작업 수행:

**Step 8.2: DependencyAnalyzer**
- 생성자에서 의존성 주입 받도록 수정
- 테스트에서 mock 주입하도록 업데이트

**Step 8.3: MoveValidator**
**Step 8.4: JSXTransformer**
**Step 8.5: ScopeManager**
**Step 8.6: HoistPlanner**
**Step 8.7: HoistExecutor**
**Step 8.8: All Strategies**

**커밋 패턴:** `refactor(phase8): apply DI to [ClassName]`

---

## Phase 9: Split Strategy Classes (MEDIUM RISK) 🟡

### Step 9.1: Split HoistPlanner
**목표:** ~200 lines coordinator로 축소

**작업:**
1. 개별 전략에 더 많은 로직 위임
2. Planner는 조정만 담당

**커밋:** `refactor(phase9): split HoistPlanner`

---

### Step 9.2: Split ContextHandler
**파일:** `src/strategies/context/` (새 서브디렉토리)

**커밋:** `refactor(phase9): split ContextHandler`

---

### Step 9.3: Split SharedModuleCreator
**파일:** `src/strategies/cross-file/shared-module/` (새 서브디렉토리)

**커밋:** `refactor(phase9): split SharedModuleCreator`

---

## Phase 10: Split Cross-Cutting Files (LOW RISK) 🟢

### Step 10.1: Split Type Factories
**작업:**
1. `src/types/factories/` 디렉토리 생성
2. 도메인별로 factory 그룹화

**구조:**
```
src/types/factories/
├── dependency-factories.ts
├── scope-factories.ts
├── code-factories.ts
└── index.ts
```

**커밋:** `refactor(phase10): organize type factories by domain`

---

### Step 10.2: Split Error Categories
**작업:**
1. `src/errors/categories/` 디렉토리 생성
2. 카테고리별로 1개 파일

**구조:**
```
src/errors/categories/
├── parse-errors.ts
├── selector-errors.ts
├── dependency-errors.ts
├── validation-errors.ts
├── transform-errors.ts
├── circular-errors.ts
├── internal-errors.ts
└── index.ts
```

**커밋:** `refactor(phase10): split error categories`

---

## Phase 11: Apply OCP Patterns (LOW RISK) 🟢

### Step 11.1: Registry for Hoist Strategies
**작업:**
1. Switch statement → Strategy Registry로 변환
2. 새 전략 추가 시 기존 코드 수정 불필요하도록

**커밋:** `refactor(phase11): add hoist strategy registry`

---

### Step 11.2: Registry for Move Strategies
**커밋:** `refactor(phase11): add move strategy registry`

---

### Step 11.3: Registry for Error Types
**커밋:** `refactor(phase11): add error type registry`

---

## Phase 12: Final Cleanup and Optimization (LOW RISK) 🟢

### Step 12.1: Remove Remaining Duplication
**작업:**
1. 코드베이스 전체 중복 검사
2. 남은 중복 코드 제거
3. 중복율 <3% 달성

**커밋:** `refactor(phase12): remove remaining code duplication`

---

### Step 12.2: Standardize Patterns
**작업:**
1. 코딩 패턴 표준화
2. 네이밍 컨벤션 일관성 확보
3. 파일 구조 일관성 확보

**커밋:** `refactor(phase12): standardize coding patterns`

---

### Step 12.3: Update Documentation
**작업:**
1. API 문서 업데이트
2. 아키텍처 문서 업데이트
3. 기여 가이드 업데이트

**커밋:** `docs(phase12): update documentation for refactored architecture`

---

## 우선순위 권장사항

### 즉시 시작 가능 (병렬 작업 가능):
1. **Phase 1 (나머지)**: Extract Utilities - 낮은 위험도
2. **Phase 2**: Define Interfaces - 낮은 위험도, 다른 phase의 기초

### 순차 진행 필요:
3. **Phase 3**: Split DependencyAnalyzer - Phase 2 완료 후
4. **Phase 4**: Split MoveValidator - Phase 2 완료 후
5. **Phase 5**: Split JSXTransformer - Phase 2 완료 후
6. **Phase 6**: Split ScopeManager - Phase 2 완료 후
7. **Phase 8**: Implement DI - Phases 2-6 완료 후
8. **Phase 9-12**: 순차 진행

---

## 성공 지표 (Success Metrics)

### 코드 품질 목표

| 메트릭 | 시작 | 현재 | 목표 | 진행률 |
|--------|------|------|------|--------|
| 평균 파일 크기 | 236 lines | ~180 lines | <200 lines | ✅ 달성 |
| 1000+ lines 파일 | 4개 | 1개 | 0개 | 🟡 75% |
| 500+ lines 파일 | 19개 | ~12개 | <5개 | 🟡 58% |
| 인터페이스 있는 클래스 | ~10% | ~40% | 100% | 🟡 40% |
| Hard-coded 의존성 | 20+ | ~15 | 0 | 🟡 25% |
| 코드 중복율 | ~8% | ~5% | <3% | 🟡 60% |
| 테스트 커버리지 | 85% | 85%+ | ≥85% | ✅ 유지 |

### 실제 코드 감소 성과

| 파일 | 원본 | 현재 | 감소 | 비율 |
|------|------|------|------|------|
| DependencyAnalyzer | 1,796 | 1,156 | -640 | 36% ↓ |
| MoveValidator | 1,023 | 377 | -646 | 63% ↓ |
| JSXTransformer | 1,200 | 389 | -811 | 68% ↓ |
| ScopeManager | 966 | 382 | -584 | 60% ↓ |
| **총계** | **4,985** | **2,304** | **-2,681** | **54% ↓** |

### 각 Phase 완료 조건

✅ **모든 테스트 통과** (1,876 tests passing, 5 skipped)
✅ **TypeScript 컴파일 성공**
✅ **Benchmark 성능 유지** (<100ms single file)
✅ **커밋 메시지 규칙 준수** (conventional commits)
✅ **코드 리뷰 승인**

---

## Phase별 진행 상황

| Phase | 상태 | 완료율 | 비고 |
|-------|------|--------|------|
| Phase 1 | ✅ 완료 | 100% | 4 steps 완료 |
| Phase 2 | ✅ 완료 | 100% | 8 interfaces 정의 |
| Phase 3 | 🔄 진행중 | 55% | 6/11 steps 완료 |
| Phase 4 | ✅ 완료 | 100% | 8 steps 완료 |
| Phase 5 | ✅ 완료 | 100% | 5 steps 완료 |
| Phase 6 | ✅ 완료 | 100% | 6 steps 완료 |
| Phase 7 | ✅ 완료 | 100% | 8 steps 완료 |
| Phase 8 | ⏳ 대기 | 0% | Phase 3 완료 후 시작 |

**전체 진행률:** ~72% (6개 Phase 완료, 1개 진행중)

---

## 다음 단계

### 즉시 진행 (Phase 3 완료)
1. **Step 3.7**: ContextDependencyAnalyzer 추출
2. **Step 3.8**: RefDependencyAnalyzer 추출
3. **Step 3.9**: ScopeResolver 추출
4. **Step 3.10**: BindingAnalyzer 추출
5. **Step 3.11**: DependencyAnalyzer를 Coordinator로 최종 변환

### Phase 3 완료 후
- **Phase 8**: Dependency Injection 구현 (HIGH RISK)
- **Phase 9-12**: 순차 진행

---

**문서 버전:** 2.0
**최종 업데이트:** 2025-12-19 20:15
**작성자:** Claude Code + Ryan
