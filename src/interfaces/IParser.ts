/**
 * Parser Interface
 *
 * Defines the contract for parsing source files into Babel AST format.
 * Implementations handle JSX, TypeScript, and modern JavaScript syntax
 * with support for error recovery and AST caching.
 *
 * @module interfaces/IParser
 */

import type { File as BabelFile } from '@babel/types';

import type { ParseErrorType } from '../errors/index.js';
import type { FileInput } from '../parser/types.js';
import type { Result } from '../result/index.js';

/**
 * Interface for parsing operations
 *
 * Implementations must:
 * - Parse .ts, .tsx, .js, .jsx files into Babel AST
 * - Support JSX syntax and TypeScript type annotations
 * - Handle modern JavaScript features (optional chaining, nullish coalescing, etc.)
 * - Provide error recovery mode for continued parsing after syntax errors
 * - Cache ASTs with content hash validation for performance
 * - Return meaningful error messages with source locations
 *
 * @example
 * ```typescript
 * const parser: IParser = createParser();
 *
 * // Parse a single file
 * const source = 'const App = () => <div>Hello</div>;';
 * const result = parser.parse(source, 'App.tsx');
 *
 * if (isErr(result)) {
 *   console.error('Parse error:', result.error.message);
 *   if (result.error.location) {
 *     const { line, column } = result.error.location.start;
 *     console.error(`  at line ${line}, column ${column}`);
 *   }
 *   return;
 * }
 *
 * const ast = result.value;
 * console.log('AST type:', ast.type); // "File"
 * console.log('Program body:', ast.program.body.length);
 *
 * // Parse multiple files
 * const files = [
 *   { path: 'App.tsx', content: appSource },
 *   { path: 'Button.tsx', content: buttonSource },
 * ];
 * const results = parser.parseFiles(files);
 *
 * for (const [path, result] of results) {
 *   if (isErr(result)) {
 *     console.error(`Failed to parse ${path}:`, result.error.message);
 *   } else {
 *     console.log(`Parsed ${path} successfully`);
 *   }
 * }
 * ```
 */
export interface IParser {
  /**
   * Parse a single source file
   *
   * Parses JavaScript/TypeScript source code into a Babel AST.
   * The AST is cached based on file path and content hash for performance.
   *
   * Supports:
   * - JSX elements and fragments
   * - TypeScript type annotations (.ts, .tsx files)
   * - Modern JavaScript (ES2020+)
   * - Decorators, class properties, optional chaining, etc.
   *
   * Error handling:
   * - Empty source: Returns ParseError with code "E004"
   * - Unsupported file type: Returns ParseError with code "E003"
   * - Syntax errors: Returns ParseError with location and suggestions
   *
   * @param source - Source code content
   * @param filename - File path (used for error messages and type detection)
   * @returns Result with Babel AST or ParseError
   *
   * @example
   * ```typescript
   * const source = `
   *   import React from 'react';
   *   export const Button = ({ label }: { label: string }) => (
   *     <button>{label}</button>
   *   );
   * `;
   *
   * const result = parser.parse(source, 'Button.tsx');
   *
   * if (isErr(result)) {
   *   console.error('Syntax error:', result.error.message);
   *   console.error('Code:', result.error.code);
   *   if (result.error.suggestions.length > 0) {
   *     console.log('Suggestions:', result.error.suggestions);
   *   }
   *   return;
   * }
   *
   * const ast = result.value;
   * console.log('Parsed successfully');
   * console.log('Imports:', ast.program.body.filter(n => n.type === 'ImportDeclaration').length);
   * console.log('Exports:', ast.program.body.filter(n => n.type === 'ExportNamedDeclaration').length);
   * ```
   */
  parse(source: string, filename: string): Result<BabelFile, ParseErrorType>;

  /**
   * Parse multiple files in batch
   *
   * Parses an array of files and returns a map of results.
   * Each file is parsed independently; errors in one file do not affect others.
   * All files use the same parser configuration and benefit from caching.
   *
   * @param files - Array of file inputs to parse
   * @returns Map from file path to parse Result
   *
   * @example
   * ```typescript
   * const files = [
   *   { path: 'src/App.tsx', content: appSource },
   *   { path: 'src/components/Header.tsx', content: headerSource },
   *   { path: 'src/components/Footer.tsx', content: footerSource },
   * ];
   *
   * const results = parser.parseFiles(files);
   *
   * const errors: string[] = [];
   * const asts = new Map<string, BabelFile>();
   *
   * for (const [path, result] of results) {
   *   if (isErr(result)) {
   *     errors.push(`${path}: ${result.error.message}`);
   *   } else {
   *     asts.set(path, result.value);
   *   }
   * }
   *
   * if (errors.length > 0) {
   *   console.error('Parse errors:');
   *   errors.forEach(err => console.error(`  - ${err}`));
   * }
   *
   * console.log(`Successfully parsed ${asts.size} of ${files.length} files`);
   * ```
   */
  parseFiles(
    files: FileInput[]
  ): Map<string, Result<BabelFile, ParseErrorType>>;

  /**
   * Invalidate cached AST for a file
   *
   * Removes the cached AST for a specific file path.
   * Next parse() call for this file will re-parse from source.
   *
   * Use this when file content changes externally or when you need
   * to force a re-parse for testing purposes.
   *
   * @param filename - File path to invalidate
   *
   * @example
   * ```typescript
   * // Initial parse
   * const result1 = parser.parse(source, 'App.tsx');
   *
   * // Modify source externally
   * source = updatedSource;
   *
   * // Invalidate cache to force re-parse
   * parser.invalidateCache('App.tsx');
   *
   * // Next parse will use new source
   * const result2 = parser.parse(source, 'App.tsx');
   * ```
   */
  invalidateCache(filename: string): void;

  /**
   * Clear all cached ASTs
   *
   * Removes all cached ASTs from the parser's internal cache.
   * Useful for freeing memory or ensuring clean state in tests.
   *
   * @example
   * ```typescript
   * // Parse many files
   * const results = parser.parseFiles(files);
   *
   * // Work with ASTs...
   *
   * // Free memory when done
   * parser.clearCache();
   * console.log('Cache cleared');
   * ```
   */
  clearCache(): void;

  /**
   * Get the number of cached files
   *
   * Returns the count of files currently cached in the parser.
   * Useful for monitoring cache usage and testing cache behavior.
   *
   * @returns Number of cached ASTs
   *
   * @example
   * ```typescript
   * console.log('Cache size before:', parser.getCacheSize()); // 0
   *
   * parser.parse(source1, 'file1.tsx');
   * parser.parse(source2, 'file2.tsx');
   *
   * console.log('Cache size after:', parser.getCacheSize()); // 2
   *
   * parser.invalidateCache('file1.tsx');
   * console.log('Cache size after invalidation:', parser.getCacheSize()); // 1
   *
   * parser.clearCache();
   * console.log('Cache size after clear:', parser.getCacheSize()); // 0
   * ```
   */
  getCacheSize(): number;
}
