/**
 * Move Transformation Pipeline
 *
 * Orchestrates the complete move transformation through 5 distinct stages:
 * 1. Validation - Parse files, validate selectors, build scope tree
 * 2. Analysis - Get scopes, analyze dependencies
 * 3. Planning - Create HoistContext, build hoist plan
 * 4. Execution - Execute hoisting operations, transform element
 * 5. Generation - Generate source code from mutated AST
 *
 * Each stage returns a typed context or error, enabling fail-fast execution.
 *
 * @module api/move-transformation-pipeline
 */

import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import type { DependencyOrchestrator } from '../analyzer/dependency-orchestrator.js';
import { error } from '../errors/error-builder.js';
import { createSelectorError } from '../errors/index.js';
import type { RegraffError } from '../errors/index.js';
import type { CodeGenerator } from '../generator/code-generator.js';
import { err, isErr, ok, type Result } from '../result/index.js';
import type { ScopeManager } from '../scope/index.js';
import { getScopeWithFallback } from '../scope/scope-helpers.js';
import type { SelectorResolver, ElementData } from '../selector/index.js';
import type { HoistExecutor, HoistExecutionContext } from '../strategies/hoist-executor.js';
import type { HoistPlanBuilder } from '../strategies/hoist-plan-builder.js';
import type { HoistPlan, HoistContext } from '../strategies/types.js';
import type { JSXTransformer } from '../transformer/jsx-transformer.js';
import type { Code, FileInput, Move, Selector } from '../types/index.js';
import type { DependencyAnalysis, ScopeInfo } from '../types/internal.js';
import { loadTraverseFunction } from '../utils/index.js';

import { generateCodeForFiles } from './generation-utils.js';
import { parseAllFiles } from './parse-utils.js';

const traverse = loadTraverseFunction(traverseModule);

// =============================================================================
// Context Interfaces
// =============================================================================

/**
 * Initial context containing all input parameters
 */
export interface MoveContext {
  readonly files: FileInput[];
  readonly from: Selector;
  readonly to: Selector;
  readonly mode: Move;
  readonly options?: {
    insertIndex?: number;
    preserveComments?: boolean;
  };
}

/**
 * Context after validation stage
 */
export interface ValidatedContext extends MoveContext {
  readonly parsedFiles: Map<string, t.File>;
  readonly sourceAst: t.File;
  readonly sourceResult: ElementData;
  readonly targetResult: ElementData;
}

/**
 * Context after analysis stage
 */
export interface AnalyzedContext extends ValidatedContext {
  readonly sourceScope: ScopeInfo | null;
  readonly targetScope: ScopeInfo | null;
  readonly dependencyAnalysis: DependencyAnalysis;
  readonly shouldSkipHoisting: boolean;
}

/**
 * Context after planning stage
 */
export interface PlannedContext extends AnalyzedContext {
  readonly hoistPlan: HoistPlan | null;
  readonly hoistContext: HoistContext | null;
}

/**
 * Context after execution stage
 */
export interface ExecutedContext extends PlannedContext {
  readonly refreshedSourceResult: ElementData;
  readonly refreshedTargetResult: ElementData;
}

// =============================================================================
// Pipeline Class
// =============================================================================

/**
 * MoveTransformationPipeline orchestrates the complete move transformation
 * through 5 distinct stages with fail-fast error handling.
 */
export class MoveTransformationPipeline {
  constructor(
    private readonly resolver: SelectorResolver,
    private readonly scopeManager: ScopeManager,
    private readonly analyzer: DependencyOrchestrator,
    private readonly planner: HoistPlanBuilder,
    private readonly executor: HoistExecutor,
    private readonly transformer: JSXTransformer,
    private readonly generator: CodeGenerator
  ) {}

