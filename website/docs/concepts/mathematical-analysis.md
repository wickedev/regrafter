---
sidebar_position: 2
---

# Mathematical Analysis

> **Regrafter**: 프로그래매틱 AST 변환을 통한 React 엘리먼트 재배치 라이브러리

---

## 1. 문제 정의

### 1.1 목표 API

```typescript
import { regraft, Move } from 'regrafter';

// 통합 API (canMove + move + analyze + optimize)
regraft(files: string[], from: Selector, to: Selector, mode: Move, options?: Options): Result

interface Options {
  optimize?: boolean;   // 싱킹 최적화 (default: true)
  dryRun?: boolean;     // 실제 변환 없이 분석만 (default: false)
}

interface Result {
  success: boolean;
  codes: Code[];           // 변환된 코드
  analysis: MoveAnalysis;  // 분석 결과
}

enum Move {
  Inside,  // to의 자식으로
  Before,  // to의 이전 형제로
  After    // to의 다음 형제로
}

// 개별 API (세부 제어용)
regraft.canMove(files, from, to, mode): boolean
regraft.move(files, from, to, mode): Code[]
regraft.analyze(files, from, to, mode): MoveAnalysis
regraft.optimize(files): Code[]
```

### 1.2 핵심 요구사항

```
1. 엘리먼트 이동 시 의존성도 함께 이동
   - useState, useEffect 등 훅
   - const, let 변수 선언
   - import 문

2. 이동 후 코드가 정상 빌드되어야 함

3. 불가능한 이동은 사전에 검증 가능해야 함
```

### 1.3 수학적 표현

```
regraft: (Files, From, To, Mode) → Code[] | ⊥

where:
  Files = 소스 파일 집합
  From  = 이동할 엘리먼트 선택자
  To    = 목적지 선택자
  Mode  = Inside | Before | After
  ⊥     = 이동 불가능 (canRegraft로 사전 검증)
```

---

## 2. 의존성 그래프 모델

### 2.1 의존성 정의

엘리먼트 E가 참조하는 모든 심볼의 집합:

```
deps(E) = { s | E가 심볼 s를 참조 }

심볼 종류:
├── Hook: useState, useEffect, useContext, ...
├── Variable: const, let 선언
├── Import: 외부 모듈
└── Prop: 상위에서 전달받은 값
```

### 2.2 예시

```tsx
function Parent() {
  const [count, setCount] = useState(0);  // ← 의존성 D1
  const label = "Count: ";                 // ← 의존성 D2

  return (
    <div>
      <Child count={count} label={label} />  // ← 이동 대상 E
    </div>
  );
}
```

```
deps(E) = { count, label }
origin(count) = useState(0)  → Hook
origin(label) = "Count: "    → Variable
```

### 2.3 의존성 그래프

```
G = (V, E)

V = 모든 심볼 + 모든 JSX 엘리먼트
E = { (a, b) | b가 a를 참조 }

예시:
  useState(0) ← count ← <Child />
  "Count: "   ← label ← <Child />
```

---

## 3. 이동 연산 정의

### 3.1 Move.Inside

```
move_inside(E, T): E를 T의 자식으로 이동

Before:                    After:
<Parent>                   <Parent>
  <E />      ──────→         <T>
  <T />                        <E />
</Parent>                    </T>
                           </Parent>
```

### 3.2 Move.Before

```
move_before(E, T): E를 T의 이전 형제로 이동

Before:                    After:
<Parent>                   <Parent>
  <T />      ──────→         <E />
  <E />                      <T />
</Parent>                  </Parent>
```

### 3.3 Move.After

```
move_after(E, T): E를 T의 다음 형제로 이동

Before:                    After:
<Parent>                   <Parent>
  <E />      ──────→         <T />
  <T />                      <E />
</Parent>                  </Parent>
```

---

## 4. 의존성 이동 알고리즘

### 4.1 핵심 원리

엘리먼트 E가 이동할 때, deps(E)도 유효한 스코프에 있어야 함.

```
∀ d ∈ deps(E): scope(d) ⊇ scope(E')

where E' = 이동 후 E의 새 위치
```

### 4.2 의존성 이동 전략

