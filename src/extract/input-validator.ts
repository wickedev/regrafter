/**
 * InputValidator
 *
 * Task 2.2: InputValidator 기본 구현
 * 입력 파라미터 검증 담당
 */

import type { FileInput, Selector } from '../types/public.js';
import type { ExtractOptions, RangeSelector } from './types.js';
import type { Result } from '../result/types.js';
import type { RegraffError } from '../errors/error-category.js';
import { ok, err } from '../result/types.js';
import { ExtractErrorCode, createExtractError } from './errors.js';

/**
 * InputValidator 인터페이스
 */
export interface IInputValidator {
  validate(
    files: FileInput[],
    selector: Selector | RangeSelector,
    options: ExtractOptions
  ): Result<void, RegraffError>;
}

/**
 * InputValidator 구현
 */
export class InputValidator implements IInputValidator {
  /**
   * 입력 파라미터 검증
   *
   * @param files - 파일 입력 배열
   * @param selector - Selector 또는 RangeSelector
   * @param options - Extract 옵션
   * @returns Result<void, RegraffError>
   */
  validate(
    files: FileInput[],
    selector: Selector | RangeSelector,
    options: ExtractOptions
  ): Result<void, RegraffError> {
    // 1. 빈 파일 목록 검증
    if (files.length === 0) {
      return err(
        createExtractError(ExtractErrorCode.EMPTY_INPUT, {
          details: '파일 목록이 비어있습니다',
        })
      );
    }

    // 2. Selector 유효성 검증
    if (!this.isValidSelector(selector)) {
      return err(
        createExtractError(ExtractErrorCode.INVALID_SELECTOR, {
          selector: selector as Selector,
          details: '유효하지 않은 selector입니다',
        })
      );
    }

    // 3. 모든 검증 통과
    return ok(undefined);
  }

  /**
   * Selector 유효성 검사
   *
   * @param selector - 검증할 selector
   * @returns boolean - 유효성 여부
   */
  private isValidSelector(selector: Selector | RangeSelector): boolean {
    if (!selector || typeof selector !== 'object') {
      return false;
    }

    // file 속성은 필수
    if (!('file' in selector) || typeof selector.file !== 'string') {
      return false;
    }

    // PositionSelector 체크
    if ('line' in selector && 'column' in selector) {
      return (
        typeof selector.line === 'number' && typeof selector.column === 'number'
      );
    }

    // PathSelector 체크
    if ('path' in selector) {
      return typeof selector.path === 'string';
    }

    // RangeSelector 체크
    if ('start' in selector && 'end' in selector) {
      const rangeSelector = selector as RangeSelector;
      return (
        rangeSelector.start &&
        typeof rangeSelector.start.line === 'number' &&
        typeof rangeSelector.start.column === 'number' &&
        rangeSelector.end &&
        typeof rangeSelector.end.line === 'number' &&
        typeof rangeSelector.end.column === 'number'
      );
    }

    return false;
  }
}
