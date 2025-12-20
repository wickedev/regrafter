/**
 * Parser Module
 *
 * Exports the Parser component for parsing source files into Babel AST format.
 * Supports JSX, TypeScript, and modern JavaScript syntax with error recovery.
 */

import { ASTStore } from './ast-store.js';

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

/**
 * Create a new ASTStore instance for caching parsed ASTs.
 *
 * Factory function following DIP (Dependency Inversion Principle).
 * Use this instead of direct constructor instantiation for better
 * testability and dependency management.
 *
 * @returns A new ASTStore instance
 *
 * @example
 * ```typescript
 * import { createASTStore } from './parser';
 *
 * const astStore = createASTStore();
 * astStore.set('app.tsx', sourceCode, parseResult);
 * const cached = astStore.get('app.tsx', sourceCode);
 * ```
 */
export function createASTStore(): ASTStore {
  return new ASTStore();
}