```
Strategy: ResolveDependencies(E, target)

FOR EACH d IN deps(E):
  IF d가 target 스코프에서 접근 불가:
    CASE d.type:
      Hook     → hoist_to_common_ancestor(d, E, target)
      Variable → hoist_or_pass_as_prop(d, E, target)
      Import   → add_import_to_target_file(d)
      Prop     → thread_through_ancestors(d, E, target)
```

### 4.3 Hook 호이스팅

React Hook은 컴포넌트 최상위에서만 호출 가능:

```tsx
// Before: E가 Parent 안에서 count 사용
function Parent() {
  const [count, setCount] = useState(0);
  return <E count={count} />;
}

// After: E가 GrandParent로 이동
function GrandParent() {
  const [count, setCount] = useState(0);  // ← Hook도 함께 호이스팅
  return (
    <E count={count} />
    <Parent />
  );
}
```

### 4.4 변수 호이스팅 또는 Prop 전달

```tsx
// 전략 1: 호이스팅 (순수 값인 경우)
const label = "Count: ";  // 상위로 이동

// 전략 2: Prop 전달 (컨텍스트 의존인 경우)
<Parent label={label}>
  <E label={label} />     // prop으로 전달
</Parent>
```

---

## 5. 이동 불가능 조건

### 5.1 불가능 케이스 정의

```typescript
regraft.canMove(files, from, to, mode): boolean

// 모든 케이스가 해결 가능 (원자적 단위 취급)
return true;
```

### 5.2 Case 1: 구조적 역전 (해결 가능)

```tsx
// Before: Parent가 Child를 감싸고 있음
<Parent>
  <Child />
</Parent>

// After: Child가 Parent를 감싸도록 역전
<Child>
  <Parent />
</Child>
```

```
AST 레벨에서는 단순히 중첩 구조 변경
= 완전히 가능

regraft.canMove = true
```

### 5.3 Case 2: 조건부 렌더링 (해결 가능)

```tsx
// 조건문 전체를 하나의 단위로 취급
{condition && <E />}  // 이 전체가 하나의 이동 단위

// Before:
<Parent>
  {show && <Modal />}
</Parent>

// After: 조건문 전체가 이동
<Container>
  {show && <Modal />}  // 조건 + 컴포넌트가 함께 이동
</Container>
<Parent />
```

```
해결 전략:
- 조건 표현식 전체를 원자적 단위(atomic unit)로 취급
- 조건과 컴포넌트가 함께 이동
- Hook이 있어도 조건부 호출 구조 유지

regraft.canMove = true (조건문 전체를 단위로 이동)
```

### 5.4 Case 3: 동적 리스트 (해결 가능)

```tsx
// map 표현식 전체를 하나의 단위로 취급
{list.map((item) => <Card key={item.id}>{item.name}</Card>)}

// Before:
<Parent>
  {users.map((u) => <UserCard key={u.id} user={u} />)}
</Parent>

// After: map 전체가 이동
<Container>
  {users.map((u) => <UserCard key={u.id} user={u} />)}
</Container>
<Parent />
```

```
해결 전략:
- map/filter/reduce 표현식 전체를 원자적 단위로 취급
- 반복 로직 + 렌더링이 함께 이동
- 의존성(users)은 기존 패턴대로 호이스팅 + props

regraft.canMove = true (동적 리스트 전체를 단위로 이동)
```

### 5.5 Case 4: Context 의존성 (해결 가능)

```tsx
// Before: Child가 ThemeContext를 사용
<ThemeProvider>
  <Parent>
    <Child />  // useContext(ThemeContext) 사용
  </Parent>
</ThemeProvider>

// 문제: Child를 ThemeProvider 밖으로 이동하면?
```

**해결 전략 A: Provider 호이스팅**
```tsx
// Provider를 상위로 이동하여 새 위치도 감싸도록
<ThemeProvider>
  <Child />      // 이동된 위치
  <Parent />
</ThemeProvider>
```

**해결 전략 B: Context → Props 변환**
```tsx
// Context 사용을 props로 변환
function Parent() {
  const theme = useContext(ThemeContext);  // Parent가 추출
  return <Child theme={theme} />;          // props로 전달
}

function Child({ theme }) {  // useContext 대신 props
  return <div style={{ color: theme.primary }}>...</div>;
}
```

