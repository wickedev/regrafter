# Extract 요구사항 문서

## 소개

Extract는 inline 함수의 반대 기능으로, 선택된 JSX 엘리먼트들을 그룹화하여 새로운 React 컴포넌트로 추출하는 기능입니다. 의존성 분석을 통해 관련 코드들을 자동으로 컴포넌트로 옮기거나 props로 전달하여 안전한 컴포넌트 추출을 보장합니다.

### 핵심 가치

- **자동화**: 의존성을 자동으로 분석하고 처리
- **안전성**: 추출 후 코드가 항상 정상 빌드되어야 함
- **유연성**: 같은 파일 내 추출과 다른 파일로의 추출 모두 지원
- **정확성**: 필요한 의존성만 정확하게 식별하고 처리

---

## 요구사항

### 1. 기본 컴포넌트 추출

**User Story:** 개발자로서, 선택한 JSX 노드들(엘리먼트, 텍스트, 표현식)을 새로운 컴포넌트로 추출하고 싶습니다. 이를 통해 코드를 재사용 가능한 단위로 모듈화할 수 있습니다.

#### Acceptance Criteria

1. WHEN `extract(files, selectors, componentName, targetFile?)` 함수가 호출되면 THEN 시스템 SHALL 선택된 노드들을 새로운 컴포넌트로 추출한다.

2. WHEN 노드들이 추출되면 THEN 시스템 SHALL 원래 위치에 새로운 컴포넌트의 사용(JSX 요소)을 삽입한다.

3. WHEN targetFile이 제공되지 않으면 THEN 시스템 SHALL 원본 파일과 같은 파일에 컴포넌트를 생성한다.

4. WHEN targetFile이 제공되면 THEN 시스템 SHALL 해당 파일에 컴포넌트를 생성하고 필요한 export/import를 추가한다.

5. IF componentName이 이미 존재하면 THEN 시스템 SHALL 오류를 반환한다.

6. WHEN 추출이 완료되면 THEN 시스템 SHALL ExtractResult 객체를 반환한다. 이 객체는 codes(Code[]), componentName(string), componentFile(string), propsGenerated(string[]) 필드를 포함한다.

---

### 2. 노드 선택 (JSX Element, Text, Expression)

**User Story:** 개발자로서, 추출할 JSX 노드를 유연하게 선택하고 싶습니다. 이를 통해 엘리먼트, 텍스트, 표현식 등 다양한 노드를 추출할 수 있습니다.

#### Acceptance Criteria

1. WHEN selectors 배열에 기존 Selector 타입(PositionSelector | PathSelector)이 제공되면 THEN 시스템 SHALL 해당 선택자를 사용하여 노드를 식별한다.

2. WHEN PositionSelector(file, line, column)로 JSX 엘리먼트를 선택하면 THEN 시스템 SHALL 시작 태그의 위치에서 해당 태그의 닫는 태그까지를 자동으로 추론하여 전체 엘리먼트를 선택한다.

3. WHEN PathSelector로 노드를 선택하면 THEN 시스템 SHALL AST 경로를 사용하여 해당 JSX 노드를 직접 선택한다.

4. WHEN JSX 엘리먼트(JSXElement)를 선택하면 THEN 시스템 SHALL 해당 엘리먼트를 추출한다.

5. WHEN JSX 텍스트(JSXText)를 선택하면 THEN 시스템 SHALL 해당 텍스트 노드를 추출한다.

6. WHEN JSX 표현식(JSXExpressionContainer, 예: `{variable}`, `{count + 1}`)을 선택하면 THEN 시스템 SHALL 해당 표현식을 추출한다.

7. WHEN selectors 배열에 단일 Selector가 제공되면 THEN 시스템 SHALL 해당 노드만 추출한다.

8. WHEN selectors 배열에 여러 Selector가 제공되면 THEN 시스템 SHALL 모든 선택된 노드들을 하나의 Fragment로 감싸서 추출한다.

9. IF 선택된 노드들이 형제 관계가 아니면 THEN 시스템 SHALL 오류를 반환한다.

10. IF 선택된 노드들 사이에 선택되지 않은 노드가 있으면 THEN 시스템 SHALL 오류를 반환하거나 경고를 표시한다.

11. WHEN 선택된 노드가 유효한 JSX 노드(Element, Text, Expression)가 아니면 THEN 시스템 SHALL 명확한 오류 메시지를 반환한다.

