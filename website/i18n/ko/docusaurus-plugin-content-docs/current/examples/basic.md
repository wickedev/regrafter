---
sidebar_position: 1
---

# 기본 예제

이 페이지는 Regrafter의 기본 사용 패턴을 보여줍니다.

## 같은 컴포넌트 내에서 엘리먼트 이동

같은 컴포넌트 내에서 JSX 엘리먼트를 다른 위치로 이동:

```typescript
import { regraft, Move } from 'regrafter';

const files = [{
  path: 'App.tsx',
  content: `
    function App() {
      return (
        <div>
          <Header />
          <Main>
            <Sidebar />
            <Content />
          </Main>
          <Footer />
        </div>
      );
    }
  `
}];

// Sidebar를 Content 다음으로 이동
const result = regraft(
  files,
  { file: 'App.tsx', line: 6, column: 13 },  // Sidebar
  { file: 'App.tsx', line: 7, column: 13 },  // Content
  Move.After
);

console.log(result.codes[0].content);
```

## 컴포넌트 간 엘리먼트 이동

한 컴포넌트에서 다른 컴포넌트로 엘리먼트 이동:

```typescript
const files = [{
  path: 'App.tsx',
  content: `
    function Dashboard() {
      const [user, setUser] = useState(null);
      return (
        <div>
          <Profile user={user} />
          <Settings />
        </div>
      );
    }

    function Settings() {
      return <div>Settings</div>;
    }
  `
}];

// Profile을 Settings 안으로 이동
const result = regraft(
  files,
  { file: 'App.tsx', line: 5, column: 11 },  // Profile
  { file: 'App.tsx', line: 11, column: 16 }, // Settings div
  Move.Inside
);

// Profile이 이제 Settings 안에 있고 user prop이 전달됨
```

## 다른 파일로 엘리먼트 이동

다른 파일로 엘리먼트 이동:

```typescript
const files = [
  {
    path: 'Dashboard.tsx',
    content: `
      function Dashboard() {
        const data = useDashboardData();
        return (
          <div>
            <Chart data={data} />
            <Stats data={data} />
          </div>
        );
      }
    `
  },
  {
    path: 'Sidebar.tsx',
    content: `
      function Sidebar() {
        return <nav>Menu</nav>;
      }
    `
  }
];

// Chart를 Sidebar로 이동
const result = regraft(
  files,
  { file: 'Dashboard.tsx', line: 5, column: 13 }, // Chart
  { file: 'Sidebar.tsx', line: 2, column: 16 },   // nav
  Move.Inside
);

// Chart가 필요한 imports와 함께 Sidebar.tsx로 이동됨
```

## Dry Run 미리보기

변경사항을 적용하지 않고 미리보기:

```typescript
const result = regraft(
  files,
  from,
  to,
  Move.Inside,
  { dryRun: true }
);

console.log('수정될 파일:', result.codes.filter(c => c.changed));
console.log('의존성:', analysis.dependencies);
console.log('이동 가능:', result.success);
```

## 다음 단계

- 복잡한 의존성 처리에 대한 [의존성 관리](/docs/concepts/dependencies) 보기
- [API 레퍼런스](/docs/api/overview)에서 더 자세한 내용 살펴보기
