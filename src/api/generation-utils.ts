/**
 * Code Generation Utilities Module
 *
 * Shared utilities for code generation in the API layer.
 * Extracted from duplicated code in move.ts (Phase 1 consolidation).
 *
 * @module api/generation-utils
 */

import type * as t from '@babel/types';
import type { RegraffError } from '../errors/index.js';
import type { CodeGenerator } from '../generator/code-generator.js';
import { err, isErr, ok, type Result } from '../result/index.js';
import { createCode } from '../types/index.js';
import type { Code, FileInput } from '../types/index.js';

/**
 * Generate code for all files using the provided generator
 *
 * @param files - Array of file inputs to generate code for
 * @param parsedFiles - Map of file paths to parsed ASTs
 * @param sourceFile - Path to the file that was modified (marked as changed)
 * @param generator - Code generator instance to use
 * @returns Result containing array of generated code objects, or generation error
 *
 * @example
 * ```typescript
 * const generator = new CodeGenerator();
 * const result = generateCodeForFiles(files, parsedFiles, 'App.tsx', generator);
 * if (isErr(result)) {
 *   console.error('Generation failed:', result.error.message);
 *   return;
 * }
 * const codes = result.value;
 * console.log('Generated', codes.length, 'files');
 * ```
 */
export function generateCodeForFiles(
  files: FileInput[],
  parsedFiles: Map<string, t.File>,
  sourceFile: string,
  generator: CodeGenerator
): Result<Code[], RegraffError> {
  const codes: Code[] = [];

  for (const file of files) {
    const ast = parsedFiles.get(file.path);
    if (!ast) continue;

    const generateResult = generator.generate(ast);
    if (isErr(generateResult)) {
      return err(generateResult.error);
    }

    const generated = generateResult.value;
    codes.push(
      createCode({
        file: file.path,
        content: generated.code,
        changed: file.path === sourceFile,
        original: file.path === sourceFile ? file.content : undefined,
      })
    );
  }

  return ok(codes);
}