12. WHEN 자체 닫힘 태그(self-closing tag, 예: `<div />`)를 선택하면 THEN 시스템 SHALL 해당 태그를 단일 엘리먼트로 처리한다.

13. WHEN 여는 태그와 닫는 태그가 있는 엘리먼트(예: `<div>...</div>`)를 선택하면 THEN 시스템 SHALL 여는 태그 위치로부터 닫는 태그까지의 전체 범위를 엘리먼트로 인식한다.

14. WHEN 텍스트와 표현식이 혼합된 영역(예: `Hello {name}`)을 선택하면 THEN 시스템 SHALL 해당 영역의 모든 노드를 함께 추출한다.

---

### 3. 의존성 자동 분석

**User Story:** 개발자로서, 추출할 노드가 참조하는 모든 의존성을 자동으로 분석하고 싶습니다. 이를 통해 수동으로 의존성을 추적하지 않고도 안전하게 컴포넌트를 추출할 수 있습니다.

#### Acceptance Criteria

1. WHEN JSX 노드를 추출하면 THEN 시스템 SHALL Variable 의존성(const, let, var 선언)을 식별한다.

2. WHEN JSX 노드를 추출하면 THEN 시스템 SHALL Hook 의존성(useState, useEffect, useContext, useRef 등)을 식별한다.

3. WHEN JSX 노드를 추출하면 THEN 시스템 SHALL Import 의존성(외부 모듈 참조)을 식별한다.

4. WHEN JSX 노드를 추출하면 THEN 시스템 SHALL Function 의존성(함수 선언 및 표현식)을 식별한다.

5. WHEN JSX 노드를 추출하면 THEN 시스템 SHALL Prop 의존성(상위 컴포넌트에서 전달받은 값)을 식별한다.

6. WHEN JSX 노드를 추출하면 THEN 시스템 SHALL Context 의존성(useContext로 접근하는 값)을 식별한다.

7. WHEN JSX 표현식(`{variable}`)을 추출하면 THEN 시스템 SHALL 표현식 내부에서 참조하는 모든 식별자의 의존성을 분석한다.

8. IF 의존성이 eval() 또는 동적 코드 실행을 포함하면 THEN 시스템 SHALL 해당 의존성을 분석 불가능으로 표시하고 경고를 반환한다.

---

### 4. 의존성 처리 전략

**User Story:** 개발자로서, 분석된 의존성이 적절하게 처리되길 원합니다. 이를 통해 추출된 컴포넌트가 정상적으로 동작하게 됩니다.

#### Acceptance Criteria

1. WHEN Variable 의존성이 추출된 엘리먼트에서만 사용되면 THEN 시스템 SHALL 해당 변수를 새 컴포넌트 내부로 이동한다.

2. WHEN Variable 의존성이 추출된 엘리먼트와 원본 위치 모두에서 사용되면 THEN 시스템 SHALL 해당 변수를 props로 전달한다.

3. WHEN Hook 의존성이 추출된 엘리먼트에서만 사용되면 THEN 시스템 SHALL 해당 Hook을 새 컴포넌트 내부로 이동한다.

4. WHEN Hook 의존성이 추출된 엘리먼트와 원본 위치 모두에서 사용되면 THEN 시스템 SHALL 해당 Hook의 반환값을 props로 전달한다.

5. WHEN Function 의존성이 추출된 엘리먼트에서만 사용되면 THEN 시스템 SHALL 해당 함수를 새 컴포넌트 내부로 이동한다.

6. WHEN Function 의존성이 추출된 엘리먼트와 원본 위치 모두에서 사용되면 THEN 시스템 SHALL 해당 함수를 props로 전달한다.

7. WHEN Import 의존성이 필요하면 THEN 시스템 SHALL 새 컴포넌트 파일에 동일한 import 문을 추가한다.

8. WHEN Prop 의존성이 필요하면 THEN 시스템 SHALL 새 컴포넌트의 props 인터페이스에 해당 prop을 추가한다.

9. WHEN Context 의존성이 필요하면 THEN 시스템 SHALL 새 컴포넌트 내부에 useContext 호출을 추가한다.

---

### 5. Props 인터페이스 생성

**User Story:** 개발자로서, 추출된 컴포넌트의 props 인터페이스가 자동으로 생성되길 원합니다. 이를 통해 TypeScript 타입 안정성을 유지할 수 있습니다.

#### Acceptance Criteria

