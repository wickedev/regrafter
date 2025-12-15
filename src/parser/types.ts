/**
 * Parser Component Type Definitions
 *
 * These types define the interfaces for the Parser component
 * which handles parsing source files into Babel AST format.
 */

import type { File as BabelFile , SourceLocation } from '@babel/types';

/**
 * Input file for parsing
 */
export interface FileInput {
  /** File path (used for error messages and caching) */
  path: string;
  /** File content to parse */
  content: string;
}

/**
 * Error that occurred during parsing
 */
export interface ParseError {
  /** Human-readable error message */
  message: string;
  /** Location in source where error occurred */
  location: SourceLocation | null;
  /** Error code for programmatic handling (e.g., 'E001', 'E002') */
  code: string;
}

/**
 * Result of parsing a single file
 */
export interface ParseResult {
  /** The parsed Babel AST (null if parsing completely failed) */
  ast: BabelFile | null;
  /** Array of errors encountered during parsing */
  errors: ParseError[];
  /** Whether parsing succeeded (may have recovered from some errors) */
  success: boolean;
}

/**
 * Parser interface for parsing source files
 */
export interface IParser {
  /**
   * Parse a single source file
   * @param source - Source code content
   * @param filename - File path (used for error messages and file type detection)
   * @returns ParseResult with AST and any errors
   */
  parse(source: string, filename: string): ParseResult;

  /**
   * Parse multiple files in batch
   * @param files - Array of file inputs to parse
   * @returns Map from file path to ParseResult
   */
  parseFiles(files: FileInput[]): Map<string, ParseResult>;

  /**
   * Invalidate cached AST for a file
   * @param filename - File path to invalidate
   */
  invalidateCache(filename: string): void;

  /**
   * Clear all cached ASTs
   */
  clearCache(): void;
}

/**
 * Supported file extensions for parsing
 */
export type SupportedExtension = '.ts' | '.tsx' | '.js' | '.jsx';

/**
 * Check if a filename has a supported extension
 */
export function isSupportedFile(filename: string): boolean {
  const ext = getExtension(filename);
  return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx';
}

/**
 * Get the extension from a filename
 */
export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if a file is a TypeScript file
 */
export function isTypeScriptFile(filename: string): boolean {
  const ext = getExtension(filename);
  return ext === '.ts' || ext === '.tsx';
}

/**
 * Check if a file is a JSX file (either .jsx or .tsx)
 */
export function isJSXFile(filename: string): boolean {
  const ext = getExtension(filename);
  return ext === '.jsx' || ext === '.tsx';
}
