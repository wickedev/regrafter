/**
 * Optimizer
 *
 * Main optimizer module that coordinates sink analysis, execution,
 * and performance optimization. Provides the public optimize() API.
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import type * as t from '@babel/types';

import type { RegraffError } from '../errors/index.js';
import { CodeGenerator } from '../generator/code-generator.js';
import type { Parser} from '../parser/index.js';
import { createParser } from '../parser/index.js';
import { ok, err, isErr, type Result } from '../result/index.js';
import {
  createCode,
  createDependencyGraph,
  addNodeToDependencyGraph,
  createDependencyNode,
  createScopeInfo,
  createOptimizeResult,
} from '../types/factories.js';
import { ScopeType, type DependencyGraph, type ScopeInfo } from '../types/index.js';
import type { FileInput, Code } from '../types/public.js';
import { loadTraverseFunction, type TraverseFunction } from '../utils/index.js';

const traverse: TraverseFunction = loadTraverseFunction(traverseModule);


import type { FastCanMove} from './fast-can-move.js';
import { createFastCanMove } from './fast-can-move.js';
import type {
  PerformanceOptimizer} from './performance-optimizer.js';
import {
  createPerformanceOptimizer,
} from './performance-optimizer.js';
import type { SinkAnalyzer} from './sink-analyzer.js';
import { createSinkAnalyzer } from './sink-analyzer.js';
import type { SinkExecutor} from './sink-executor.js';
import { createSinkExecutor } from './sink-executor.js';
import type {
  IOptimizer,
  OptimizeOptions,
  ExtendedOptimizeResult,
  FastCanMoveResult,
  FastCanMoveOptions,
  DeadCodeInfo,
  SinkAnalysisResult,
} from './types.js';

/**
 * Default options for optimization.
 */
const DEFAULT_OPTIMIZE_OPTIONS: Required<OptimizeOptions> = {
  enableSinking: true,
  enableDeadCodeRemoval: true,
  enablePropCleanup: true,
  sinkOptions: {
    minDepthImprovement: 1,
    analyzeTransitive: true,
    maxConsumers: 100,
    allowHookSinking: false,
  },
  performanceConfig: {
    maxCacheSize: 100,
    parallelProcessing: true,
    maxWorkers: 4,
    incrementalAnalysis: true,
    enableMemoization: true,
    cacheTTL: 60000,
  },
  dryRun: false,
};

/**
 * Optimizer coordinates all optimization operations including sink analysis,
 * dead code removal, and performance optimization.
 */
export class Optimizer implements IOptimizer {
  private readonly parser: Parser;
  private readonly generator: CodeGenerator;
  private readonly sinkAnalyzer: SinkAnalyzer;
  private readonly sinkExecutor: SinkExecutor;
  private readonly performanceOptimizer: PerformanceOptimizer;
  private readonly fastCanMove: FastCanMove;

  constructor() {
    this.parser = createParser();
    this.generator = new CodeGenerator();
    this.sinkAnalyzer = createSinkAnalyzer();
    this.sinkExecutor = createSinkExecutor();
    this.performanceOptimizer = createPerformanceOptimizer();
    this.fastCanMove = createFastCanMove();
  }

  /**
   * Optimize files by sinking over-hoisted dependencies and removing dead code.
   *
   * @param files - Input files to optimize
   * @param options - Optimization options
   * @returns Result with array of optimized file contents, or RegraffError on failure
   */
  optimize(files: FileInput[], options?: OptimizeOptions): Result<Code[], RegraffError> {
    const result = this.optimizeWithDetails(files, options);

    if (isErr(result)) {
      return result;
    }

    return ok(this.convertToCodeArray(result.value));
  }