1. WHEN TypeScript 파일에서 컴포넌트를 추출하면 THEN 시스템 SHALL props 인터페이스를 생성한다.

2. WHEN props가 필요하면 THEN 시스템 SHALL 각 prop의 타입을 추론하여 인터페이스에 추가한다.

3. IF 타입 추론이 불가능하면 THEN 시스템 SHALL `any` 타입을 사용하고 경고를 표시한다.

4. WHEN props가 없으면 THEN 시스템 SHALL props 인터페이스를 생성하지 않는다.

5. WHEN JavaScript 파일에서 컴포넌트를 추출하면 THEN 시스템 SHALL props 인터페이스 없이 destructuring만 수행한다.

6. WHEN 추출이 완료되면 THEN ExtractResult.propsGenerated SHALL 생성된 props 이름 목록을 포함한다.

---

### 6. 같은 파일 내 추출

**User Story:** 개발자로서, 같은 파일 내에서 컴포넌트를 추출하고 싶습니다. 이를 통해 큰 컴포넌트를 작은 단위로 분리할 수 있습니다.

#### Acceptance Criteria

1. WHEN targetFile이 제공되지 않거나 원본 파일과 동일하면 THEN 시스템 SHALL 같은 파일에 새 컴포넌트를 생성한다.

2. WHEN 새 컴포넌트를 생성하면 THEN 시스템 SHALL 원본 컴포넌트 정의 이전 또는 이후에 배치한다.

3. IF options.insertPosition이 'before'이면 THEN 시스템 SHALL 원본 컴포넌트 정의 이전에 새 컴포넌트를 배치한다.

4. IF options.insertPosition이 'after' 또는 명시되지 않으면 THEN 시스템 SHALL 원본 컴포넌트 정의 이후에 새 컴포넌트를 배치한다.

5. WHEN 같은 파일에 추출하면 THEN 시스템 SHALL import 문을 추가하지 않는다.

6. WHEN 의존성이 원본 파일 최상위에 있으면 THEN 시스템 SHALL 해당 의존성을 이동하지 않고 그대로 참조한다.

---

### 7. 다른 파일로 추출

**User Story:** 개발자로서, 엘리먼트를 다른 파일로 추출하고 싶습니다. 이를 통해 컴포넌트를 재사용 가능한 모듈로 분리할 수 있습니다.

#### Acceptance Criteria

1. WHEN targetFile이 제공되고 원본 파일과 다르면 THEN 시스템 SHALL 해당 파일에 새 컴포넌트를 생성한다.

2. WHEN 다른 파일로 추출하면 THEN 시스템 SHALL 원본 파일에 새 컴포넌트의 import 문을 추가한다.

3. WHEN 다른 파일로 추출하면 THEN 시스템 SHALL 대상 파일에 새 컴포넌트의 export 문을 추가한다.

4. IF 대상 파일이 존재하지 않으면 THEN 시스템 SHALL 새 파일을 생성하고 필요한 imports와 component 정의를 포함한다.

5. IF 대상 파일이 이미 존재하면 THEN 시스템 SHALL 기존 파일 끝에 새 컴포넌트를 추가한다.

6. WHEN Import 의존성이 필요하면 THEN 시스템 SHALL 대상 파일에 동일한 import 문을 추가한다.

7. WHEN 이동된 의존성(variables, functions, hooks)이 원본 파일에서 더 이상 사용되지 않으면 THEN 시스템 SHALL 원본 파일에서 해당 코드를 제거한다.

8. IF 이동된 의존성이 원본 파일의 다른 곳에서도 사용되면 THEN 시스템 SHALL 해당 의존성을 원본 파일에 유지하고 새 컴포넌트에 복사한다.

---

### 8. Hook 처리

**User Story:** 개발자로서, React Hooks가 포함된 엘리먼트를 안전하게 추출하고 싶습니다. 이를 통해 Hook 규칙을 위반하지 않고 컴포넌트를 추출할 수 있습니다.

#### Acceptance Criteria

1. WHEN Hook이 추출된 엘리먼트에서만 사용되면 THEN 시스템 SHALL 해당 Hook을 새 컴포넌트 최상위로 이동한다.

2. WHEN Hook이 조건부 로직 내부에 있으면 THEN 시스템 SHALL Hook을 최상위로 이동하고 조건부 로직은 Hook 반환값에 적용한다.

