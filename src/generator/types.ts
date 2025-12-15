import type * as t from '@babel/types';

/**
 * Options for code generation
 * Based on design.md section 3.8 Code Generator Component
 */
export interface GeneratorOptions {
  /**
   * Whether to preserve comments from the original source
   * @default true
   */
  preserveComments?: boolean;

  /**
   * Whether to format the output code
   * @default false
   */
  formatOutput?: boolean;

  /**
   * Number of spaces for indentation
   * @default 2
   */
  indentSize?: number;

  /**
   * Whether to use tabs instead of spaces
   * @default false
   */
  useTabs?: boolean;

  /**
   * Maximum line width for formatting
   * @default 80
   */
  printWidth?: number;

  /**
   * Whether to use single quotes for strings
   * @default true
   */
  singleQuote?: boolean;

  /**
   * Trailing comma style
   * @default 'es5'
   */
  trailingComma?: 'none' | 'es5' | 'all';

  /**
   * Whether to add semicolons
   * @default true
   */
  semicolons?: boolean;

  /**
   * JSX quote style (single or double)
   * @default 'double'
   */
  jsxSingleQuote?: boolean;
}

/**
 * Result of code generation
 */
export interface GenerateResult {
  /**
   * The generated code string
   */
  code: string;

  /**
   * Source map for the generated code (if requested)
   */
  map?: SourceMap;

  /**
   * Any errors encountered during generation
   */
  errors: GeneratorError[];
}

/**
 * Source map structure
 */
export interface SourceMap {
  version: number;
  sources: string[];
  names: string[];
  mappings: string;
  sourcesContent?: string[];
}

/**
 * Error that occurred during code generation
 */
export interface GeneratorError {
  message: string;
  location?: {
    line: number;
    column: number;
  };
  code?: string;
}

/**
 * Comment attachment information
 */
export interface CommentAttachment {
  /**
   * Leading comments before the node
   */
  leadingComments?: t.Comment[];

  /**
   * Trailing comments after the node
   */
  trailingComments?: t.Comment[];

  /**
   * Inner comments within the node
   */
  innerComments?: t.Comment[];
}

/**
 * Indentation detection result
 */
export interface IndentationInfo {
  /**
   * The indentation character(s) used
   */
  char: string;

  /**
   * The size of each indentation level
   */
  size: number;

  /**
   * Whether tabs are used
   */
  useTabs: boolean;

  /**
   * The current indentation level
   */
  level: number;
}

/**
 * Default generator options
 */
export const DEFAULT_GENERATOR_OPTIONS: Required<GeneratorOptions> = {
  preserveComments: true,
  formatOutput: false,
  indentSize: 2,
  useTabs: false,
  printWidth: 80,
  singleQuote: true,
  trailingComma: 'es5',
  semicolons: true,
  jsxSingleQuote: false,
};
