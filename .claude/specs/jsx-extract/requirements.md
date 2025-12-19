# Requirements Document - JSX Extract

## Introduction

Extract 기능은 inline 함수의 반대 기능으로, 선택된 JSX 엘리먼트들을 그룹화하여 새로운 React 컴포넌트로 추출하는 리팩토링 도구입니다. 이 기능은 코드 재사용성을 높이고 컴포넌트 구조를 개선하기 위해 기존 JSX 코드의 일부를 독립적인 컴포넌트로 분리합니다.

핵심 기능:
- JSX 노드 선택 및 그룹화 (Element, Text, Expression)
- 의존성 자동 분석 및 처리
- 같은 파일 내 추출 및 다른 파일로의 추출 지원
- TypeScript 타입 자동 생성
- Hook 및 상태 관리 자동 처리

## Requirements

### Requirement 1: JSX 노드 선택 및 추출

**User Story:** 개발자로서, PositionSelector 또는 PathSelector를 사용하여 단일 또는 여러 JSX 노드를 선택하고 새로운 컴포넌트로 추출하고 싶습니다. 이를 통해 복잡한 컴포넌트를 더 작고 관리 가능한 단위로 분리할 수 있습니다.

#### Acceptance Criteria

1. WHEN 개발자가 PositionSelector로 JSX 노드의 시작과 끝 위치를 지정하면 THEN 시스템은 SHALL 해당 범위의 모든 JSX 노드를 선택한다
2. WHEN 개발자가 PathSelector로 JSX 노드의 경로를 지정하면 THEN 시스템은 SHALL 해당 경로에 위치한 JSX 노드를 선택한다
3. WHEN 개발자가 여러 개의 연속된 JSX 노드를 선택하면 THEN 시스템은 SHALL 모든 선택된 노드를 단일 그룹으로 처리한다
4. WHEN 선택된 JSX 노드가 JSXElement, JSXText, JSXExpressionContainer 타입 중 하나라면 THEN 시스템은 SHALL 해당 노드를 추출 가능한 노드로 인식한다
5. IF 선택된 범위가 유효하지 않거나 추출 불가능한 노드를 포함하면 THEN 시스템은 SHALL 명확한 에러 메시지를 반환한다

### Requirement 2: 의존성 자동 분석

**User Story:** 개발자로서, 추출할 JSX 코드가 의존하는 변수, 함수, Hook 등을 자동으로 분석하고 처리하고 싶습니다. 이를 통해 수동으로 의존성을 파악하고 props로 전달하는 번거로움을 줄일 수 있습니다.

#### Acceptance Criteria

1. WHEN 선택된 JSX 노드가 외부 변수를 참조하면 THEN 시스템은 SHALL 해당 변수를 식별하고 props로 전달할 목록에 추가한다
2. WHEN 선택된 JSX 노드가 외부 함수를 호출하면 THEN 시스ystem은 SHALL 해당 함수를 식별하고 props로 전달할 목록에 추가한다
3. WHEN 선택된 JSX 노드가 React Hook을 사용하면 THEN 시스템은 SHALL 해당 Hook을 새 컴포넌트로 이동할지 또는 props로 전달할지 결정한다
4. IF 의존성이 상태 변수(state)이면 THEN 시스템은 SHALL 상태와 상태 설정 함수를 모두 props로 전달한다
5. WHEN 의존성 분석이 완료되면 THEN 시스템은 SHALL props 인터페이스를 생성한다
6. IF 순환 의존성이 감지되면 THEN 시스템은 SHALL 추출을 중단하고 경고 메시지를 반환한다

### Requirement 3: 같은 파일 내 컴포넌트 추출

**User Story:** 개발자로서, 선택된 JSX 코드를 같은 파일 내에서 새로운 컴포넌트로 추출하고 싶습니다. 이를 통해 파일 구조를 유지하면서 컴포넌트를 분리할 수 있습니다.

#### Acceptance Criteria

