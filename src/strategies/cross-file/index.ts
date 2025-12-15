/**
 * Cross-File Movement Module
 *
 * Main integration point for cross-file movement functionality.
 * Coordinates multi-file AST transformations and generates all modified files.
 * Implements task 4.5.1 from the task list.
 */

import generateCode from '@babel/generator';
import * as t from '@babel/types';

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
} from './detector.js';
import {
  isNewFile,
  generateEmptyComponentFile,
  generateEmptyFile,
  isComponentFile,
  validateNewFilePath,
  type NewFileConfig,
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
      const newFileResult = handleNewTargetFile(
        context.targetFile,
        options.newFileConfig
      );
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

    // Step 3: Determine if shared module is needed
    const depsNeedingSharedModule = context.dependencies.filter(
      (dep) => needsSharedModule(dep, exportAnalysis)
    );

    let sharedModulePath: string | null = null;

    if (createSharedModules && depsNeedingSharedModule.length > 0) {
      // Step 3a: Create shared module
      const sharedModuleResult = generateSharedModule(
        depsNeedingSharedModule,
        sourceAst,
        context.sourceFile
      );

      sharedModulePath = sharedModuleResult.operation.newFilePath;
      newFiles.set(sharedModulePath, sharedModuleResult.ast);
      sharedModuleOperations.push(sharedModuleResult.operation);

      // Step 3b: Update source file to import from shared module
      const sourceUpdate = updateSourceFileReferences(
        sourceAst,
        context.sourceFile,
        sharedModulePath,
        depsNeedingSharedModule
      );

      modifiedAsts.set(context.sourceFile, sourceUpdate.ast);
      importOperations.push(...sourceUpdate.imports);
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
    const unexportedNonShared = exportAnalysis.unexportedDeps.filter(
      (dep) => !depsNeedingSharedModule.some((d) => d.id === dep.id)
    );

    if (unexportedNonShared.length > 0) {
      const currentSourceAst =
        modifiedAsts.get(context.sourceFile) ?? sourceAst;
      const exportedSourceAst = addExportsToSourceFile(
        currentSourceAst,
        unexportedNonShared.map((d) => d.symbol)
      );
      modifiedAsts.set(context.sourceFile, exportedSourceAst);
    }

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
    const allAsts = new Map([...context.asts, ...modifiedAsts, ...newFiles]);
    const importGraph = buildImportGraph(allAsts);
    const circularCheck = detectCircularDependencies(importGraph);

    if (circularCheck.hasCircular) {
      if (resolveCircularDeps) {
        // Try to resolve circular dependencies
        const resolution = resolveCircularDependencies(importGraph, allAsts);

        if (!resolution.success) {
          return {
            success: false,
            modifiedAsts,
            newFiles,
            codes,
            importOperations,
            sharedModuleOperations,
            error: resolution.error ?? 'Failed to resolve circular dependencies',
          };
        }

        // Add any new shared modules from resolution
        for (const res of resolution.resolutions) {
          if (res.sharedModulePath && res.type === 'extract_shared') {
            sharedModuleOperations.push(...res.operations);
          }
        }
      } else {
        return {
          success: false,
          modifiedAsts,
          newFiles,
          codes,
          importOperations,
          sharedModuleOperations,
          error: `Circular dependency detected: ${circularCheck.shortestCycle?.join(' -> ')}`,
        };
      }
    }

    // Step 8: Generate code for all files
    // Generate code for modified files
    for (const [filePath, ast] of modifiedAsts) {
      const originalContent = context.originalContents.get(filePath);
      const generated = generateCode(ast, { comments: true });

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
        continue; // Already added
      }

      const generated = generateCode(ast, { comments: true });

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
      if (originalContent) {
        codes.push(
          createCode({
            file: filePath,
            content: originalContent,
            changed: false,
          })
        );
      }
    }

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
): NewFileResult {
  const validation = validateNewFilePath(targetFile);
  if (!validation.valid) {
    throw new Error(validation.error);
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
 * @param targetAst - Target file AST (may be undefined if new file)
 * @param dependencies - Dependencies of the element being moved
 * @param existingFiles - Set of existing file paths
 * @returns Validation result
 */
export function validateCrossFileMove(
  sourceFile: string,
  targetFile: string,
  sourceAst: t.File,
  targetAst: t.File | undefined,
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
    if (dep.origin.node.type === 'CallExpression') {
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
 * @param targetFile - Target file path
 * @param sourceAst - Source file AST
 * @param dependencies - Dependencies of the element being moved
 * @returns Impact estimation
 */
export function estimateCrossFileMoveImpact(
  sourceFile: string,
  targetFile: string,
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
