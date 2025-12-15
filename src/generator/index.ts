/**
 * Code Generator Module
 *
 * This module provides functionality for generating code from Babel AST
 * with support for comment preservation and indentation adjustment.
 *
 * @module generator
 */

export { CodeGenerator } from './CodeGenerator.js';
export {
  GeneratorOptions,
  GenerateResult,
  GeneratorError,
  SourceMap,
  CommentAttachment,
  IndentationInfo,
  DEFAULT_GENERATOR_OPTIONS,
} from './types.js';