1. WHEN 개발자가 같은 파일 내 추출을 요청하면 THEN 시스템은 SHALL 원본 컴포넌트와 동일한 파일에 새 컴포넌트를 생성한다
2. WHEN 새 컴포넌트가 생성되면 THEN 시스템은 SHALL 원본 컴포넌트 정의 앞에 새 컴포넌트를 배치한다
3. WHEN 새 컴포넌트가 생성되면 THEN 시스템은 SHALL 원본 위치의 JSX 코드를 새 컴포넌트 호출로 교체한다
4. IF 원본 파일에 TypeScript가 사용 중이면 THEN 시스템은 SHALL 새 컴포넌트의 Props 타입을 생성하고 타입을 지정한다
5. WHEN 컴포넌트 이름이 지정되지 않으면 THEN 시스템은 SHALL 의미 있는 기본 이름을 생성한다 (예: ExtractedComponent)
6. WHEN 추출이 완료되면 THEN 시스템은 SHALL 모든 필요한 props를 새 컴포넌트 호출에 전달한다

### Requirement 4: 다른 파일로 컴포넌트 추출

**User Story:** 개발자로서, 선택된 JSX 코드를 새로운 파일로 추출하고 싶습니다. 이를 통해 컴포넌트를 물리적으로 분리하고 재사용성을 높일 수 있습니다.

#### Acceptance Criteria

1. WHEN 개발자가 다른 파일로 추출을 요청하고 대상 파일 경로를 제공하면 THEN 시스템은 SHALL 지정된 경로에 새 파일을 생성한다
2. IF 대상 파일이 이미 존재하면 THEN 시스템은 SHALL 기존 파일에 새 컴포넌트를 추가한다
3. WHEN 새 파일이 생성되면 THEN 시스템은 SHALL 필요한 모든 import 문을 추가한다
4. WHEN 새 파일이 생성되면 THEN 시스템은 SHALL 컴포넌트와 Props 타입을 export한다
5. WHEN 원본 파일이 업데이트되면 THEN 시스템은 SHALL 새 컴포넌트에 대한 import 문을 추가한다
6. IF 추출된 컴포넌트가 React나 다른 라이브러리에 의존하면 THEN 시스템은 SHALL 해당 import 문을 새 파일에 추가한다
7. WHEN 파일 경로가 상대 경로로 제공되면 THEN 시스템은 SHALL 원본 파일을 기준으로 경로를 해석한다

### Requirement 5: TypeScript 타입 처리

**User Story:** 개발자로서, 추출된 컴포넌트의 TypeScript 타입이 자동으로 생성되고 올바르게 적용되기를 원합니다. 이를 통해 타입 안정성을 유지하면서 리팩토링할 수 있습니다.

#### Acceptance Criteria

1. WHEN 원본 파일이 TypeScript를 사용하면 THEN 시스템은 SHALL Props 인터페이스를 생성한다
2. WHEN Props 인터페이스가 생성되면 THEN 시스템은 SHALL 모든 prop의 타입을 정확하게 추론한다
3. IF prop이 기본 타입(string, number, boolean 등)이면 THEN 시스템은 SHALL 해당 타입을 직접 사용한다
4. IF prop이 복잡한 타입이나 커스텀 타입이면 THEN 시스템은 SHALL 해당 타입을 import하거나 인라인으로 정의한다
5. WHEN 컴포넌트가 제네릭 타입을 사용하면 THEN 시스템은 SHALL 제네릭 파라미터를 올바르게 전달한다
6. IF 타입 추론이 불가능하면 THEN 시스템은 SHALL 'any' 타입 대신 명시적인 타입 주석 요청 메시지를 반환한다

### Requirement 6: React Hook 처리

**User Story:** 개발자로서, 추출된 JSX 코드가 사용하는 Hook들이 올바르게 처리되기를 원합니다. 이를 통해 Hook의 규칙을 준수하면서 컴포넌트를 추출할 수 있습니다.

#### Acceptance Criteria

