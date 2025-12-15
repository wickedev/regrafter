---
sidebar_position: 1
---

# 시작하기

**Regrafter**에 오신 것을 환영합니다. Regrafter는 자동 의존성 관리를 통해 React/JSX 엘리먼트를 재배치하는 프로그래매틱 AST 변환 라이브러리입니다.

## Regrafter란?

Regrafter는 React/JSX 엘리먼트를 파일 내 또는 파일 간에 안전하게 이동하면서 모든 의존성, 훅, import를 자동으로 관리하고 React 규칙 준수를 보장하는 강력한 도구입니다.

### 주요 기능

- **안전한 엘리먼트 재배치**: 파일 내 및 파일 간 JSX 엘리먼트 이동
- **자동 의존성 분석**: 변수, 훅, prop 의존성 추적
- **스마트 호이스팅**: 공통 조상 스코프로 의존성 자동 호이스팅
- **React 규칙 준수**: 변환 중 Hook 규칙 유지
- **최적화**: 과도하게 호이스팅된 의존성을 최적 위치로 싱킹
- **파일 간 지원**: import 관리와 함께 파일 간 엘리먼트 이동

## 설치

npm을 사용하여 Regrafter 설치:

```bash
npm install regrafter
```

yarn 사용:

```bash
yarn add regrafter
```

pnpm 사용:

```bash
pnpm add regrafter
```

## 빠른 시작

Regrafter 사용 예제:

```typescript
import { regraft, Move } from 'regrafter';

const files = [{
  path: 'App.tsx',
  content: `
    function App() {
      const [count, setCount] = useState(0);
      return (
        <div>
          <Header />
          <Counter value={count} onChange={setCount} />
          <Footer />
        </div>
      );
    }
  `
}];

// <Counter />를 <Header /> 안으로 이동
const result = regraft(
  files,
  { file: 'App.tsx', line: 7, column: 11 },  // from: Counter 엘리먼트
  { file: 'App.tsx', line: 6, column: 11 },  // to: Header 엘리먼트
  Move.Inside
);

if (result.success) {
  console.log('변환된 코드:', result.codes[0].content);
  console.log('호이스팅된 의존성:', result.analysis.hoistedDeps);
}
```

## 다음 단계

- [API 레퍼런스](/docs/api/overview)에서 사용 가능한 모든 함수와 타입 살펴보기
- [예제](/docs/examples/basic)에서 더 많은 사용 사례 확인하기
- [의존성 관리](/docs/concepts/dependencies)에서 Regrafter가 다양한 유형의 의존성을 처리하는 방법 이해하기
