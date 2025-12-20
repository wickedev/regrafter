/**
 * CodeFormatter - Code formatter for Extract feature
 *
 * Task 11.2: CodeFormatter implementation
 * - Implement format method
 * - Reuse CodeGenerator
 * - Extract original formatting style
 * Requirements: 8.1, 8.3, 8.6
 */

import type * as t from '@babel/types';

import type { RegraffError } from '../errors/error-category.js';
import { createCodeGenerator } from '../generator/index.js';
import type { CodeGenerator } from '../generator/code-generator.js';
import type { GeneratorOptions } from '../generator/types.js';
import { ok, err, type Result } from '../result/index.js';

import { createExtractError, ExtractErrorCode } from './errors.js';
import type { ICodeFormatter } from './interfaces/i-code-formatter.js';

/**
 * CodeFormatter converts AST to code while preserving original code style.
 *
 * Responsibilities:
 * - Convert AST to code string
 * - Preserve original code indentation style
 * - Preserve original code formatting style (quotes, semicolons, etc.)
 * - Reuse CodeGenerator
 *
 * Based on design.md section CodeFormatter
 */
export class CodeFormatter implements ICodeFormatter {
  private readonly codeGenerator: CodeGenerator;

  constructor() {
    this.codeGenerator = createCodeGenerator();
  }

  /**
   * Convert AST to code while preserving original code style.
   *
   * @param ast - Babel AST to convert
   * @param originalContent - Original code (for style analysis)
   * @returns Generated code string or error
   *
   * Requirements:
   * - 8.1: Preserve original file indentation style
   * - 8.3: Apply appropriate indentation
   * - 8.6: Generate code compatible with formatters like Prettier or ESLint
   */
  format(ast: t.File, originalContent: string): Result<string, RegraffError> {
    // 1. Extract formatting style from original code
    const formattingOptions = this.extractFormattingStyle(originalContent);

    // 2. Generate code with CodeGenerator
    const result = this.codeGenerator.generate(ast, formattingOptions);

    // 3. Return error on generation failure
    if (result.ok === false) {
      return err(
        createExtractError(ExtractErrorCode.CODE_GENERATION_FAILED, {
          details: result.error.message,
          cause: result.error instanceof Error ? result.error : undefined,
        })
      );
    }

    // 4. Adjust indentation (Babel always generates with 2 spaces)
    const adjustedCode = this.adjustGeneratedIndentation(result.value.code, {
      useTabs: formattingOptions.useTabs ?? false,
      indentSize: formattingOptions.indentSize ?? 2,
    });

    // 5. Return adjusted code on success
    return ok(adjustedCode);
  }

  /**
   * Extract formatting style from original code.
   *
   * Analyzes:
   * - Indentation style (spaces vs tabs)
   * - Indentation size (2 spaces, 4 spaces, etc.)
   * - Quote style (single vs double)
   * - Semicolon usage
   *
   * @param code - Original code to analyze
   * @returns CodeGenerator options
   */
  private extractFormattingStyle(code: string): GeneratorOptions {
    const lines = code.split('\n');

    // Analyze indentation style
    const indentationInfo = this.analyzeIndentation(lines);

    // Analyze quote style
    const singleQuote = this.analyzeSingleQuotePreference(code);

    // Analyze semicolon usage
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
   * Analyze indentation style.
   *
   * @param lines - Array of code lines
   * @returns Indentation information
   */
  private analyzeIndentation(lines: string[]): {
    useTabs: boolean;
    size: number;
  } {
    let tabCount = 0;
    let spaceCount = 0;
    const spaceCounts: number[] = [];

    for (const line of lines) {
      // Skip empty lines
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

    // Choose the more frequently used one between tabs and spaces
    const useTabs = tabCount > spaceCount;

    // Calculate space indentation size (using GCD)
    let size = 2; // default value
    if (!useTabs && spaceCounts.length > 0) {
      const gcd = this.findGCD(spaceCounts);
      if (gcd >= 1 && gcd <= 8) {
        size = gcd;
      }
    }

    return { useTabs, size };
  }

  /**
   * Analyze line indentation.
   *
   * @param line - Line to analyze
   * @returns Tab and space counts
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
   * Find greatest common divisor of an array.
   *
   * @param numbers - Array of numbers
   * @returns Greatest common divisor
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
   * Analyze single quote usage preference.
   *
   * @param code - Code to analyze
   * @returns true if single quotes are preferred
   */
  private analyzeSingleQuotePreference(code: string): boolean {
    // Count single/double quotes in string literals
    const singleQuoteMatches = code.match(/'[^']*'/g) ?? [];
    const doubleQuoteMatches = code.match(/"[^"]*"/g) ?? [];

    // Return true if single quotes are more common
    return singleQuoteMatches.length >= doubleQuoteMatches.length;
  }

  /**
   * Analyze semicolon usage.
   *
   * @param code - Code to analyze
   * @returns true if semicolons are used
   */
  private analyzeSemicolonUsage(code: string): boolean {
    const lines = code.split('\n');
    let linesWithSemicolon = 0;
    let statementsCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines or comments
      if (
        trimmed.length === 0 ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*')
      ) {
        continue;
      }

      // Check if line looks like a statement
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

    // Return true if more than half of statements end with semicolon
    return statementsCount > 0 && linesWithSemicolon / statementsCount >= 0.5;
  }

  /**
   * Adjust indentation of generated code.
   *
   * Since Babel generator always generates code with 2 spaces,
   * convert indentation to match original code style.
   *
   * @param code - Generated code
   * @param options - Indentation options
   * @returns Adjusted code
   */
  private adjustGeneratedIndentation(
    code: string,
    options: { useTabs: boolean; indentSize: number }
  ): string {
    // No adjustment needed if 2 spaces is default
    if (!options.useTabs && options.indentSize === 2) {
      return code;
    }

    const lines = code.split('\n');

    return lines
      .map((line) => {
        // Return lines without indentation as-is
        if (line.length === 0 || !line.startsWith(' ')) {
          return line;
        }

        // Calculate current indentation level (Babel uses 2 spaces)
        const match = line.match(/^( +)/);
        if (match?.[1] === undefined) return line;

        const currentIndent = match[1].length;
        const level = Math.floor(currentIndent / 2); // Babel uses 2 spaces unit

        // Generate new indentation
        const newIndent = options.useTabs
          ? '\t'.repeat(level)
          : ' '.repeat(options.indentSize * level);

        return newIndent + line.trimStart();
      })
      .join('\n');
  }
}
