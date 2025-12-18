/**
 * Code Generator Module
 *
 * This module provides functionality for generating code from Babel AST
 * with support for comment preservation and indentation adjustment.
 *
 * @module generator
 */

import type * as t from '@babel/types';

import { createTransformError, type TransformError } from '../errors/index.js';
import { tryCatch , mapErr } from '../result/helpers.js';
import type { Result } from '../result/types.js';
import { ok, err } from '../result/types.js';

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
): Result<string, TransformError> {
  // Create generator with options
  const generator = new CodeGenerator(options);

  // Generate code - this now returns Result<GeneratedCode, TransformError>
  const generateResult = generator.generate(ast);

  if (!generateResult.ok) {
    // Return the TransformError directly
    return generateResult;
  }

  // Extract just the code string from the GeneratedCode
  return ok(generateResult.value.code);
}
