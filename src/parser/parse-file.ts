/**
 * parseFile Function with Result Return Type (Task 10.2)
 *
 * Parses a source file into a Babel AST using the Result pattern.
 * Returns Result<BabelFile, ParseErrorType> instead of throwing exceptions.
 */

import type { ParserOptions, ParserPlugin } from '@babel/parser';
import { parse as babelParse } from '@babel/parser';
import type { File as BabelFile } from '@babel/types';

import { createParseError } from '../errors/error-category.js';
import type { ParseErrorType } from '../errors/error-category.js';
import { err, mapErr, tryCatch } from '../result/index.js';
import type { Result } from '../result/index.js';

import { isTypeScriptFile } from './types.js';

/**
 * Error codes for parser errors
 */
const ParseErrorCodes = {
  /** Generic parse error */
  PARSE_ERROR: 'E001',
  /** Unexpected token */
  UNEXPECTED_TOKEN: 'E002',
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
 * Parse a source file into a Babel AST.
 *
 * @param filename - The name of the file being parsed
 * @param source - The source code to parse
 * @returns Ok with the parsed AST, or Err with a ParseError
 *
 * @example
 * ```typescript
 * const result = parseFile('app.tsx', sourceCode);
 * if (result.ok) {
 *   console.log('Parsed successfully:', result.value);
 * } else {
 *   console.error('Parse failed:', result.error.message);
 * }
 * ```
 */
export function parseFile(
  filename: string,
  source: string
): Result<BabelFile, ParseErrorType> {
  // Check for empty source
  if (!source || source.trim() === '') {
    return err(
      createParseError({
        code: ParseErrorCodes.EMPTY_SOURCE,
        message: `Empty source file: ${filename}`,
        syntaxError: 'Source file is empty or contains only whitespace',
        file: filename,
        location: undefined,
        suggestions: [],
      })
    );
  }

  // Parse with Babel using tryCatch to convert exceptions to Result
  const parseResult = tryCatch(() =>
    babelParse(source, getParserOptions(filename))
  );

  // Convert Error to ParseErrorType using mapErr
  return mapErr(parseResult, (error) => {
    // Extract error message
    const message =
      error instanceof Error ? error.message : 'Unknown parse error';

    // Determine error code
    const code = message.includes('Unexpected token')
      ? ParseErrorCodes.UNEXPECTED_TOKEN
      : ParseErrorCodes.PARSE_ERROR;

    // Extract location information if available
    let location: ParseErrorType['location'] = undefined;

    // Check if error has location information (Babel errors typically do)
    // Note: typeof null === 'object' in JavaScript, so null check is necessary
    /* eslint-disable @typescript-eslint/no-unnecessary-condition */
    if (
      error !== null &&
      typeof error === 'object' &&
      'loc' in error &&
      error.loc !== null &&
      typeof error.loc === 'object' &&
      'line' in error.loc &&
      'column' in error.loc &&
      typeof error.loc.line === 'number' &&
      typeof error.loc.column === 'number'
    ) {
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      location = {
        start: {
          line: error.loc.line,
          column: error.loc.column,
        },
        end: {
          line: error.loc.line,
          column: error.loc.column,
        },
      };
    }

    return createParseError({
      code,
      message: `Failed to parse ${filename}: ${message}`,
      syntaxError: message,
      file: filename,
      location,
      suggestions: [],
    });
  });
}
