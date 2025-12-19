/**
 * Type Guards Tests
 *
 * Task 22.1: 타입 가드 테스트 작성
 * Tests for isRangeSelector and isExtractSuccess type guards
 */

import { describe, it, expect } from 'vitest';
import { ok, err } from '../../result/index.js';
import type { Result } from '../../result/index.js';
import type { Selector } from '../../types/public.js';
import type { RangeSelector, ExtractResult } from '../types.js';
import type { RegraffError } from '../../errors/error-category.js';
import { ExtractErrorCode, createExtractError } from '../errors.js';
import { isRangeSelector, isExtractSuccess } from '../type-guards.js';

describe('isRangeSelector', () => {
  it('should return true for valid RangeSelector', () => {
    const rangeSelector: RangeSelector = {
      file: 'test.tsx',
      start: { line: 1, column: 0 },
      end: { line: 5, column: 10 },
    };

    expect(isRangeSelector(rangeSelector)).toBe(true);
  });

  it('should return false for PositionSelector', () => {
    const positionSelector: Selector = {
      file: 'test.tsx',
      line: 1,
      column: 0,
    };

    expect(isRangeSelector(positionSelector)).toBe(false);
  });

  it('should return false for PathSelector', () => {
    const pathSelector: Selector = {
      file: 'test.tsx',
      path: 'Program.body[0]',
    };

    expect(isRangeSelector(pathSelector)).toBe(false);
  });

  it('should return false for invalid object with only start', () => {
    const invalid = {
      file: 'test.tsx',
      start: { line: 1, column: 0 },
    };

    expect(isRangeSelector(invalid as RangeSelector)).toBe(false);
  });

  it('should return false for invalid object with only end', () => {
    const invalid = {
      file: 'test.tsx',
      end: { line: 5, column: 10 },
    };

    expect(isRangeSelector(invalid as RangeSelector)).toBe(false);
  });

  it('should return false for object with invalid start structure', () => {
    const invalid = {
      file: 'test.tsx',
      start: { line: 1 }, // missing column
      end: { line: 5, column: 10 },
    };

    expect(isRangeSelector(invalid as RangeSelector)).toBe(false);
  });

  it('should return false for object with invalid end structure', () => {
    const invalid = {
      file: 'test.tsx',
      start: { line: 1, column: 0 },
      end: { column: 10 }, // missing line
    };

    expect(isRangeSelector(invalid as RangeSelector)).toBe(false);
  });

  it('should return false for non-object values', () => {
    expect(isRangeSelector(null as unknown as RangeSelector)).toBe(false);
    expect(isRangeSelector(undefined as unknown as RangeSelector)).toBe(false);
    expect(isRangeSelector('test' as unknown as RangeSelector)).toBe(false);
    expect(isRangeSelector(123 as unknown as RangeSelector)).toBe(false);
  });
});

describe('isExtractSuccess', () => {
  it('should return true for Ok<ExtractResult>', () => {
    const extractResult: ExtractResult = {
      codes: [{ file: 'test.tsx', content: 'code', changed: true }],
      component: {
        name: 'TestComponent',
        file: 'test.tsx',
        props: [],
      },
      stats: {
        nodesExtracted: 1,
        dependenciesFound: 0,
        propsGenerated: 0,
      },
    };

    const result: Result<ExtractResult, RegraffError> = ok(extractResult);

    expect(isExtractSuccess(result)).toBe(true);
  });

  it('should return false for Err<RegraffError>', () => {
    const error = createExtractError(ExtractErrorCode.INVALID_SELECTION, {
      details: 'Invalid selection',
    });

    const result: Result<ExtractResult, RegraffError> = err(error);

    expect(isExtractSuccess(result)).toBe(false);
  });

  it('should narrow type correctly when used in type guard', () => {
    const extractResult: ExtractResult = {
      codes: [{ file: 'test.tsx', content: 'code', changed: true }],
      component: {
        name: 'TestComponent',
        file: 'test.tsx',
        props: [],
      },
      stats: {
        nodesExtracted: 1,
        dependenciesFound: 0,
        propsGenerated: 0,
      },
    };

    const result: Result<ExtractResult, RegraffError> = ok(extractResult);

    if (isExtractSuccess(result)) {
      // TypeScript should know result.value exists here
      expect(result.value.component.name).toBe('TestComponent');
      expect(result.value.stats.nodesExtracted).toBe(1);
    }
  });
});
