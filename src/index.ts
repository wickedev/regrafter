/**
 * Regrafter - Programmatic AST Transformation Library for React
 *
 * A library for safely relocating React/JSX elements within and across files
 * with automatic dependency analysis, hoisting, and optimization.
 *
 * @packageDocumentation
 */

// Re-export all public types
export {
  // Main enums
  Move,
  DependencyType,
  ResolutionStrategy,

  // Selector types
  type PositionSelector,
  type PathSelector,
  type Selector,

  // Options and results
  type Options,
  // Result is exported separately from result module
  type Code,
  type MoveAnalysis,
  type AnalysisStats,
  type Dependency,
  type SuggestedFix,
  type FileInput,

  // Type guards
  isPositionSelector,
  isPathSelector,
  isValidMove,
  isValidDependencyType,
  isValidSelector,
  isValidOptions,

  // Utilities
  DEFAULT_OPTIONS,
  mergeOptions,
} from './types/index.js';

// Export hoisting executor
export {
  HoistExecutor,
  createHoistExecutor,
  type HoistExecutionContext,
} from './strategies/index.js';

// Export internal types for advanced usage
export {
  // Scope types
  ScopeType,
  type ScopeInfo,
  type ComponentScope,

  // Strategy types
  HoistStrategy,
  AtomicUnitType,
} from './types/index.js';

// Export error handling
export {
  // Error categories and classes
  ErrorCategory,
  RegraffErrorClass,
  type RegraffError,
  ParseError,
  SelectorError,
  DependencyError,
  ValidationError,
  TransformError,
  CircularError,
  InternalError,
  // Error type guards
  isRegraffError,
  isParseError,
  isSelectorError,
  isDependencyError,
  isValidationError,
  isTransformError,
  isCircularError,
  isInternalError,
  // Error codes
  ERROR_CODES,
  type ErrorCodeDefinition,
  getErrorCodeDefinition,
  getErrorCodesByCategory,
  isRecoverableErrorCode,
  // Error recovery
  type RecoveryResult,
  type RecoveryStrategy,
  isRecoverable,
  attemptRecovery,
} from './errors/index.js';

// Export validation utilities
export {
  InputValidationError,
  type ValidationResult,
  validateSelector,
  validateMove,
  validateOptions,
  validateFileInputArray,
  validateRegraftInput,
  type RegraftInput,
  assertRegraftInput,
  assertSelector,
  assertMove,
  assertOptions,
} from './validation/index.js';

// Export Result type and helpers (Task 17.1-17.5)
export {
  type Result,
  type Ok,
  type Err,
  ok,
  err,
  isOk,
  isErr,
  map,
  flatMap,
  mapErr,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  all,
  any,
  tryCatch,
  tryCatchAsync,
  mapAsync,
  flatMapAsync,
  // Batch processing (Task 17.3-17.4)
  type BatchResult,
  processBatch,
} from './result/index.js';

// Import Result helpers for internal use

// Export new API types (Task 17.2)
export {
  type TransformedCode,
} from './api/types.js';

// Export analyzer utilities
export {
  // Atomic unit detection
  detectAtomicUnit,
  detectConditionalExpression,
  detectTernaryExpression,
  detectMapExpression,
  detectCompoundComponent,
  getAtomicUnitType,
  findEnclosingAtomicUnit,
  isJSXNode,
  containsJSXElement,

  // Move validation
  validateMoveOperation,
  canMoveElement,
  MoveValidationError,
  type MoveValidationResult,
  type ConditionalExpressionInfo,
  type TernaryExpressionInfo,
  type MapExpressionInfo,
  type CompoundComponentInfo,

  // Dependency analysis
  DependencyAnalyzer,
  createDependencyAnalyzer,
  MoveAnalysisBuilder,
  createMoveAnalysisBuilder,
} from './analyzer/index.js';

// Export scope utilities
export {
  ScopeManager,
  createScopeManager,
} from './scope/index.js';

// Export selector utilities
export {
  SelectorResolver,
  createSelectorResolver,
} from './selector/index.js';

