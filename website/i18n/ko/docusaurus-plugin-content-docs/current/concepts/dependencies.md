---
sidebar_position: 1
---

# 의존성 관리

Regrafter는 React 엘리먼트를 재배치할 때 다양한 유형의 의존성을 자동으로 추적하고 관리합니다.

## 의존성 타입

Regrafter는 다음과 같은 의존성 타입을 인식하고 처리합니다:

### Hook 의존성

React hooks는 Hook 규칙을 따라야 합니다. Regrafter는 필요할 때 자동으로 hooks를 조상 컴포넌트로 호이스팅합니다.

```typescript
// 이동 전
function Parent() {
  return <Child />;
}

function Child() {
  const [state, setState] = useState(0);
  return <div>{state}</div>;
}

// state를 사용하는 엘리먼트 이동 후
function Parent() {
  const [state, setState] = useState(0); // 호이스팅됨
  return <Child state={state} setState={setState} />;
}
```

**지원되는 hooks:**
- `useState`
- `useEffect`
- `useContext`
- `useRef`
- `useMemo`
- `useCallback`
- 커스텀 hooks

### 변수 의존성

지역 변수와 상수는 호이스팅되거나 prop으로 전달됩니다.

```typescript
const result = regraft(files, from, to, Move.Inside);
// 이동된 엘리먼트가 사용하는 변수는 자동으로 추적됩니다
```

### Import 의존성

외부 import는 파일 간 이동 시 자동으로 타겟 파일에 추가됩니다.

```typescript
// 소스 파일
import { Button } from '@/components';

// 파일 간 이동 후, import가 타겟 파일에 추가됩니다
```

### Prop 의존성

컴포넌트 props는 필요할 때 컴포넌트 트리를 통해 전달됩니다.

### Context 의존성

React context 값은 provider와 함께 호이스팅되거나 추출될 수 있습니다.

### Ref 의존성

React refs는 필요에 따라 호이스팅되거나 forward됩니다.

## 해결 전략

| 타입 | 해결 방법 |
|------|------------|
| `Hook` | 조상 컴포넌트로 호이스팅 |
| `Variable` | 호이스팅 또는 prop으로 전달 |
| `Import` | 타겟 파일에 추가 |
| `Prop` | 트리를 통해 전달 |
| `Context` | Provider 호이스팅 또는 추출 |
| `Ref` | 호이스팅 또는 ref forwarding |

## 의존성 분석

`analyze()` 함수를 사용하여 의존성 변경사항을 미리 확인할 수 있습니다:

```typescript
const analysis = analyze(files, from, to, Move.Inside);

console.log('의존성:', analysis.dependencies);
console.log('호이스팅될 항목:', analysis.hoistedDeps);
console.log('이동 가능:', analysis.canMove);
```

## 다음 단계

- [에러 처리](/docs/api/errors)에 대해 배우기
- 의존성 처리 패턴에 대한 [예제](/docs/examples/basic) 보기
