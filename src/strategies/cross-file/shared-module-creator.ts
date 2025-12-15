/**
 * Shared Module Creator
 *
 * Generates shared module files for dependencies that need to be
 * accessible from both source and target files.
 * Implements tasks 4.2.1, 4.2.2, and 4.2.3 from the task list.
 */

import generateCode from '@babel/generator';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

import {
  createImportOperation,
  createImportSpecifier,
  createSharedModuleOperation,
  createExportDeclaration,
} from '../../types/factories.js';
import type {
  InternalDependency,
  ImportOperation,
  ImportSpecifier,
  SharedModuleOperation,
  ExportDeclaration,
} from '../../types/internal.js';
import { DependencyType } from '../../types/public.js';

import {
  computeImportPath,
  needsSharedModule,
  type DependencyExportAnalysis,
} from './detector.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of shared module generation.
 */
export interface SharedModuleResult {
  /** The shared module operation */
  operation: SharedModuleOperation;
  /** AST for the new shared module file */
  ast: t.File;
  /** Generated code for the shared module */
  code: string;
}

/**
 * Result of source file update.
 */
export interface SourceFileUpdateResult {
  /** Updated AST */
  ast: t.File;
  /** Import operations to add */
  imports: ImportOperation[];
  /** Symbols that were moved to shared module */
  movedSymbols: string[];
}

/**
 * Result of target file import additions.
 */
export interface TargetImportResult {
  /** Import operations to add */
  imports: ImportOperation[];
}

/**
 * Configuration for shared module creation.
 */
