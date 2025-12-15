---
sidebar_position: 1
---

# API 개요

Regrafter는 프로그래매틱 AST 변환을 위한 간단하면서도 강력한 API를 제공합니다. 이 페이지는 주요 함수와 타입에 대한 개요를 제공합니다.

## 주요 함수

### `regraft()`

엘리먼트 재배치를 위한 메인 진입점입니다.

```typescript
function regraft(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result
```

**파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|-------------|
| `files` | `FileInput[]` | 변환할 파일 배열 |
| `from` | `Selector` | 소스 엘리먼트 위치 |
| `to` | `Selector` | 타겟 위치 |
| `mode` | `Move` | 타겟 기준 위치 |
| `options` | `Options` | 선택적 설정 |

**반환값:** 변환된 코드와 분석 결과를 포함한 `Result` 객체

### `analyze()`

실행 없이 제안된 이동을 분석합니다.

```typescript
function analyze(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): MoveAnalysis
```

### `canMove()`

이동이 가능한지 빠르게 확인합니다.

```typescript
function canMove(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): boolean
```

### `optimize()`

과도하게 호이스팅된 의존성을 싱킹하여 파일을 최적화합니다.

```typescript
function optimize(files: FileInput[]): Code[]
```

## 핵심 타입

### `Selector`

위치 기반 또는 AST 경로 기반 엘리먼트 선택.

```typescript
// 위치 선택자 (IDE 통합)
const posSelector: PositionSelector = {
  file: 'src/App.tsx',
  line: 10,
  column: 5
};

// 경로 선택자 (프로그래매틱)
const pathSelector: PathSelector = {
  file: 'src/App.tsx',
  path: 'Program.body[0].declaration.body.body[2]'
};
```

### `Move`

엘리먼트 위치 모드.

```typescript
enum Move {
  Inside = 'inside',   // 타겟의 자식으로
  Before = 'before',   // 타겟 이전 형제로
  After = 'after'      // 타겟 이후 형제로
}
```

### `Options`

설정 옵션.

```typescript
interface Options {
  optimize?: boolean;       // 싱킹 최적화 실행 (기본값: true)
  dryRun?: boolean;         // 미리보기만 (기본값: false)
  preserveComments?: boolean; // 주석 유지 (기본값: true)
  formatOutput?: boolean;   // Prettier로 포맷 (기본값: false)
}
```

## 다음 단계

- [에러 처리](/docs/api/errors) - 구조화된 에러 처리에 대해 배우기
