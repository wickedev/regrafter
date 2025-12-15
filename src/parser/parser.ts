/**
 * Parser Component
 *
 * Parses source files into Babel AST format with support for
 * JSX, TypeScript, and modern JavaScript syntax.
 */

import { parse as babelParse, ParserOptions, ParserPlugin } from '@babel/parser';
import type { File as BabelFile, SourceLocation } from '@babel/types';

import { ASTStore } from './ast-store.js';
import {
  FileInput,
  IParser,
  ParseError,
  ParseResult,
  getExtension,
  isTypeScriptFile,
} from './types.js';

/**
 * Error codes for parser errors
 */
export const ParseErrorCodes = {
  /** Generic parse error */
  PARSE_ERROR: 'E001',
  /** Unexpected token */
  UNEXPECTED_TOKEN: 'E002',
  /** Unsupported file type */
  UNSUPPORTED_FILE: 'E003',
  /** Empty source */
  EMPTY_SOURCE: 'E004',
} as const;

/**
 * Base Babel parser plugins configuration
 * Includes JSX, TypeScript, and modern JavaScript features
 */
const BASE_PLUGINS: ParserPlugin[] = [
  'jsx',
  ['decorators', { decoratorsBeforeExport: true }],
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'dynamicImport',
  'nullishCoalescingOperator',
  'optionalChaining',
  'topLevelAwait',
];

/**
 * Get parser plugins based on file type
 */
function getPluginsForFile(filename: string): ParserPlugin[] {
  const plugins = [...BASE_PLUGINS];

  // Add TypeScript plugin for .ts and .tsx files
  if (isTypeScriptFile(filename)) {
    plugins.push('typescript');
  }

  return plugins;
}

/**
 * Get parser options for a file
 */
function getParserOptions(filename: string): ParserOptions {
  return {
    sourceType: 'module',
    plugins: getPluginsForFile(filename),
    // Enable error recovery to continue parsing after errors
    errorRecovery: true,
    // Preserve source locations for selector resolution
    sourceFilename: filename,
    // Allow return statements at module level (for error recovery)
    allowReturnOutsideFunction: true,
    // Allow import/export everywhere for error recovery
    allowImportExportEverywhere: true,
    // Allow super outside method for error recovery
    allowSuperOutsideMethod: true,
    // Allow undeclared exports for error recovery
    allowUndeclaredExports: true,
  };
}

/**
 * Convert Babel parser error to ParseError
 */
function toBabelParseError(error: unknown, filename: string): ParseError {
  if (error && typeof error === 'object') {
    const babelError = error as {
      message?: string;
      loc?: { line: number; column: number };
      code?: string;
    };

    const message = babelError.message ?? 'Unknown parse error';
    const code = message.includes('Unexpected token')
      ? ParseErrorCodes.UNEXPECTED_TOKEN
      : ParseErrorCodes.PARSE_ERROR;

    return {
      message: `Failed to parse ${filename}: ${message}`,
      location: babelError.loc
        ? {
            start: {
              line: babelError.loc.line,
              column: babelError.loc.column,
              index: 0,
            },
            end: {
              line: babelError.loc.line,
              column: babelError.loc.column,
              index: 0,
            },
            filename,
          }
        : null,
      code,
    };
  }

  return {
    message: `Failed to parse ${filename}: Unknown error`,
    location: null,
    code: ParseErrorCodes.PARSE_ERROR,
  };
}

/**
 * Extract errors from Babel AST's error array (from error recovery)
 */
function extractRecoveredErrors(ast: BabelFile, filename: string): ParseError[] {
  const errors: ParseError[] = [];

  // Babel stores recovered errors in ast.errors when errorRecovery is enabled
  const astErrors = (ast as BabelFile & { errors?: unknown[] }).errors;
  if (Array.isArray(astErrors)) {
    for (const error of astErrors) {
      if (error && typeof error === 'object') {
        const babelError = error as {
          message?: string;
          loc?: { line: number; column: number };
        };

        errors.push({
          message: babelError.message ?? 'Recovered parse error',
          location: babelError.loc
            ? ({
                start: {
                  line: babelError.loc.line,
                  column: babelError.loc.column,
                  index: 0,
                },
                end: {
                  line: babelError.loc.line,
                  column: babelError.loc.column,
                  index: 0,
                },
                filename,
              } as SourceLocation)
            : null,
          code: ParseErrorCodes.PARSE_ERROR,
        });
      }
    }
  }

  return errors;
}

/**
 * Parser class for parsing JSX/TSX/JS source files
 *
 * Features:
 * - Supports .ts, .tsx, .js, .jsx files
 * - Error recovery mode for continued parsing after errors
 * - AST caching with content hash validation
 * - Meaningful error messages with source locations
 */
export class Parser implements IParser {
  private astStore: ASTStore;

  constructor() {
    this.astStore = new ASTStore();
  }

  /**
   * Parse a single source file
   * @param source - Source code content
   * @param filename - File path (used for error messages and file type detection)
   * @returns ParseResult with AST and any errors
   */
  parse(source: string, filename: string): ParseResult {
    // Check for empty source
    if (!source || source.trim() === '') {
      return {
        ast: null,
        errors: [
          {
            message: `Empty source file: ${filename}`,
            location: null,
            code: ParseErrorCodes.EMPTY_SOURCE,
          },
        ],
        success: false,
      };
    }

    // Check for unsupported file extensions
    const ext = getExtension(filename);
    if (ext && !['.ts', '.tsx', '.js', '.jsx', ''].includes(ext)) {
      return {
        ast: null,
        errors: [
          {
            message: `Unsupported file type: ${ext}`,
            location: null,
            code: ParseErrorCodes.UNSUPPORTED_FILE,
          },
        ],
        success: false,
      };
    }

    // Check cache first
    const cached = this.astStore.get(filename, source);
    if (cached) {
      return cached;
    }

    try {
      const options = getParserOptions(filename);
      const ast = babelParse(source, options);

      // Extract any errors from recovery mode
      const recoveredErrors = extractRecoveredErrors(ast, filename);

      const result: ParseResult = {
        ast,
        errors: recoveredErrors,
        // Success if we got an AST, even with recovered errors
        success: true,
      };

      // Cache the result
      this.astStore.set(filename, source, result);

      return result;
    } catch (error) {
      // Complete parsing failure (shouldn't happen often with errorRecovery)
      return {
        ast: null,
        errors: [toBabelParseError(error, filename)],
        success: false,
      };
    }
  }

  /**
   * Parse multiple files in batch
   * @param files - Array of file inputs to parse
   * @returns Map from file path to ParseResult
   */
  parseFiles(files: FileInput[]): Map<string, ParseResult> {
    const results = new Map<string, ParseResult>();

    for (const file of files) {
      const result = this.parse(file.content, file.path);
      results.set(file.path, result);
    }

    return results;
  }

  /**
   * Invalidate cached AST for a file
   * @param filename - File path to invalidate
   */
  invalidateCache(filename: string): void {
    this.astStore.invalidate(filename);
  }

  /**
   * Clear all cached ASTs
   */
  clearCache(): void {
    this.astStore.clear();
  }

  /**
   * Get the number of cached files (for testing)
   */
  getCacheSize(): number {
    return this.astStore.size;
  }
}

/**
 * Create a new Parser instance
 */
export function createParser(): Parser {
  return new Parser();
}