3. WHEN Hook이 원본과 추출된 엘리먼트 모두에서 사용되면 THEN 시스템 SHALL Hook을 원본에 유지하고 반환값을 props로 전달한다.

4. WHEN useState Hook이 이동되면 THEN 시스템 SHALL state와 setter 함수 모두를 처리한다.

5. WHEN useEffect Hook이 이동되면 THEN 시스템 SHALL dependency array의 의존성도 함께 분석하고 처리한다.

6. WHEN useRef Hook이 이동되면 THEN 시스템 SHALL ref 객체를 새 컴포넌트로 이동하거나 props로 전달한다.

7. WHEN Custom Hook이 이동되면 THEN 시스템 SHALL 해당 Hook의 import도 함께 처리한다.

---

### 9. 컴포넌트 구조 생성

**User Story:** 개발자로서, 추출된 컴포넌트가 올바른 React 컴포넌트 구조를 가지길 원합니다. 이를 통해 추가 수정 없이 바로 사용할 수 있습니다.

#### Acceptance Criteria

1. WHEN 컴포넌트를 생성하면 THEN 시스템 SHALL Function Declaration 또는 Arrow Function 형식으로 생성한다.

2. IF options.componentStyle이 'function'이면 THEN 시스템 SHALL Function Declaration 형식으로 생성한다.

3. IF options.componentStyle이 'arrow' 또는 명시되지 않으면 THEN 시스템 SHALL Arrow Function 형식으로 생성한다.

4. WHEN props가 필요하면 THEN 시스템 SHALL props 매개변수를 destructuring 형식으로 추가한다.

5. WHEN Hooks가 포함되면 THEN 시스템 SHALL Hooks를 컴포넌트 최상위에 배치한다.

6. WHEN 추출된 JSX가 여러 엘리먼트이면 THEN 시스템 SHALL React.Fragment 또는 <></>로 감싼다.

7. WHEN 추출된 JSX가 단일 엘리먼트이면 THEN 시스템 SHALL Fragment 없이 그대로 반환한다.

8. WHEN TypeScript를 사용하면 THEN 시스템 SHALL 적절한 타입 어노테이션을 추가한다.

---

### 10. 이름 생성 및 충돌 방지

**User Story:** 개발자로서, 컴포넌트 이름이 자동으로 제안되거나 충돌이 방지되길 원합니다. 이를 통해 이름 충돌 없이 안전하게 컴포넌트를 추출할 수 있습니다.

#### Acceptance Criteria

1. WHEN componentName이 제공되지 않으면 THEN 시스템 SHALL 의미 있는 이름을 제안한다.

2. WHEN 이름을 제안하면 THEN 시스템 SHALL 추출된 엘리먼트의 내용을 기반으로 생성한다.

3. IF 제안된 이름이 이미 존재하면 THEN 시스템 SHALL 숫자 접미사를 추가하여 고유하게 만든다.

4. WHEN 사용자가 제공한 componentName이 이미 존재하면 THEN 시스템 SHALL 오류를 반환한다.

5. IF options.allowNameConflict이 true이면 THEN 시스템 SHALL 이름 충돌을 허용하고 경고만 표시한다.

6. WHEN 이름을 검증하면 THEN 시스템 SHALL 같은 파일 내의 다른 컴포넌트와 함수 이름도 확인한다.

---

### 11. 추출 가능성 검증

**User Story:** 개발자로서, 실제 추출 전에 추출 가능 여부를 사전에 검증하고 싶습니다. 이를 통해 불필요한 연산을 피하고 사용자에게 즉각적인 피드백을 제공할 수 있습니다.

#### Acceptance Criteria

1. WHEN `canExtract(files, selectors, componentName)` 함수가 호출되면 THEN 시스템 SHALL 추출 가능 여부를 boolean으로 반환한다.

2. IF 선택된 노드가 유효하지 않으면 THEN 시스템 SHALL false를 반환한다.

3. IF componentName이 이미 존재하면 THEN 시스템 SHALL false를 반환한다.

4. IF 의존성에 분석 불가능한 동적 코드가 포함되면 THEN 시스템 SHALL false를 반환한다.

5. IF 추출이 불가능하면 THEN ExtractAnalysis.reason SHALL 불가능한 이유를 명확히 설명한다.

6. WHEN `analyzeExtract(files, selectors)` 함수가 호출되면 THEN 시스템 SHALL 실제 추출 없이 의존성 분석 결과만 반환한다.

