/**
 * Code Generator Interface
 *
 * Defines the contract for code generation from AST.
 * Implementations wrap @babel/generator to produce formatted code
 * with comment preservation and indentation adjustment.
 *
 * @module interfaces/ICodeGenerator
 */

import type * as t from '@babel/types';

import type { TransformErrorType } from '../errors/index.js';
import type { CommentAttachment, GeneratedCode, GeneratorOptions, IndentationInfo } from '../generator/types.js';
import type { Result } from '../result/index.js';

/**
 * Interface for code generation operations
 *
 * Implementations must:
 * - Generate code from Babel AST
 * - Preserve comments during transformations
 * - Adjust indentation for moved code blocks
 * - Support custom formatting options
 * - Handle both single and multiple file generation
 *
 * @example
 * ```typescript
 * const generator: ICodeGenerator = new CodeGenerator({
 *   retainLines: true,
 *   compact: false,
 * });
 *
 * const result = generator.generate(ast);
 * if (isErr(result)) {
 *   console.error('Generation failed:', result.error);
 *   return;
 * }
 *
 * console.log('Generated code:', result.value.code);
 * ```
 */
export interface ICodeGenerator {
  /**
   * Generate code from a Babel AST
   *
   * @param ast - The Babel AST to generate code from
   * @param options - Optional generation options (overrides constructor options)
   * @returns Result containing generated code and source map, or TransformError
   *
   * @example
   * ```typescript
   * const result = generator.generate(ast, { retainLines: true });
   * if (isErr(result)) {
   *   console.error('Generation error:', result.error.message);
   *   return;
   * }
   * const { code, map } = result.value;
   * ```
   */
  generate(ast: t.File, options?: GeneratorOptions): Result<GeneratedCode, TransformErrorType>;

  /**
   * Generate code for multiple ASTs
   *
   * Batch operation for generating code from multiple files.
   *
   * @param asts - Map of file paths to ASTs
   * @param options - Optional generation options
   * @returns Result containing map of file paths to generated code, or TransformError
   *
   * @example
   * ```typescript
   * const result = generator.generateMultiple(astMap);
   * if (isErr(result)) {
   *   console.error('Batch generation failed:', result.error);
   *   return;
   * }
   * for (const [file, code] of result.value.entries()) {
   *   console.log(`Generated ${file}: ${code.code.length} bytes`);
   * }
   * ```
   */
  generateMultiple(
    asts: Map<string, t.File>,
    options?: GeneratorOptions
  ): Result<Map<string, GeneratedCode>, TransformErrorType>;

  /**
   * Attach comments to a node
   *
   * @param node - Node to attach comments to
   * @param comments - Comments to attach
   */
  attachComments(node: t.Node, comments: CommentAttachment): void;

  /**
   * Extract comments from a node
   *
   * @param node - Node to extract comments from
   * @returns Extracted comments (leading and trailing)
   */
  extractComments(node: t.Node): CommentAttachment;

  /**
   * Remove all comments from a node
   *
   * @param node - Node to remove comments from
   */
  removeComments(node: t.Node): void;

  /**
   * Transfer comments from source node to target node
   *
   * Preserves comments when moving/replacing nodes.
   *
   * @param source - Source node with comments
   * @param target - Target node to receive comments
   */
  transferComments(source: t.Node, target: t.Node): void;

  /**
   * Detect indentation style from source code
   *
   * @param code - Source code to analyze
   * @param line - Line number to check (1-indexed)
   * @returns Indentation information (spaces/tabs, amount)
   */
  detectIndentation(code: string, line: number): IndentationInfo;

  /**
   * Adjust indentation of generated code
   *
   * @param code - Code to adjust
   * @param targetIndent - Target indentation information
   * @param preserveRelative - Whether to preserve relative indentation within the code
   * @returns Adjusted code
   */
  adjustIndentation(code: string, targetIndent: IndentationInfo, preserveRelative?: boolean): string;

  /**
   * Adjust node indentation to match target location
   *
   * @param nodeCode - Code of the node to adjust
   * @param targetCode - Code containing the target location
   * @param targetLine - Line number where the node will be inserted
   * @returns Adjusted code string
   */
  adjustNodeIndentation(nodeCode: string, targetCode: string, targetLine: number): string;

  /**
   * Update generator options
   *
   * @param options - New options to merge with existing options
   */
  updateOptions(options: GeneratorOptions): void;

  /**
   * Get current generator options
   *
   * @returns Current options
   */
  getOptions(): Required<GeneratorOptions>;
}