// Export strategy utilities for dependency hoisting
export {
  // Main planner
  HoistPlanner,
  createHoistPlanner,
  createConfiguredHoistPlanner,

  // Individual strategies
  HookHoister,
  createHookHoister,
  VariableHoister,
  createVariableHoister,
  PropThreader,
  createPropThreader,
  ImportManager,
  createImportManager,
  ContextHandler,
  createContextHandler,
  SuspenseHandler,
  createSuspenseHandler,

  // Utility functions
  isHookName,
  classifyHook,
  HookCategory,
  createStrategies,
  getAllHoistStrategies,

  // Type exports
  type HoistContext,
  type HoistPlanItem,
  type HoistPlan,
  type IHoistStrategy,
  type StrategyRegistry,
} from './strategies/index.js';

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import type * as t from '@babel/types';

import { DependencyAnalyzer, createMoveAnalysisBuilder, validateMoveOperation } from './analyzer/index.js';
import type { MoveValidationResult } from './analyzer/index.js';
import {
  createSuccessResult,
  createErrorResult,
  createErrorFromException,
} from './api/result-helpers.js';
import type { TransformedCode } from './api/types.js';
import { createValidationError, createTransformError, createSelectorError } from './errors/index.js';
import type { RegraffError, SelectorErrorType } from './errors/index.js';
import { CodeGenerator } from './generator/code-generator.js';
import { createOptimizer } from './optimizer/optimizer.js';
import type { OptimizeOptions } from './optimizer/types.js';
import { parseFile } from './parser/parse-file.js';
import { ok, err, isErr, type Result } from './result/index.js';
import { createScopeManager } from './scope/index.js';
import type { ScopeManager } from './scope/index.js';
import { createSelectorResolver } from './selector/index.js';
import type { ElementData } from './selector/index.js';
import { createCrossFileContext, executeCrossFileTransform } from './strategies/cross-file/index.js';
import type { HoistExecutionContext } from './strategies/hoist-executor.js';
import { createConfiguredHoistPlanner, createHoistExecutor } from './strategies/index.js';
import type { HoistContext } from './strategies/types.js';
import { createJSXTransformer } from './transformer/index.js';
import {
  mergeOptions,
  createCode,
  createSuggestedFix,
} from './types/index.js';
import type { Code, FileInput, MoveAnalysis, Move, Options, Selector, SuggestedFix } from './types/index.js';
import type { ScopeInfo } from './types/internal.js';
import { loadTraverseFunction } from './utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

/**
 * Main entry point for the regraft operation.
 *
 * **BREAKING CHANGE (v2.0.0)**: This function now returns `Result<TransformedCode, RegraffError>` directly
 * instead of the legacy `{ success: boolean, codes: Code[], analysis: MoveAnalysis }` format.
 *
 * Performs element relocation with automatic dependency analysis,
 * hoisting, and optional optimization.
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @param options - Optional configuration
 * @returns Result<TransformedCode, RegraffError> - Ok with transformed code or Err with error details
 *
 * @example
 * **New API (v2.0.0+)**
 * ```typescript
 * import { regraft, Move, isOk } from 'regrafter';
 *
 * const result = regraft(
 *   [{ path: 'App.tsx', content: sourceCode }],
 *   { file: 'App.tsx', line: 10, column: 5 },
 *   { file: 'App.tsx', line: 20, column: 5 },
 *   Move.Inside
 * );
 *
 * if (result.ok) {
 *   console.log('Transformed code:', result.value.codes[0].content);
 *   console.log('Analysis:', result.value.analysis);
 * } else {
 *   console.error('Error:', result.error.message);
 *   console.error('Suggestions:', result.error.suggestions);
 * }
 * ```
 *
 * @example
 * **Using type guards**
 * ```typescript
 * import { regraft, Move, isOk, isErr } from 'regrafter';
 *
 * const result = regraft(files, from, to, Move.Inside);
 *
 * if (isOk(result)) {
 *   // TypeScript knows result.value exists
 *   result.value.codes.forEach(code => console.log(code.file));
 * }
 *
 * if (isErr(result)) {
 *   // TypeScript knows result.error exists
 *   console.error(`[${result.error.code}] ${result.error.message}`);
 * }
 * ```
 *
 * @see {@link ../api/types.js!RegraftResult} for the return type
 * @see {@link ../api/types.js!TransformedCode} for the success value type
 * @see {@link ../errors/index.js!RegraffError} for the error type
 */

/**
 * Helper function to find a fresh NodePath for a given node
 */
function findNodePath(ast: t.File, targetNode: t.Node): NodePath | null {
  let foundPath: NodePath | null = null;

  traverse(ast, {
    enter(path: NodePath) {
      if (path.node === targetNode) {
        foundPath = path;
        path.stop();
      }
    },
  });

  return foundPath;
}