  /**
   * Optimize files with extended result details.
   *
   * @param files - Input files to optimize
   * @param options - Optimization options
   * @returns Result with extended optimize result details, or RegraffError on failure
   */
  optimizeWithDetails(
    files: FileInput[],
    options?: OptimizeOptions
  ): Result<ExtendedOptimizeResult, RegraffError> {
    const opts = this.mergeOptions(options);

    // Parse all files
    const parseResults = this.performanceOptimizer.timePhase('parse', () => {
      return this.parser.parseFiles(files);
    });

    // Extract ASTs
    const asts = new Map<string, t.File>();
    const originalContents = new Map<string, string>();

    for (const file of files) {
      const result = parseResults.get(file.path);
      if (result !== undefined && result.ok) {
        asts.set(file.path, result.value);
        originalContents.set(file.path, file.content);
      }
    }

    // Build dependency graph
    const graph = this.performanceOptimizer.timePhase('analysis', () => {
      return this.buildDependencyGraph(asts);
    });

    let sinkAnalysis: SinkAnalysisResult | undefined;
    const deadCode: DeadCodeInfo[] = [];

    // Sink analysis and execution
    if (opts.enableSinking) {
      const analysisResult = this.performanceOptimizer.timePhase('analysis', () => {
        return this.sinkAnalyzer.analyze(files, graph, opts.sinkOptions);
      });
      sinkAnalysis = analysisResult;

      // analysisResult is always defined (analyze() always returns a result)
      // Check if there are sinkable elements and if not in dry run mode
      if (!opts.dryRun && analysisResult.sinkable.length > 0) {
        this.performanceOptimizer.timePhase('transform', () => {
          return this.sinkExecutor.execute(analysisResult.sinkable, asts);
        });
      }
    }

    // Dead code removal
    if (opts.enableDeadCodeRemoval && !opts.dryRun) {
      const removedDeadCode = this.performanceOptimizer.timePhase('transform', () => {
        return this.sinkExecutor.removeDeadCode(asts);
      });
      deadCode.push(...removedDeadCode);
    }

    // Generate code - now returns Result
    const generatedCodeResult = this.performanceOptimizer.timePhase('generate', () => {
      return this.generator.generateMultiple(asts);
    });

    // Handle generation errors
    if (isErr(generatedCodeResult)) {
      return err(generatedCodeResult.error);
    }

    const generatedCode = generatedCodeResult.value;

    // Build result
    const result = createOptimizeResult({
      asts,
      sunkDependencies: sinkAnalysis?.sinkable ?? [],
      removedProps: [],
      deadCodeRemoved: deadCode.map((d) => d.name),
    });

    // Determine if changes were made
    const hasChanges = this.checkForChanges(files, generatedCode);

    return ok({
      ...result,
      sinkAnalysis,
      deadCode,
      metrics: this.performanceOptimizer.getMetrics(),
      hasChanges,
    });
  }

  /**
   * Fast canMove check without full transformation.
   *
   * @param files - Input files
   * @param from - Source selector
   * @param to - Target selector
   * @param options - Analysis options
   * @returns Fast canMove result
   */
  canMove(
    files: FileInput[],
    from: { file: string; path: string },
    to: { file: string; path: string },
    options?: FastCanMoveOptions
  ): FastCanMoveResult {
    return this.fastCanMove.analyze(files, from, to, options);
  }

  /**
   * Clear all internal caches.
   */
  clearCaches(): void {
    this.parser.clearCache();
    this.sinkAnalyzer.clearCache();
    this.performanceOptimizer.clearCaches();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private mergeOptions(options?: OptimizeOptions): Required<OptimizeOptions> {
    return {
      ...DEFAULT_OPTIMIZE_OPTIONS,
      ...options,
      sinkOptions: {
        ...DEFAULT_OPTIMIZE_OPTIONS.sinkOptions,
        ...options?.sinkOptions,
      },
      performanceConfig: {
        ...DEFAULT_OPTIMIZE_OPTIONS.performanceConfig,
        ...options?.performanceConfig,
      },
    };
  }

  private buildDependencyGraph(asts: Map<string, t.File>): DependencyGraph {
    const graph = createDependencyGraph();

    for (const [_filePath, ast] of Array.from(asts)) {
      // Build scope tree first
      const scopeTree = this.sinkAnalyzer.buildScopeTree(ast);

      // Find all declarations and references
      traverse(ast, {
        VariableDeclarator: (path: NodePath<t.VariableDeclarator>) => {
          const id = path.node.id;
          if (id.type !== 'Identifier') return;

          const scope = this.findEnclosingScope(path, scopeTree.root);
          const node = createDependencyNode({
            type: 'symbol',
            name: id.name,
            path,
            scope,
            metadata: {
              isHook: false,
              isPure: this.isPureDeclaration(path),
              hasSideEffects: this.hasSideEffects(path),
              isExported: this.isExported(path),
            },
          });
          addNodeToDependencyGraph(graph, node);
        },
        FunctionDeclaration: (path: NodePath<t.FunctionDeclaration>) => {
          const nodeId = path.node.id;
          if (!nodeId) return;

          const scope = this.findEnclosingScope(path, scopeTree.root);
          const node = createDependencyNode({
            type: 'symbol',
            name: nodeId.name,
            path,
            scope,
            metadata: {
              isHook: this.fastCanMove.isHookName(nodeId.name),
              isPure: true,
              hasSideEffects: false,
              isExported: this.isExported(path),
            },
          });
          addNodeToDependencyGraph(graph, node);
        },
        JSXElement: (path: NodePath<t.JSXElement>) => {
          const opening = path.node.openingElement;
          const name = opening.name;
          if (name.type !== 'JSXIdentifier') return;

          const scope = this.findEnclosingScope(path, scopeTree.root);
          const node = createDependencyNode({
            type: 'element',
            name: name.name,
            path,
            scope,
            metadata: {
              isHook: false,
              isPure: false,
              hasSideEffects: false,
              isExported: false,
            },
          });
          addNodeToDependencyGraph(graph, node);
        },
      });
    }

    return graph;
  }

  private findEnclosingScope(path: NodePath, rootScope: ScopeInfo): ScopeInfo {
    let current: NodePath | null = path;

    while (current) {
      // Check for function scope
      if (
        current.isFunctionDeclaration() ||
        current.isFunctionExpression() ||
        current.isArrowFunctionExpression()
      ) {
        // Check if React component
        const name = this.getFunctionName(current);
        const isComponent = name !== null ? /^[A-Z]/.test(name) : false;

        return createScopeInfo({
          type: isComponent ? ScopeType.Component : ScopeType.Function,
          path: current,
          parent: rootScope,
          depth: rootScope.depth + 1,
        });
      }

      // Check for block scope
      if (current.isBlockStatement()) {
        const parent = current.parentPath;
        if (parent.isIfStatement()) {
          return createScopeInfo({
            type: ScopeType.Conditional,
            path: current,
            parent: rootScope,
            depth: rootScope.depth + 1,
          });
        }
        if (
          parent.isForStatement() ||
          parent.isWhileStatement() ||
          parent.isDoWhileStatement()
        ) {
          return createScopeInfo({
            type: ScopeType.Loop,
            path: current,
            parent: rootScope,
            depth: rootScope.depth + 1,
          });
        }
      }

      current = current.parentPath;
    }

    return rootScope;
  }

  private getFunctionName(path: NodePath): string | null {
    if (path.isFunctionDeclaration()) {
      const nodeId = path.node.id;
      if (nodeId !== null && nodeId !== undefined) {
        return nodeId.name;
      }
    }
    const parentPath = path.parentPath;
    if (parentPath !== null && parentPath.isVariableDeclarator()) {
      const id = parentPath.node.id;
      if (id.type === 'Identifier') {
        return id.name;
      }
    }
    return null;
  }

  private isPureDeclaration(path: NodePath<t.VariableDeclarator>): boolean {
    const init = path.node.init;
    if (init === null || init === undefined) return true;

    // Check for side-effect-free initializers
    if (
      init.type === 'StringLiteral' ||
      init.type === 'NumericLiteral' ||
      init.type === 'BooleanLiteral' ||
      init.type === 'NullLiteral' ||
      init.type === 'BigIntLiteral'
    ) {
      return true;
    }

    if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
      return true;
    }

    if (init.type === 'ObjectExpression' || init.type === 'ArrayExpression') {
      return true;
    }

    return false;
  }

