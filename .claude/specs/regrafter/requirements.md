# Regrafter 요구사항 문서

## 소개

Regrafter는 프로그래매틱 AST 변환을 통해 React 엘리먼트를 재배치하는 라이브러리입니다. 개발자가 JSX 엘리먼트를 안전하게 이동할 수 있도록 의존성 분석, 자동 호이스팅, 파일 간 이동, 그리고 최적화 기능을 제공합니다.

### 핵심 가치

- **안전성**: 이동 후 코드가 항상 정상 빌드되어야 함
- **예측 가능성**: 이동 불가능한 경우 사전에 검증 가능
- **자동화**: 의존성 처리를 자동으로 수행
- **최적화**: 호이스팅된 의존성을 최적 위치로 재배치

---

## 요구사항

### 1. 통합 API

**User Story:** 개발자로서, 단일 API로 엘리먼트 이동의 검증, 분석, 실행, 최적화를 한 번에 수행하고 싶습니다. 이를 통해 복잡한 단계별 호출 없이 간편하게 리팩토링할 수 있습니다.

#### Acceptance Criteria

1. WHEN `regraft(files, from, to, mode)` 함수가 호출되면 THEN 시스템 SHALL 이동 가능 여부 검증(canMove), 이동 실행(move), 의존성 분석(analyze), 최적화(optimize)를 순차적으로 수행한다.

2. WHEN 유효한 파일 경로 배열, from 선택자, to 선택자, 이동 모드가 제공되면 THEN 시스템 SHALL Result 객체를 반환한다. 이 객체는 success(boolean), codes(Code[]), analysis(MoveAnalysis) 필드를 포함한다.

3. IF options.dryRun이 true이면 THEN 시스템 SHALL 실제 코드 변환 없이 분석 결과만 반환한다.

4. IF options.optimize가 false이면 THEN 시스템 SHALL 싱킹 최적화 단계를 건너뛴다.

5. IF options.optimize가 명시되지 않으면 THEN 시스템 SHALL 기본값 true로 싱킹 최적화를 수행한다.

6. WHEN 이동이 성공하면 THEN 시스템 SHALL codes 배열에 변경된 모든 파일의 내용을 포함하고, 각 Code 객체의 changed 필드로 변경 여부를 표시한다.

---

### 2. 이동 모드

**User Story:** 개발자로서, 엘리먼트를 목적지의 자식, 이전 형제, 또는 다음 형제로 이동하고 싶습니다. 이를 통해 다양한 구조 변경 요구사항을 충족할 수 있습니다.

#### Acceptance Criteria

1. WHEN Move.Inside 모드로 이동하면 THEN 시스템 SHALL 소스 엘리먼트를 목적지 엘리먼트의 자식으로 배치한다.

2. WHEN Move.Before 모드로 이동하면 THEN 시스템 SHALL 소스 엘리먼트를 목적지 엘리먼트의 이전 형제로 배치한다.

3. WHEN Move.After 모드로 이동하면 THEN 시스템 SHALL 소스 엘리먼트를 목적지 엘리먼트의 다음 형제로 배치한다.

4. WHEN 이동이 완료되면 THEN 시스템 SHALL 원본 위치에서 소스 엘리먼트를 제거한다.

5. IF 소스와 목적지가 동일한 위치이면 THEN 시스템 SHALL 변경 없이 성공을 반환한다.

---

### 3. 선택자 (Selector)

**User Story:** 개발자로서, 파일 위치와 라인/컬럼 또는 AST 경로로 엘리먼트를 지정하고 싶습니다. 이를 통해 IDE 통합 및 프로그래매틱 사용 모두 지원할 수 있습니다.

#### Acceptance Criteria

1. WHEN 선택자가 `{ file, line, column }` 형식으로 제공되면 THEN 시스템 SHALL 해당 위치의 가장 가까운 JSX 엘리먼트를 선택한다.

2. WHEN 선택자가 `{ file, path }` 형식으로 제공되면 THEN 시스템 SHALL 해당 AST 경로의 노드를 선택한다.

3. IF 선택자가 유효한 JSX 엘리먼트를 가리키지 않으면 THEN 시스템 SHALL success: false와 함께 명확한 오류 메시지를 반환한다.

4. IF 선택자의 파일 경로가 files 배열에 포함되지 않으면 THEN 시스템 SHALL 오류를 반환한다.

---

### 4. 의존성 분석

**User Story:** 개발자로서, 이동할 엘리먼트가 참조하는 모든 의존성을 자동으로 분석하고 싶습니다. 이를 통해 수동 의존성 추적 없이 안전하게 이동할 수 있습니다.