export function regraft(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result<TransformedCode, RegraffError> {
  const mergedOptions = mergeOptions(options);

  // Validate the move first
  const validation = validateMoveOperation(files, from, to, mode);

  if (!validation.valid) {
    // Return error result with reason
    return createErrorResult(
      validation.reason ?? 'Move validation failed',
      [],
      getSuggestedFixes(validation.errorCode)
    );
  }

  // If dryRun is enabled, return analysis without transformation
  if (mergedOptions.dryRun) {
    return createDryRunResult(files, from, to, mode);
  }

  // Execute the transformation
  return executeTransformation(files, from, to, mode, mergedOptions, validation);
}

/**
 * Check if an element can be moved to the target location.
 *
 * Performs validation without executing the transformation.
 * Use this for quick feedback in IDEs or before expensive operations.
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns true if the move is possible, false otherwise
 */
export function canMove(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): boolean {
  const validation = validateMoveOperation(files, from, to, mode);
  return validation.valid;
}

/**
 * Execute element movement without validation or optimization.
 *
 * Lower-level API for custom workflows. Does not check if the move
 * is safe or perform dependency sinking.
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns Result containing array of transformed file contents or error
 */
export function move(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): Result<Code[], RegraffError> {
  // Create required instances
  const generator = new CodeGenerator();
  const resolver = createSelectorResolver();
  const transformer = createJSXTransformer();

  // Parse all files
  const parsedFiles = new Map<string, t.File>();
  for (const file of files) {
    const result = parseFile(file.path, file.content);
    if (isErr(result)) {
      return err(result.error);
    }
    parsedFiles.set(file.path, result.value);
  }

  // Get the AST for source and target files
  const sourceAst = parsedFiles.get(from.file);
  const targetAst = parsedFiles.get(to.file);

  if (!sourceAst) {
    return err(createValidationError({
      code: 'FILE_NOT_FOUND',
      message: `Source file not found: ${from.file}`,
      constraint: 'file_exists',
      details: `The source file "${from.file}" could not be found in the parsed files map`,
    }));
  }
  if (!targetAst) {
    return err(createValidationError({
      code: 'FILE_NOT_FOUND',
      message: `Target file not found: ${to.file}`,
      constraint: 'file_exists',
      details: `The target file "${to.file}" could not be found in the parsed files map`,
    }));
  }

  // Resolve selectors
  const sourceResult = resolver.resolveResult(from, sourceAst);
  if (isErr(sourceResult)) {
    return err(sourceResult.error);
  }

  const targetResult = resolver.resolveResult(to, targetAst);
  if (isErr(targetResult)) {
    return err(targetResult.error);
  }

  // For same-file moves
  if (from.file === to.file) {
    // Perform the transformation
    const moveResult = transformer.move(
      sourceAst,
      sourceResult.value.path,
      targetResult.value.path,
      mode
    );

    if (isErr(moveResult)) {
      return err(moveResult.error);
    }

    // Generate code for all files
    const codes: Code[] = [];
    for (const file of files) {
      const ast = parsedFiles.get(file.path);
      if (!ast) continue;

      const generateResult = generator.generate(ast);
      if (isErr(generateResult)) {
        return err(generateResult.error);
      }

      const generated = generateResult.value;
      codes.push(createCode({
        file: file.path,
        content: generated.code,
        changed: file.path === from.file,
        original: file.path === from.file ? file.content : undefined,
      }));
    }

    return ok(codes);
  }

  // Cross-file move - delegate to cross-file handler
  return executeCrossFileMove(files, from, to, mode);
}

/**
 * Execute cross-file move operation
 */
function executeCrossFileMove(
  files: FileInput[],
  from: Selector,
  to: Selector,
  _mode: Move
): Result<Code[], RegraffError> {
  const scopeManager = createScopeManager();
  const analyzer = new DependencyAnalyzer(scopeManager);
  const resolver = createSelectorResolver();

  // Parse all files
  const parsedFiles = new Map<string, t.File>();
  const originalContents = new Map<string, string>();

  for (const file of files) {
    const result = parseFile(file.path, file.content);
    if (isErr(result)) {
      return err(result.error);
    }
    parsedFiles.set(file.path, result.value);
    originalContents.set(file.path, file.content);
  }

  // Get source AST
  const sourceAst = parsedFiles.get(from.file);
  if (!sourceAst) {
    return err(createValidationError({
      code: 'FILE_NOT_FOUND',
      message: `Source file not found: ${from.file}`,
      constraint: 'file_exists',
      details: `The source file "${from.file}" could not be found in the parsed files map`,
    }));
  }

  // Build scope tree and analyze
  scopeManager.buildScopeTree(sourceAst);
  analyzer.setCurrentFile(from.file);

  // Resolve source element
  const sourceResult = resolver.resolveResult(from, sourceAst);
  if (isErr(sourceResult)) {
    return err(sourceResult.error);
  }

  // Get target scope for dependency analysis
  let targetScope = null;
  const targetAstMaybe = parsedFiles.get(to.file);
  if (targetAstMaybe !== undefined) {
    const targetResult = resolver.resolveResult(to, targetAstMaybe);
    if (targetResult.ok) {
      targetScope = scopeManager.getScopeForPath(targetResult.value.path);
      // If target element doesn't have its own scope, use enclosing component
      if (!targetScope) {
        const enclosingComponentResult = scopeManager.findEnclosingComponent(targetResult.value.path);
        if (!isErr(enclosingComponentResult) && enclosingComponentResult.value) {
          targetScope = enclosingComponentResult.value;
        }
      }
    }
  }

  // Analyze dependencies
  const depAnalysisResult = analyzer.analyzeElement(sourceResult.value.path, targetScope);
  if (isErr(depAnalysisResult)) {
    return err(depAnalysisResult.error);
  }
  const depAnalysis = depAnalysisResult.value;

  // Create cross-file context
  const context = createCrossFileContext(
    parsedFiles,
    originalContents,
    from.file,
    to.file,
    depAnalysis.dependencies
  );

  // Execute cross-file transformation
  const transformResult = executeCrossFileTransform(context, {
    createSharedModules: true,
    resolveCircularDeps: true,
  });

  if (!transformResult.success) {
    return err(createTransformError({
      code: 'CROSS_FILE_MOVE_FAILED',
      message: `Cross-file move failed: ${transformResult.error ?? 'Unknown error'}`,
      operation: 'cross_file_move',
    }));
  }

  return ok(transformResult.codes);
}

/**
 * Parse all files and return AST map
 */
function parseAllFiles(files: FileInput[]): Result<Map<string, t.File>, RegraffError> {
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

/**
 * Build scope paths map for hoisting
 */
function buildScopePaths(
  ast: t.File,
  scopeManager: ScopeManager
): Map<string, NodePath> {
  const scopePaths = new Map<string, NodePath>();

  traverse(ast, {
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      const scope = scopeManager.getScopeForPath(path);
      if (scope !== null) {
        scopePaths.set(scope.id, path);
      }
    },
    FunctionExpression(path: NodePath<t.FunctionExpression>) {
      const scope = scopeManager.getScopeForPath(path);
      if (scope !== null) {
        scopePaths.set(scope.id, path);
      }
    },
    ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
      const scope = scopeManager.getScopeForPath(path);
      if (scope !== null) {
        scopePaths.set(scope.id, path);
      }
    },
  });

  return scopePaths;
}