```
regraft.canMove = true (Provider 호이스팅 또는 props 변환)
```

### 5.6 Case 5: Suspense/Lazy 컴포넌트 (해결 가능)

```tsx
// Before: LazyComponent가 Suspense 안에 있음
<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>

// 문제: LazyComponent를 Suspense 밖으로 이동하면 에러
```

**해결 전략: Suspense 자동 래핑**
```tsx
// 이동 시 Suspense도 함께 이동하거나 새로 생성
<NewParent>
  <Suspense fallback={<Loading />}>
    <LazyComponent />
  </Suspense>
</NewParent>
```

```
regraft.canMove = true (Suspense 경계 자동 생성/이동)
```

### 5.7 Case 6: Compound Components (해결 가능)

```tsx
// Tabs 내부 상태를 Context로 공유하는 패턴
<Tabs>
  <Tabs.List>
    <Tabs.Tab>One</Tabs.Tab>  // 내부적으로 Tabs Context 사용
  </Tabs.List>
  <Tabs.Panel>Content</Tabs.Panel>
</Tabs>

// Tabs.Tab을 Tabs 밖으로 이동하면 Context 연결 끊김
```

**해결 전략: Context 의존성과 동일**
```
- Tabs를 함께 이동 (원자적 단위)
- 또는 Context 의존성 해결 패턴 적용

regraft.canMove = true (Compound Component 전체를 단위로)
```

### 5.8 Case 7: Ref 전달 (해결 가능)

```tsx
// Before: Parent가 Child의 ref를 보유
function Parent() {
  const childRef = useRef(null);
  return (
    <div>
      <Child ref={childRef} />
      <button onClick={() => childRef.current.focus()}>Focus</button>
    </div>
  );
}

// Child를 밖으로 이동하면 childRef 접근 필요
```

**해결 전략: 스코프 탈출과 동일**
```tsx
// ref를 상위로 호이스팅 + props로 주입
function GrandParent() {
  const childRef = useRef(null);
  return (
    <div>
      <Child ref={childRef} />
      <Parent childRef={childRef} />  // ref를 props로 전달
    </div>
  );
}
```

```
regraft.canMove = true (ref 호이스팅 + props 주입)
```

### 5.9 Case 8: 스코프 탈출 (해결 가능)

```tsx
// Before: E가 Parent 안에서 localFn 사용
function Parent() {
  const localFn = () => { console.log('click'); };
  return (
    <div>
      <E onClick={localFn} />
      <Other onClick={localFn} />  // 기존 코드도 localFn 사용
    </div>
  );
}

// After: E를 GrandParent로 이동
// 1. localFn을 상위로 호이스팅
// 2. Parent에는 props로 주입
function GrandParent() {
  const localFn = () => { console.log('click'); };  // ← 호이스팅
  return (
    <div>
      <E onClick={localFn} />
      <Parent localFn={localFn} />  // ← props로 주입
    </div>
  );
}

function Parent({ localFn }) {  // ← props로 받음
  return (
    <div>
      <Other onClick={localFn} />  // 기존 코드 정상 동작
    </div>
  );
}
```

```
해결 전략:
1. 의존성(localFn)을 공통 조상으로 호이스팅
2. 기존 위치(Parent)에서 여전히 사용 중이면 props로 주입
3. 모든 참조가 유효하게 유지됨

regraft.canMove = true (호이스팅 + props 주입으로 해결)
```

### 5.10 Case 9: 파일 간 이동 (해결 가능)

```tsx
// Before: file-a.tsx
const secret = "local";
const other = secret + "!";  // secret을 다른 곳에서도 사용

export function ComponentA() {
  return <E text={secret} />;  // E를 file-b.tsx로 이동하고 싶음
}

// After:
// shared.ts (또는 file-b.tsx)
export const secret = "local";  // ← 공유 모듈로 이동

// file-a.tsx
import { secret } from './shared';  // ← import 추가
const other = secret + "!";  // 기존 코드 정상 동작

export function ComponentA() {
  // E는 제거됨
}

// file-b.tsx
import { secret } from './shared';  // ← import 추가

export function ComponentB() {
  return <E text={secret} />;  // ← E가 여기로 이동
}
```

