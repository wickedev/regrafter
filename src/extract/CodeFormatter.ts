/**
 * CodeFormatter - Extract 기능용 코드 포맷터
 *
 * Task 11.2: CodeFormatter 구현
 * - format 메서드 구현
 * - CodeGenerator 재사용
 * - 원본 포맷팅 스타일 추출
 * Requirements: 8.1, 8.3, 8.6
 */

import type * as t from '@babel/types';
import { CodeGenerator } from '../generator/code-generator.js';
import type { GeneratorOptions } from '../generator/types.js';
import { ok, err, type Result } from '../result/index.js';
import { createExtractError, ExtractErrorCode } from './errors.js';
import type { RegraffError } from '../errors/error-category.js';

/**
 * CodeFormatter는 AST를 코드로 변환하면서 원본 코드의 스타일을 유지합니다.
 *
 * Responsibilities:
 * - AST를 코드 문자열로 변환
 * - 원본 코드의 들여쓰기 스타일 유지
 * - 원본 코드의 포맷팅 스타일 유지 (따옴표, 세미콜론 등)
 * - CodeGenerator 재사용
 *
 * Based on design.md section CodeFormatter
 */
export class CodeFormatter {
  private codeGenerator: CodeGenerator;

  constructor() {
    this.codeGenerator = new CodeGenerator();
  }

  /**
   * AST를 코드로 변환하면서 원본 코드의 스타일을 유지합니다.
   *
   * @param ast - 변환할 Babel AST
   * @param originalContent - 원본 코드 (스타일 분석용)
   * @returns 생성된 코드 문자열 또는 에러
   *
   * Requirements:
   * - 8.1: 원본 파일의 들여쓰기 스타일을 유지
   * - 8.3: 적절한 들여쓰기를 적용
   * - 8.6: Prettier나 ESLint 같은 포맷터와 호환되는 코드를 생성
   */
  format(ast: t.File, originalContent: string): Result<string, RegraffError> {
    // 1. 원본 코드에서 포맷팅 스타일 추출
    const formattingOptions = this.extractFormattingStyle(originalContent);

    // 2. CodeGenerator로 코드 생성
    const result = this.codeGenerator.generate(ast, formattingOptions);

    // 3. 생성 실패 시 에러 반환
    if (result.ok === false) {
      return err(
        createExtractError(ExtractErrorCode.CODE_GENERATION_FAILED, {
          details: result.error.message,
          cause: result.error instanceof Error ? result.error : undefined,
        })
      );
    }

    // 4. 들여쓰기 조정 (Babel은 항상 2 spaces로 생성하므로)
    const adjustedCode = this.adjustGeneratedIndentation(result.value.code, {
      useTabs: formattingOptions.useTabs ?? false,
      indentSize: formattingOptions.indentSize ?? 2,
    });

    // 5. 성공 시 조정된 코드 반환
    return ok(adjustedCode);
  }

  /**
   * 원본 코드에서 포맷팅 스타일을 추출합니다.
   *
   * Analyzes:
   * - 들여쓰기 스타일 (spaces vs tabs)
   * - 들여쓰기 크기 (2 spaces, 4 spaces 등)
   * - 따옴표 스타일 (single vs double)
   * - 세미콜론 사용 여부
   *
   * @param code - 분석할 원본 코드
   * @returns CodeGenerator 옵션
   */
  private extractFormattingStyle(code: string): GeneratorOptions {
    const lines = code.split('\n');

    // 들여쓰기 스타일 분석
    const indentationInfo = this.analyzeIndentation(lines);

    // 따옴표 스타일 분석
    const singleQuote = this.analyzeSingleQuotePreference(code);

    // 세미콜론 사용 분석
    const semicolons = this.analyzeSemicolonUsage(code);

    return {
      indentSize: indentationInfo.size,
      useTabs: indentationInfo.useTabs,
      singleQuote,
      semicolons,
      preserveComments: true,
      formatOutput: true,
    };
  }

