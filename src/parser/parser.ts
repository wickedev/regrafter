/**
 * Parser Component
 *
 * Parses source files into Babel AST format with support for
 * JSX, TypeScript, and modern JavaScript syntax.
 */

import type { ParserOptions, ParserPlugin } from "@babel/parser";
import { parse as babelParse } from "@babel/parser";
import type { File as BabelFile, SourceLocation } from "@babel/types";

import type { ParseErrorType } from "../errors/error-category.js";
import { createParseError } from "../errors/index.js";
import { err, ok, type Result } from "../result/index.js";

import { ASTStore } from "./ast-store.js";
import type { FileInput, IParser, ParseError } from "./types.js";
import { getExtension, isTypeScriptFile } from "./types.js";

/**
 * Error codes for parser errors
 */
export const ParseErrorCodes = {
  /** Generic parse error */
  PARSE_ERROR: "E001",
  /** Unexpected token */
  UNEXPECTED_TOKEN: "E002",
  /** Unsupported file type */
  UNSUPPORTED_FILE: "E003",
  /** Empty source */
  EMPTY_SOURCE: "E004",
} as const;

/**
 * Base Babel parser plugins configuration
 * Includes JSX, TypeScript, and modern JavaScript features
 */
const BASE_PLUGINS: ParserPlugin[] = [
  "jsx",
  ["decorators", { decoratorsBeforeExport: true }],
  "classProperties",
  "classPrivateProperties",
  "classPrivateMethods",
  "exportDefaultFrom",
  "exportNamespaceFrom",
  "dynamicImport",
  "nullishCoalescingOperator",
  "optionalChaining",
  "topLevelAwait",
];

/**
 * Get parser plugins based on file type
 */
function getPluginsForFile(filename: string): ParserPlugin[] {
  const plugins = [...BASE_PLUGINS];

  // Add TypeScript plugin for .ts and .tsx files
  if (isTypeScriptFile(filename)) {
    plugins.push("typescript");
  }

  return plugins;
}

/**
 * Get parser options for a file
 */
function getParserOptions(filename: string): ParserOptions {
  return {
    sourceType: "module",
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
  if (error !== null && error !== undefined && typeof error === "object") {
    const babelError: unknown = error;

    // Type guard to check if error has the expected properties
    const hasMessage =
      babelError !== null &&
      typeof babelError === "object" &&
      "message" in babelError &&
      (typeof babelError.message === "string" ||
        babelError.message === undefined);

    const hasLoc =
      babelError !== null &&
      typeof babelError === "object" &&
      "loc" in babelError;

    const message =
      hasMessage &&
      typeof babelError === "object" &&
      "message" in babelError &&
      typeof babelError.message === "string"
        ? babelError.message
        : "Unknown parse error";

    const code = message.includes("Unexpected token")
      ? ParseErrorCodes.UNEXPECTED_TOKEN
      : ParseErrorCodes.PARSE_ERROR;

    let location: SourceLocation | null = null;

    if (
      hasLoc &&
      typeof babelError === "object" &&
      "loc" in babelError &&
      babelError.loc !== null &&
      typeof babelError.loc === "object" &&
      "line" in babelError.loc &&
      "column" in babelError.loc &&
      typeof babelError.loc.line === "number" &&
      typeof babelError.loc.column === "number"
    ) {
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
   * @returns Result with AST or parse error
   */
  parse(source: string, filename: string): Result<BabelFile, ParseErrorType> {
    // Check for empty source
    if (!source || source.trim() === "") {
      return err(
        createParseError({
          code: ParseErrorCodes.EMPTY_SOURCE,
          message: `Empty source file: ${filename}`,
          syntaxError: "Empty source",
          file: filename,
          suggestions: [],
        })
      );
    }

    // Check for unsupported file extensions
    const ext = getExtension(filename);
    if (ext && ![".ts", ".tsx", ".js", ".jsx", ""].includes(ext)) {
      return err(
        createParseError({
          code: ParseErrorCodes.UNSUPPORTED_FILE,
          message: `Unsupported file type: ${ext}`,
          syntaxError: `Unsupported file extension: ${ext}`,
          file: filename,
          suggestions: [],
        })
      );
    }

    // Check cache first
    const cached = this.astStore.get(filename, source);
    if (cached) {
      return cached;
    }

    try {
      const options = getParserOptions(filename);
      const ast = babelParse(source, options);

      // Extract any errors from recovery mode (ignored for now - we succeed if we got AST)
      // const recoveredErrors = extractRecoveredErrors(ast, filename);

      const result = ok(ast);

      // Cache the result
      this.astStore.set(filename, source, result);

      return result;
    } catch (error) {
      // Complete parsing failure
      const parseError = toBabelParseError(error, filename);
      return err(
        createParseError({
          code: parseError.code,
          message: parseError.message,
          syntaxError: parseError.message,
          file: filename,
          location: parseError.location ?? undefined,
          suggestions: [],
        })
      );
    }
  }

  /**
   * Parse multiple files in batch
   * @param files - Array of file inputs to parse
   * @returns Map from file path to Result
   */
  parseFiles(
    files: FileInput[]
  ): Map<string, Result<BabelFile, ParseErrorType>> {
    const results = new Map<string, Result<BabelFile, ParseErrorType>>();

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