  /**
   * Execute the complete transformation pipeline
   *
   * @param context - Initial move context
   * @returns Result containing transformed code array or error
   */
  execute(context: MoveContext): Result<Code[], RegraffError> {
    // Stage 1: Validation
    const validatedResult = this.runValidation(context);
    if (isErr(validatedResult)) {
      return err(validatedResult.error);
    }

    // Stage 2: Analysis
    const analyzedResult = this.runAnalysis(validatedResult.value);
    if (isErr(analyzedResult)) {
      return err(analyzedResult.error);
    }

    // Stage 3: Planning
    const plannedResult = this.runPlanning(analyzedResult.value);
    if (isErr(plannedResult)) {
      return err(plannedResult.error);
    }

    // Stage 4: Execution
    const executedResult = this.runExecution(plannedResult.value);
    if (isErr(executedResult)) {
      return err(executedResult.error);
    }

    // Stage 5: Generation
    return this.runGeneration(executedResult.value);
  }

  /**
   * Stage 1: Validation
   *
   * Parse all files, validate selectors can be resolved, build scope tree
   *
   * @param context - Initial move context
   * @returns ValidatedContext or error
   */
  private runValidation(context: MoveContext): Result<ValidatedContext, RegraffError> {
    // Parse all files
    const parsedFilesResult = parseAllFiles(context.files);
    if (isErr(parsedFilesResult)) {
      return err(parsedFilesResult.error);
    }
    const parsedFiles = parsedFilesResult.value;

    // Get the AST for source file
    const sourceAst = parsedFiles.get(context.from.file);
    if (!sourceAst) {
      return err(
        error()
          .code('FILE_NOT_FOUND')
          .message(`Source file not found: ${context.from.file}`)
          .constraint('file_exists')
          .details(`The source file "${context.from.file}" could not be found in the parsed files map`)
          .build()
      );
    }

    // For same-file moves only (cross-file not yet implemented)
    if (context.from.file !== context.to.file) {
      return err(
        error()
          .code('CROSS_FILE_NOT_SUPPORTED')
          .message('Cross-file moves not yet implemented')
          .constraint('same_file_move')
          .details('Cross-file moves are not yet supported in moveWithHoisting')
          .build()
      );
    }

    // Build scope tree
    this.scopeManager.buildScopeTree(sourceAst);
    this.analyzer.setCurrentFile(context.from.file);

    // Resolve selectors
    const sourceResult = this.resolver.resolveResult(context.from, sourceAst);
    if (isErr(sourceResult)) {
      return err(sourceResult.error);
    }

    const targetResult = this.resolver.resolveResult(context.to, sourceAst);
    if (isErr(targetResult)) {
      return err(targetResult.error);
    }

    return ok({
      ...context,
      parsedFiles,
      sourceAst,
      sourceResult: sourceResult.value,
      targetResult: targetResult.value,
    });
  }

  /**
   * Stage 2: Analysis
   *
   * Get source and target scopes, analyze element dependencies
   *
   * @param context - Validated context
   * @returns AnalyzedContext or error
   */
  private runAnalysis(context: ValidatedContext): Result<AnalyzedContext, RegraffError> {
    // Get scopes
    const sourceScope = getScopeWithFallback(context.sourceResult.path, this.scopeManager);
    const targetScope = getScopeWithFallback(context.targetResult.path, this.scopeManager);

    // Perform dependency analysis
    const depAnalysisResult = this.analyzer.analyzeElement(context.sourceResult.path, targetScope);
    if (isErr(depAnalysisResult)) {
      return err(depAnalysisResult.error);
    }
    const dependencyAnalysis = depAnalysisResult.value;

    // Never skip hoisting if there are dependencies that need hoisting
    // The dependency classifier has already determined what needs hoisting
    const shouldSkipHoisting = false;

    return ok({
      ...context,
      sourceScope,
      targetScope,
      dependencyAnalysis,
      shouldSkipHoisting,
    });
  }

