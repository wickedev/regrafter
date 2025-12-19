/**
 * Selector Resolver Interface
 *
 * Defines the contract for resolving position-based and path-based selectors
 * to AST nodes. Implementations navigate the AST to find JSX elements based
 * on source code positions or AST path notation.
 *
 * @module interfaces/ISelectorResolver
 */

import type * as t from '@babel/types';
import type { SelectorErrorType } from '../errors/index.js';
import type { Result } from '../result/index.js';
import type {
  Selector,
  PositionSelector,
  PathSelector,
} from '../types/public.js';
import type { ResolveResult } from '../types/internal.js';
import type { ElementData } from '../selector/selector-resolver.js';

/**
 * Interface for selector resolution operations
 *
 * Implementations must:
 * - Resolve position selectors to most specific JSX element at line/column
 * - Resolve path selectors using AST dot notation (e.g., "Program.body[0]")
 * - Detect atomic units (conditionals, maps, ternaries, compound components)
 * - Handle JSXExpressionContainer wrapping transparently
 * - Provide both legacy and Result-based APIs for compatibility
 * - Return comprehensive error information for failed resolutions
 *
 * @example
 * ```typescript
 * const resolver: ISelectorResolver = createSelectorResolver();
 *
 * // Position-based selection (line 10, column 5)
 * const posSelector = { file: 'App.tsx', line: 10, column: 5 };
 * const posResult = resolver.resolveResult(posSelector, ast);
 *
 * if (isErr(posResult)) {
 *   console.error('No JSX at position:', posResult.error.message);
 *   return;
 * }
 *
 * console.log('Found element:', posResult.value.node.type);
 * console.log('Atomic unit:', posResult.value.atomicUnit?.type);
 *
 * // Path-based selection
 * const pathSelector = { file: 'App.tsx', path: 'Program.body[0].declaration' };
 * const pathResult = resolver.resolveResult(pathSelector, ast);
 *
 * if (isErr(pathResult)) {
 *   console.error('Path not found:', pathResult.error.message);
 *   return;
 * }
 *
 * console.log('Found node:', pathResult.value.node.type);
 * ```
 */
export interface ISelectorResolver {
  /**
   * Resolve a selector to an AST node and path (legacy method)
   *
   * Automatically detects selector type (position or path) and delegates
   * to the appropriate resolver. Returns legacy ResolveResult format for
   * backward compatibility.
   *
   * @param selector - Position or path-based selector
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with node, path, and atomic unit
   *
   * @example
   * ```typescript
   * const result = resolver.resolve(selector, ast);
   *
   * if (result.error) {
   *   console.error('Resolution failed:', result.error.message);
   *   return;
   * }
   *
   * const node = result.node;
   * const path = result.path;
   * const atomicUnit = result.computeAtomicUnit();
   * ```
   */
  resolve(selector: Selector, ast: t.File): ResolveResult;

  /**
   * Resolve a selector to an AST node and path (Result-based)
   *
   * Automatically detects selector type (position or path) and delegates
   * to the appropriate resolver. Returns Result type for explicit error handling.
   *
   * @param selector - Position or path-based selector
   * @param ast - Parsed AST of the file
   * @returns Result with ElementData or SelectorError
   *
   * @example
   * ```typescript
   * const result = resolver.resolveResult(selector, ast);
   *
   * if (isErr(result)) {
   *   console.error('Code:', result.error.code);
   *   console.error('Message:', result.error.message);
   *   if (result.error.location) {
   *     console.error('Location:', result.error.location);
   *   }
   *   return;
   * }
   *
   * const { node, path, atomicUnit } = result.value;
   * ```
   */
  resolveResult(selector: Selector, ast: t.File): Result<ElementData, SelectorErrorType>;

  /**
   * Find the most specific JSX element at a position (legacy method)
   *
   * Uses specificity scoring to prefer smaller, more precisely targeted nodes.
   * Searches for JSXElement, JSXFragment, JSXText, and JSXExpressionContainer
   * nodes that contain the given line/column position.
   *
   * @param selector - Position selector with line and column
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with resolved node or error
   *
   * @example
   * ```typescript
   * const selector = { file: 'App.tsx', line: 15, column: 8 };
   * const result = resolver.resolveByPosition(selector, ast);
   *
   * if (result.error) {
   *   console.error('No JSX at line 15, column 8');
   *   return;
   * }
   *
   * console.log('Found:', result.node.type);
   * ```
   */
  resolveByPosition(selector: PositionSelector, ast: t.File): ResolveResult;

  /**
   * Find the most specific JSX element at a position (Result-based)
   *
   * Uses specificity scoring to prefer smaller, more precisely targeted nodes.
   * Validates position is within bounds (line >= 1, column >= 0) and returns
   * detailed error information for failed resolutions.
   *
   * @param selector - Position selector with line and column
   * @param ast - Parsed AST of the file
   * @returns Result with ElementData or SelectorError
   *
   * @example
   * ```typescript
   * const selector = { file: 'App.tsx', line: 15, column: 8 };
   * const result = resolver.resolveByPositionResult(selector, ast);
   *
   * if (isErr(result)) {
   *   if (result.error.code === 'S002') {
   *     console.error('Position out of bounds');
   *   } else if (result.error.code === 'S003') {
   *     console.error('No JSX element at this position');
   *   }
   *   return;
   * }
   *
   * const { node, path, atomicUnit } = result.value;
   * console.log('Element type:', node.type);
   * console.log('Atomic unit type:', atomicUnit?.type);
   * ```
   */
  resolveByPositionResult(selector: PositionSelector, ast: t.File): Result<ElementData, SelectorErrorType>;

  /**
   * Navigate the AST using a dot-notation path (legacy method)
   *
   * Supports array indexing with bracket notation:
   * - "Program.body[0]" - First statement in program
   * - "Program.body[0].declaration.body.body[2]" - Third statement in function
   *
   * @param selector - Path selector with AST path
   * @param ast - Parsed AST of the file
   * @returns ResolveResult with resolved node or error
   *
   * @example
   * ```typescript
   * const selector = {
   *   file: 'App.tsx',
   *   path: 'Program.body[0].declaration.body.body[1]'
   * };
   * const result = resolver.resolveByPath(selector, ast);
   *
   * if (result.error) {
   *   console.error('Path not found:', result.error.message);
   *   return;
   * }
   *
   * console.log('Found node:', result.node.type);
   * ```
   */
  resolveByPath(selector: PathSelector, ast: t.File): ResolveResult;

  /**
   * Navigate the AST using a dot-notation path (Result-based)
   *
   * Validates path format and navigates using property access and array indexing.
   * Returns detailed error information including:
   * - Invalid path format (empty or malformed)
   * - Path not found (invalid property or index)
   *
   * @param selector - Path selector with AST path
   * @param ast - Parsed AST of the file
   * @returns Result with ElementData or SelectorError
   *
   * @example
   * ```typescript
   * const selector = {
   *   file: 'App.tsx',
   *   path: 'Program.body[0].declaration.body.body[1]'
   * };
   * const result = resolver.resolveByPathResult(selector, ast);
   *
   * if (isErr(result)) {
   *   if (result.error.code === 'S004') {
   *     console.error('Invalid path format:', result.error.message);
   *   } else if (result.error.code === 'S005') {
   *     console.error('Path does not exist:', result.error.message);
   *   }
   *   return;
   * }
   *
   * const { node, path, atomicUnit } = result.value;
   * console.log('Node at path:', node.type);
   * ```
   */
  resolveByPathResult(selector: PathSelector, ast: t.File): Result<ElementData, SelectorErrorType>;
}