  /**
   * 들여쓰기 스타일을 분석합니다.
   *
   * @param lines - 코드 라인 배열
   * @returns 들여쓰기 정보
   */
  private analyzeIndentation(lines: string[]): {
    useTabs: boolean;
    size: number;
  } {
    let tabCount = 0;
    let spaceCount = 0;
    const spaceCounts: number[] = [];

    for (const line of lines) {
      // 빈 줄 건너뛰기
      if (line.trim().length === 0) continue;

      const indent = this.getLineIndentation(line);

      if (indent.tabs > 0) {
        tabCount++;
      }
      if (indent.spaces > 0) {
        spaceCount++;
        spaceCounts.push(indent.spaces);
      }
    }

    // 탭과 스페이스 중 더 많이 사용된 것 선택
    const useTabs = tabCount > spaceCount;

    // 스페이스 들여쓰기 크기 계산 (GCD 사용)
    let size = 2; // 기본값
    if (!useTabs && spaceCounts.length > 0) {
      const gcd = this.findGCD(spaceCounts);
      if (gcd >= 1 && gcd <= 8) {
        size = gcd;
      }
    }

    return { useTabs, size };
  }

  /**
   * 라인의 들여쓰기를 분석합니다.
   *
   * @param line - 분석할 라인
   * @returns 탭과 스페이스 개수
   */
  private getLineIndentation(line: string): { tabs: number; spaces: number } {
    let tabs = 0;
    let spaces = 0;

    for (const char of line) {
      if (char === '\t') {
        tabs++;
      } else if (char === ' ') {
        spaces++;
      } else {
        break;
      }
    }

    return { tabs, spaces };
  }

  /**
   * 배열의 최대공약수를 구합니다.
   *
   * @param numbers - 숫자 배열
   * @returns 최대공약수
   */
  private findGCD(numbers: number[]): number {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

    if (numbers.length === 0) return 1;

    let result = numbers[0];
    if (result === undefined) return 1;

    for (let i = 1; i < numbers.length; i++) {
      const num = numbers[i];
      if (num !== undefined) {
        result = gcd(result, num);
      }
    }

    return result;
  }

  /**
   * 싱글 쿼트 사용 여부를 분석합니다.
   *
   * @param code - 분석할 코드
   * @returns true if single quotes are preferred
   */
  private analyzeSingleQuotePreference(code: string): boolean {
    // 문자열 리터럴에서 싱글/더블 쿼트 카운트
    const singleQuoteMatches = code.match(/'[^']*'/g) || [];
    const doubleQuoteMatches = code.match(/"[^"]*"/g) || [];

    // 싱글 쿼트가 더 많으면 true
    return singleQuoteMatches.length >= doubleQuoteMatches.length;
  }

  /**
   * 세미콜론 사용 여부를 분석합니다.
   *
   * @param code - 분석할 코드
   * @returns true if semicolons are used
   */
  private analyzeSemicolonUsage(code: string): boolean {
    const lines = code.split('\n');
    let linesWithSemicolon = 0;
    let statementsCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // 빈 줄이나 주석 건너뛰기
      if (
        trimmed.length === 0 ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*')
      ) {
        continue;
      }

      // statement로 보이는 줄인지 확인
      if (
        trimmed.match(
          /^(const|let|var|function|return|import|export|if|for|while)/
        )
      ) {
        statementsCount++;
        if (trimmed.endsWith(';')) {
          linesWithSemicolon++;
        }
      }
    }

    // statement의 절반 이상이 세미콜론으로 끝나면 true
    return statementsCount > 0 && linesWithSemicolon / statementsCount >= 0.5;
  }

  /**
   * 생성된 코드의 들여쓰기를 조정합니다.
   *
   * Babel generator는 항상 2 spaces로 코드를 생성하므로,
   * 원본 코드의 스타일에 맞게 들여쓰기를 변환합니다.
   *
   * @param code - 생성된 코드
   * @param options - 들여쓰기 옵션
   * @returns 조정된 코드
   */
  private adjustGeneratedIndentation(
    code: string,
    options: { useTabs: boolean; indentSize: number }
  ): string {
    // 2 spaces가 기본이면 조정 불필요
    if (!options.useTabs && options.indentSize === 2) {
      return code;
    }

    const lines = code.split('\n');

    return lines
      .map((line) => {
        // 들여쓰기가 없는 줄은 그대로 반환
        if (line.length === 0 || !line.startsWith(' ')) {
          return line;
        }

        // 현재 들여쓰기 수준 계산 (Babel은 2 spaces 사용)
        const match = line.match(/^( +)/);
        if (!match) return line;

        const currentIndent = match[1].length;
        const level = Math.floor(currentIndent / 2); // Babel은 2 spaces 단위

        // 새로운 들여쓰기 생성
        const newIndent = options.useTabs
          ? '\t'.repeat(level)
          : ' '.repeat(options.indentSize * level);

        return newIndent + line.trimStart();
      })
      .join('\n');
  }
}