  /**
   * Stage 3: Planning
   *
   * Create HoistContext and build hoist plan
   *
   * @param context - Analyzed context
   * @returns PlannedContext or error
   */
  private runPlanning(context: AnalyzedContext): Result<PlannedContext, RegraffError> {
    // If there are no dependencies that need hoisting, skip planning
    if (
      context.dependencyAnalysis.needsHoisting.length === 0 ||
      context.sourceScope === null ||
      context.targetScope === null ||
      context.shouldSkipHoisting
    ) {
      return ok({
        ...context,
        hoistPlan: null,
        hoistContext: null,
      });
    }

    // Create hoisting context
    const hoistContext: HoistContext = {
      sourceFile: context.from.file,
      targetFile: context.to.file,
      sourceScope: context.sourceScope,
      targetScope: context.targetScope,
      sourceComponent: null, // Not tracking component scopes in this integration
      targetComponent: null,
      isCrossFile: context.from.file !== context.to.file,
      asts: context.parsedFiles,
    };

    // Create hoisting plan
    const hoistPlan = this.planner.plan(context.dependencyAnalysis, hoistContext);

    return ok({
      ...context,
      hoistPlan,
      hoistContext,
    });
  }

  /**
   * Stage 4: Execution
   *
   * Execute hoisting operations and transform element
   *
   * @param context - Planned context
   * @returns ExecutedContext or error
   */
  private runExecution(context: PlannedContext): Result<ExecutedContext, RegraffError> {
    let refreshedSourceResult = context.sourceResult;
    let refreshedTargetResult = context.targetResult;

    // If there's a valid hoisting plan, execute it
    if (context.hoistPlan?.valid === true) {
      // Use dependency paths from analysis
      const dependencyPaths = context.dependencyAnalysis.dependencyPaths;
      const scopePaths = this.buildScopePaths(context.sourceAst);

      // Execute hoisting operations
      const execContext: HoistExecutionContext = {
        ast: context.sourceAst,
        dependencyPaths,
        scopePaths,
      };

      const executeResult = this.executor.execute(context.hoistPlan, execContext);
      if (isErr(executeResult)) {
        return err(executeResult.error);
      }

      // Recrawl scope to synchronize Babel's internal state after AST modifications
      this.recrawlScope(context.sourceAst);

      // Refresh node paths after hoisting
      const refreshed = this.refreshNodePaths(
        context.sourceAst,
        context.sourceResult,
        context.targetResult
      );

      if (isErr(refreshed.sourceResult)) {
        return err(refreshed.sourceResult.error);
      }
      if (isErr(refreshed.targetResult)) {
        return err(refreshed.targetResult.error);
      }

      refreshedSourceResult = refreshed.sourceResult.value;
      refreshedTargetResult = refreshed.targetResult.value;
    }

    // Perform the element move
    const moveResult = this.transformer.move(
      context.sourceAst,
      refreshedSourceResult.path,
      refreshedTargetResult.path,
      context.mode,
      context.options
    );

    if (isErr(moveResult)) {
      return err(moveResult.error);
    }

    return ok({
      ...context,
      refreshedSourceResult,
      refreshedTargetResult,
    });
  }