---

### 12. 옵션 설정

**User Story:** 개발자로서, 추출 동작을 세부적으로 제어하고 싶습니다. 이를 통해 프로젝트의 코딩 스타일과 요구사항에 맞게 추출할 수 있습니다.

#### Acceptance Criteria

1. WHEN options.componentStyle이 제공되면 THEN 시스템 SHALL 해당 스타일로 컴포넌트를 생성한다.

2. WHEN options.insertPosition이 제공되면 THEN 시스템 SHALL 해당 위치에 컴포넌트를 배치한다.

3. WHEN options.exportType이 'named'이면 THEN 시스템 SHALL named export를 사용한다.

4. WHEN options.exportType이 'default'이면 THEN 시스템 SHALL default export를 사용한다.

5. IF options.exportType이 명시되지 않으면 THEN 시스템 SHALL 기본값 'named'를 사용한다.

6. WHEN options.includeTypes이 true이면 THEN 시스템 SHALL TypeScript 타입 정의를 생성한다.

7. IF options.includeTypes이 false 또는 JavaScript 파일이면 THEN 시스템 SHALL 타입 정의 없이 생성한다.

8. WHEN options.preserveComments가 true이면 THEN 시스템 SHALL 추출된 엘리먼트와 의존성의 주석을 보존한다.

9. WHEN options.dryRun이 true이면 THEN 시스템 SHALL 실제 코드 변환 없이 분석 결과만 반환한다.

---

### 13. 결과 반환

**User Story:** 개발자로서, 추출 결과에 대한 상세한 정보를 받고 싶습니다. 이를 통해 어떤 변경이 일어났는지 정확히 파악할 수 있습니다.

#### Acceptance Criteria

1. WHEN 추출이 성공하면 THEN 시스템 SHALL Result<ExtractResult, RegraffError> 객체를 반환한다.

2. WHEN 결과를 반환하면 THEN ExtractResult.codes SHALL 모든 변경된 파일의 내용을 포함한다.

3. WHEN 결과를 반환하면 THEN ExtractResult.componentName SHALL 생성된 컴포넌트 이름을 포함한다.

4. WHEN 결과를 반환하면 THEN ExtractResult.componentFile SHALL 컴포넌트가 생성된 파일 경로를 포함한다.

5. WHEN 결과를 반환하면 THEN ExtractResult.propsGenerated SHALL 생성된 props 목록을 포함한다.

6. WHEN 결과를 반환하면 THEN ExtractResult.dependenciesMoved SHALL 이동된 의존성 목록을 포함한다.

7. WHEN 결과를 반환하면 THEN ExtractResult.analysis SHALL 상세한 의존성 분석 정보를 포함한다.

8. IF 추출이 실패하면 THEN 시스템 SHALL RegraffError 객체에 명확한 오류 메시지와 제안사항을 포함하여 반환한다.

---

### 14. 코드 생성 품질

**User Story:** 개발자로서, 생성된 코드가 읽기 쉽고 프로젝트의 코딩 스타일을 따르길 원합니다. 이를 통해 추가 포맷팅 없이 바로 사용할 수 있습니다.

#### Acceptance Criteria

1. WHEN 코드를 생성하면 THEN 시스템 SHALL 적절한 들여쓰기와 줄바꿈을 사용한다.

2. WHEN props destructuring을 생성하면 THEN 시스템 SHALL 알파벳 순서로 정렬한다.

3. WHEN import 문을 생성하면 THEN 시스템 SHALL 그룹별로 정렬한다 (React imports, 라이브러리 imports, 로컬 imports).

4. WHEN 컴포넌트를 생성하면 THEN 시스템 SHALL JSDoc 주석을 추가한다.

5. IF 원본 코드에 주석이 있고 options.preserveComments가 true이면 THEN 시스템 SHALL 해당 주석을 유지한다.

6. WHEN TypeScript 코드를 생성하면 THEN 시스템 SHALL 타입 안전성을 보장한다.

---

### 15. 오류 처리 및 검증

**User Story:** 개발자로서, 추출 과정에서 발생하는 오류를 명확하게 이해하고 싶습니다. 이를 통해 문제를 빠르게 해결할 수 있습니다.

#### Acceptance Criteria

1. IF 선택된 노드가 없으면 THEN 시스템 SHALL 'EMPTY_SELECTION' 오류를 반환한다.

