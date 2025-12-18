/**
 * Parser Module
 *
 * Exports the Parser component for parsing source files into Babel AST format.
 * Supports JSX, TypeScript, and modern JavaScript syntax with error recovery.
 */

export { Parser, createParser, ParseErrorCodes } from './parser.js';
export { parseFile } from './parse-file.js';
export { ASTStore, computeContentHash } from './ast-store.js';
export {
  getExtension,
  isJSXFile,
  isSupportedFile,
  isTypeScriptFile,
} from './types.js';
export type {
  FileInput,
  IParser,
  ParseError,
  SupportedExtension,
} from './types.js';
