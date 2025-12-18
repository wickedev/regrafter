/**
 * Cross-File Movement Module
 *
 * Main integration point for cross-file movement functionality.
 * Coordinates multi-file AST transformations and generates all modified files.
 * Implements task 4.5.1 from the task list.
 */

import generateCodeModule from '@babel/generator';
import type * as t from '@babel/types';

import { createInternalError, type InternalErrorType } from '../../errors/index.js';
import { ok, err, isErr, type Result } from '../../result/index.js';
import {
  createCode,
} from '../../types/factories.js';
import type {
  InternalDependency,
  ImportOperation,
  SharedModuleOperation,
} from '../../types/internal.js';
import type {
  Code,
  Dependency,
} from '../../types/public.js';
import { loadGenerateFunction } from '../../utils/index.js';

const generateCode = loadGenerateFunction(generateCodeModule);

// Import cross-file sub-modules
import {
  buildImportGraph,
  detectCircularDependencies,
  resolveCircularDependencies,
} from './circular-dependency.js';
import {
  detectCrossFileMove,
  analyzeDependencyExports,
  needsSharedModule,
  type DependencyExportAnalysis,
} from './detector.js';
import {
  isNewFile,
  generateEmptyComponentFile,
  generateEmptyFile,
  isComponentFile,
  validateNewFilePath,
  type NewFileConfig,
  type NewFileResult,
} from './new-file-handler.js';
import {
  generateSharedModule,
  updateSourceFileReferences,
  generateTargetImports,
  addImportsToAst,
  addExportsToSourceFile,
} from './shared-module-creator.js';

// Re-export all sub-module types and functions
export * from './detector.js';
export * from './shared-module-creator.js';
export * from './circular-dependency.js';
export * from './new-file-handler.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for cross-file transformation.
 */
export interface CrossFileContext {
  /** Map of file path to AST */
  asts: Map<string, t.File>;
  /** Map of file path to original content */
  originalContents: Map<string, string>;
  /** Source file path */
  sourceFile: string;
  /** Target file path */
  targetFile: string;
  /** Dependencies of the element being moved */
  dependencies: InternalDependency[];
  /** Whether target file is new */
  isNewTargetFile: boolean;
}

/**
 * Result of cross-file transformation.
 */
export interface CrossFileTransformResult {
  /** Whether transformation was successful */
  success: boolean;
  /** Modified ASTs */
  modifiedAsts: Map<string, t.File>;
  /** New files created */
  newFiles: Map<string, t.File>;
  /** All generated codes */
  codes: Code[];
  /** Import operations performed */
  importOperations: ImportOperation[];
  /** Shared module operations performed */
  sharedModuleOperations: SharedModuleOperation[];
  /** Error message if failed */
  error?: string;
}

/**
 * Options for cross-file transformation.
 */
export interface CrossFileOptions {
  /** Whether to create shared modules for dependencies */
  createSharedModules?: boolean;
  /** Whether to auto-resolve circular dependencies */
  resolveCircularDeps?: boolean;
  /** Configuration for new target files */
  newFileConfig?: NewFileConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type guard for generateCode result.
 */
function isGeneratedCode(value: unknown): value is { code: string; map?: object } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('code' in value)) {
    return false;
  }
  // At this point, TypeScript knows value is an object with 'code' property
  type ObjectWithCode = { code: unknown };
  const obj: ObjectWithCode = value;
  return typeof obj.code === 'string';
}

/**
 * Safely generates code from AST.
 */
function safeGenerateCode(ast: t.Node, opts?: object): Result<{ code: string; map?: object }, InternalErrorType> {
  const result: unknown = generateCode(ast, opts);
  if (isGeneratedCode(result)) {
    return ok(result);
  }
  return err(
    createInternalError({
      code: 'E001',
      message: `safeGenerateCode: Invalid generateCode result with type ${typeof result}`,
    })
  );
}

/**
 * Handles shared module creation and source file updates.
 */
function handleSharedModuleCreation(
  depsNeedingSharedModule: InternalDependency[],
  sourceAst: t.File,
  sourceFile: string,
  newFiles: Map<string, t.File>,
  modifiedAsts: Map<string, t.File>,
  sharedModuleOperations: SharedModuleOperation[],
  importOperations: ImportOperation[]
): Result<string, InternalErrorType> {
  const sharedModuleResultOrError = generateSharedModule(
    depsNeedingSharedModule,
    sourceAst,
    sourceFile
  );

  if (isErr(sharedModuleResultOrError)) {
    return err(sharedModuleResultOrError.error);
  }

  const sharedModuleResult = sharedModuleResultOrError.value;

  const sharedModulePath = sharedModuleResult.operation.newFilePath;
  newFiles.set(sharedModulePath, sharedModuleResult.ast);
  sharedModuleOperations.push(sharedModuleResult.operation);

  const sourceUpdate = updateSourceFileReferences(
    sourceAst,
    sourceFile,
    sharedModulePath,
    depsNeedingSharedModule
  );

  modifiedAsts.set(sourceFile, sourceUpdate.ast);
  importOperations.push(...sourceUpdate.imports);

  return ok(sharedModulePath);
}

