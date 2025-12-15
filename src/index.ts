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
  type Result,
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
  RegraffError,
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

  // Dependency analysis (Phase 2)
  DependencyAnalyzer,
  createDependencyAnalyzer,
  MoveAnalysisBuilder,
  createMoveAnalysisBuilder,
} from './analyzer/index.js';

// Export scope utilities (Phase 2)
export {
  ScopeManager,
  createScopeManager,
} from './scope/index.js';

// Export selector utilities
export {
  SelectorResolver,
  createSelectorResolver,
} from './selector/index.js';

// Export strategy utilities for dependency hoisting (Phase 3)
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

// Internal imports for implementation
import type {
  FileInput,
  Selector,
  Move,
  Options,
  Result,
  Code,
} from './types/index.js';
import {
  mergeOptions,
  createMoveAnalysis,
  createCode,
  createSuccessResult,
  createFailureResult,
  createAnalysisStats,
} from './types/index.js';
import { validateMoveOperation, type MoveValidationResult } from './analyzer/index.js';
import { createParser } from './parser/index.js';
import { CodeGenerator } from './generator/CodeGenerator.js';
import { createSelectorResolver } from './selector/index.js';
import { createJSXTransformer } from './transformer/index.js';
import { createScopeManager } from './scope/index.js';
import { createMoveAnalysisBuilder, DependencyAnalyzer } from './analyzer/index.js';
import {
  createConfiguredHoistPlanner,
  createHoistExecutor,
  type HoistPlan,
  type HoistContext,
  type HoistExecutionContext,
} from './strategies/index.js';
import type { NodePath } from '@babel/traverse';
import traverse from '@babel/traverse';

/**
 * Main entry point for the regraft operation.
 *
 * Performs element relocation with automatic dependency analysis,
 * hoisting, and optional optimization.
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @param options - Optional configuration
 * @returns Result containing transformed files and analysis
 *
 * @example
 * ```typescript
 * import { regraft, Move } from 'regrafter';
 *
 * const result = regraft(
 *   [{ path: 'App.tsx', content: sourceCode }],
 *   { file: 'App.tsx', line: 10, column: 5 },
 *   { file: 'App.tsx', line: 20, column: 5 },
 *   Move.Inside
 * );
 *
 * if (result.success) {
 *   console.log('Transformed code:', result.codes[0].content);
 * }
 * ```
 */