1. WHEN 선택된 JSX 코드가 useState를 사용하면 THEN 시스템은 SHALL 상태와 setter를 props로 전달한다
2. WHEN 선택된 JSX 코드가 useEffect를 사용하면 THEN 시스템은 SHALL useEffect를 새 컴포넌트로 이동한다
3. WHEN 선택된 JSX 코드가 useCallback 또는 useMemo를 사용하면 THEN 시스템은 SHALL 해당 Hook을 새 컴포넌트로 이동한다
4. IF Hook이 외부 의존성을 참조하면 THEN 시스템은 SHALL 해당 의존성을 props로 전달한다
5. WHEN Custom Hook이 사용되면 THEN 시스템은 SHALL Custom Hook을 새 컴포넌트에서 호출하도록 이동한다
6. IF Hook의 의존성 배열에 외부 변수가 포함되면 THEN 시스템은 SHALL 해당 변수를 props로 전달하고 의존성 배열을 업데이트한다

### Requirement 7: 컴포넌트 이름 지정 및 충돌 방지

**User Story:** 개발자로서, 추출된 컴포넌트의 이름을 지정하고 이름 충돌을 방지하고 싶습니다. 이를 통해 명확하고 유지보수 가능한 코드를 작성할 수 있습니다.

#### Acceptance Criteria

1. WHEN 개발자가 컴포넌트 이름을 제공하면 THEN 시스템은 SHALL 해당 이름을 사용한다
2. IF 컴포넌트 이름이 제공되지 않으면 THEN 시스템은 SHALL 의미 있는 기본 이름을 생성한다
3. WHEN 컴포넌트 이름이 결정되면 THEN 시스템은 SHALL PascalCase 형식을 따르는지 확인한다
4. IF 동일한 이름의 컴포넌트가 이미 존재하면 THEN 시스템은 SHALL 숫자 접미사를 추가하여 고유한 이름을 생성한다 (예: MyComponent2)
5. IF 컴포넌트 이름이 React 규칙에 위배되면 THEN 시스템은 SHALL 에러 메시지를 반환한다
6. WHEN 다른 파일로 추출 시 이름 충돌이 발생하면 THEN 시스템은 SHALL import 이름을 변경하여 충돌을 해결한다

### Requirement 8: 코드 포맷팅 및 스타일 유지

**User Story:** 개발자로서, 추출된 컴포넌트가 기존 코드 스타일을 따르고 올바르게 포맷팅되기를 원합니다. 이를 통해 일관된 코드베이스를 유지할 수 있습니다.

#### Acceptance Criteria

1. WHEN 새 컴포넌트가 생성되면 THEN 시스템은 SHALL 원본 파일의 들여쓰기 스타일을 유지한다
2. WHEN 새 컴포넌트가 생성되면 THEN 시스템은 SHALL 원본 파일의 따옴표 스타일(single/double)을 유지한다
3. WHEN JSX 코드가 추출되면 THEN 시스템은 SHALL 적절한 들여쓰기를 적용한다
4. IF 원본 코드에 주석이 포함되면 THEN 시스템은 SHALL 주석을 새 컴포넌트로 함께 이동한다
5. WHEN import 문이 추가되면 THEN 시스템은 SHALL 기존 import 문의 정렬 방식을 따른다
6. WHEN 코드 생성이 완료되면 THEN 시스템은 SHALL Prettier나 ESLint 같은 포맷터와 호환되는 코드를 생성한다

### Requirement 9: 에러 처리 및 검증

**User Story:** 개발자로서, 추출 작업이 안전하게 수행되고 문제 발생 시 명확한 피드백을 받고 싶습니다. 이를 통해 코드 손상을 방지하고 문제를 빠르게 해결할 수 있습니다.

#### Acceptance Criteria

1. WHEN 선택 범위가 유효하지 않으면 THEN 시스템은 SHALL 구체적인 에러 메시지를 반환한다
2. IF JSX 구조가 손상될 가능성이 있으면 THEN 시스템은 SHALL 추출을 중단하고 경고한다
3. WHEN 파일 쓰기에 실패하면 THEN 시스템은 SHALL 에러를 반환하고 원본 파일을 수정하지 않는다
4. IF 추출 후 원본 컴포넌트가 유효하지 않은 JSX를 생성하면 THEN 시스템은 SHALL 변경사항을 롤백한다
5. WHEN 의존성 분석에 실패하면 THEN 시스템은 SHALL 실패 원인을 설명하는 에러 메시지를 반환한다
6. IF 타입 체크 에러가 발생하면 THEN 시스템은 SHALL 타입 에러 위치와 원인을 보고한다
7. WHEN 추출 작업이 완료되면 THEN 시스템은 SHALL 생성된 파일 경로와 변경 사항 요약을 반환한다