export interface SharedModuleConfig {
  /** Base directory for the shared module */
  baseDir?: string;
  /** Naming convention for shared modules */
  namingConvention?: 'shared' | 'common' | 'utils';
  /** File extension */
  extension?: '.ts' | '.tsx' | '.js' | '.jsx';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Module Generation (4.2.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a shared module file for dependencies.
 *
 * @param dependencies - Dependencies to include in the shared module
 * @param sourceAst - Source file AST
 * @param sourceFile - Source file path
 * @param config - Configuration options
 * @returns Shared module result
 */
export function generateSharedModule(
  dependencies: InternalDependency[],
  sourceAst: t.File,
  sourceFile: string,
  config: SharedModuleConfig = {}
): SharedModuleResult {
  const {
    namingConvention = 'shared',
    extension = '.ts',
  } = config;

  // Generate shared module path
  const sharedModulePath = generateSharedModulePath(
    sourceFile,
    namingConvention,
    extension
  );

  // Extract declarations from source AST
  const exports: ExportDeclaration[] = [];
  const statements: t.Statement[] = [];

  // Collect all imports needed by the dependencies
  const neededImports = collectNeededImports(dependencies, sourceAst);

  // Add import statements first
  for (const importStmt of neededImports) {
    statements.push(importStmt);
  }

  // Extract and export each dependency
  for (const dep of dependencies) {
    const declaration = extractDeclaration(dep, sourceAst);
    if (declaration) {
      // Wrap in export named declaration
      const exportDecl = t.exportNamedDeclaration(declaration, []);
      statements.push(exportDecl);

      exports.push(
        createExportDeclaration({
          name: dep.symbol,
          type: 'named',
          node: declaration,
        })
      );
    }
  }

  // Create the AST for the shared module
  const sharedAst = t.file(t.program(statements, [], 'module'));

  // Generate code
  const result = generateCode(sharedAst, {
    comments: true,
    compact: false,
  });

  const operation = createSharedModuleOperation({
    newFilePath: sharedModulePath,
    exports,
    importers: [sourceFile],
  });

  return {
    operation,
    ast: sharedAst,
    code: result.code,
  };
}

/**
 * Generates the file path for a shared module.
 */
function generateSharedModulePath(
  sourceFile: string,
  convention: string,
  extension: string
): string {
  // Extract directory from source file
  const parts = sourceFile.split('/');
  parts.pop(); // Remove filename

  // Get source file name without extension
  const sourceFileName = sourceFile.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'module';

  // Generate shared module name
  const sharedName = `${sourceFileName}.${convention}${extension}`;

  return [...parts, sharedName].join('/');
}

/**
 * Collects import statements needed by the dependencies.
 */
function collectNeededImports(
  dependencies: InternalDependency[],
  sourceAst: t.File
): t.ImportDeclaration[] {
  const neededImports = new Map<string, Set<string>>();
  const defaultImports = new Map<string, string>();
  const namespaceImports = new Map<string, string>();

  // Find all identifiers used in the dependencies
  const usedIdentifiers = new Set<string>();
  for (const dep of dependencies) {
    collectIdentifiersFromNode(dep.origin.node, usedIdentifiers);
  }

  // Analyze imports in source file
  for (const node of sourceAst.program.body) {
    if (node.type !== 'ImportDeclaration') continue;

    const source = node.source.value;

    for (const specifier of node.specifiers) {
      if (specifier.type === 'ImportSpecifier') {
        const imported =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value;
        const local = specifier.local.name;

        if (usedIdentifiers.has(local)) {
          if (!neededImports.has(source)) {
            neededImports.set(source, new Set());
          }
          neededImports.get(source)!.add(imported);
        }
      } else if (specifier.type === 'ImportDefaultSpecifier') {
        if (usedIdentifiers.has(specifier.local.name)) {
          defaultImports.set(source, specifier.local.name);
        }
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        if (usedIdentifiers.has(specifier.local.name)) {
          namespaceImports.set(source, specifier.local.name);
        }
      }
    }
  }

  // Build import declarations
  const imports: t.ImportDeclaration[] = [];

  // Add default imports
  for (const [source, name] of defaultImports) {
    const specifiers: Array<t.ImportDefaultSpecifier | t.ImportSpecifier | t.ImportNamespaceSpecifier> = [t.importDefaultSpecifier(t.identifier(name))];

    // Merge with named imports if they exist
    const namedImports = neededImports.get(source);
    if (namedImports) {
      for (const imported of namedImports) {
        specifiers.push(
          t.importSpecifier(t.identifier(imported), t.identifier(imported))
        );
      }
      neededImports.delete(source);
    }

    imports.push(t.importDeclaration(specifiers, t.stringLiteral(source)));
  }

  // Add namespace imports
  for (const [source, name] of namespaceImports) {
    imports.push(
      t.importDeclaration(
        [t.importNamespaceSpecifier(t.identifier(name))],
        t.stringLiteral(source)
      )
    );
  }

  // Add named imports
  for (const [source, names] of neededImports) {
    const specifiers = Array.from(names).map((name) =>
      t.importSpecifier(t.identifier(name), t.identifier(name))
    );
    imports.push(t.importDeclaration(specifiers, t.stringLiteral(source)));
  }

  return imports;
}

/**
 * Collects all identifiers from a node.
 */
function collectIdentifiersFromNode(node: t.Node, identifiers: Set<string>): void {
  const tempAst = t.file(t.program([t.expressionStatement(node as t.Expression)]));

  traverse(tempAst, {
    Identifier(path) {
      identifiers.add(path.node.name);
    },
  });
}

/**
 * Extracts the declaration node for a dependency.
 */
function extractDeclaration(
  dep: InternalDependency,
  sourceAst: t.File
): t.Declaration | null {
  let declaration: t.Declaration | null = null;

  traverse(sourceAst, {
    VariableDeclarator(path) {
      if (
        path.node.id.type === 'Identifier' &&
        path.node.id.name === dep.symbol
      ) {
        const parentPath = path.parentPath;
        if (parentPath?.isVariableDeclaration()) {
          // Clone the declaration with only this declarator
          declaration = t.variableDeclaration(parentPath.node.kind, [
            t.cloneNode(path.node, true),
          ]);
          path.stop();
        }
      }
    },
    FunctionDeclaration(path) {
      if (path.node.id?.name === dep.symbol) {
        declaration = t.cloneNode(path.node, true);
        path.stop();
      }
    },
    ClassDeclaration(path) {
      if (path.node.id?.name === dep.symbol) {
        declaration = t.cloneNode(path.node, true);
        path.stop();
      }
    },
  });

  return declaration;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Source File Reference Update (4.2.2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Updates the source file to import from the shared module.
 *
 * @param sourceAst - Source file AST (will be cloned)
 * @param sourceFile - Source file path
 * @param sharedModulePath - Path to the shared module
 * @param movedDependencies - Dependencies moved to shared module
 * @returns Updated source file result
 */
export function updateSourceFileReferences(
  sourceAst: t.File,
  sourceFile: string,
  sharedModulePath: string,
  movedDependencies: InternalDependency[]
): SourceFileUpdateResult {
  const clonedAst = t.cloneNode(sourceAst, true);
  const movedSymbols = movedDependencies.map((d) => d.symbol);
  const movedSymbolSet = new Set(movedSymbols);

  // Remove declarations for moved dependencies
  const statementsToRemove: number[] = [];

  clonedAst.program.body.forEach((node, index) => {
    if (node.type === 'VariableDeclaration') {
      // Filter out moved declarators
      const remainingDeclarators = node.declarations.filter((decl) => {
        if (decl.id.type === 'Identifier') {
          return !movedSymbolSet.has(decl.id.name);
        }
        return true;
      });

      if (remainingDeclarators.length === 0) {
        statementsToRemove.push(index);
      } else if (remainingDeclarators.length < node.declarations.length) {
        node.declarations = remainingDeclarators;
      }
    } else if (
      node.type === 'FunctionDeclaration' &&
      node.id &&
      movedSymbolSet.has(node.id.name)
    ) {
      statementsToRemove.push(index);
    } else if (
      node.type === 'ClassDeclaration' &&
      node.id &&
      movedSymbolSet.has(node.id.name)
    ) {
      statementsToRemove.push(index);
    }
  });

  // Remove marked statements (in reverse order to preserve indices)
  for (let i = statementsToRemove.length - 1; i >= 0; i--) {
    clonedAst.program.body.splice(statementsToRemove[i], 1);
  }

  // Create import operation for the shared module
  const importPath = computeImportPath(sourceFile, sharedModulePath);
  const importOp = createImportOperation({
    file: sourceFile,
    importSource: importPath,
    specifiers: movedSymbols.map((symbol) =>
      createImportSpecifier({
        type: 'named',
        imported: symbol,
      })
    ),
    position: 'grouped',
  });

  // Add import statement to AST
  const importDecl = t.importDeclaration(
    movedSymbols.map((symbol) =>
      t.importSpecifier(t.identifier(symbol), t.identifier(symbol))
    ),
    t.stringLiteral(importPath)
  );

  // Find the last import in the file
  let lastImportIndex = -1;
  for (let i = 0; i < clonedAst.program.body.length; i++) {
    if (clonedAst.program.body[i].type === 'ImportDeclaration') {
      lastImportIndex = i;
    }
  }

  // Insert after last import or at beginning
  clonedAst.program.body.splice(lastImportIndex + 1, 0, importDecl);

  return {
    ast: clonedAst,
    imports: [importOp],
    movedSymbols,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Target File Import Additions (4.2.3)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates import operations for the target file.
 *
 * @param targetFile - Target file path
 * @param sourceFile - Source file path
 * @param sharedModulePath - Path to shared module (if created)
 * @param dependencies - All dependencies of the moved element
 * @param exportAnalysis - Export analysis of the source file
 * @returns Import operations for the target file
 */
export function generateTargetImports(
  targetFile: string,
  sourceFile: string,
  sharedModulePath: string | null,
  dependencies: InternalDependency[],
  exportAnalysis: DependencyExportAnalysis
): TargetImportResult {
  const imports: ImportOperation[] = [];

  // Group dependencies by their source
  const fromShared: string[] = [];
  const fromSource: string[] = [];
  const fromExternal = new Map<string, ImportSpecifier[]>();

  for (const dep of dependencies) {
    // Check if this is an external import (Import type)
    if (dep.type === DependencyType.Import) {
      // This dependency is from an external module
      // We need to add the same import to the target file
      const importSource = extractImportSource(dep);
      if (importSource) {
        if (!fromExternal.has(importSource)) {
          fromExternal.set(importSource, []);
        }
        fromExternal.get(importSource)!.push(
          createImportSpecifier({
            type: 'named',
            imported: dep.symbol,
          })
        );
      }
      continue;
    }

    // Check if dependency needs shared module
    if (sharedModulePath && needsSharedModule(dep, exportAnalysis)) {
      fromShared.push(dep.symbol);
    }
    // Check if dependency is already exported from source
    else if (exportAnalysis.exportedDeps.some((d) => d.id === dep.id)) {
      fromSource.push(dep.symbol);
    }
    // Check if dependency is from source file but not exported
    else if (exportAnalysis.unexportedDeps.some((d) => d.id === dep.id)) {
      // This dependency will be exported from source after transformation
      fromSource.push(dep.symbol);
    }
  }

  // Create import from shared module
  if (sharedModulePath && fromShared.length > 0) {
    const importPath = computeImportPath(targetFile, sharedModulePath);
    imports.push(
      createImportOperation({
        file: targetFile,
        importSource: importPath,
        specifiers: fromShared.map((symbol) =>
          createImportSpecifier({
            type: 'named',
            imported: symbol,
          })
        ),
        position: 'grouped',
      })
    );
  }

  // Create import from source file
  if (fromSource.length > 0) {
    const importPath = computeImportPath(targetFile, sourceFile);
    imports.push(
      createImportOperation({
        file: targetFile,
        importSource: importPath,
        specifiers: fromSource.map((symbol) =>
          createImportSpecifier({
            type: 'named',
            imported: symbol,
          })
        ),
        position: 'grouped',
      })
    );
  }

  // Create imports from external modules
  for (const [source, specifiers] of fromExternal) {
    imports.push(
      createImportOperation({
        file: targetFile,
        importSource: source,
        specifiers,
        position: 'grouped',
      })
    );
  }

  return { imports };
}

/**
 * Extracts the import source from a dependency.
 */
function extractImportSource(dep: InternalDependency): string | null {
  // The origin node should be an ImportSpecifier or similar
  // We need to find the parent ImportDeclaration
  // const node = dep.origin.node;

  // This is a simplified approach - in a full implementation,
  // we would traverse up to find the ImportDeclaration
  // For now, we'll store this in the dependency metadata
  if ('importSource' in dep.origin && typeof dep.origin.importSource === 'string') {
    return dep.origin.importSource;
  }

  return null;
}

/**
 * Adds import statements to a target AST.
 *
 * @param targetAst - Target file AST (will be modified)
 * @param imports - Import operations to add
 * @returns Modified AST
 */
export function addImportsToAst(
  targetAst: t.File,
  imports: ImportOperation[]
): t.File {
  const clonedAst = t.cloneNode(targetAst, true);

  // Find existing imports to check for duplicates
  const existingImports = new Map<string, Set<string>>();
  for (const node of clonedAst.program.body) {
    if (node.type === 'ImportDeclaration') {
      const source = node.source.value;
      if (!existingImports.has(source)) {
        existingImports.set(source, new Set());
      }
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          existingImports.get(source)!.add(spec.local.name);
        }
      }
    }
  }

  // Create import declarations for non-duplicate imports
  const newImports: t.ImportDeclaration[] = [];

  for (const importOp of imports) {
    const existing = existingImports.get(importOp.importSource);
    const newSpecifiers = importOp.specifiers.filter(
      (spec) => !existing?.has(spec.local)
    );

    if (newSpecifiers.length === 0) continue;

    // Check if we can merge with existing import
    let merged = false;
    for (const node of clonedAst.program.body) {
      if (
        node.type === 'ImportDeclaration' &&
        node.source.value === importOp.importSource
      ) {
        // Add new specifiers to existing import
        for (const spec of newSpecifiers) {
          if (spec.type === 'named') {
            node.specifiers.push(
              t.importSpecifier(
                t.identifier(spec.imported),
                t.identifier(spec.local)
              )
            );
          }
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      const specifiers = newSpecifiers.map((spec) => {
        if (spec.type === 'default') {
          return t.importDefaultSpecifier(t.identifier(spec.local));
        } else if (spec.type === 'namespace') {
          return t.importNamespaceSpecifier(t.identifier(spec.local));
        } else {
          return t.importSpecifier(
            t.identifier(spec.imported),
            t.identifier(spec.local)
          );
        }
      });

      newImports.push(
        t.importDeclaration(specifiers, t.stringLiteral(importOp.importSource))
      );
    }
  }

  // Find insertion point (after last import)
  let insertIndex = 0;
  for (let i = 0; i < clonedAst.program.body.length; i++) {
    if (clonedAst.program.body[i].type === 'ImportDeclaration') {
      insertIndex = i + 1;
    }
  }

  // Insert new imports
  clonedAst.program.body.splice(insertIndex, 0, ...newImports);

  return clonedAst;
}

/**
 * Adds export to source file for dependencies that will be imported by target.
 *
 * @param sourceAst - Source file AST
 * @param symbols - Symbols to export
 * @returns Modified AST
 */
export function addExportsToSourceFile(
  sourceAst: t.File,
  symbols: string[]
): t.File {
  const clonedAst = t.cloneNode(sourceAst, true);
  const symbolSet = new Set(symbols);

  // Check which symbols are not yet exported
  const existingExports = new Set<string>();
  for (const node of clonedAst.program.body) {
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        if (node.declaration.type === 'VariableDeclaration') {
          for (const decl of node.declaration.declarations) {
            if (decl.id.type === 'Identifier') {
              existingExports.add(decl.id.name);
            }
          }
        } else if (
          (node.declaration.type === 'FunctionDeclaration' ||
            node.declaration.type === 'ClassDeclaration') &&
          node.declaration.id
        ) {
          existingExports.add(node.declaration.id.name);
        }
      }
      for (const spec of node.specifiers) {
        if (spec.type === 'ExportSpecifier') {
          const exported =
            spec.exported.type === 'Identifier'
              ? spec.exported.name
              : spec.exported.value;
          existingExports.add(exported);
        }
      }
    }
  }

  // Find symbols that need export
  const needExport = symbols.filter((s) => !existingExports.has(s));

  if (needExport.length === 0) {
    return clonedAst;
  }

  // Convert existing declarations to exports
  for (let i = 0; i < clonedAst.program.body.length; i++) {
    const node = clonedAst.program.body[i];

    if (node.type === 'VariableDeclaration') {
      const hasExportableDecl = node.declarations.some(
        (decl) =>
          decl.id.type === 'Identifier' && symbolSet.has(decl.id.name)
      );

      if (hasExportableDecl) {
        // Wrap in export
        clonedAst.program.body[i] = t.exportNamedDeclaration(node, []);
      }
    } else if (
      node.type === 'FunctionDeclaration' &&
      node.id &&
      symbolSet.has(node.id.name)
    ) {
      clonedAst.program.body[i] = t.exportNamedDeclaration(node, []);
    } else if (
      node.type === 'ClassDeclaration' &&
      node.id &&
      symbolSet.has(node.id.name)
    ) {
      clonedAst.program.body[i] = t.exportNamedDeclaration(node, []);
    }
  }

  return clonedAst;
}