/**
 * Handles adding exports to source file for unexported dependencies.
 */
function handleExportAdditions(
  exportAnalysis: DependencyExportAnalysis,
  depsNeedingSharedModule: InternalDependency[],
  sourceFile: string,
  sourceAst: t.File,
  modifiedAsts: Map<string, t.File>
): void {
  const unexportedNonShared = exportAnalysis.unexportedDeps.filter(
    (dep) => !depsNeedingSharedModule.some((d) => d.id === dep.id)
  );

  if (unexportedNonShared.length > 0) {
    const currentSourceAst = modifiedAsts.get(sourceFile) ?? sourceAst;
    const exportedSourceAst = addExportsToSourceFile(
      currentSourceAst,
      unexportedNonShared.map((d) => d.symbol)
    );
    modifiedAsts.set(sourceFile, exportedSourceAst);
  }
}

/**
 * Handles circular dependency detection and resolution.
 */
function handleCircularDependencies(
  context: CrossFileContext,
  modifiedAsts: Map<string, t.File>,
  newFiles: Map<string, t.File>,
  resolveCircularDeps: boolean,
  sharedModuleOperations: SharedModuleOperation[]
): { success: boolean; error?: string } {
  const allAsts = new Map([...context.asts, ...modifiedAsts, ...newFiles]);
  const importGraph = buildImportGraph(allAsts);
  const circularCheck = detectCircularDependencies(importGraph);

  if (!circularCheck.hasCircular) {
    return { success: true };
  }

  if (resolveCircularDeps) {
    const resolution = resolveCircularDependencies(importGraph, allAsts);

    if (!resolution.success) {
      return {
        success: false,
        error: resolution.error ?? 'Failed to resolve circular dependencies',
      };
    }

    for (const res of resolution.resolutions) {
      const hasSharedPath = res.sharedModulePath !== undefined && res.sharedModulePath.length > 0;
      if (hasSharedPath && res.type === 'extract_shared') {
        sharedModuleOperations.push(...res.operations);
      }
    }

    return { success: true };
  }

  const cycle = circularCheck.shortestCycle ?? [];
  const cycleDescription = cycle.length > 0 ? cycle.join(' -> ') : 'unknown cycle';

  return {
    success: false,
    error: `Circular dependency detected: ${cycleDescription}`,
  };
}

/**
 * Generates code for all modified, new, and unchanged files.
 */