  private hasSideEffects(path: NodePath): boolean {
    let hasSideEffects = false;

    path.traverse({
      CallExpression(callPath: NodePath<t.CallExpression>) {
        // Check for known side-effect functions
        const callee = callPath.node.callee;
        if (callee.type === 'Identifier') {
          if (['console', 'fetch', 'setTimeout', 'setInterval'].includes(callee.name)) {
            hasSideEffects = true;
            callPath.stop();
          }
        }
      },
      AssignmentExpression(_path: NodePath<t.AssignmentExpression>) {
        hasSideEffects = true;
      },
    });

    return hasSideEffects;
  }

  private isExported(path: NodePath): boolean {
    let current: NodePath | null = path;
    while (current) {
      if (current.isExportNamedDeclaration() || current.isExportDefaultDeclaration()) {
        return true;
      }
      current = current.parentPath;
    }
    return false;
  }

  private convertToCodeArray(result: ExtendedOptimizeResult): Code[] {
    const codes: Code[] = [];

    for (const [filePath, ast] of Array.from(result.asts)) {
      const generated = this.generator.generate(ast);
      if (isErr(generated)) {
        throw new Error(`Failed to generate code for ${filePath}: ${generated.error.message}`);
      }
      codes.push(
        createCode({
          file: filePath,
          content: generated.value.code,
          changed: result.hasChanges,
        })
      );
    }

    return codes;
  }

  private checkForChanges(
    originalFiles: FileInput[],
    generatedCode: Map<string, { code: string }>
  ): boolean {
    for (const file of originalFiles) {
      const generated = generatedCode.get(file.path);
      if (generated && generated.code !== file.content) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Create an Optimizer instance.
 */
export function createOptimizer(): Optimizer {
  return new Optimizer();
}

/**
 * Standalone optimize function.
 *
 * @param files - Input files to optimize
 * @param options - Optimization options
 * @returns Array of optimized file contents
 */
export function optimize(files: FileInput[], options?: OptimizeOptions): Code[] {
  const optimizer = createOptimizer();
  const result = optimizer.optimize(files, options);
  if (isErr(result)) {
    throw new Error(`Optimization failed: ${result.error.message}`);
  }
  return result.value;
}

/**
 * Standalone optimize function with extended results.
 *
 * @param files - Input files to optimize
 * @param options - Optimization options
 * @returns Extended optimize result
 */
export function optimizeWithDetails(
  files: FileInput[],
  options?: OptimizeOptions
): ExtendedOptimizeResult {
  const optimizer = createOptimizer();
  const result = optimizer.optimizeWithDetails(files, options);
  if (isErr(result)) {
    throw new Error(`Optimization failed: ${result.error.message}`);
  }
  return result.value;
}
