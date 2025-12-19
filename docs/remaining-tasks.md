# Regrafter 리팩토링 남은 작업 (Remaining Tasks)

**작성일:** 2025-12-19
**기준:** SOLID Violations Refactoring Plan

---

## 완료된 작업 (Completed) ✅

### Phase 1 (일부): Extract Utility Functions
- ✅ **Step 1.2**: ImportManager 통합 완료 (-518 lines 중복 코드 제거)
- ✅ **Step 1.3**: AST Type Guards 통합 완료 (5개 중복 구현 제거)

### Phase 7: Refactor API Layer
- ✅ **Step 7.1-7.8**: src/api/ 모듈 생성 및 API 추출 완료
  - regraft.ts (278 lines)
  - move.ts (649 lines)
  - analyze.ts (87 lines)
  - optimize.ts (33 lines)
  - inline.ts (329 lines)
  - types.ts, result-helpers.ts, index.ts
- ✅ **Step 7.8**: index.ts → 순수 barrel 파일로 변환 (1,512 → 238 lines, 84% 감소)
- ✅ **All 1,703 tests passing**

---

## 남은 작업 (Remaining Tasks)

---

## Phase 1: Extract Utility Functions (LOW RISK) 🟢

### Step 1.1: Extract File Parsing Utility
**목표:** parseAllFiles() 함수 공통 유틸리티로 추출

**작업:**
1. `src/utils/file-parser.ts` 파일 생성
2. 다음 위치에서 parseAllFiles() 추출:
   - src/api/move.ts (line 606-615)
   - src/transformer/jsx-transformer.ts
   - src/optimizer/optimizer.ts
3. 공통 parseAllFiles() 함수 작성:
   ```typescript
   export function parseAllFiles(
     files: FileInput[]
   ): Result<Map<string, t.File>, RegraffError>
   ```
4. 모든 호출 위치 업데이트
5. 테스트 작성 및 실행

**파일:**
- NEW: `src/utils/file-parser.ts`
- UPDATE: `src/api/move.ts`, `src/transformer/jsx-transformer.ts`, etc.

**테스트:**
- 모든 기존 테스트 통과 확인
- parseAllFiles() 단위 테스트 추가

**커밋:** `refactor: extract parseAllFiles utility`

---

### Step 1.4: Extract Code Generation Utilities
**목표:** 코드 생성 공통 로직 추출

**작업:**
1. `src/utils/code-gen-utils.ts` 생성
2. generateCodeForFiles() 함수 추출 (api/move.ts line 717-752)
3. 중복된 코드 생성 로직 통합

**커밋:** `refactor: extract code generation utilities`

---

## Phase 2: Define Core Interfaces (LOW RISK) 🟢

### Step 2.1: Create Core Interfaces Directory
**목표:** 모든 핵심 컴포넌트의 인터페이스 정의

**작업:**
1. `src/interfaces/` 디렉토리 생성
2. 다음 인터페이스 파일들 생성:
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

**인터페이스 예시:**
```typescript
// src/interfaces/i-dependency-analyzer.ts
export interface IDependencyAnalyzer {
  setCurrentFile(file: string): void;
  analyzeElement(
    elementPath: NodePath,
    targetScope: ScopeInfo | null
  ): Result<DependencyAnalysis, RegraffError>;
  // ... 기타 public 메서드
}
```

**테스트:**
- TypeScript 컴파일 성공 확인

**커밋:** `refactor: add core interface definitions`

---

### Step 2.2: Implement Interfaces in Existing Classes
**목표:** 기존 클래스들이 인터페이스 구현하도록 수정

**작업:**
1. DependencyAnalyzer: `implements IDependencyAnalyzer` 추가
2. MoveValidator: `implements IMoveValidator` 추가
3. JSXTransformer: `implements IJSXTransformer` 추가
4. ScopeManager: `implements IScopeManager` 추가
5. HoistPlanner: `implements IHoistPlanner` 추가
6. HoistExecutor: `implements IHoistExecutor` 추가
7. CodeGenerator: `implements ICodeGenerator` 추가
8. SelectorResolver: `implements ISelectorResolver` 추가

**테스트:**
- TypeScript 컴파일 + 모든 테스트 통과

**커밋:** `refactor: implement interfaces in core classes`

---

## Phase 3: Split DependencyAnalyzer (HIGH RISK) 🔴

**현재 상태:** 1,795 lines (가장 큰 파일)
**목표:** ~200 lines coordinator + 8개 전문 analyzer

### Step 3.1: Extract IdentifierCollector
**파일:** `src/analyzer/analyzers/identifier-collector.ts`

**작업:**
1. collectIdentifiers() 로직 추출
2. IdentifierCollectionResult 타입 정의
3. 단위 테스트 작성
4. DependencyAnalyzer에서 사용하도록 업데이트

**테스트:**
- IdentifierCollector 단위 테스트 (90%+ coverage)
- DependencyAnalyzer 통합 테스트 모두 통과

**커밋:** `refactor(phase3): extract IdentifierCollector`

