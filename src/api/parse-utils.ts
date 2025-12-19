/**
 * Parse Utilities Module
 *
 * Shared utilities for parsing files in the API layer.
 * Extracted from duplicated code in move.ts and inline.ts (Phase 1 consolidation).
 *
 * @module api/parse-utils
 */

import type * as t from '@babel/types';

import type { RegraffError } from '../errors/index.js';
import { parseFile } from '../parser/parse-file.js';
import { err, isErr, ok, type Result } from '../result/index.js';
import type { FileInput } from '../types/index.js';

/**
 * Parse all files and return AST map
 *
 * @param files - Array of file inputs to parse
 * @returns Result containing map of file paths to parsed ASTs, or parse error
 *
 * @example
 * ```typescript
 * const result = parseAllFiles(files);
 * if (isErr(result)) {
 *   console.error('Parse failed:', result.error.message);
 *   return;
 * }
 * const parsedFiles = result.value;
 * const ast = parsedFiles.get('App.tsx');
 * ```
 */
export function parseAllFiles(
  files: FileInput[]
): Result<Map<string, t.File>, RegraffError> {
  const parsedFiles = new Map<string, t.File>();

  for (const file of files) {
    const result = parseFile(file.path, file.content);
    if (isErr(result)) {
      return err(result.error);
    }
    parsedFiles.set(file.path, result.value);
  }

  return ok(parsedFiles);
}