2. IF componentName이 유효하지 않으면 THEN 시스템 SHALL 'INVALID_COMPONENT_NAME' 오류를 반환한다.

3. IF 선택된 노드들이 형제 관계가 아니면 THEN 시스템 SHALL 'NON_SIBLING_NODES' 오류를 반환한다.

4. IF 선택된 노드가 유효한 JSX 노드(Element, Text, Expression)가 아니면 THEN 시스템 SHALL 'INVALID_NODE_TYPE' 오류를 반환한다.

5. IF 분석할 수 없는 의존성이 있으면 THEN 시스템 SHALL 'UNANALYZABLE_DEPENDENCY' 오류를 반환하고 해당 의존성 정보를 포함한다.

6. IF 파일을 생성할 수 없으면 THEN 시스템 SHALL 'FILE_CREATION_FAILED' 오류를 반환한다.

7. WHEN 오류가 발생하면 THEN RegraffError.suggestions SHALL 해결 방법을 제안한다.

8. WHEN 경고가 발생하면 THEN ExtractResult.warnings SHALL 경고 메시지 목록을 포함한다.

---

## API 설계

### 함수 시그니처

```typescript
/**
 * Extract selected JSX nodes (elements, text, expressions) into a new component
 *
 * @param files - Array of file inputs with path and content
 * @param selectors - Array of Selector (PositionSelector | PathSelector) for nodes to extract
 * @param componentName - Name for the new component
 * @param targetFile - Optional target file path (defaults to source file)
 * @param options - Optional extraction options
 * @returns Result containing transformed codes and extraction info, or error
 *
 * @example
 * // Extract single element using position selector
 * const result = extract(
 *   files,
 *   [{ file: 'App.tsx', line: 10, column: 5 }],
 *   'UserProfile'
 * );
 *
 * @example
 * // Extract multiple nodes (elements + text + expressions) using position selectors
 * const result = extract(
 *   files,
 *   [
 *     { file: 'App.tsx', line: 10, column: 7 },  // Text: "Hello"
 *     { file: 'App.tsx', line: 10, column: 13 }, // Expression: {name}
 *     { file: 'App.tsx', line: 15, column: 5 }   // Element: <button>
 *   ],
 *   'Greeting'
 * );
 *
 * @example
 * // Extract to different file
 * const result = extract(
 *   files,
 *   [{ file: 'App.tsx', line: 10, column: 5 }],
 *   'UserProfile',
 *   'components/UserProfile.tsx'
 * );
 *
 * @example
 * // Extract JSX expression
 * const result = extract(
 *   files,
 *   [{ file: 'App.tsx', line: 8, column: 10 }], // {count > 0 && <Badge />}
 *   'ConditionalBadge'
 * );
 */
export function extract(
  files: FileInput[],
  selectors: Selector[],
  componentName: string,
  targetFile?: string,
  options?: ExtractOptions
): Result<ExtractResult, RegraffError>;

/**
 * Check if nodes can be extracted
 */
export function canExtract(
  files: FileInput[],
  selectors: Selector[],
  componentName: string,
  targetFile?: string
): boolean;

/**
 * Analyze what would happen if nodes were extracted
 */
export function analyzeExtract(
  files: FileInput[],
  selectors: Selector[],
  targetFile?: string
): Result<ExtractAnalysis, RegraffError>;
```

### 타입 정의