```
해결 전략:
1. 의존성(secret)을 공유 모듈로 이동 + export
2. 기존 파일(file-a)에 import 추가
3. 대상 파일(file-b)에 import 추가
4. 스코프 탈출과 동일한 패턴 (파일 레벨)

regraft.canMove = true (공유 모듈 + import로 해결)
```

---

## 6. 알고리즘

### 6.1 전체 흐름

```
Algorithm: Regraft(files, from, to, mode)

1. PARSE files → AST[]
2. FIND source_element ← select(AST, from)
3. FIND target_element ← select(AST, to)
4. COMPUTE deps ← analyze_dependencies(source_element)
5. VALIDATE can_move(source_element, target_element, deps)
6. IF not valid: RETURN ⊥
7. RESOLVE dependency_moves ← resolve_dependencies(deps, target)
8. APPLY moves to AST
9. GENERATE code from AST
10. RETURN code[]
```

### 6.2 의존성 분석

```
Algorithm: AnalyzeDependencies(element)

deps = {}
FOR EACH identifier IN element.references:
  binding ← find_binding(identifier)
  deps.add({
    symbol: identifier,
    origin: binding,
    type: classify(binding),  // Hook | Variable | Import | Prop
    scope: binding.scope
  })
RETURN deps
```

### 6.3 이동 가능성 검증

```
Algorithm: CanMove(source, target, deps)

// 원자적 단위 전략: 조건문/반복문 전체를 단위로 취급
// → 대부분의 케이스에서 이동 가능

// 유일한 제약: eval 등 정적 분석 불가능한 코드
FOR EACH d IN deps:
  IF is_eval_or_dynamic_code(d): RETURN false

RETURN true
```

---

## 7. 복잡도 분석

### 7.1 시간 복잡도

```
Parse:           O(n)      n = 총 코드 길이
Dependency:      O(v + e)  v = 심볼 수, e = 참조 수
Validation:      O(d)      d = 의존성 수
Transformation:  O(n)
Generation:      O(n)
─────────────────────────
Total:           O(n + v + e)
```

### 7.2 공간 복잡도

```
AST:             O(n)
Dependency Graph: O(v + e)
Output Code:     O(n)
─────────────────────────
Total:           O(n + v + e)
```

---

## 8. 수학적 정리

### 정리 1: 의존성 보존 필요충분조건

> **"이동이 가능하려면, 모든 의존성이 새 스코프에서 접근 가능해야 한다."**

```
canRegraft(E, T) ⟺ ∀d ∈ deps(E): resolvable(d, scope(T))
```

### 정리 2: Hook 호이스팅의 안전성

> **"Hook은 조건부/반복문 밖의 공통 조상으로만 호이스팅 가능하다."**

```
safe_hoist(hook, target) ⟺
  is_component_top_level(target) ∧
  ¬is_conditional(path(hook, target)) ∧
  ¬is_loop(path(hook, target))
```

### 정리 3: 이동 연산의 결정성

> **"동일한 입력에 대해 regraft는 항상 동일한 출력을 생성한다."**

```
regraft(F, from, to, mode) = regraft(F, from, to, mode)  (참조 투명성)
```

---

## 9. API 설계

### 9.1 Core API

```typescript
import { regraft, Move } from 'regrafter';

// ═══════════════════════════════════════════════
// 통합 API (권장)
// ═══════════════════════════════════════════════
regraft(
  files: string[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result;

interface Options {
  optimize?: boolean;        // 싱킹 최적화 (default: true)
  dryRun?: boolean;          // 분석만 수행 (default: false)
  preserveComments?: boolean;
  formatOutput?: boolean;
}

interface Result {
  success: boolean;
  codes: Code[];
  analysis: MoveAnalysis;
}

// ═══════════════════════════════════════════════
// 개별 API (세부 제어용)
// ═══════════════════════════════════════════════
regraft.canMove(files, from, to, mode): boolean;
regraft.move(files, from, to, mode): Code[];
regraft.analyze(files, from, to, mode): MoveAnalysis;
regraft.optimize(files): Code[];
```

