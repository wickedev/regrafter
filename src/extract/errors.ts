/**
 * Extract Feature Error Definitions
 *
 * Task 1.3: 에러 타입 정의
 * Defines all error codes and error creation utilities for extract feature
 */

import type { Selector, SuggestedFix } from '../types/public.js';
import type { SourceLocation } from '../types/internal.js';
import {
  ErrorCategory,
  ValidationError,
  SelectorError,
  DependencyError,
  TransformError,
  type RegraffError,
} from '../errors/error-category.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Error Codes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract 기능 전용 에러 코드
 */
export enum ExtractErrorCode {
  // 검증 에러
  EMPTY_INPUT = 'EMPTY_INPUT',
  INVALID_SELECTOR = 'INVALID_SELECTOR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  // 선택 에러
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  INVALID_SELECTION = 'INVALID_SELECTION',
  NON_CONTIGUOUS_NODES = 'NON_CONTIGUOUS_NODES',
  DIFFERENT_PARENTS = 'DIFFERENT_PARENTS',
  NOT_JSX_NODE = 'NOT_JSX_NODE',

  // 의존성 분석 에러
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  UNRESOLVABLE_DEPENDENCY = 'UNRESOLVABLE_DEPENDENCY',
  HOOK_RULE_VIOLATION = 'HOOK_RULE_VIOLATION',

  // 타입 추론 에러
  TYPE_INFERENCE_FAILED = 'TYPE_INFERENCE_FAILED',
  COMPLEX_TYPE_UNSUPPORTED = 'COMPLEX_TYPE_UNSUPPORTED',

  // 이름 생성 에러
  INVALID_COMPONENT_NAME = 'INVALID_COMPONENT_NAME',
  NAME_CONFLICT = 'NAME_CONFLICT',

  // 코드 생성 에러
  COMPONENT_BUILD_FAILED = 'COMPONENT_BUILD_FAILED',
  CODE_GENERATION_FAILED = 'CODE_GENERATION_FAILED',
  INVALID_JSX_STRUCTURE = 'INVALID_JSX_STRUCTURE',

  // 파일 작업 에러
  FILE_WRITE_FAILED = 'FILE_WRITE_FAILED',
  FILE_READ_FAILED = 'FILE_READ_FAILED',
}

/**
 * 에러 코드별 메시지 매핑
 */
