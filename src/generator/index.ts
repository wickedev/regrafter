/**
 * Code Generator Module
 *
 * This module provides functionality for generating code from Babel AST
 * with support for comment preservation and indentation adjustment.
 *
 * @module generator
 */

export { CodeGenerator } from './code-generator.js';
export type {
  GeneratorOptions,
  GenerateResult,
  GeneratorError,
  SourceMap,
  CommentAttachment,
  IndentationInfo,
} from './types.js';
export { DEFAULT_GENERATOR_OPTIONS } from './types.js';
