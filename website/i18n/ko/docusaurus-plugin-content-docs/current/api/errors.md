---
sidebar_position: 2
---

# 에러 코드 레퍼런스

Regrafter의 모든 에러 코드에 대한 자세한 정보를 제공합니다.

## 에러 코드 형식

에러 코드는 `EXXX` 형식을 따릅니다:
- E001-E009: Parse 에러
- E010-E019: Selector 에러
- E020-E029: Dependency 에러
- E030-E039: Validation 에러
- E040-E049: Circular dependency 에러
- E050-E059: Transform 에러
- E090-E099: Internal 에러

## Parse 에러 (E001-E009)

### E001 - 일반 Parse 에러

**메시지:** `Failed to parse {file}: {message}`

**설명:** 파일 파싱이 실패했을 때 발생합니다.

**원인:**
- 잘못된 JavaScript/TypeScript 문법
- 지원되지 않는 문법 기능
- 손상된 파일 인코딩

**해결방법:**
1. 파일의 문법이 올바른지 확인
2. TypeScript 컴파일러로 파일 검증
3. 파일 인코딩이 UTF-8인지 확인

## Selector 에러 (E010-E019)

### E010 - 엘리먼트를 찾을 수 없음

**메시지:** `Element not found at {file}:{line}:{column}`

**설명:** 지정된 위치에서 엘리먼트를 찾을 수 없습니다.

**원인:**
- 잘못된 라인/컬럼 번호
- 파일이 수정됨
- JSX 엘리먼트가 아닌 위치

**해결방법:**
1. 라인/컬럼 번호 확인
2. 파일의 최신 버전 사용
3. 유효한 JSX 엘리먼트 선택

## Dependency 에러 (E020-E029)

### E020 - 순환 의존성 감지

**메시지:** `Circular dependency detected: {chain}`

**설명:** 의존성 체인에서 순환이 감지되었습니다.

**원인:**
- 컴포넌트 간 순환 참조
- 상호 의존적인 imports

**해결방법:**
1. 의존성 구조 재설계
2. 공유 로직을 별도 모듈로 추출
3. 의존성 방향 재검토

## Validation 에러 (E030-E039)

### E030 - Hook 규칙 위반

**메시지:** `Move would violate Rules of Hooks: {reason}`

**설명:** 이동이 React Hook 규칙을 위반합니다.

**원인:**
- 조건부 Hook 호출
- 루프 내 Hook
- 중첩 함수 내 Hook

**해결방법:**
1. Hook을 컴포넌트 최상위로 이동
2. 조건부 로직을 Hook 내부로 이동
3. 별도 컴포넌트로 추출

## Transform 에러 (E050-E059)

### E050 - 변환 실패

**메시지:** `Failed to transform {file}: {reason}`

**설명:** AST 변환이 실패했습니다.

**원인:**
- 복잡한 코드 구조
- 지원되지 않는 패턴
- 내부 에러

**해결방법:**
1. 코드 단순화
2. 더 작은 단위로 나누어 이동
3. 이슈 리포트

## 에러 처리 예제

```typescript
import { regraft, RegraffError } from 'regrafter';

try {
  const result = regraft(files, from, to, Move.Inside);
} catch (error) {
  if (error instanceof RegraffError) {
    console.error(`[${error.code}] ${error.message}`);

    // 제안된 수정사항 확인
    for (const fix of error.suggestions) {
      console.log(`제안: ${fix.description}`);
      if (fix.automatic) {
        console.log('  (자동 수정 가능)');
      }
    }
  }
}
```