export const ERROR_MESSAGES: Record<ExtractErrorCode, string> = {
  [ExtractErrorCode.EMPTY_INPUT]: '파일 목록이 비어있습니다',
  [ExtractErrorCode.INVALID_SELECTOR]: '유효하지 않은 selector입니다',
  [ExtractErrorCode.FILE_NOT_FOUND]: '파일을 찾을 수 없습니다',
  [ExtractErrorCode.NODE_NOT_FOUND]: '지정된 위치에서 노드를 찾을 수 없습니다',
  [ExtractErrorCode.INVALID_SELECTION]: '선택된 노드가 추출 가능한 JSX 노드가 아닙니다',
  [ExtractErrorCode.NON_CONTIGUOUS_NODES]: '선택된 노드들이 연속되어 있지 않습니다',
  [ExtractErrorCode.DIFFERENT_PARENTS]: '선택된 노드들의 부모가 서로 다릅니다',
  [ExtractErrorCode.NOT_JSX_NODE]: 'JSX 노드만 추출 가능합니다',
  [ExtractErrorCode.CIRCULAR_DEPENDENCY]: '순환 의존성이 감지되었습니다',
  [ExtractErrorCode.UNRESOLVABLE_DEPENDENCY]: '해결할 수 없는 의존성이 있습니다',
  [ExtractErrorCode.HOOK_RULE_VIOLATION]: 'React Hook 규칙 위반이 감지되었습니다',
  [ExtractErrorCode.TYPE_INFERENCE_FAILED]: '타입 추론에 실패했습니다',
  [ExtractErrorCode.COMPLEX_TYPE_UNSUPPORTED]: '지원하지 않는 복잡한 타입입니다',
  [ExtractErrorCode.INVALID_COMPONENT_NAME]: '유효하지 않은 컴포넌트 이름입니다',
  [ExtractErrorCode.NAME_CONFLICT]: '동일한 이름의 컴포넌트가 이미 존재합니다',
  [ExtractErrorCode.COMPONENT_BUILD_FAILED]: '컴포넌트 생성에 실패했습니다',
  [ExtractErrorCode.CODE_GENERATION_FAILED]: '코드 생성에 실패했습니다',
  [ExtractErrorCode.INVALID_JSX_STRUCTURE]: '유효하지 않은 JSX 구조입니다',
  [ExtractErrorCode.FILE_WRITE_FAILED]: '파일 쓰기에 실패했습니다',
  [ExtractErrorCode.FILE_READ_FAILED]: '파일 읽기에 실패했습니다',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Error Creation Parameters
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract 에러 생성 파라미터
 */
interface ExtractErrorParams {
  selector?: Selector;
  file?: string;
  location?: SourceLocation;
  suggestions?: SuggestedFix[];
  cause?: Error;
  details?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Error Creation Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract 에러 생성 함수
 */
export function createExtractError(
  code: ExtractErrorCode,
  params: ExtractErrorParams
): RegraffError {
  const message = ERROR_MESSAGES[code];

  // 에러 코드에 따라 적절한 카테고리의 에러 생성
  switch (code) {
    // 검증 에러
    case ExtractErrorCode.EMPTY_INPUT:
    case ExtractErrorCode.FILE_NOT_FOUND:
      return new ValidationError({
        code,
        message,
        constraint: code,
        details: params.details ?? message,
        file: params.file,
        location: params.location,
        suggestions: params.suggestions,
        recoverable: false,
      });

    // 선택 에러
    case ExtractErrorCode.INVALID_SELECTOR:
    case ExtractErrorCode.NODE_NOT_FOUND:
    case ExtractErrorCode.INVALID_SELECTION:
    case ExtractErrorCode.NON_CONTIGUOUS_NODES:
    case ExtractErrorCode.DIFFERENT_PARENTS:
    case ExtractErrorCode.NOT_JSX_NODE:
      return new SelectorError({
        code,
        message,
        selector: params.selector!,
        file: params.file ?? params.selector?.file ?? '',
        location: params.location,
        suggestions: params.suggestions,
      });

    // 의존성 분석 에러
    case ExtractErrorCode.CIRCULAR_DEPENDENCY:
    case ExtractErrorCode.UNRESOLVABLE_DEPENDENCY:
    case ExtractErrorCode.HOOK_RULE_VIOLATION:
      return new DependencyError({
        code,
        message,
        unresolvableReason: params.details ?? message,
        file: params.file,
        location: params.location,
        suggestions: params.suggestions,
        recoverable: code !== ExtractErrorCode.HOOK_RULE_VIOLATION,
      });

    // 코드 생성 에러
    case ExtractErrorCode.COMPONENT_BUILD_FAILED:
    case ExtractErrorCode.CODE_GENERATION_FAILED:
    case ExtractErrorCode.INVALID_JSX_STRUCTURE:
    case ExtractErrorCode.FILE_WRITE_FAILED:
    case ExtractErrorCode.FILE_READ_FAILED:
      return new TransformError({
        code,
        message,
        operation: code,
        file: params.file,
        location: params.location,
        suggestions: params.suggestions,
        cause: params.cause,
      });

    // 타입 추론 및 이름 생성 에러
    case ExtractErrorCode.TYPE_INFERENCE_FAILED:
    case ExtractErrorCode.COMPLEX_TYPE_UNSUPPORTED:
    case ExtractErrorCode.INVALID_COMPONENT_NAME:
    case ExtractErrorCode.NAME_CONFLICT:
      return new ValidationError({
        code,
        message,
        constraint: code,
        details: params.details ?? message,
        file: params.file,
        location: params.location,
        suggestions: params.suggestions,
        recoverable: code === ExtractErrorCode.NAME_CONFLICT,
      });

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = code;
      return new ValidationError({
        code: _exhaustive,
        message: 'Unknown error',
        constraint: 'UNKNOWN',
        details: 'Unknown error occurred',
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Type Guards
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract 에러 타입 가드
 */
export function isExtractError(error: unknown): error is RegraffError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as Partial<RegraffError>;
  return (
    'code' in err &&
    'message' in err &&
    'category' in err &&
    Object.values(ExtractErrorCode).includes(err.code as ExtractErrorCode)
  );
}