#### Acceptance Criteria

1. WHEN 엘리먼트 이동을 분석하면 THEN 시스템 SHALL Hook 의존성(useState, useEffect, useContext 등)을 식별한다.

2. WHEN 엘리먼트 이동을 분석하면 THEN 시스템 SHALL Variable 의존성(const, let 선언)을 식별한다.

3. WHEN 엘리먼트 이동을 분석하면 THEN 시스템 SHALL Import 의존성(외부 모듈 참조)을 식별한다.

4. WHEN 엘리먼트 이동을 분석하면 THEN 시스템 SHALL Prop 의존성(상위에서 전달받은 값)을 식별한다.

5. WHEN 분석이 완료되면 THEN 시스템 SHALL MoveAnalysis 객체에 모든 dependencies와 hoistedDeps 목록을 포함한다.

6. IF 의존성이 eval() 또는 동적 코드 실행을 포함하면 THEN 시스템 SHALL 해당 의존성을 분석 불가능으로 표시한다.

---

### 5. 의존성 자동 호이스팅

**User Story:** 개발자로서, 엘리먼트 이동 시 필요한 의존성이 자동으로 적절한 위치로 호이스팅되길 원합니다. 이를 통해 수동 리팩토링 없이 코드가 정상 동작하게 됩니다.

#### Acceptance Criteria

1. WHEN Hook 의존성이 새 스코프에서 접근 불가능하면 THEN 시스템 SHALL 해당 Hook을 공통 조상 컴포넌트의 최상위로 호이스팅한다.

2. WHEN Variable 의존성이 새 스코프에서 접근 불가능하면 THEN 시스템 SHALL 해당 변수를 호이스팅하거나 props로 전달한다.

3. WHEN Import 의존성이 대상 파일에 없으면 THEN 시스템 SHALL 대상 파일에 import 문을 자동 추가한다.

4. WHEN Prop 의존성이 새 스코프에서 접근 불가능하면 THEN 시스템 SHALL 조상 컴포넌트를 통해 props를 전달(thread)한다.

5. IF Hook 호이스팅 대상 위치가 조건부 또는 반복문 내부이면 THEN 시스템 SHALL Hook 규칙을 준수하는 유효한 상위 위치로 호이스팅한다.

6. WHEN 의존성이 호이스팅된 후에도 원본 위치에서 해당 의존성을 사용하면 THEN 시스템 SHALL 원본 위치에 props를 통해 주입한다.

---

### 6. 이동 불가능 조건 검증 (canMove API)

**User Story:** 개발자로서, 실제 이동 전에 이동 가능 여부를 사전에 검증하고 싶습니다. 이를 통해 불필요한 연산을 피하고 사용자에게 즉각적인 피드백을 제공할 수 있습니다.

#### Acceptance Criteria

1. WHEN `regraft.canMove(files, from, to, mode)` 함수가 호출되면 THEN 시스템 SHALL 이동 가능 여부를 boolean으로 반환한다.

2. IF 의존성에 eval() 또는 정적 분석이 불가능한 동적 코드가 포함되면 THEN 시스템 SHALL false를 반환한다.

3. IF 이동이 불가능하면 THEN MoveAnalysis.reason SHALL 불가능한 이유를 명확히 설명한다.

4. WHEN 조건부 렌더링 표현식(condition && element)을 이동하면 THEN 시스템 SHALL 조건 표현식 전체를 원자적 단위로 취급하여 이동 가능으로 판단한다.

5. WHEN 동적 리스트(map/filter/reduce)를 이동하면 THEN 시스템 SHALL 표현식 전체를 원자적 단위로 취급하여 이동 가능으로 판단한다.

6. WHEN Context 의존성이 있는 엘리먼트를 Provider 외부로 이동하면 THEN 시스템 SHALL Provider 호이스팅 또는 props 변환으로 이동 가능으로 판단한다.

7. WHEN Suspense 경계 내의 Lazy 컴포넌트를 이동하면 THEN 시스템 SHALL Suspense 경계 자동 생성으로 이동 가능으로 판단한다.

8. WHEN Compound Components(예: Tabs.Tab)를 부모 외부로 이동하면 THEN 시스템 SHALL 전체를 원자적 단위로 취급하여 이동 가능으로 판단한다.

9. WHEN ref를 사용하는 엘리먼트를 이동하면 THEN 시스템 SHALL ref 호이스팅과 props 주입으로 이동 가능으로 판단한다.