```typescript
/**
 * Selector type is reused from existing types
 * - PositionSelector: { file: string, line: number, column: number }
 * - PathSelector: { file: string, path: string }
 */
import type { Selector } from "./types/public.js";

export interface ExtractOptions {
  /** Component style: 'function' | 'arrow' */
  componentStyle?: "function" | "arrow";

  /** Where to insert new component: 'before' | 'after' */
  insertPosition?: "before" | "after";

  /** Export type: 'named' | 'default' */
  exportType?: "named" | "default";

  /** Include TypeScript type definitions */
  includeTypes?: boolean;

  /** Preserve comments from extracted code */
  preserveComments?: boolean;

  /** Dry run mode (analysis only) */
  dryRun?: boolean;

  /** Allow component name conflicts */
  allowNameConflict?: boolean;
}

export interface ExtractResult {
  /** Transformed file contents */
  codes: Code[];

  /** Name of the created component */
  componentName: string;

  /** File containing the created component */
  componentFile: string;

  /** Names of props that were generated */
  propsGenerated: string[];

  /** Dependencies that were moved to the new component */
  dependenciesMoved: DependencyInfo[];

  /** Detailed analysis of the extraction */
  analysis: ExtractAnalysis;

  /** Warning messages (if any) */
  warnings?: string[];
}

export interface ExtractAnalysis {
  /** Whether extraction is possible */
  canExtract: boolean;

  /** Reason if extraction is not possible */
  reason?: string;

  /** All identified dependencies */
  dependencies: Dependency[];

  /** Dependencies to be moved to new component */
  dependenciesToMove: Dependency[];

  /** Dependencies to be passed as props */
  dependenciesToPropsify: Dependency[];

  /** Suggested component name (if not provided) */
  suggestedName?: string;
}

export interface DependencyInfo {
  /** Name of the dependency */
  name: string;

  /** Type of dependency */
  type: DependencyType;

  /** How it was handled: 'moved' | 'propsified' | 'copied' */
  handling: "moved" | "propsified" | "copied";

  /** Original location */
  originalLocation: {
    file: string;
    line: number;
    column: number;
  };

  /** New location (if moved) */
  newLocation?: {
    file: string;
    line: number;
    column: number;
  };
}
```

---

## JSX 노드 범위 추론 상세

### PositionSelector 처리

WHEN PositionSelector(file, line, column)가 제공되면:

1. **시작 위치 식별**: 주어진 line과 column 위치에서 가장 가까운 JSX 노드를 찾는다.

2. **노드 타입별 범위 추론**:
   - **JSX Element (자체 닫힘)**: `<div />`, `<Button />`와 같은 경우, 해당 태그 전체를 범위로 인식
   - **JSX Element (여는/닫는)**: `<div>...</div>`와 같은 경우, 여는 태그에서 닫는 태그까지의 전체 범위를 인식
   - **JSX Text**: `Hello World`와 같은 텍스트 노드, 해당 텍스트의 시작부터 끝까지를 범위로 인식
   - **JSX Expression**: `{variable}`, `{count + 1}`와 같은 표현식, `{`부터 `}`까지를 범위로 인식
   - **중첩 노드**: 엘리먼트 내부의 모든 자식 노드도 범위에 포함

3. **AST 노드 매핑**: 식별된 범위에 해당하는 JSX AST 노드(JSXElement, JSXText, JSXExpressionContainer)를 반환

### 예시: JSX Element 추출

```tsx
// 코드 예시
function App() {
  return (
    <div>
      {" "}
      // line 3, column 5<h1>Title</h1>
      <p>Content</p>
    </div> // line 6, column 5
  );
}

// Selector: { file: 'App.tsx', line: 3, column: 5 }
// 추론된 범위: line 3, column 5 ~ line 6, column 11
// 포함되는 내용: <div> 전체 (자식 <h1>, <p> 포함)
```

### 예시: JSX Text + Expression 추출

```tsx
// 코드 예시
function App() {
  const name = "John";
  return <div>Hello {name}, welcome! // line 5, column 7</div>;
}

// Selectors: [
//   { file: 'App.tsx', line: 5, column: 7 },   // Text: "Hello "
//   { file: 'App.tsx', line: 5, column: 13 },  // Expression: {name}
//   { file: 'App.tsx', line: 5, column: 19 }   // Text: ", welcome!"
// ]
// 추론된 범위: "Hello " + {name} + ", welcome!"
// 결과: 3개 노드를 Fragment로 감싸서 추출
```

### 예시: 여러 노드 선택

```tsx
// 코드 예시
function App() {
  const count = 5;
  return (
    <div>
      <h1>Title</h1> // line 4, column 7 You have {count} messages // line 5,
      column 7 (text + expression)
      <footer>End</footer>
    </div>
  );
}

// Selectors: [
//   { file: 'App.tsx', line: 4, column: 7 },  // <h1> element
//   { file: 'App.tsx', line: 5, column: 7 }   // text node (시작점)
// ]
// 추론된 범위: <h1> 전체 + "You have {count} messages" 전체
// 결과: 엘리먼트와 텍스트/표현식을 Fragment로 감싸서 추출
```

### 예시: JSX Expression만 추출

```tsx
// 코드 예시
function App() {
  const count = 5;
  return <div>{count > 0 && <Badge count={count} />} // line 4, column 7</div>;
}

// Selector: { file: 'App.tsx', line: 4, column: 7 }
// 추론된 범위: {count > 0 && <Badge count={count} />} 전체
// 포함되는 내용: JSXExpressionContainer 노드 전체
// 결과: 조건부 렌더링 로직을 포함한 새 컴포넌트
```