  /**
   * Stage 5: Generation
   *
   * Generate source code from mutated AST
   *
   * @param context - Executed context
   * @returns Code array or error
   */
  private runGeneration(context: ExecutedContext): Result<Code[], RegraffError> {
    return generateCodeForFiles(context.files, context.parsedFiles, context.from.file, this.generator);
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  // Helper method for future validation logic
  // @ts-expect-error - Unused currently but kept for future validation logic
  private isSourceAncestorOfTarget(sourceScope: ScopeInfo, targetScope: ScopeInfo): boolean {
    let current: ScopeInfo | null = targetScope;
    let depth = 0;
    const MAX_DEPTH = 100; // Prevent infinite loops

    while (current !== null && depth < MAX_DEPTH) {
      if (current.id === sourceScope.id) {
        return true;
      }
      current = current.parent;
      depth++;
    }
    return false;
  }

  /**
   * Build scope paths map for hoisting
   */
  private buildScopePaths(ast: t.File): Map<string, NodePath> {
    const scopePaths = new Map<string, NodePath>();

    traverse(ast, {
      FunctionDeclaration: (path: NodePath<t.FunctionDeclaration>) => {
        const scope = this.scopeManager.getScopeForPath(path);
        if (scope !== null) {
          scopePaths.set(scope.id, path);
        }
      },
      FunctionExpression: (path: NodePath<t.FunctionExpression>) => {
        const scope = this.scopeManager.getScopeForPath(path);
        if (scope !== null) {
          scopePaths.set(scope.id, path);
        }
      },
      ArrowFunctionExpression: (path: NodePath<t.ArrowFunctionExpression>) => {
        const scope = this.scopeManager.getScopeForPath(path);
        if (scope !== null) {
          scopePaths.set(scope.id, path);
        }
      },
    });

    return scopePaths;
  }

  /**
   * Recrawl scope to synchronize Babel's internal state
   */
  private recrawlScope(ast: t.File): void {
    traverse(ast, {
      Program(path: NodePath<t.Program>) {
        path.scope.crawl();
        path.stop();
      },
    });
  }

  /**
   * Refresh node paths after AST modifications
   */
  private refreshNodePaths(
    ast: t.File,
    sourceMatch: ElementData,
    targetMatch: ElementData
  ): {
    sourceResult: Result<ElementData, RegraffError>;
    targetResult: Result<ElementData, RegraffError>;
  } {
    const sourceNode = sourceMatch.path.node;
    const targetNode = targetMatch.path.node;

    const freshSourcePath = this.findNodePath(ast, sourceNode);
    const freshTargetPath = this.findNodePath(ast, targetNode);

    if (!freshSourcePath) {
      const loc = sourceNode.loc;
      return {
        sourceResult: err(
          createSelectorError({
            code: 'NODE_NOT_FOUND',
            message: 'Failed to find source node after hoisting',
            selector: {
              file: '',
              line: loc?.start.line ?? 0,
              column: loc?.start.column ?? 0,
            },
            file: '',
          })
        ),
        targetResult: ok(targetMatch),
      };
    }
    if (!freshTargetPath) {
      const loc = targetNode.loc;
      return {
        sourceResult: ok(sourceMatch),
        targetResult: err(
          createSelectorError({
            code: 'NODE_NOT_FOUND',
            message: 'Failed to find target node after hoisting',
            selector: {
              file: '',
              line: loc?.start.line ?? 0,
              column: loc?.start.column ?? 0,
            },
            file: '',
          })
        ),
      };
    }

    return {
      sourceResult: ok({
        node: sourceNode,
        path: freshSourcePath,
        atomicUnit: sourceMatch.atomicUnit,
      }),
      targetResult: ok({
        node: targetNode,
        path: freshTargetPath,
        atomicUnit: targetMatch.atomicUnit,
      }),
    };
  }

  /**
   * Helper function to find a fresh NodePath for a given node
   */
  private findNodePath(ast: t.File, targetNode: t.Node): NodePath | null {
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
}

/**
 * Factory function to create a MoveTransformationPipeline
 *
 * @param resolver - Selector resolver
 * @param scopeManager - Scope manager
 * @param analyzer - Dependency analyzer
 * @param planner - Hoist planner
 * @param executor - Hoist executor
 * @param transformer - JSX transformer
 * @param generator - Code generator
 * @returns MoveTransformationPipeline instance
 */
export function createMoveTransformationPipeline(
  resolver: SelectorResolver,
  scopeManager: ScopeManager,
  analyzer: DependencyOrchestrator,
  planner: HoistPlanBuilder,
  executor: HoistExecutor,
  transformer: JSXTransformer,
  generator: CodeGenerator
): MoveTransformationPipeline {
  return new MoveTransformationPipeline(
    resolver,
    scopeManager,
    analyzer,
    planner,
    executor,
    transformer,
    generator
  );
}
