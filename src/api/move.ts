/**
 * Move API Implementation
 *
 * Functions for moving JSX elements with automatic dependency analysis and hoisting.
 *
 * @module api/move
 */

import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import { DependencyAnalyzer, validateMoveOperation } from '../analyzer/index.js';
import type { RegraffError, SelectorErrorType } from '../errors/index.js';
import { createSelectorError, createTransformError, createValidationError } from '../errors/index.js';
import { CodeGenerator } from '../generator/code-generator.js';
import { err, isErr, ok, type Result } from '../result/index.js';
import { createScopeManager } from '../scope/index.js';
import type { ScopeManager } from '../scope/index.js';
import type { ElementData } from '../selector/index.js';
import { createSelectorResolver } from '../selector/index.js';
import type { HoistExecutionContext } from '../strategies/hoist-executor.js';
import { createConfiguredHoistPlanner, createHoistExecutor } from '../strategies/index.js';
import type { HoistContext } from '../strategies/types.js';
import { createJSXTransformer } from '../transformer/index.js';
import type { Code, FileInput, Move, Selector, Options, SuggestedFix } from '../types/index.js';
import { mergeOptions, createCode, createSuggestedFix } from '../types/index.js';
import type { ScopeInfo } from '../types/internal.js';
import { loadTraverseFunction } from '../utils/index.js';

import { analyze } from './analyze.js';
import { generateCodeForFiles } from './generation-utils.js';
import { optimize } from './optimize.js';
import { parseAllFiles } from './parse-utils.js';
import { createSuccessResult, createErrorFromException } from './result-helpers.js';
import type { TransformedCode } from './types.js';

const traverse = loadTraverseFunction(traverseModule);

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
 * Move a JSX element with automatic dependency management.
 *
 * This is the main API for moving React/JSX elements. It performs:
 * 1. Validation of the move operation
 * 2. Dependency analysis
 * 3. Element relocation with automatic hoisting
 * 4. Optional optimization (sinking over-hoisted dependencies)
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @param options - Optional configuration
 * @returns Result containing transformed code and analysis or error
 *
 * @example
 * ```typescript
 * import { move, Move, isOk } from 'regrafter';
 *
 * const result = move(
 *   [{ path: 'App.tsx', content: sourceCode }],
 *   { file: 'App.tsx', line: 10, column: 5 },
 *   { file: 'App.tsx', line: 20, column: 5 },
 *   Move.Inside
 * );
 *
 * if (result.ok) {
 *   console.log('Moved!', result.value.codes);
 * }
 * ```
 */
export function move(
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
 * Internal function: Move with hoisting integration
 *
 * Performs the complete transformation with dependency hoisting.
 * This is used internally by move() to execute the full pipeline.
 *
 * @internal
 */
function moveWithHoistingInternal(
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

// =============================================================================
// Helper Functions
// =============================================================================

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

// =============================================================================
// Helper Functions for Main move() API
// =============================================================================

/**
 * Get suggested fixes based on error code
 */
function getSuggestedFixes(errorCode?: string): SuggestedFix[] | undefined {
  if (errorCode === undefined || errorCode === '') return undefined;

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
  const codes: Code[] = files.map(file =>
    createCode({
      file: file.path,
      content: file.content,
      changed: false,
    })
  );

  const analysisResult = analyze(files, from, to, mode);

  if (isErr(analysisResult)) {
    return err(analysisResult.error);
  }

  const analysis = analysisResult.value;

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
  _validation: unknown
): Result<TransformedCode, RegraffError> {
  try {
    const analysisResult = analyze(files, from, to, mode);

    if (isErr(analysisResult)) {
      return err(analysisResult.error);
    }

    const fullAnalysis = analysisResult.value;

    const moveResult = moveWithHoistingInternal(files, from, to, mode, {
      insertIndex: options.insertIndex,
      preserveComments: options.preserveComments,
    });

    if (isErr(moveResult)) {
      return err(moveResult.error);
    }

    let codes = moveResult.value;

    if (options.optimize) {
      const originalChangedFlags = new Map<string, boolean>();
      for (const code of codes) {
        originalChangedFlags.set(code.file, code.changed);
      }

      const optimizeInput: FileInput[] = codes.map(code => ({
        path: code.file,
        content: code.content,
      }));

      const optimizeResult = optimize(optimizeInput);

      if (isErr(optimizeResult)) {
        return err(optimizeResult.error);
      }

      codes = optimizeResult.value.map(code => ({
        ...code,
        changed: code.changed || (originalChangedFlags.get(code.file) ?? false),
      }));
    }

    return createSuccessResult(codes, fullAnalysis);
  } catch (error) {
    return createErrorFromException(error, {
      file: files[0]?.path,
      operation: 'transformation',
    });
  }
}

/**
 * Create an error result from a message
 */
function createErrorResult(
  message: string,
  codes?: Code[],
  suggestedFixes?: Array<{ description: string; action: string; automatic: boolean }>,
  file?: string
): Result<TransformedCode, RegraffError> {
  const error: RegraffError = createValidationError({
    code: 'MOVE_FAILED',
    message,
    constraint: 'general',
    details: 'Move validation failed',
    file: file ?? codes?.[0]?.file ?? 'unknown',
    suggestions: suggestedFixes ?? [],
  });

  return err(error);
}