export function regraft(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result {
  const mergedOptions = mergeOptions(options);

  // Validate the move first
  const validation = validateMoveOperation(files, from, to, mode);

  if (!validation.valid) {
    // Return failure result with reason
    return createFailureResult(
      validation.reason || 'Move validation failed',
      [],
      getSuggestedFixes(validation.errorCode)
    );
  }

  // If dryRun is enabled, return analysis without transformation
  if (mergedOptions.dryRun) {
    return createDryRunResult(files, validation);
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
 * Task 1.6.1: Basic move() API implementation
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns Array of transformed file contents
 */
export function move(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): Code[] {
  // Create required instances
  const parser = createParser();
  const generator = new CodeGenerator();
  const resolver = createSelectorResolver();
  const transformer = createJSXTransformer();

  // Parse all files
  const parsedFiles = new Map<string, import('@babel/types').File>();
  for (const file of files) {
    const result = parser.parse(file.content, file.path);
    if (!result.success || !result.ast) {
      throw new Error(`Failed to parse ${file.path}: ${result.errors[0]?.message || 'Unknown error'}`);
    }
    parsedFiles.set(file.path, result.ast);
  }

  // Get the AST for source and target files
  const sourceAst = parsedFiles.get(from.file);
  const targetAst = parsedFiles.get(to.file);

  if (!sourceAst) {
    throw new Error(`Source file not found: ${from.file}`);
  }
  if (!targetAst) {
    throw new Error(`Target file not found: ${to.file}`);
  }

  // Resolve selectors
  const sourceResult = resolver.resolve(from, sourceAst);
  if (!sourceResult.node || !sourceResult.path) {
    throw new Error(`Failed to resolve source: ${sourceResult.error?.message || 'Element not found'}`);
  }

  const targetResult = resolver.resolve(to, targetAst);
  if (!targetResult.node || !targetResult.path) {
    throw new Error(`Failed to resolve target: ${targetResult.error?.message || 'Element not found'}`);
  }

  // For same-file moves
  if (from.file === to.file) {
    // Perform the transformation
    const moveResult = transformer.move(
      sourceAst,
      sourceResult.path,
      targetResult.path,
      mode
    );

    if (!moveResult.success) {
      throw new Error(`Move failed: ${moveResult.error || 'Unknown error'}`);
    }

    // Generate code for all files
    const codes: Code[] = [];
    for (const file of files) {
      const ast = parsedFiles.get(file.path);
      if (!ast) continue;

      const generated = generator.generate(ast);
      codes.push(createCode({
        file: file.path,
        content: generated.code,
        changed: file.path === from.file,
        original: file.path === from.file ? file.content : undefined,
      }));
    }

    return codes;
  }

  // Cross-file move (Phase 4 - for now throw not implemented)
  throw new Error('Cross-file moves not yet implemented (Phase 4)');
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
  mode: Move
): Code[] {
  // Create required instances
  const parser = createParser();
  const generator = new CodeGenerator();
  const resolver = createSelectorResolver();
  const transformer = createJSXTransformer();
  const scopeManager = createScopeManager();
  const analyzer = new DependencyAnalyzer(scopeManager);
  const planner = createConfiguredHoistPlanner(scopeManager);
  const executor = createHoistExecutor();

  // Parse all files
  const parsedFiles = new Map<string, import('@babel/types').File>();
  for (const file of files) {
    const result = parser.parse(file.content, file.path);
    if (!result.success || !result.ast) {
      throw new Error(`Failed to parse ${file.path}: ${result.errors[0]?.message || 'Unknown error'}`);
    }
    parsedFiles.set(file.path, result.ast);
  }

  // Get the AST for source file
  const sourceAst = parsedFiles.get(from.file);
  if (!sourceAst) {
    throw new Error(`Source file not found: ${from.file}`);
  }

  // For same-file moves only (cross-file not yet implemented)
  if (from.file !== to.file) {
    throw new Error('Cross-file moves not yet implemented (Phase 4)');
  }

  // Build scope tree
  scopeManager.buildScopeTree(sourceAst);
  analyzer.setCurrentFile(from.file);

  // Resolve selectors
  const sourceResult = resolver.resolve(from, sourceAst);
  if (!sourceResult.node || !sourceResult.path) {
    throw new Error(`Failed to resolve source: ${sourceResult.error?.message || 'Element not found'}`);
  }

  const targetResult = resolver.resolve(to, sourceAst);
  if (!targetResult.node || !targetResult.path) {
    throw new Error(`Failed to resolve target: ${targetResult.error?.message || 'Element not found'}`);
  }

  // Get scopes
  const sourceScope = scopeManager.getScopeForPath(sourceResult.path);
  const targetScope = scopeManager.getScopeForPath(targetResult.path);

  // Perform dependency analysis
  const depAnalysis = analyzer.analyzeElement(sourceResult.path, targetScope);

  // If there are dependencies that need hoisting, create and execute a hoisting plan
  if (depAnalysis.needsHoisting.length > 0) {
    // Create hoisting context
    const context: HoistContext = {
      sourceFile: from.file,
      targetFile: to.file,
      sourceScope: sourceScope || undefined,
      targetScope: targetScope || undefined,
      targetComponent: targetScope,
    };

    // Create hoisting plan
    const hoistPlan = planner.plan(depAnalysis, context);

    // If the plan is valid, execute it
    if (hoistPlan.valid) {
      // Build dependency paths map for executor
      const dependencyPaths = new Map<string, NodePath>();
      const scopePaths = new Map<string, NodePath>();

      // Collect dependency paths
      for (const dep of depAnalysis.dependencies) {
        if (dep.location?.path) {
          dependencyPaths.set(dep.id, dep.location.path);
        }
      }

      // Collect scope paths by traversing the AST
      traverse(sourceAst, {
        FunctionDeclaration(path) {
          if (path.node.id) {
            scopePaths.set(path.node.id.name, path);
          }
        },
        FunctionExpression(path) {
          const parent = path.parent;
          if (parent && 'id' in parent && parent.id && 'name' in parent.id) {
            scopePaths.set(parent.id.name, path);
          }
        },
        ArrowFunctionExpression(path) {
          const parent = path.parent;
          if (parent && 'id' in parent && parent.id && 'name' in parent.id) {
            scopePaths.set(parent.id.name, path);
          }
        },
      });

      // Execute hoisting operations
      const execContext: HoistExecutionContext = {
        ast: sourceAst,
        dependencyPaths,
        scopePaths,
      };

      executor.execute(hoistPlan, execContext);
    }
  }

  // Now perform the element move
  const moveResult = transformer.move(
    sourceAst,
    sourceResult.path,
    targetResult.path,
    mode
  );

  if (!moveResult.success) {
    throw new Error(`Move failed: ${moveResult.error || 'Unknown error'}`);
  }

  // Generate code for all files
  const codes: Code[] = [];
  for (const file of files) {
    const ast = parsedFiles.get(file.path);
    if (!ast) continue;

    const generated = generator.generate(ast);
    codes.push(createCode({
      file: file.path,
      content: generated.code,
      changed: file.path === from.file,
      original: file.path === from.file ? file.content : undefined,
    }));
  }

  return codes;
}

/**
 * Analyze dependencies for a proposed move operation.
 *
 * Returns detailed dependency analysis without performing transformation.
 * Useful for understanding what hoisting would be required.
 *
 * Task 2.5.2: Implement analyze() API
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns Detailed analysis of dependencies and hoisting requirements
 */
export function analyze(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): MoveAnalysis {
  const validation = validateMoveOperation(files, from, to, mode);

  if (!validation.valid) {
    return createMoveAnalysis({
      canMove: false,
      reason: validation.reason,
      dependencies: [],
      hoistedDeps: [],
      suggestedFixes: getSuggestedFixes(validation.errorCode as string),
      stats: createAnalysisStats(),
    });
  }

  // Create required instances for dependency analysis
  const parser = createParser();
  const resolver = createSelectorResolver();

  // Note: HoistPlanner and strategies are available via ./strategies/index.js
  // for full dependency hoisting integration (Phase 3 complete)

  // Parse the source file
  const sourceFile = files.find(f => f.path === from.file);
  if (!sourceFile) {
    return createMoveAnalysis({
      canMove: false,
      reason: `Source file not found: ${from.file}`,
      dependencies: [],
      hoistedDeps: [],
      stats: createAnalysisStats(),
    });
  }

  const parseResult = parser.parse(sourceFile.content, sourceFile.path);
  if (!parseResult.success || !parseResult.ast) {
    return createMoveAnalysis({
      canMove: false,
      reason: `Failed to parse ${from.file}: ${parseResult.errors[0]?.message || 'Unknown error'}`,
      dependencies: [],
      hoistedDeps: [],
      stats: createAnalysisStats(),
    });
  }

  // Resolve selectors
  const sourceResult = resolver.resolve(from, parseResult.ast);
  if (!sourceResult.node || !sourceResult.path) {
    return createMoveAnalysis({
      canMove: false,
      reason: `Failed to resolve source: ${sourceResult.error?.message || 'Element not found'}`,
      dependencies: [],
      hoistedDeps: [],
      stats: createAnalysisStats(),
    });
  }

  const targetResult = resolver.resolve(to, parseResult.ast);
  if (!targetResult.node || !targetResult.path) {
    return createMoveAnalysis({
      canMove: false,
      reason: `Failed to resolve target: ${targetResult.error?.message || 'Element not found'}`,
      dependencies: [],
      hoistedDeps: [],
      stats: createAnalysisStats(),
    });
  }

  // Build scope tree and perform dependency analysis
  const scopeManager = createScopeManager();
  const analysisBuilder = createMoveAnalysisBuilder(scopeManager);
  analysisBuilder.setCurrentFile(from.file);

  // Perform full dependency analysis
  return analysisBuilder.analyze(parseResult.ast, sourceResult.path, targetResult.path);
}

/**
 * Optimize files by sinking over-hoisted dependencies.
 *
 * Analyzes dependency usage and moves declarations to their
 * optimal locations, removing unnecessary prop threading.
 *
 * @param files - Array of file inputs with path and content
 * @returns Array of optimized file contents
 */
export function optimize(
  files: FileInput[]
): Code[] {
  // For now, return files unchanged - full optimization is complex
  // and would be implemented as part of Phase 5
  return files.map(f => createCode({
    file: f.path,
    content: f.content,
    changed: false,
  }));
}

// =============================================================================
// Helper Functions for regraft
// =============================================================================

import type { SuggestedFix } from './types/index.js';
import { createSuggestedFix } from './types/index.js';

/**
 * Get suggested fixes based on error code
 */
function getSuggestedFixes(errorCode?: string): SuggestedFix[] | undefined {
  if (!errorCode) return undefined;

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
  validation: MoveValidationResult
): Result {
  // Create unchanged code results
  const codes: Code[] = files.map(file =>
    createCode({
      file: file.path,
      content: file.content,
      changed: false,
    })
  );

  // Create analysis result
  const analysis = createMoveAnalysis({
    canMove: validation.valid,
    reason: validation.valid ? undefined : validation.reason,
    dependencies: [], // TODO: Add dependency analysis in Phase 2
    hoistedDeps: [],
    stats: createAnalysisStats({
      totalDependencies: 0,
      hookDependencies: 0,
      variableDependencies: 0,
      importDependencies: 0,
      propDependencies: 0,
      transitiveDependencies: 0,
    }),
  });

  return {
    success: validation.valid,
    codes,
    analysis,
  };
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
): Result {
  try {
    // Perform dependency analysis
    const fullAnalysis = analyze(files, from, to, mode);

    // If analysis shows the move isn't possible, return failure
    if (!fullAnalysis.canMove) {
      return createFailureResult(
        fullAnalysis.reason || 'Move is not possible',
        [],
        fullAnalysis.suggestedFixes
      );
    }

    // Use the move function for actual transformation
    // The move function will now integrate hoisting internally if needed
    const codes = move(files, from, to, mode);

    // Return success with the real analysis
    return createSuccessResult(codes, fullAnalysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createFailureResult(message);
  }
}