### 9.2 타입 정의

```typescript
enum Move {
  Inside = "inside",
  Before = "before",
  After = "after"
}

type Selector =
  { file: string, line: number, column: number }
  | { file: string, path: string }  // AST path

interface Code {
  file: string;
  content: string;
  changed: boolean;
}

interface MoveAnalysis {
  canMove: boolean;
  reason?: string;
  dependencies: Dependency[];
  hoistedDeps: Dependency[];     // 호이스팅될 의존성
  suggestedFixes?: SuggestedFix[];
}
```

### 9.3 사용 예시

```typescript
import { regraft, Move } from 'regrafter';

const files = ['./src/App.tsx', './src/components/Layout.tsx'];
const from = { file: './src/App.tsx', line: 15, column: 4 };
const to = { file: './src/components/Layout.tsx', line: 8, column: 6 };

// ═══════════════════════════════════════════════
// 통합 API 사용 (권장)
// ═══════════════════════════════════════════════
const result = regraft(files, from, to, Move.Inside);
// → canMove + move + analyze + optimize 모두 수행

if (result.success) {
  result.codes.forEach(code => {
    if (code.changed) {
      fs.writeFileSync(code.file, code.content);
    }
  });
  console.log('호이스팅된 의존성:', result.analysis.hoistedDeps);
}

// 분석만 수행 (코드 변환 없음)
const preview = regraft(files, from, to, Move.Inside, { dryRun: true });

// 최적화 비활성화
const noOptimize = regraft(files, from, to, Move.Inside, { optimize: false });

// ═══════════════════════════════════════════════
// 개별 API 사용 (세부 제어)
// ═══════════════════════════════════════════════
if (regraft.canMove(files, from, to, Move.Inside)) {
  const codes = regraft.move(files, from, to, Move.Inside);
  const optimized = regraft.optimize(files);
}

// AST path로도 선택 가능
const fromPath = { file: './src/App.tsx', path: 'Program.body[0].declaration.body.body[0]' };
regraft(files, fromPath, to, Move.After);
```

---

## 10. 제약 조건

### 10.1 해결 가능한 케이스

| 케이스 | 해결 방법 |
|--------|----------|
| Hook 의존성 | 공통 조상으로 호이스팅 |
| 순수 변수 | 호이스팅 또는 prop 전달 |
| Import | 대상 파일에 import 추가 |
| 단순 Prop | 경로 따라 전달 |
| 스코프 탈출 | 호이스팅 + 기존 위치에 props 주입 |
| 파일 간 이동 | 공유 모듈로 이동 + import 추가 |
| 구조적 역전 | 중첩 구조 변경 (AST 조작) |
| 조건부 렌더링 | 조건 표현식 전체를 원자적 단위로 |
| 동적 리스트 | map 표현식 전체를 원자적 단위로 |
| Context 의존성 | Provider 호이스팅 또는 props 변환 |
| Suspense/Lazy | Suspense 경계 자동 생성/이동 |
| Compound Components | 전체를 원자적 단위로 이동 |
| Ref 전달 | ref 호이스팅 + props 주입 |

### 10.2 해결 불가능한 케이스

| 케이스 | 이유 |
|--------|------|
| eval() | 임의 코드 실행 - 정적 분석 원천 불가 |

※ eval() 외 모든 케이스는 의존성 분석 + 호이스팅으로 해결 가능

**동적 import / 런타임 선택도 해결 가능:**
```tsx
// import(variable) → 변수 의존성으로 처리
const path = getPath();
const Component = lazy(() => import(path));
// → path와 lazy() 전체를 함께 호이스팅

// components[type] → 동일하게 처리
const type = getType();
const Component = components[type];
// → type과 선택 로직 전체를 함께 호이스팅
```

---

## 11. 최적화: 의존성 싱킹 (Dependency Sinking)

### 11.1 문제: 호이스팅 누적