---

### 7. 파일 간 이동

**User Story:** 개발자로서, 엘리먼트를 다른 파일로 이동하고 싶습니다. 이를 통해 컴포넌트 구조를 재구성하고 코드를 모듈화할 수 있습니다.

#### Acceptance Criteria

1. WHEN from과 to의 파일이 다르면 THEN 시스템 SHALL 파일 간 이동을 수행한다.

2. IF 의존성이 원본 파일에서만 정의되고 export되지 않았으면 THEN 시스템 SHALL 공유 모듈을 생성하고 의존성을 이동시킨다.

3. WHEN 공유 모듈이 생성되면 THEN 시스템 SHALL 원본 파일과 대상 파일 모두에 필요한 import 문을 추가한다.

4. IF 의존성이 원본 파일의 다른 코드에서도 사용 중이면 THEN 시스템 SHALL 원본 파일에서의 참조를 import로 대체한다.

5. WHEN 파일 간 이동이 완료되면 THEN codes 배열 SHALL 모든 변경된 파일(원본, 대상, 공유 모듈)의 내용을 포함한다.

6. IF 대상 파일이 files 배열에 없으면 THEN 시스템 SHALL 새 파일 생성 여부를 codes에 반영한다.

---

### 8. 의존성 싱킹 최적화

**User Story:** 개발자로서, 여러 번의 이동으로 상위에 누적된 의존성을 실제 사용 위치로 최적화하고 싶습니다. 이를 통해 불필요한 props 전달을 줄이고 코드 품질을 개선할 수 있습니다.

#### Acceptance Criteria

1. WHEN `regraft.optimize(files)` 함수가 호출되면 THEN 시스템 SHALL 모든 호이스팅된 의존성을 분석한다.

2. IF 의존성이 단일 서브트리에서만 사용되면 THEN 시스템 SHALL 해당 의존성을 사용 위치의 최하위 공통 조상으로 이동(싱킹)한다.

3. IF 형제 컴포넌트들이 의존성을 공유하면 THEN 시스템 SHALL 의존성을 부모에 유지한다.

4. IF 부모-자식이 의존성을 공유하면 THEN 시스템 SHALL 의존성을 부모에 유지한다.

5. WHEN 의존성이 싱킹되면 THEN 시스템 SHALL 불필요해진 props 전달을 제거한다.

6. IF Hook 싱킹 대상 위치가 조건부 또는 반복문 내부이면 THEN 시스템 SHALL 해당 Hook을 싱킹하지 않는다.

7. WHEN 통합 API에서 optimize가 true이면 THEN 시스템 SHALL move 완료 후 자동으로 싱킹 최적화를 수행한다.

---

### 9. 개별 API

**User Story:** 개발자로서, 세부 제어가 필요할 때 개별 기능을 분리하여 호출하고 싶습니다. 이를 통해 커스텀 워크플로우를 구성할 수 있습니다.

#### Acceptance Criteria

1. WHEN `regraft.canMove(files, from, to, mode)` 함수가 호출되면 THEN 시스템 SHALL 이동 가능 여부만 boolean으로 반환한다.

2. WHEN `regraft.move(files, from, to, mode)` 함수가 호출되면 THEN 시스템 SHALL 검증 및 최적화 없이 이동만 수행하고 Code[] 배열을 반환한다.

3. WHEN `regraft.analyze(files, from, to, mode)` 함수가 호출되면 THEN 시스템 SHALL 코드 변환 없이 MoveAnalysis 객체만 반환한다.

4. WHEN `regraft.optimize(files)` 함수가 호출되면 THEN 시스템 SHALL 파일의 모든 의존성에 대해 싱킹 최적화를 수행하고 Code[] 배열을 반환한다.

---

### 10. 코드 생성

**User Story:** 개발자로서, 변환된 코드가 원본의 형식(주석, 공백 등)을 최대한 유지하길 원합니다. 이를 통해 코드 리뷰 시 실제 변경 사항만 확인할 수 있습니다.

#### Acceptance Criteria

1. IF options.preserveComments가 true이면 THEN 시스템 SHALL 원본 코드의 주석을 보존한다.

2. IF options.preserveComments가 명시되지 않으면 THEN 시스템 SHALL 기본값 true로 주석을 보존한다.

3. IF options.formatOutput이 true이면 THEN 시스템 SHALL 출력 코드를 포맷팅한다.

4. IF options.formatOutput이 명시되지 않으면 THEN 시스템 SHALL 기본값 false로 원본 형식을 유지한다.