/**
 * Refresh node paths after AST modifications
 */
function refreshNodePaths(
  ast: t.File,
  sourceMatch: ElementData,
  targetMatch: ElementData
): {
  sourceResult: Result<ElementData, SelectorErrorType>;
  targetResult: Result<ElementData, SelectorErrorType>;
} {
  const sourceNode = sourceMatch.path.node;
  const targetNode = targetMatch.path.node;

  const freshSourcePath = findNodePath(ast, sourceNode);
  const freshTargetPath = findNodePath(ast, targetNode);

  if (!freshSourcePath) {
    const loc = sourceNode.loc;
    return {
      sourceResult: err(createSelectorError({
        code: 'NODE_NOT_FOUND',
        message: 'Failed to find source node after hoisting',
        selector: {
          file: '',
          line: loc?.start.line ?? 0,
          column: loc?.start.column ?? 0
        },
        file: '',
      })),
      targetResult: ok(targetMatch),
    };
  }
  if (!freshTargetPath) {
    const loc = targetNode.loc;
    return {
      sourceResult: ok(sourceMatch),
      targetResult: err(createSelectorError({
        code: 'NODE_NOT_FOUND',
        message: 'Failed to find target node after hoisting',
        selector: {
          file: '',
          line: loc?.start.line ?? 0,
          column: loc?.start.column ?? 0
        },
        file: '',
      })),
    };
  }

  return {
    sourceResult: {
      ok: true,
      value: {
        node: sourceNode,
        path: freshSourcePath,
        atomicUnit: sourceMatch.atomicUnit,
      },
    },
    targetResult: {
      ok: true,
      value: {
        node: targetNode,
        path: freshTargetPath,
        atomicUnit: targetMatch.atomicUnit,
      },
    },
  };
}