---

### Step 3.2: Extract DependencyClassifier
**파일:** `src/analyzer/analyzers/dependency-classifier.ts`

**작업:**
1. classifyDependency() 로직 추출
2. 의존성 타입 분류 로직 캡슐화
3. 테스트 작성

**커밋:** `refactor(phase3): extract DependencyClassifier`

---

### Step 3.3: Extract HookDependencyAnalyzer
**파일:** `src/analyzer/analyzers/hook-dependency-analyzer.ts`

**작업:**
1. analyzeHookDependency() 추출
2. React hooks 규칙 검증 로직 포함
3. 테스트 작성

**커밋:** `refactor(phase3): extract HookDependencyAnalyzer`

---

### Step 3.4: Extract VariableDependencyAnalyzer
**파일:** `src/analyzer/analyzers/variable-dependency-analyzer.ts`

**커밋:** `refactor(phase3): extract VariableDependencyAnalyzer`

---

### Step 3.5: Extract ImportDependencyAnalyzer
**파일:** `src/analyzer/analyzers/import-dependency-analyzer.ts`

**커밋:** `refactor(phase3): extract ImportDependencyAnalyzer`

---

### Step 3.6: Extract PropDependencyAnalyzer
**파일:** `src/analyzer/analyzers/prop-dependency-analyzer.ts`

**커밋:** `refactor(phase3): extract PropDependencyAnalyzer`

---

### Step 3.7: Extract ContextDependencyAnalyzer
**파일:** `src/analyzer/analyzers/context-dependency-analyzer.ts`

**커밋:** `refactor(phase3): extract ContextDependencyAnalyzer`

---

### Step 3.8: Extract RefDependencyAnalyzer
**파일:** `src/analyzer/analyzers/ref-dependency-analyzer.ts`

**커밋:** `refactor(phase3): extract RefDependencyAnalyzer`

---

### Step 3.9: Extract ScopeResolver
**파일:** `src/analyzer/analyzers/scope-resolver.ts`

**커밋:** `refactor(phase3): extract ScopeResolver`

---

### Step 3.10: Extract BindingAnalyzer
**파일:** `src/analyzer/analyzers/binding-analyzer.ts`

**커밋:** `refactor(phase3): extract BindingAnalyzer`

---

### Step 3.11: Refactor DependencyAnalyzer as Coordinator
**목표:** 1,795 lines → ~200 lines coordinator

**작업:**
1. DependencyAnalyzer를 coordinator 역할로 축소
2. 추출된 analyzers에 위임
3. 모든 DependencyAnalyzer 테스트 통과 확인

**최종 구조:**
```typescript
export class DependencyAnalyzer implements IDependencyAnalyzer {
  constructor(
    private scopeManager: IScopeManager,
    private identifierCollector: IIdentifierCollector,
    private classifier: IDependencyClassifier,
    private hookAnalyzer: IHookDependencyAnalyzer,
    // ... 기타 analyzers
  ) {}

  analyzeElement(path: NodePath, targetScope: ScopeInfo | null) {
    // 단순 조정 로직만
    const identifiers = this.identifierCollector.collect(path);
    const classified = this.classifier.classify(identifiers);
    // ... 위임
  }
}
```

**커밋:** `refactor(phase3): convert DependencyAnalyzer to coordinator`

---

## Phase 4: Split MoveValidator (MEDIUM RISK) 🟡

**현재 상태:** 1,023 lines
**목표:** ~150 lines coordinator + 7개 validator

### Step 4.1: Extract SelectorValidator
**파일:** `src/analyzer/validators/selector-validator.ts`

**커밋:** `refactor(phase4): extract SelectorValidator`

---

### Step 4.2: Extract MoveRulesValidator
**파일:** `src/analyzer/validators/move-rules-validator.ts`

**커밋:** `refactor(phase4): extract MoveRulesValidator`

---

### Step 4.3: Extract AtomicUnitValidator
**파일:** `src/analyzer/validators/atomic-unit-validator.ts`

**커밋:** `refactor(phase4): extract AtomicUnitValidator`

---

### Step 4.4: Extract HookRulesValidator
**파일:** `src/analyzer/validators/hook-rules-validator.ts`

**커밋:** `refactor(phase4): extract HookRulesValidator`

---

### Step 4.5: Extract ConditionalValidator
**파일:** `src/analyzer/validators/conditional-validator.ts`

**커밋:** `refactor(phase4): extract ConditionalValidator`

---

### Step 4.6: Extract BoundaryValidator
**파일:** `src/analyzer/validators/boundary-validator.ts`

**커밋:** `refactor(phase4): extract BoundaryValidator`

---

### Step 4.7: Extract AnalyzabilityValidator
**파일:** `src/analyzer/validators/analyzability-validator.ts`

**커밋:** `refactor(phase4): extract AnalyzabilityValidator`

---

### Step 4.8: Refactor MoveValidator as Coordinator
**목표:** 1,023 lines → ~150 lines coordinator

**커밋:** `refactor(phase4): convert MoveValidator to coordinator`