5. WHEN 코드를 생성하면 THEN 시스템 SHALL 이동된 엘리먼트의 들여쓰기를 새 위치에 맞게 조정한다.

---

### 11. 오류 처리

**User Story:** 개발자로서, 이동 실패 시 명확한 오류 정보와 가능한 해결책을 받고 싶습니다. 이를 통해 문제를 빠르게 진단하고 해결할 수 있습니다.

#### Acceptance Criteria

1. IF 파일 파싱에 실패하면 THEN 시스템 SHALL 파싱 오류 위치와 메시지를 포함한 Result를 반환한다.

2. IF 선택자가 유효한 엘리먼트를 찾지 못하면 THEN 시스템 SHALL 선택자 정보와 함께 오류를 반환한다.

3. IF 이동이 불가능하면 THEN MoveAnalysis.suggestedFixes SHALL 가능한 해결 방법을 제안한다.

4. WHEN 오류가 발생하면 THEN Result.success SHALL false이고 analysis.reason에 상세 정보가 포함된다.

5. IF 파일 간 이동 시 순환 의존성이 발생하면 THEN 시스템 SHALL 순환 의존성 경로를 포함한 오류를 반환한다.

---

### 12. 성능 요구사항 (비기능적)

**User Story:** 개발자로서, 대규모 코드베이스에서도 빠른 응답을 받고 싶습니다. 이를 통해 IDE 통합 시 실시간 피드백이 가능합니다.

#### Acceptance Criteria

1. WHEN 단일 파일(1000줄 이하)에서 이동을 수행하면 THEN 시스템 SHALL 100ms 이내에 결과를 반환한다.

2. WHEN 다중 파일(10개 이하, 각 1000줄 이하)에서 이동을 수행하면 THEN 시스템 SHALL 500ms 이내에 결과를 반환한다.

3. WHEN canMove만 호출하면 THEN 시스템 SHALL 전체 이동 연산의 20% 이내 시간으로 완료한다.

4. WHILE 파일을 파싱하면 THEN 시스템 SHALL 메모리 사용량을 파일 크기의 10배 이내로 유지한다.

---

### 13. 타입 안전성 (비기능적)

**User Story:** 개발자로서, TypeScript 프로젝트에서 완전한 타입 지원을 받고 싶습니다. 이를 통해 컴파일 타임에 오류를 발견할 수 있습니다.

#### Acceptance Criteria

1. WHEN 라이브러리를 import하면 THEN 시스템 SHALL 모든 공개 API에 대한 TypeScript 타입 정의를 제공한다.

2. WHEN Move enum을 사용하면 THEN 시스템 SHALL Inside, Before, After 값에 대한 타입 체크를 수행한다.

3. WHEN Selector 타입을 사용하면 THEN 시스템 SHALL line/column 형식과 path 형식을 유니온 타입으로 지원한다.

4. WHEN Options를 제공하면 THEN 시스템 SHALL 모든 옵션 필드가 선택적(optional)임을 타입으로 표현한다.

---

## 부록: 타입 정의

```typescript
import { regraft, canMove, move, analyze, optimize, Move } from 'regrafter';

// 통합 API
regraft(
  files: string[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result;

// 개별 API
canMove(files: string[], from: Selector, to: Selector, mode: Move): boolean;
move(files: string[], from: Selector, to: Selector, mode: Move): Code[];
analyze(files: string[], from: Selector, to: Selector, mode: Move): MoveAnalysis;
optimize(files: string[]): Code[];

enum Move {
  Inside = "inside",
  Before = "before",
  After = "after"
}

type Selector =
  | { file: string; line: number; column: number }
  | { file: string; path: string };

interface Options {
  optimize?: boolean;        // default: true
  dryRun?: boolean;          // default: false
  preserveComments?: boolean; // default: true
  formatOutput?: boolean;    // default: false
}

interface Result {
  success: boolean;
  codes: Code[];
  analysis: MoveAnalysis;
}

interface Code {
  file: string;
  content: string;
  changed: boolean;
}

interface MoveAnalysis {
  canMove: boolean;
  reason?: string;
  dependencies: Dependency[];
  hoistedDeps: Dependency[];
  suggestedFixes?: SuggestedFix[];
}

interface Dependency {
  symbol: string;
  origin: string;
  type: 'Hook' | 'Variable' | 'Import' | 'Prop';
  scope: string;
}

interface SuggestedFix {
  description: string;
  action: string;
}
```

---

*문서 버전: 2.0*
*작성일: 2025-12-15*
