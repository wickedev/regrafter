/**
 * Dependency Analyzer Interface
 *
 * Defines the contract for dependency analysis of JSX elements.
 * Implementations analyze React/JSX code to identify hooks, variables,
 * imports, props, context, and refs that an element depends on.
 *
 * @module interfaces/IDependencyAnalyzer
 */

import type { NodePath } from '@babel/traverse';

import type { AnalyzabilityResult, DependencyAnalysis } from '../analyzer/types.js';
import type { DependencyErrorType } from '../errors/error-category.js';
import type { Result } from '../result/index.js';
import type { ScopeInfo } from '../scope/index.js';

/**
 * Interface for dependency analysis operations
 *
 * Implementations must:
 * - Detect all dependency types (hooks, variables, imports, props, context, refs)
 * - Check code analyzability before analysis
 * - Return Result type for error handling
 * - Support cross-file dependency detection
 *
 * @example
 * ```typescript
 * const analyzer: IDependencyAnalyzer = createDependencyAnalyzer(scopeManager);
 * analyzer.setCurrentFile('App.tsx');
 *
 * const result = analyzer.analyzeElement(elementPath, targetScope);
 * if (isErr(result)) {
 *   console.error('Analysis failed:', result.error.message);
 *   return;
 * }
 *
 * const analysis = result.value;
 * console.log('Hook dependencies:', analysis.hooks.length);
 * console.log('Variable dependencies:', analysis.variables.length);
 * ```
 */
export interface IDependencyAnalyzer {
  /**
   * Set the current file being analyzed
   *
   * @param file - Path to the current file (used for error reporting)
   */
  setCurrentFile(file: string): void;

  /**
   * Analyze a JSX element to find all dependencies
   *
   * Detects all dependency types:
   * - React hooks (useState, useEffect, etc.)
   * - Variables (let, const declarations)
   * - Imports (from other modules)
   * - Props (component parameters)
   * - Context (React.createContext values)
   * - Refs (useRef instances)
   *
   * @param elementPath - Path to the JSX element to analyze
   * @param targetScope - Target scope for the move (determines required hoisting)
   * @returns Result containing full dependency analysis or DependencyError
   *
   * @example
   * ```typescript
   * const result = analyzer.analyzeElement(elementPath, targetScope);
   * if (isErr(result)) {
   *   console.error('Cannot analyze:', result.error.message);
   *   return;
   * }
   *
   * const { hooks, variables, imports } = result.value;
   * ```
   */
  analyzeElement(
    elementPath: NodePath,
    targetScope: ScopeInfo | null
  ): Result<DependencyAnalysis, DependencyErrorType>;

  /**
   * Check if code can be analyzed
   *
   * Detects patterns that prevent safe analysis:
   * - Dynamic property access (obj[variable])
   * - eval() calls
   * - Destructuring with computed properties
   * - Function.prototype.call/apply with dynamic this
   *
   * @param elementPath - Path to the element to check
   * @returns Analyzability result with list of blockers if not analyzable
   *
   * @example
   * ```typescript
   * const result = analyzer.checkAnalyzability(elementPath);
   * if (!result.analyzable) {
   *   console.log('Blockers:', result.blockers);
   *   return;
   * }
   * ```
   */
  checkAnalyzability(elementPath: NodePath): AnalyzabilityResult;
}