### Requirement 10: API 인터페이스 설계

**User Story:** 개발자로서, 직관적이고 유연한 API를 통해 extract 기능을 사용하고 싶습니다. 이를 통해 다양한 사용 사례에 맞게 기능을 활용할 수 있습니다.

#### Acceptance Criteria

1. WHEN extract 함수가 호출되면 THEN 시스템은 SHALL 소스 파일 경로를 필수 파라미터로 요구한다
2. WHEN extract 함수가 호출되면 THEN 시스템은 SHALL selector(PositionSelector 또는 PathSelector)를 필수 파라미터로 요구한다
3. IF 새 컴포넌트 이름이 제공되면 THEN 시스템은 SHALL 해당 이름을 사용한다
4. IF 대상 파일 경로가 제공되면 THEN 시스템은 SHALL 다른 파일로 추출을 수행한다
5. IF 대상 파일 경로가 제공되지 않으면 THEN 시스템은 SHALL 같은 파일 내 추출을 수행한다
6. WHEN 옵션 파라미터가 제공되면 THEN 시스템은 SHALL 타입 생성 활성화/비활성화, 포맷팅 옵션 등을 지원한다
7. WHEN 함수가 성공하면 THEN 시스템은 SHALL 생성된 컴포넌트 정보와 수정된 파일 목록을 반환한다
8. IF 함수가 실패하면 THEN 시스템은 SHALL 구체적인 에러 객체를 throw한다

### Requirement 11: 성능 및 확장성

**User Story:** 개발자로서, 대규모 컴포넌트와 파일에서도 extract 기능이 효율적으로 작동하기를 원합니다. 이를 통해 프로젝트 규모에 관계없이 기능을 사용할 수 있습니다.

#### Acceptance Criteria

1. WHEN 큰 컴포넌트(1000줄 이상)에서 추출이 수행되면 THEN 시스템은 SHALL 5초 이내에 완료한다
2. WHEN 복잡한 의존성 그래프를 분석하면 THEN 시스템은 SHALL 메모이제이션을 사용하여 중복 분석을 방지한다
3. IF 프로젝트에 많은 파일이 있으면 THEN 시스템은 SHALL 필요한 파일만 파싱한다
4. WHEN AST 변환이 수행되면 THEN 시스템은 SHALL 메모리 효율적인 방식으로 작업한다
5. IF 동일한 소스 파일에서 여러 번 추출이 수행되면 THEN 시스템은 SHALL AST를 재사용한다

### Requirement 12: 테스트 가능성

**User Story:** 개발자로서, extract 기능이 철저하게 테스트되고 신뢰할 수 있기를 원합니다. 이를 통해 안정적인 리팩토링 도구를 사용할 수 있습니다.

#### Acceptance Criteria

1. WHEN 단위 테스트가 작성되면 THEN 시스템은 SHALL 각 주요 기능(노드 선택, 의존성 분석, 코드 생성)을 독립적으로 테스트할 수 있도록 한다
2. WHEN 통합 테스트가 작성되면 THEN 시스템은 SHALL 실제 파일 시스템과의 상호작용을 테스트할 수 있도록 한다
3. IF 에지 케이스가 발견되면 THEN 시스템은 SHALL 해당 케이스에 대한 테스트를 추가할 수 있도록 한다
4. WHEN 테스트가 실행되면 THEN 시스템은 SHALL 예상 출력과 실제 출력을 비교할 수 있는 스냅샷 테스트를 지원한다
5. IF 리그레션이 발생하면 THEN 시스템은 SHALL 해당 버그를 재현하는 테스트를 작성할 수 있도록 한다