---

## 우선순위 및 단계별 구현

### Phase 1: 기본 추출 (MVP)

- 단일 노드 추출 (PositionSelector 지원)
  - JSXElement 추출
  - JSXText 추출
  - JSXExpressionContainer 추출
- 같은 파일 내 추출
- 간단한 Variable 의존성 처리 (props로 전달)
- 기본 컴포넌트 구조 생성
- JSX 노드 범위 자동 추론
  - Element: 시작 태그 → 닫는 태그
  - Text: 텍스트 시작 → 텍스트 끝
  - Expression: `{` → `}`

### Phase 2: 의존성 처리 강화

- Hook 의존성 처리
- Function 의존성 처리
- Import 의존성 처리
- 의존성 이동 vs props 결정 로직
- PathSelector 지원

### Phase 3: 고급 기능

- 다른 파일로 추출
- TypeScript 타입 생성
- 여러 노드 추출 (Fragment로 감싸기)
- 혼합 노드 추출 (Element + Text + Expression)
- 이름 충돌 감지 및 제안

### Phase 4: 최적화 및 검증

- 추출 가능성 사전 검증 (canExtract)
- 분석 API (analyzeExtract)
- 코드 생성 품질 개선
- 오류 처리 강화

---

## 제약사항 및 한계

1. **동적 코드 실행**: `eval()`, `Function()` 등을 사용하는 코드는 분석 불가능
2. **복잡한 타입 추론**: 일부 복잡한 TypeScript 타입은 정확히 추론하지 못할 수 있음
3. **순환 의존성**: 추출로 인해 순환 의존성이 발생할 수 있는 경우 오류 반환
4. **비형제 노드**: 형제 관계가 아닌 노드들은 함께 추출 불가능
5. **고차 컴포넌트**: HOC로 감싸진 컴포넌트 내부 노드 추출 시 제한적
6. **위치 정확도**: PositionSelector는 line/column 위치에서 가장 가까운 JSX 노드를 선택하므로, 정확한 위치 지정 필요
7. **텍스트 노드 경계**: 연속된 텍스트 노드의 일부만 선택하는 것은 불가능 (전체 텍스트 노드 단위로만 선택)

---

## 비기능 요구사항

### 성능

- 단일 파일 추출: <100ms
- 크로스 파일 추출: <500ms
- 의존성 분석: <50ms
- JSX 노드 범위 추론: <10ms

### 안정성

- 추출 후 코드는 항상 컴파일 가능해야 함
- 추출 후 의미론적 동작은 변경되지 않아야 함
- JSX 노드 범위 추론은 항상 유효한 JSX 노드(Element, Text, Expression)를 반환해야 함

### 사용성

- 명확한 오류 메시지 제공
- 추출 불가능 시 이유와 해결 방법 제안
- 진행 상황 표시 (선택적)

---

## 테스트 전략

### 단위 테스트

- 의존성 분석 로직
- Props 생성 로직
- 컴포넌트 구조 생성
- 이름 충돌 감지
- **JSX 노드 범위 추론 로직**
  - JSXElement: 자체 닫힘 태그 인식
  - JSXElement: 여는/닫는 태그 쌍 인식
  - JSXText: 텍스트 노드 범위 인식
  - JSXExpressionContainer: 표현식 범위 인식 (`{` ~ `}`)
  - 중첩 노드 처리
  - 혼합 노드 (Text + Expression) 처리

### 통합 테스트

- 같은 파일 내 추출 시나리오
- 다른 파일로 추출 시나리오
- 다양한 의존성 조합
- TypeScript vs JavaScript
- **PositionSelector vs PathSelector**
- **단일 vs 여러 노드 추출**
- **노드 타입별 추출**
  - JSXElement만 추출
  - JSXText만 추출
  - JSXExpression만 추출
  - 혼합 노드 추출 (Element + Text + Expression)

### E2E 테스트

- 실제 프로젝트 코드 추출
- 추출 후 빌드 및 실행
- 의미론적 동작 일치 확인
- **다양한 JSX 패턴 추출**
  - 조건부 렌더링 (`{condition && <Element />}`)
  - 리스트 렌더링 (`{items.map(...)}`)
  - 텍스트와 표현식 혼합
  - 복잡한 중첩 구조
