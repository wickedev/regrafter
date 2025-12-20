/**
 * Code Generator Module
 *
 * This module provides functionality for generating code from Babel AST
 * with support for comment preservation and indentation adjustment.
 *
 * @module generator
 */

import type * as t from '@babel/types';

import type { TransformErrorType } from '../errors/index.js';
import type { Result } from '../result/types.js';
import { ok, err, isErr } from '../result/types.js';

import { CodeGenerator } from './code-generator.js';
import type { GeneratorOptions } from './types.js';


export { CodeGenerator } from './code-generator.js';
export type {
  GeneratorOptions,
  GeneratedCode,
  SourceMap,
  CommentAttachment,
  IndentationInfo,
} from './types.js';
export { DEFAULT_GENERATOR_OPTIONS } from './types.js';

/**
 * Create a new CodeGenerator instance with optional configuration.
 *
 * Factory function following DIP (Dependency Inversion Principle).
 * Use this instead of direct constructor instantiation for better
 * testability and dependency management.
 *
 * @param options - Optional generator options
 * @returns A new CodeGenerator instance
 *
 * @example
 * ```typescript
 * import { createCodeGenerator } from './generator';
 *
 * const generator = createCodeGenerator({
 *   preserveComments: true,
 *   singleQuote: true,
 * });
 *
 * const result = generator.generate(ast);
 * ```
 */
export function createCodeGenerator(options?: GeneratorOptions): CodeGenerator {
  return new CodeGenerator(options);
}

/**
 * Generate code from a Babel AST using the Result pattern.
 *
 * This function wraps the CodeGenerator's generate method and returns
 * a Result type instead of throwing exceptions. It converts generation
 * errors into TransformError instances.
 *
 * @param ast - The Babel AST to generate code from
 * @param options - Optional generator options
 * @returns Ok with the generated code string, or Err with a TransformError
 *
 * @example
 * ```typescript
 * import { parseFile } from '../parser';
 * import { generateCode } from '../generator';
 *
 * const parseResult = parseFile('app.tsx', sourceCode);
 * if (parseResult.ok) {
 *   const codeResult = generateCode(parseResult.value);
 *   if (codeResult.ok) {
 *     console.log('Generated code:', codeResult.value);
 *   } else {
 *     console.error('Generation failed:', codeResult.error.message);
 *   }
 * }
 * ```
 */
export function generateCode(
  ast: t.File,
  options?: GeneratorOptions
): Result<string, TransformErrorType> {
  // Create generator with options using factory
  const generator = createCodeGenerator(options);

  // Generate code - this now returns Result<GeneratedCode, TransformErrorType>
  const generateResult = generator.generate(ast);

  if (isErr(generateResult)) {
    return err(generateResult.error);
  }

  // Extract just the code string from the GeneratedCode
  return ok(generateResult.value.code);
}
