/**
 * Extract Public API
 *
 * Task 10.3: extract() API 함수 구현
 *
 * Requirements:
 * - 10.1: 소스 파일 경로를 필수 파라미터로 요구
 * - 10.2: selector를 필수 파라미터로 요구
 * - 10.7: 생성된 컴포넌트 정보와 수정된 파일 목록을 반환
 * - 10.8: 실패 시 구체적인 에러 객체를 throw
 */

import type { FileInput, Selector } from "../types/public.js";
import type { Result } from "../result/types.js";
import type { RegraffError } from "../errors/error-category.js";
import type {
  ExtractOptions,
  ExtractResult,
  ExtractAnalysis,
  RangeSelector,
} from "./types.js";
import { ExtractOrchestrator } from "./extract-orchestrator.js";

/**
 * JSX 노드를 새로운 컴포넌트로 추출
 *
 * @param files - 파일 입력 배열
 * @param selector - JSX 노드를 선택하는 Selector 또는 RangeSelector
 * @param options - 추출 옵션
 * @returns Result<ExtractResult, RegraffError>
 *
 * @example
 * // 같은 파일 내 추출
 * const result = extract(
 *   [{ path: 'App.tsx', content: sourceCode }],
 *   { file: 'App.tsx', line: 10, column: 5 },
 *   { componentName: 'UserProfile' }
 * );
 *
 * @example
 * // 다른 파일로 추출
 * const result = extract(
 *   files,
 *   { file: 'App.tsx', line: 10, column: 5 },
 *   {
 *     componentName: 'UserProfile',
 *     targetFile: 'components/UserProfile.tsx'
 *   }
 * );
 *
 * @example
 * // 범위 선택으로 여러 노드 추출
 * const result = extract(
 *   files,
 *   {
 *     file: 'App.tsx',
 *     start: { line: 10, column: 5 },
 *     end: { line: 15, column: 20 }
 *   },
 *   { componentName: 'FormSection' }
 * );
 */
export function extract(
  files: FileInput[],
  selector: Selector | RangeSelector,
  options?: ExtractOptions
): Result<ExtractResult, RegraffError> {
  const orchestrator = new ExtractOrchestrator();
  return orchestrator.orchestrate(files, selector, options ?? {});
}

/**
 * 추출 가능 여부를 빠르게 확인 (dry-run)
 *
 * Task 21.2: canExtract() 함수 구현
 *
 * @param files - 파일 입력 배열
 * @param selector - JSX 노드를 선택하는 Selector 또는 RangeSelector
 * @returns boolean - 추출 가능 여부
 *
 * Requirements:
 * - 10.7: 검증만 수행하고 변환 생략
 *
 * @example
 * if (canExtract(files, selector)) {
 *   // 추출 수행
 *   const result = extract(files, selector, options);
 * }
 */
export function canExtract(
  files: FileInput[],
  selector: Selector | RangeSelector
): boolean {
  const orchestrator = new ExtractOrchestrator();
  const result = orchestrator.validate(files, selector);
  return result;
}

/**
 * 추출 분석만 수행 (변환 없이)
 *
 * Task 21.4: analyzeExtract() 함수 구현
 *
 * @param files - 파일 입력 배열
 * @param selector - JSX 노드를 선택하는 Selector 또는 RangeSelector
 * @returns Result<ExtractAnalysis, RegraffError>
 *
 * Requirements:
 * - 2.5: 의존성 분석만 수행하고 코드 변환 생략
 *
 * @example
 * const analysis = analyzeExtract(files, selector);
 * if (analysis.ok) {
 *   console.log('Dependencies:', analysis.value.dependencies);
 *   console.log('Component name:', analysis.value.componentName);
 * }
 */
export function analyzeExtract(
  files: FileInput[],
  selector: Selector | RangeSelector
): Result<ExtractAnalysis, RegraffError> {
  const orchestrator = new ExtractOrchestrator();
  return orchestrator.analyze(files, selector);
}
