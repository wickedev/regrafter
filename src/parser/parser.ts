/**
 * Parser Component
 *
 * Parses source files into Babel AST format with support for
 * JSX, TypeScript, and modern JavaScript syntax.
 */

import type { ParserOptions, ParserPlugin } from '@babel/parser';
import { parse as babelParse } from '@babel/parser';
import type { File as BabelFile, SourceLocation } from '@babel/types';

import { ASTStore } from './ast-store.js';
import type {
  FileInput,
  IParser,
  ParseError,
  ParseResult} from './types.js';
import {
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
  if (error !== null && error !== undefined && typeof error === 'object') {
    const babelError: unknown = error;

    // Type guard to check if error has the expected properties
    const hasMessage = babelError !== null &&
      typeof babelError === 'object' &&
      'message' in babelError &&
      (typeof babelError.message === 'string' || babelError.message === undefined);

    const hasLoc = babelError !== null &&
      typeof babelError === 'object' &&
      'loc' in babelError;

    const message = hasMessage &&
      typeof babelError === 'object' &&
      'message' in babelError &&
      typeof babelError.message === 'string'
        ? babelError.message
        : 'Unknown parse error';

    const code = message.includes('Unexpected token')
      ? ParseErrorCodes.UNEXPECTED_TOKEN
      : ParseErrorCodes.PARSE_ERROR;

    let location: SourceLocation | null = null;

    if (hasLoc &&
        typeof babelError === 'object' &&
        'loc' in babelError &&
        babelError.loc !== null &&
        typeof babelError.loc === 'object' &&
        'line' in babelError.loc &&
        'column' in babelError.loc &&
        typeof babelError.loc.line === 'number' &&
        typeof babelError.loc.column === 'number') {
      location = {
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
        identifierName: undefined,
      };
    }

    return {
      message: `Failed to parse ${filename}: ${message}`,
      location,
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
 * Type guard to check if a value has a message property
 */
function hasMessageProperty(value: unknown): value is { message?: string } {
  if (value === null || typeof value !== 'object' || !('message' in value)) {
    return false;
  }
  const messageValue = Reflect.get(value, 'message');
  return (
    typeof messageValue === 'string' || messageValue === undefined
  );
}

/**
 * Type guard to check if a value has a loc property with line and column
 */
function hasLocProperty(
  value: unknown
): value is { loc: { line: number; column: number } } {
  if (value === null || typeof value !== 'object' || !('loc' in value)) {
    return false;
  }
  const locValue: unknown = Reflect.get(value, 'loc');
  if (locValue === null || typeof locValue !== 'object') {
    return false;
  }
  const lineValue: unknown = Reflect.get(locValue, 'line');
  const columnValue: unknown = Reflect.get(locValue, 'column');
  return (
    typeof lineValue === 'number' &&
    typeof columnValue === 'number'
  );
}

/**
 * Extract errors from Babel AST's error array (from error recovery)
 */
function extractRecoveredErrors(ast: BabelFile, filename: string): ParseError[] {
  const errors: ParseError[] = [];

  // Babel stores recovered errors in ast.errors when errorRecovery is enabled
  const astWithErrors: unknown = ast;
  if (
    astWithErrors === null ||
    typeof astWithErrors !== 'object' ||
    !('errors' in astWithErrors)
  ) {
    return errors;
  }

  const errorsValue = Reflect.get(astWithErrors, 'errors');
  if (!Array.isArray(errorsValue)) {
    return errors;
  }

  for (const error of errorsValue) {
    if (error === null || error === undefined || typeof error !== 'object') {
      continue;
    }

    const message = hasMessageProperty(error) && typeof error.message === 'string'
      ? error.message
      : 'Recovered parse error';

    let location: SourceLocation | null = null;

    if (hasLocProperty(error)) {
      location = {
        start: {
          line: error.loc.line,
          column: error.loc.column,
          index: 0,
        },
        end: {
          line: error.loc.line,
          column: error.loc.column,
          index: 0,
        },
        filename,
        identifierName: undefined,
      };
    }

    errors.push({
      message,
      location,
      code: ParseErrorCodes.PARSE_ERROR,
    });
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
  private readonly astStore: ASTStore;

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