---

## Phase 5: Split JSXTransformer (MEDIUM RISK) 🟡

**현재 상태:** 1,200 lines
**목표:** Strategy pattern 적용

### Step 5.1: Create Move Strategy Interface
**파일:** `src/transformer/strategies/i-move-strategy.ts`

**작업:**
```typescript
export interface IMoveStrategy {
  execute(
    ast: t.File,
    source: NodePath,
    target: NodePath,
    options?: MoveOptions
  ): Result<void, RegraffError>;
}
```

**커밋:** `refactor(phase5): add IMoveStrategy interface`

---

### Step 5.2: Extract InsideMoveStrategy
**파일:** `src/transformer/strategies/inside-move-strategy.ts`

**커밋:** `refactor(phase5): extract InsideMoveStrategy`

---

### Step 5.3: Extract BeforeMoveStrategy
**파일:** `src/transformer/strategies/before-move-strategy.ts`

**커밋:** `refactor(phase5): extract BeforeMoveStrategy`

---

### Step 5.4: Extract AfterMoveStrategy
**파일:** `src/transformer/strategies/after-move-strategy.ts`

**커밋:** `refactor(phase5): extract AfterMoveStrategy`

---

### Step 5.5: Refactor JSXTransformer with Strategy Pattern
**작업:**
```typescript
export class JSXTransformer implements IJSXTransformer {
  private strategies: Map<Move, IMoveStrategy>;

  constructor() {
    this.strategies = new Map([
      [Move.Inside, new InsideMoveStrategy()],
      [Move.Before, new BeforeMoveStrategy()],
      [Move.After, new AfterMoveStrategy()],
    ]);
  }

  move(ast: t.File, source: NodePath, target: NodePath, mode: Move) {
    const strategy = this.strategies.get(mode);
    return strategy.execute(ast, source, target);
  }
}
```

**커밋:** `refactor(phase5): apply strategy pattern to JSXTransformer`

---

## Phase 6: Split ScopeManager (MEDIUM RISK) 🟡

**목표:** 6개 scope 컴포넌트로 분리

### Step 6.1: Extract ScopeTreeBuilder
**파일:** `src/scope/components/scope-tree-builder.ts`

**커밋:** `refactor(phase6): extract ScopeTreeBuilder`

---

### Step 6.2: Extract BindingTracker
**파일:** `src/scope/components/binding-tracker.ts`

**커밋:** `refactor(phase6): extract BindingTracker`

---

### Step 6.3: Extract HookTracker
**파일:** `src/scope/components/hook-tracker.ts`

**커밋:** `refactor(phase6): extract HookTracker`

---

### Step 6.4: Extract ScopeQuery
**파일:** `src/scope/components/scope-query.ts`

**커밋:** `refactor(phase6): extract ScopeQuery`

---

### Step 6.5: Extract LCAComputer
**파일:** `src/scope/components/lca-computer.ts`

**커밋:** `refactor(phase6): extract LCAComputer`

---

### Step 6.6: Refactor ScopeManager as Coordinator
**커밋:** `refactor(phase6): convert ScopeManager to coordinator`

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

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| 평균 파일 크기 | 236 lines | <200 lines |
| 1000+ lines 파일 | 4개 | 0개 |
| 500+ lines 파일 | 19개 | <5개 |
| 인터페이스 있는 클래스 | ~10% | 100% |
| Hard-coded 의존성 | 20+ | 0 |
| 코드 중복율 | ~8% | <3% |
| 테스트 커버리지 | 85% | ≥85% |

### 각 Phase 완료 조건

✅ **모든 테스트 통과** (1,703+ tests)
✅ **TypeScript 컴파일 성공**
✅ **Benchmark 성능 유지** (<100ms single file)
✅ **커밋 메시지 규칙 준수** (conventional commits)
✅ **코드 리뷰 승인**

---

## 예상 일정

| Phase | 기간 | 위험도 |
|-------|------|--------|
| Phase 1 (나머지) | 2-3일 | 🟢 Low |
| Phase 2 | 1주 | 🟢 Low |
| Phase 3 | 3주 | 🔴 High |
| Phase 4 | 1주 | 🟡 Medium |
| Phase 5 | 1주 | 🟡 Medium |
| Phase 6 | 1주 | 🟡 Medium |
| Phase 8 | 1주 | 🔴 High |
| Phase 9 | 1주 | 🟡 Medium |
| Phase 10 | 1주 | 🟢 Low |
| Phase 11 | 1주 | 🟢 Low |
| Phase 12 | 1주 | 🟢 Low |

**총 예상 기간:** 13-15주 (2명 개발자 기준)

---

## 다음 단계

1. **Phase 1 완료하기** - 나머지 utility 추출
2. **Phase 2 시작** - 인터페이스 정의 (병렬 가능)
3. **Phase 3 계획** - DependencyAnalyzer 분리 상세 계획 수립

---

**문서 버전:** 1.0
**마지막 업데이트:** 2025-12-19
**작성자:** Claude Code + Ryan
