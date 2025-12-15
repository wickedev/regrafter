import generate from '@babel/generator';
import type * as t from '@babel/types';
import {
  GeneratorOptions,
  GenerateResult,
  GeneratorError,
  IndentationInfo,
  CommentAttachment,
  DEFAULT_GENERATOR_OPTIONS,
} from './types.js';

/**
 * CodeGenerator wraps @babel/generator to produce code from AST
 * with comment preservation and indentation adjustment capabilities.
 *
 * Based on design.md section 3.8 Code Generator Component
 *
 * Responsibilities:
 * - Generate code from transformed AST
 * - Preserve comments and formatting when possible
 * - Adjust indentation for moved elements
 * - Handle import statement formatting and deduplication
 */
export class CodeGenerator {
  private options: Required<GeneratorOptions>;

  constructor(options: GeneratorOptions = {}) {
    this.options = { ...DEFAULT_GENERATOR_OPTIONS, ...options };
  }

  /**
   * Generate code from a Babel AST
   *
   * Task 1.5.1: Basic code generation using @babel/generator
   *
   * @param ast - The Babel AST to generate code from
   * @param options - Optional generation options to override defaults
   * @returns GenerateResult with code, optional source map, and any errors
   */
  generate(ast: t.File, options?: GeneratorOptions): GenerateResult {
    const mergedOptions = { ...this.options, ...options };
    const errors: GeneratorError[] = [];

    try {
      // Configure Babel generator options
      const babelGeneratorOptions = this.buildBabelGeneratorOptions(mergedOptions);

      // Generate code using @babel/generator
      const result = generate(ast, babelGeneratorOptions);

      return {
        code: result.code,
        map: result.map ? this.convertSourceMap(result.map) : undefined,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        message: `Code generation failed: ${errorMessage}`,
        code: 'E060',
      });

      return {
        code: '',
        errors,
      };
    }
  }

  /**
   * Generate code from multiple ASTs
   *
   * @param asts - Map of filename to AST
   * @param options - Optional generation options
   * @returns Map of filename to GenerateResult
   */
  generateMultiple(
    asts: Map<string, t.File>,
    options?: GeneratorOptions
  ): Map<string, GenerateResult> {
    const results = new Map<string, GenerateResult>();

    for (const [filename, ast] of asts) {
      results.set(filename, this.generate(ast, options));
    }

    return results;
  }

  /**
   * Build Babel generator options from our options
   *
   * Task 1.5.1: Configure generator for JSX output
   * Task 1.5.2: Configure to preserve comments
   */
  private buildBabelGeneratorOptions(
    options: Required<GeneratorOptions>
  ): Parameters<typeof generate>[1] {
    return {
      // Task 1.5.2: Comment preservation configuration
      comments: options.preserveComments,
      
      // Retain leading/trailing comments on nodes
      retainLines: false,
      
      // Compact mode disabled to preserve readability
      compact: false,
      
      // Minified mode disabled
      minified: false,
      
      // JSX-specific options
      jsescOption: {
        quotes: options.jsxSingleQuote ? 'single' : 'double',
      },
      
      // Generate source maps
      sourceMaps: true,
      
      // Formatting options
      auxiliaryCommentBefore: undefined,
      auxiliaryCommentAfter: undefined,
    };
  }

  /**
   * Convert Babel source map to our SourceMap format
   */
  private convertSourceMap(babelMap: unknown): GenerateResult['map'] {
    if (!babelMap || typeof babelMap !== 'object') {
      return undefined;
    }

    const map = babelMap as Record<string, unknown>;
    
    return {
      version: typeof map['version'] === 'number' ? map['version'] : 3,
      sources: Array.isArray(map['sources']) ? map['sources'] as string[] : [],
      names: Array.isArray(map['names']) ? map['names'] as string[] : [],
      mappings: typeof map['mappings'] === 'string' ? map['mappings'] : '',
      sourcesContent: Array.isArray(map['sourcesContent'])
        ? map['sourcesContent'] as string[]
        : undefined,
    };
  }

  // ============================================================
  // Task 1.5.2: Comment Preservation
  // ============================================================

  /**
   * Attach comments to the correct nodes after a move operation
   *
   * Task 1.5.2: Implement logic to attach comments to correct nodes after move
   *
   * @param node - The node to attach comments to
   * @param comments - The comments to attach
   */
  attachComments(node: t.Node, comments: CommentAttachment): void {
    if (comments.leadingComments && comments.leadingComments.length > 0) {
      node.leadingComments = this.cloneComments(comments.leadingComments);
    }

    if (comments.trailingComments && comments.trailingComments.length > 0) {
      node.trailingComments = this.cloneComments(comments.trailingComments);
    }

    if (comments.innerComments && comments.innerComments.length > 0) {
      node.innerComments = this.cloneComments(comments.innerComments);
    }
  }

  /**
   * Extract comments from a node before moving it
   *
   * Task 1.5.2: Handle leading, trailing, and inner comments
   *
   * @param node - The node to extract comments from
   * @returns CommentAttachment with all comments from the node
   */
  extractComments(node: t.Node): CommentAttachment {
    return {
      leadingComments: node.leadingComments
        ? this.cloneComments(node.leadingComments)
        : undefined,
      trailingComments: node.trailingComments
        ? this.cloneComments(node.trailingComments)
        : undefined,
      innerComments: node.innerComments
        ? this.cloneComments(node.innerComments)
        : undefined,
    };
  }

  /**
   * Remove comments from a node (used when transferring comments)
   *
   * @param node - The node to remove comments from
   */
  removeComments(node: t.Node): void {
    delete node.leadingComments;
    delete node.trailingComments;
    delete node.innerComments;
  }

  /**
   * Clone comments to prevent mutation issues
   *
   * @param comments - The comments to clone
   * @returns Cloned comments array
   */
  private cloneComments(comments: readonly t.Comment[]): t.Comment[] {
    return comments.map((comment) => ({
      type: comment.type,
      value: comment.value,
      start: comment.start,
      end: comment.end,
      loc: comment.loc
        ? {
            start: { ...comment.loc.start },
            end: { ...comment.loc.end },
          }
        : undefined,
    }));
  }

  /**
   * Transfer comments from source node to target node
   *
   * Useful when moving nodes - preserves comment associations
   *
   * @param source - The source node to transfer comments from
   * @param target - The target node to transfer comments to
   */
  transferComments(source: t.Node, target: t.Node): void {
    const comments = this.extractComments(source);
    this.attachComments(target, comments);
    this.removeComments(source);
  }

  // ============================================================
  // Task 1.5.3: Indentation Adjustment
  // ============================================================

  /**
   * Detect the indentation style used at a specific location in the code
   *
   * Task 1.5.3: Detect indentation style of target location
   *
   * @param code - The source code string
   * @param line - The line number (1-based) to detect indentation at
   * @returns IndentationInfo describing the indentation style
   */
  detectIndentation(code: string, line: number): IndentationInfo {
    const lines = code.split('\n');
    
    // Default indentation info
    const defaultInfo: IndentationInfo = {
      char: this.options.useTabs ? '\t' : ' '.repeat(this.options.indentSize),
      size: this.options.indentSize,
      useTabs: this.options.useTabs,
      level: 0,
    };

    if (line < 1 || line > lines.length) {
      return defaultInfo;
    }

    // Analyze multiple lines to determine the prevalent indentation style
    const indentationStats = this.analyzeIndentationStyle(lines);
    
    // Get the specific line's indentation
    const targetLine = lines[line - 1];
    if (!targetLine) {
      return defaultInfo;
    }

    const lineIndent = this.getLineIndentation(targetLine);
    
    // Calculate the indentation level based on detected style
    const level = indentationStats.useTabs
      ? lineIndent.tabs
      : Math.floor(lineIndent.spaces / indentationStats.size);

    return {
      char: indentationStats.useTabs ? '\t' : ' '.repeat(indentationStats.size),
      size: indentationStats.size,
      useTabs: indentationStats.useTabs,
      level,
    };
  }

  /**
   * Analyze the indentation style used throughout the code
   *
   * @param lines - Array of code lines
   * @returns Detected indentation configuration
   */
  private analyzeIndentationStyle(lines: string[]): {
    useTabs: boolean;
    size: number;
  } {
    let tabCount = 0;
    let spaceCount = 0;
    const spaceCounts: number[] = [];

    for (const line of lines) {
      if (line.trim().length === 0) continue;

      const indent = this.getLineIndentation(line);
      if (indent.tabs > 0) {
        tabCount++;
      }
      if (indent.spaces > 0) {
        spaceCount++;
        spaceCounts.push(indent.spaces);
      }
    }

    // Determine if tabs or spaces are more common
    const useTabs = tabCount > spaceCount;

    // Calculate the most common indent size for spaces
    let size = this.options.indentSize;
    if (!useTabs && spaceCounts.length > 0) {
      // Find GCD of all space counts to determine indent size
      const gcd = this.findGCD(spaceCounts);
      if (gcd >= 1 && gcd <= 8) {
        size = gcd;
      }
    }

    return { useTabs, size };
  }

  /**
   * Get the indentation of a specific line
   *
   * @param line - The line to analyze
   * @returns Object with tabs and spaces count
   */
  private getLineIndentation(line: string): { tabs: number; spaces: number } {
    let tabs = 0;
    let spaces = 0;

    for (const char of line) {
      if (char === '\t') {
        tabs++;
      } else if (char === ' ') {
        spaces++;
      } else {
        break;
      }
    }

    return { tabs, spaces };
  }

  /**
   * Find the Greatest Common Divisor of an array of numbers
   *
   * @param numbers - Array of numbers
   * @returns GCD of all numbers
   */
  private findGCD(numbers: number[]): number {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    
    if (numbers.length === 0) return 1;
    
    let result = numbers[0];
    if (result === undefined) return 1;
    
    for (let i = 1; i < numbers.length; i++) {
      const num = numbers[i];
      if (num !== undefined) {
        result = gcd(result, num);
      }
    }
    return result;
  }

  /**
   * Adjust indentation of code to match a target indentation level
   *
   * Task 1.5.3: Adjust moved element's indentation to match new context
   *
   * @param code - The code string to adjust
   * @param targetIndent - The target indentation info
   * @param preserveRelative - Whether to preserve relative indentation within the code
   * @returns Code with adjusted indentation
   */
  adjustIndentation(
    code: string,
    targetIndent: IndentationInfo,
    preserveRelative: boolean = true
  ): string {
    const lines = code.split('\n');
    
    if (lines.length === 0) {
      return code;
    }

    // Find the minimum indentation level in the code (base indentation)
    const baseIndent = preserveRelative
      ? this.findMinimumIndentation(lines)
      : { tabs: 0, spaces: 0 };

    // Calculate the base level
    const baseLevel = targetIndent.useTabs
      ? baseIndent.tabs
      : Math.floor(baseIndent.spaces / targetIndent.size);

    // Target indentation string
    const targetIndentStr = targetIndent.char.repeat(targetIndent.level);

    // Adjust each line
    const adjustedLines = lines.map((line) => {
      if (line.trim().length === 0) {
        return line; // Preserve empty lines as-is
      }

      const currentIndent = this.getLineIndentation(line);
      
      // Calculate the relative indentation level
      const currentLevel = targetIndent.useTabs
        ? currentIndent.tabs
        : Math.floor(currentIndent.spaces / targetIndent.size);
      
      const relativeLevel = preserveRelative
        ? Math.max(0, currentLevel - baseLevel)
        : 0;

      // Build new indentation
      const newIndentLevel = targetIndent.level + relativeLevel;
      const newIndent = targetIndent.char.repeat(newIndentLevel);

      // Strip old indentation and apply new
      const content = line.trimStart();
      return newIndent + content;
    });

    return adjustedLines.join('\n');
  }

  /**
   * Find the minimum indentation level in a set of lines
   *
   * Task 1.5.3: Preserve relative indentation within moved subtree
   *
   * @param lines - Array of code lines
   * @returns Minimum indentation info
   */
  private findMinimumIndentation(lines: string[]): { tabs: number; spaces: number } {
    let minTabs = Infinity;
    let minSpaces = Infinity;

    for (const line of lines) {
      // Skip empty lines
      if (line.trim().length === 0) continue;

      const indent = this.getLineIndentation(line);
      
      if (indent.tabs > 0 || indent.spaces > 0) {
        minTabs = Math.min(minTabs, indent.tabs);
        minSpaces = Math.min(minSpaces, indent.spaces);
      } else {
        // Line has no indentation
        minTabs = 0;
        minSpaces = 0;
      }
    }

    return {
      tabs: minTabs === Infinity ? 0 : minTabs,
      spaces: minSpaces === Infinity ? 0 : minSpaces,
    };
  }

  /**
   * Adjust indentation of a node's generated code to match the target context
   *
   * This is a convenience method that combines detection and adjustment
   *
   * @param nodeCode - The generated code for a node
   * @param targetCode - The code at the target location
   * @param targetLine - The line number where the node will be inserted
   * @returns Adjusted code string
   */
  adjustNodeIndentation(
    nodeCode: string,
    targetCode: string,
    targetLine: number
  ): string {
    const targetIndent = this.detectIndentation(targetCode, targetLine);
    return this.adjustIndentation(nodeCode, targetIndent, true);
  }

  /**
   * Update the generator options
   *
   * @param options - New options to merge with existing
   */
  updateOptions(options: GeneratorOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get the current options
   *
   * @returns Current generator options
   */
  getOptions(): Required<GeneratorOptions> {
    return { ...this.options };
  }
}