/**
 * Generate code for all files
 */
function generateCodeForFiles(
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

/**
 * Internal function: Move with hoisting integration
 *
 * Performs the complete transformation with dependency hoisting.
 * This is used internally by regraft() to execute the full pipeline.
 */
function moveWithHoisting(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: { insertIndex?: number; preserveComments?: boolean }
): Result<Code[], RegraffError> {
  // Create required instances
  const generator = new CodeGenerator();
  const resolver = createSelectorResolver();
  const transformer = createJSXTransformer();
  const scopeManager = createScopeManager();
  const analyzer = new DependencyAnalyzer(scopeManager);
  const planner = createConfiguredHoistPlanner();
  const executor = createHoistExecutor();

  // Parse all files
  const parsedFilesResult = parseAllFiles(files);
  if (isErr(parsedFilesResult)) {
    return err(parsedFilesResult.error);
  }
  const parsedFiles = parsedFilesResult.value;

  // Get the AST for source file
  const sourceAst = parsedFiles.get(from.file);
  if (!sourceAst) {
    return err(createValidationError({
      code: 'FILE_NOT_FOUND',
      message: `Source file not found: ${from.file}`,
      constraint: 'file_exists',
      details: `The source file "${from.file}" could not be found in the parsed files map`,
    }));
  }

  // For same-file moves only (cross-file not yet implemented)
  if (from.file !== to.file) {
    return err(createValidationError({
      code: 'CROSS_FILE_NOT_SUPPORTED',
      message: 'Cross-file moves not yet implemented',
      constraint: 'same_file_move',
      details: 'Cross-file moves are not yet supported in moveWithHoisting',
    }));
  }

  // Build scope tree
  scopeManager.buildScopeTree(sourceAst);
  analyzer.setCurrentFile(from.file);

  // Resolve selectors
  let sourceResult = resolver.resolveResult(from, sourceAst);
  if (isErr(sourceResult)) {
    return err(sourceResult.error);
  }

  let targetResult = resolver.resolveResult(to, sourceAst);
  if (isErr(targetResult)) {
    return err(targetResult.error);
  }

  // Get scopes
  let sourceScope = scopeManager.getScopeForPath(sourceResult.value.path);
  let targetScope = scopeManager.getScopeForPath(targetResult.value.path);

  // If source element doesn't have its own scope, use enclosing component
  if (!sourceScope) {
    const enclosingComponentResult = scopeManager.findEnclosingComponent(sourceResult.value.path);
    if (!isErr(enclosingComponentResult) && enclosingComponentResult.value) {
      sourceScope = enclosingComponentResult.value;
    }
  }

  // If target element doesn't have its own scope, use enclosing component
  if (!targetScope) {
    const enclosingComponentResult = scopeManager.findEnclosingComponent(targetResult.value.path);
    if (!isErr(enclosingComponentResult) && enclosingComponentResult.value) {
      targetScope = enclosingComponentResult.value;
    }
  }

  // Perform dependency analysis
  const depAnalysisResult = analyzer.analyzeElement(sourceResult.value.path, targetScope);
  if (isErr(depAnalysisResult)) {
    return err(depAnalysisResult.error);
  }
  const depAnalysis = depAnalysisResult.value;

  // Check if targetScope is an ancestor of sourceScope
  // If so, dependencies are already accessible and hoisting is not needed
  const targetIsAncestor = (fromScope: ScopeInfo | null, toScope: ScopeInfo): boolean => {
    let current = fromScope;
    let depth = 0;
    const MAX_DEPTH = 100; // Prevent infinite loops

    while (current !== null && depth < MAX_DEPTH) {
      if (current.id === toScope.id) {
        return true;
      }
      current = current.parent;
      depth++;
    }
    return false;
  };

  const shouldSkipHoisting =
    sourceScope !== null &&
    targetScope !== null &&
    depAnalysis.needsHoisting.length > 0 &&
    targetIsAncestor(sourceScope, targetScope);

  // If there are dependencies that need hoisting, create and execute a hoisting plan
  if (depAnalysis.needsHoisting.length > 0 && sourceScope !== null && targetScope !== null && !shouldSkipHoisting) {
    // Create hoisting context
    const context: HoistContext = {
      sourceFile: from.file,
      targetFile: to.file,
      sourceScope,
      targetScope,
      sourceComponent: null, // Not tracking component scopes in this integration
      targetComponent: null,
      isCrossFile: from.file !== to.file,
      asts: parsedFiles,
    };

    // Create hoisting plan
    const hoistPlan = planner.plan(depAnalysis, context);

    // If the plan is valid, execute it
    if (hoistPlan.valid) {
      // Use dependency paths from analysis (already built before conversion)
      const dependencyPaths = depAnalysis.dependencyPaths;
      const scopePaths = buildScopePaths(sourceAst, scopeManager);

      // Execute hoisting operations
      const execContext: HoistExecutionContext = {
        ast: sourceAst,
        dependencyPaths,
        scopePaths,
      };

      const executeResult = executor.execute(hoistPlan, execContext);
      if (isErr(executeResult)) {
        return err(executeResult.error);
      }

      // Recrawl scope to synchronize Babel's internal state after AST modifications
      traverse(sourceAst, {
        Program(path: NodePath<t.Program>) {
          path.scope.crawl();
          path.stop();
        },
      });

      // Refresh node paths after hoisting
      const refreshed = refreshNodePaths(
        sourceAst,
        sourceResult.value,
        targetResult.value
      );
      sourceResult = refreshed.sourceResult;
      targetResult = refreshed.targetResult;
    }
  }

  // Now perform the element move
  if (isErr(sourceResult)) {
    return err(createTransformError({
      code: 'SOURCE_REFRESH_FAILED',
      message: 'Source result is error after refresh',
      operation: 'node_refresh',
    }));
  }
  if (isErr(targetResult)) {
    return err(createTransformError({
      code: 'TARGET_REFRESH_FAILED',
      message: 'Target result is error after refresh',
      operation: 'node_refresh',
    }));
  }

  const moveResult = transformer.move(
    sourceAst,
    sourceResult.value.path,
    targetResult.value.path,
    mode,
    options
  );

  if (isErr(moveResult)) {
    return err(moveResult.error);
  }

  // Generate code for all files
  return generateCodeForFiles(files, parsedFiles, from.file, generator);
}

/**
 * Analyze dependencies for a proposed move operation.
 *
 * Returns detailed dependency analysis without performing transformation.
 * Useful for understanding what hoisting would be required.
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns Result containing detailed analysis of dependencies and hoisting requirements
 */
export function analyze(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): Result<MoveAnalysis, RegraffError> {
  const validation = validateMoveOperation(files, from, to, mode);

  if (!validation.valid) {
    return err(createValidationError({
      code: validation.errorCode ?? 'VALIDATION_FAILED',
      message: validation.reason ?? 'Move validation failed',
      constraint: 'move_validation',
      details: validation.reason ?? 'Move validation failed',
    }));
  }

  // Create required instances for dependency analysis
  const resolver = createSelectorResolver();

  // Note: HoistPlanner and strategies are available via ./strategies/index.js
  // for full dependency hoisting integration

  // Parse the source file
  const sourceFile = files.find(f => f.path === from.file);
  if (!sourceFile) {
    return err(createValidationError({
      code: 'FILE_NOT_FOUND',
      message: `Source file not found: ${from.file}`,
      constraint: 'file_exists',
      details: `The source file "${from.file}" could not be found in the provided files array`,
    }));
  }

  const parseResult = parseFile(sourceFile.path, sourceFile.content);
  if (isErr(parseResult)) {
    return err(parseResult.error);
  }

  // Resolve selectors
  const sourceResult = resolver.resolveResult(from, parseResult.value);
  if (isErr(sourceResult)) {
    return err(sourceResult.error);
  }

  const targetResult = resolver.resolveResult(to, parseResult.value);
  if (isErr(targetResult)) {
    return err(targetResult.error);
  }

  // Build scope tree and perform dependency analysis
  const scopeManager = createScopeManager();
  const analysisBuilder = createMoveAnalysisBuilder(scopeManager);
  analysisBuilder.setCurrentFile(from.file);

  // Perform full dependency analysis
  const analysis = analysisBuilder.analyze(parseResult.value, sourceResult.value.path, targetResult.value.path);
  return ok(analysis);
}

/**
 * Optimize files by sinking over-hoisted dependencies.
 *
 * Analyzes dependency usage and moves declarations to their
 * optimal locations, removing unnecessary prop threading.
 *
 * @param files - Array of file inputs with path and content
 * @param options - Optional optimization options
 * @returns Result containing array of optimized file contents or error
 */
export function optimize(
  files: FileInput[],
  options?: OptimizeOptions
): Result<Code[], RegraffError> {
  const optimizer = createOptimizer();
  return optimizer.optimize(files, options);
}

// =============================================================================
// Helper Functions for regraft
// =============================================================================

/**
 * Get suggested fixes based on error code
 */
function getSuggestedFixes(errorCode?: string): SuggestedFix[] | undefined {
  // errorCode is string | undefined, so we only need to check for undefined and empty string
  if (errorCode === undefined || errorCode === '') return undefined;

  // Map error codes to suggested fixes
  const fixMap: Record<string, SuggestedFix[]> = {
    'CIRCULAR_MOVE': [
      createSuggestedFix({
        description: 'Move to a different target that is not a descendant of the source',
        action: 'select_different_target',
        automatic: false,
      }),
    ],
    'INVALID_SOURCE': [
      createSuggestedFix({
        description: 'Select a valid JSX element as the source',
        action: 'select_jsx_element',
        automatic: false,
      }),
    ],
    'INVALID_TARGET': [
      createSuggestedFix({
        description: 'Select a valid target location',
        action: 'select_valid_target',
        automatic: false,
      }),
    ],
  };

  return fixMap[errorCode];
}

/**
 * Create a dry run result (analysis only, no transformation)
 */
function createDryRunResult(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): Result<TransformedCode, RegraffError> {
  // Create unchanged code results
  const codes: Code[] = files.map(file =>
    createCode({
      file: file.path,
      content: file.content,
      changed: false,
    })
  );

  // Perform full dependency analysis using the analyze() function
  const analysisResult = analyze(files, from, to, mode);

  // If analysis failed, return error
  if (isErr(analysisResult)) {
    return err(analysisResult.error);
  }

  const analysis = analysisResult.value;

  // Return success with analysis
  return createSuccessResult(codes, analysis);
}

/**
 * Execute the transformation after validation
 */
function executeTransformation(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options: Required<Options>,
  _validation: MoveValidationResult
): Result<TransformedCode, RegraffError> {
  try {
    // Perform dependency analysis
    const analysisResult = analyze(files, from, to, mode);

    // If analysis failed, return error
    if (isErr(analysisResult)) {
      return err(analysisResult.error);
    }

    const fullAnalysis = analysisResult.value;

    // Use the moveWithHoisting function for transformation with automatic hoisting
    const moveResult = moveWithHoisting(files, from, to, mode, {
      insertIndex: options.insertIndex,
      preserveComments: options.preserveComments,
    });

    if (isErr(moveResult)) {
      return err(moveResult.error);
    }

    let codes = moveResult.value;

    // Optionally run optimization
    if (options.optimize) {
      // Save original changed flags
      const originalChangedFlags = new Map<string, boolean>();
      for (const code of codes) {
        originalChangedFlags.set(code.file, code.changed);
      }

      // Convert codes back to FileInput format for optimizer
      const optimizeInput: FileInput[] = codes.map(code => ({
        path: code.file,
        content: code.content,
      }));

      // Run optimization
      const optimizeResult = optimize(optimizeInput);

      if (isErr(optimizeResult)) {
        return err(optimizeResult.error);
      }

      // Preserve original changed flags if optimizer didn't make changes
      codes = optimizeResult.value.map(code => ({
        ...code,
        changed: code.changed || (originalChangedFlags.get(code.file) ?? false),
      }));
    }

    // Return success with the real analysis
    return createSuccessResult(codes, fullAnalysis);
  } catch (error) {
    return createErrorFromException(error, {
      file: files[0]?.path,
      operation: 'transformation',
    });
  }
}