function generateCodeForAllFiles(
  context: CrossFileContext,
  modifiedAsts: Map<string, t.File>,
  newFiles: Map<string, t.File>
): Result<Code[], InternalErrorType> {
  const codes: Code[] = [];

  // Generate code for modified files
  for (const [filePath, ast] of modifiedAsts) {
    const originalContent = context.originalContents.get(filePath);
    const generatedResult = safeGenerateCode(ast, { comments: true });

    if (isErr(generatedResult)) {
      return err(generatedResult.error);
    }

    const generated = generatedResult.value;

    codes.push(
      createCode({
        file: filePath,
        content: generated.code,
        changed: true,
        original: originalContent,
      })
    );
  }

  // Generate code for new files
  for (const [filePath, ast] of newFiles) {
    if (modifiedAsts.has(filePath)) {
      continue;
    }

    const generatedResult = safeGenerateCode(ast, { comments: true });

    if (isErr(generatedResult)) {
      return err(generatedResult.error);
    }

    const generated = generatedResult.value;

    codes.push(
      createCode({
        file: filePath,
        content: generated.code,
        changed: true,
        isNew: true,
      })
    );
  }

  // Add unchanged files
  for (const [filePath, _ast] of context.asts) {
    if (modifiedAsts.has(filePath) || newFiles.has(filePath)) {
      continue;
    }

    const originalContent = context.originalContents.get(filePath);
    if (originalContent !== undefined) {
      codes.push(
        createCode({
          file: filePath,
          content: originalContent,
          changed: false,
        })
      );
    }
  }

  return ok(codes);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Integration (4.5.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Orchestrates a cross-file move transformation.
 *
 * @param context - Transformation context
 * @param options - Transformation options
 * @returns Transformation result
 */
export function executeCrossFileTransform(
  context: CrossFileContext,
  options: CrossFileOptions = {}
): CrossFileTransformResult {
  const {
    createSharedModules = true,
    resolveCircularDeps = true,
  } = options;

  const modifiedAsts = new Map<string, t.File>();
  const newFiles = new Map<string, t.File>();
  const codes: Code[] = [];
  const importOperations: ImportOperation[] = [];
  const sharedModuleOperations: SharedModuleOperation[] = [];

  try {
    // Step 1: Handle new target file if needed
    if (context.isNewTargetFile) {
      const newFileResultOrError = handleNewTargetFile(
        context.targetFile,
        options.newFileConfig
      );

      if (isErr(newFileResultOrError)) {
        return {
          success: false,
          modifiedAsts,
          newFiles,
          codes,
          importOperations,
          sharedModuleOperations,
          error: newFileResultOrError.error.message,
        };
      }

      const newFileResult = newFileResultOrError.value;
      newFiles.set(context.targetFile, newFileResult.ast);
      context.asts.set(context.targetFile, newFileResult.ast);
    }

    // Step 2: Analyze dependency exports
    const sourceAst = context.asts.get(context.sourceFile);
    if (!sourceAst) {
      return {
        success: false,
        modifiedAsts,
        newFiles,
        codes,
        importOperations,
        sharedModuleOperations,
        error: `Source file not found: ${context.sourceFile}`,
      };
    }

    const exportAnalysis = analyzeDependencyExports(
      sourceAst,
      context.dependencies,
      context.sourceFile
    );

    // Step 3: Determine if shared module is needed and create it
    const depsNeedingSharedModule = context.dependencies.filter(
      (dep) => needsSharedModule(dep, exportAnalysis)
    );

    let sharedModulePath: string | null = null;
    if (createSharedModules && depsNeedingSharedModule.length > 0) {
      const sharedModulePathResult = handleSharedModuleCreation(
        depsNeedingSharedModule,
        sourceAst,
        context.sourceFile,
        newFiles,
        modifiedAsts,
        sharedModuleOperations,
        importOperations
      );

      if (isErr(sharedModulePathResult)) {
        return {
          success: false,
          modifiedAsts,
          newFiles,
          codes,
          importOperations,
          sharedModuleOperations,
          error: sharedModulePathResult.error.message,
        };
      }

      sharedModulePath = sharedModulePathResult.value;
    }

    // Step 4: Generate imports for target file
    const targetImports = generateTargetImports(
      context.targetFile,
      context.sourceFile,
      sharedModulePath,
      context.dependencies,
      exportAnalysis
    );
    importOperations.push(...targetImports.imports);

    // Step 5: Add exports to source file for unexported dependencies
    handleExportAdditions(
      exportAnalysis,
      depsNeedingSharedModule,
      context.sourceFile,
      sourceAst,
      modifiedAsts
    );

    // Step 6: Add imports to target file
    let targetAst = context.asts.get(context.targetFile);
    if (!targetAst) {
      return {
        success: false,
        modifiedAsts,
        newFiles,
        codes,
        importOperations,
        sharedModuleOperations,
        error: `Target file not found: ${context.targetFile}`,
      };
    }

    targetAst = addImportsToAst(targetAst, targetImports.imports);
    modifiedAsts.set(context.targetFile, targetAst);

    // Step 7: Check for circular dependencies
    const circularResult = handleCircularDependencies(
      context,
      modifiedAsts,
      newFiles,
      resolveCircularDeps,
      sharedModuleOperations
    );

    if (!circularResult.success) {
      return {
        success: false,
        modifiedAsts,
        newFiles,
        codes,
        importOperations,
        sharedModuleOperations,
        error: circularResult.error,
      };
    }

    // Step 8: Generate code for all files
    const generatedCodesResult = generateCodeForAllFiles(context, modifiedAsts, newFiles);

    if (isErr(generatedCodesResult)) {
      return {
        success: false,
        modifiedAsts,
        newFiles,
        codes,
        importOperations,
        sharedModuleOperations,
        error: generatedCodesResult.error.message,
      };
    }

    codes.push(...generatedCodesResult.value);

    return {
      success: true,
      modifiedAsts,
      newFiles,
      codes,
      importOperations,
      sharedModuleOperations,
    };
  } catch (error) {
    return {
      success: false,
      modifiedAsts,
      newFiles,
      codes,
      importOperations,
      sharedModuleOperations,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handles creation of a new target file.
 */
function handleNewTargetFile(
  targetFile: string,
  config?: NewFileConfig
): Result<NewFileResult, InternalErrorType> {
  const validation = validateNewFilePath(targetFile);
  if (!validation.valid) {
    return err(
      createInternalError({
        code: 'E001',
        message: `handleNewTargetFile: ${validation.error ?? 'Invalid file path'} for target file ${targetFile}`,
      })
    );
  }

  if (isComponentFile(targetFile)) {
    return generateEmptyComponentFile(targetFile, config);
  }

  return generateEmptyFile(targetFile, config?.defaultImports);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates that a cross-file move is possible.
 *
 * @param sourceFile - Source file path
 * @param targetFile - Target file path
 * @param sourceAst - Source file AST
 * @param _targetAst - Target file AST (may be undefined if new file)
 * @param dependencies - Dependencies of the element being moved
 * @param existingFiles - Set of existing file paths
 * @returns Validation result
 */
export function validateCrossFileMove(
  sourceFile: string,
  targetFile: string,
  sourceAst: t.File,
  _targetAst: t.File | undefined,
  dependencies: InternalDependency[],
  existingFiles: Set<string>
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if it's actually a cross-file move
  const detection = detectCrossFileMove(sourceFile, targetFile);
  if (!detection.isCrossFile) {
    errors.push('Source and target are the same file');
    return { valid: false, errors, warnings };
  }

  // Check if target file path is valid
  if (isNewFile(targetFile, existingFiles)) {
    const validation = validateNewFilePath(targetFile);
    if (!validation.valid) {
      errors.push(validation.error ?? 'Invalid target file path');
    }
  }

  // Check for dependencies that can't be resolved
  const exportAnalysis = analyzeDependencyExports(
    sourceAst,
    dependencies,
    sourceFile
  );

  // Check for dependencies with eval or dynamic code
  for (const dep of dependencies) {
    if (dep.origin.node !== null && dep.origin.node.type === 'CallExpression') {
      const callee = (dep.origin.node).callee;
      if (callee.type === 'Identifier' && callee.name === 'eval') {
        errors.push(
          `Dependency "${dep.symbol}" uses eval() and cannot be analyzed`
        );
      }
    }
  }

  // Warn about dependencies that will need shared module
  const needsShared = dependencies.filter((dep) =>
    needsSharedModule(dep, exportAnalysis)
  );
  if (needsShared.length > 0) {
    warnings.push(
      `${needsShared.length} dependencies will be extracted to a shared module`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Estimates the impact of a cross-file move.
 *
 * @param sourceFile - Source file path
 * @param _targetFile - Target file path
 * @param sourceAst - Source file AST
 * @param dependencies - Dependencies of the element being moved
 * @returns Impact estimation
 */
export function estimateCrossFileMoveImpact(
  sourceFile: string,
  _targetFile: string,
  sourceAst: t.File,
  dependencies: InternalDependency[]
): {
  filesModified: number;
  filesCreated: number;
  importsAdded: number;
  exportsAdded: number;
  sharedModulesCreated: number;
} {
  const exportAnalysis = analyzeDependencyExports(
    sourceAst,
    dependencies,
    sourceFile
  );

  const needsShared = dependencies.filter((dep) =>
    needsSharedModule(dep, exportAnalysis)
  );

  const sharedModulesCreated = needsShared.length > 0 ? 1 : 0;
  const exportsNeeded = exportAnalysis.unexportedDeps.filter(
    (dep) => !needsShared.some((d) => d.id === dep.id)
  );

  return {
    filesModified: 2, // Source and target
    filesCreated: sharedModulesCreated,
    importsAdded: dependencies.length,
    exportsAdded: exportsNeeded.length,
    sharedModulesCreated,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a cross-file context from inputs.
 */
export function createCrossFileContext(
  asts: Map<string, t.File>,
  originalContents: Map<string, string>,
  sourceFile: string,
  targetFile: string,
  dependencies: InternalDependency[]
): CrossFileContext {
  const existingFiles = new Set(asts.keys());

  return {
    asts,
    originalContents,
    sourceFile,
    targetFile,
    dependencies,
    isNewTargetFile: isNewFile(targetFile, existingFiles),
  };
}

/**
 * Merges transformation results with existing codes.
 */
export function mergeTransformResults(
  existingCodes: Code[],
  transformResult: CrossFileTransformResult
): Code[] {
  const codeMap = new Map<string, Code>();

  // Add existing codes
  for (const code of existingCodes) {
    codeMap.set(code.file, code);
  }

  // Override with transform results
  for (const code of transformResult.codes) {
    codeMap.set(code.file, code);
  }

  return Array.from(codeMap.values());
}

/**
 * Converts internal dependencies to public dependencies.
 */
export function toPublicDependencies(
  internalDeps: InternalDependency[]
): Dependency[] {
  return internalDeps.map((dep) => ({
    symbol: dep.symbol,
    type: dep.type,
    origin: dep.origin.file,
    scope: dep.scope.id,
    isTransitive: dep.isTransitive,
  }));
}