```tsx
// 여러 번 이동 후 - 모든 의존성이 최상위로 몰림
function App() {
  const [a, setA] = useState(0);   // 원래 ComponentA 것
  const [b, setB] = useState('');  // 원래 ComponentB 것
  const [c, setC] = useState([]);  // 원래 ComponentC 것
  const helper = () => { ... };    // 원래 ComponentD 것

  return (
    <ComponentA a={a} setA={setA}>
      <ComponentB b={b} setB={setB}>
        <ComponentC c={c} setC={setC}>
          <ComponentD helper={helper} />
        </ComponentC>
      </ComponentB>
    </ComponentA>
  );
}
```

### 11.2 해결: 의존성 싱킹 (Sinking)

**호이스팅의 역연산** - 의존성을 실제로 필요한 최하위 스코프로 내림

```
Algorithm: SinkDependencies(ast)

FOR EACH dependency d IN root_scope:
  consumers ← find_all_consumers(d)
  lca ← lowest_common_ancestor(consumers)

  IF lca ≠ current_scope(d):
    move_dependency(d, lca)
    update_references(d)
```

### 11.3 싱킹 예시

```tsx
// Before: 불필요하게 상위에 있는 의존성
function App() {
  const [count, setCount] = useState(0);  // Child에서만 사용

  return (
    <Parent>
      <Child count={count} setCount={setCount} />
    </Parent>
  );
}

// After: 싱킹 최적화 적용
function App() {
  return (
    <Parent>
      <Child />  // props 제거
    </Parent>
  );
}

function Child() {
  const [count, setCount] = useState(0);  // 원래 위치로 복원
  return <div>{count}</div>;
}
```

### 11.4 싱킹 규칙

```
싱킹 가능 조건:
├── 의존성이 단일 서브트리에서만 사용됨
├── Hook 규칙을 위반하지 않음 (조건부 X)
└── 새 위치가 유효한 스코프임

싱킹 우선순위:
1. 단일 컴포넌트만 사용 → 해당 컴포넌트로 이동
2. 형제들이 공유 → 부모에 유지
3. 부모-자식이 공유 → 부모에 유지
```

### 11.5 최적화 파이프라인

```
regraft() 내부 흐름:
1. canMove() → 이동 가능 여부 확인
2. move() → 이동 + 필요시 호이스팅
3. analyze() → 의존성 사용처 분석
4. optimize() → 싱킹 (optimize: true일 때)
5. generate() → 최적화된 코드 생성

사용:
// 기본 (optimize: true)
regraft(files, from, to, mode)

// 최적화 없이
regraft(files, from, to, mode, { optimize: false })

// 분석만 (코드 변환 없음)
regraft(files, from, to, mode, { dryRun: true })
```

---

## 12. 결론

### 12.1 구현 가능성

| 항목 | 평가 | 비고 |
|------|------|------|
| 기본 이동 | ✅ 가능 | AST 조작 |
| 의존성 분석 | ✅ 가능 | 스코프 분석 |
| 조건부/동적 | ✅ 가능 | 원자적 단위 전략 |
| 파일 간 이동 | ✅ 가능 | 공유 모듈 + import |
| 검증 API | ✅ 가능 | 사전 분석 |

### 12.2 핵심 인사이트

```
Regrafter의 본질:
├── AST 변환 + 의존성 그래프 분석
├── 스코프 기반 이동 가능성 판단
├── Hook 규칙 준수 자동화
└── 실패 케이스 사전 검증

난이도:
├── 단순 이동: 쉬움
├── 의존성 호이스팅: 중간
├── 조건부/동적: 쉬움 (원자적 단위)
└── 파일 간 이동: 중간 (공유 모듈 생성)
```

### 12.3 권장 구현 순서

1. **Phase 1**: 단일 파일 내 형제 이동 (Before/After)
2. **Phase 2**: 단일 파일 내 부모-자식 이동 (Inside)
3. **Phase 3**: 의존성 자동 호이스팅
4. **Phase 4**: 파일 간 이동
5. **Phase 5**: 의존성 싱킹 최적화
6. **Phase 6**: canRegraft 상세 분석 API

---

*문서 버전: 3.0*
*분석 일자: 2025-12-15*
*변경 이력:*
- *v1.x - 런타임 이동 분석 (deprecated)*
- *v2.0 - Slot 기반 정적 변환 (deprecated)*
- *v3.0 - 프로그래매틱 AST 이동 + 의존성 분석*
