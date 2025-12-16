/**
 * ImportManager - Strategy for managing import statements
 *
 * Handles detection of existing imports, addition of new imports,
 * and merging of duplicate import operations.
 */

import traverse from '@babel/traverse';
import * as t from '@babel/types';

import {
  createImportOperation,
  createImportSpecifier,
} from '../types/factories.js';
import type {
  ImportOperation,
  ImportSpecifier,
  InternalDependency,
} from '../types/internal.js';
import { DependencyType } from '../types/public.js';

import type {
  IImportManager,
} from './types.js';

// ===============================================================================
// ImportManager Class
// ===============================================================================

/**
 * Strategy for managing import statements in transformations.
 *
 * Responsibilities:
 * - Detect if imports already exist in target file
 * - Create import operations for dependencies
 * - Merge duplicate import operations
 * - Maintain import ordering conventions
 */
export class ImportManager implements IImportManager {
  /**
   * Check if an import already exists in the target file
   */
  hasImport(ast: t.File, source: string, specifier: string): boolean {
    let found = false;

    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === source) {
          for (const spec of path.node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
              if (spec.local.name === specifier) {
                found = true;
                path.stop();
              }
            } else if (spec.type === 'ImportSpecifier') {
              const imported =
                spec.imported.type === 'Identifier'
                  ? spec.imported.name
                  : spec.imported.value;
              if (imported === specifier || spec.local.name === specifier) {
                found = true;
                path.stop();
              }
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              if (spec.local.name === specifier) {
                found = true;
                path.stop();
              }
            }
          }
        }
      },
    });

    return found;
  }

  /**
   * Get all imports from a specific source in a file
   */
  getImportsFromSource(ast: t.File, source: string): ImportSpecifier[] {
    const specifiers: ImportSpecifier[] = [];

    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === source) {
          for (const spec of path.node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
              specifiers.push({
                type: 'default',
                imported: 'default',
                local: spec.local.name,
              });
            } else if (spec.type === 'ImportSpecifier') {
              const imported =
                spec.imported.type === 'Identifier'
                  ? spec.imported.name
                  : spec.imported.value;
              specifiers.push({
                type: 'named',
                imported,
                local: spec.local.name,
              });
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              specifiers.push({
                type: 'namespace',
                imported: '*',
                local: spec.local.name,
              });
            }
          }
        }
      },
    });

    return specifiers;
  }

  /**
   * Get all import sources in a file
   */
  getAllImportSources(ast: t.File): Set<string> {
    const sources = new Set<string>();

    traverse(ast, {
      ImportDeclaration(path) {
        sources.add(path.node.source.value);
      },
    });

    return sources;
  }

  /**
   * Create an import operation for a dependency
   */
  createImportOperation(
    dependency: InternalDependency,
    targetFile: string
  ): ImportOperation | null {
    // Only import dependencies are relevant
    if (dependency.type !== DependencyType.Import) {
      return null;
    }

    // Get the import source from the dependency origin
    const importSource = this.extractImportSource(dependency);
    if (!importSource) {
      return null;
    }

    // Determine import type
    const specifierType = this.determineSpecifierType(dependency);

    return createImportOperation({
      file: targetFile,
      importSource,
      specifiers: [
        createImportSpecifier({
          type: specifierType,
          imported: dependency.symbol,
          local: dependency.symbol,
        }),
      ],
      position: 'grouped',
    });
  }

  /**
   * Merge duplicate import operations
   */
  mergeImports(operations: ImportOperation[]): ImportOperation[] {
    // Group by file and source
    const grouped = new Map<string, ImportOperation>();

    for (const op of operations) {
      const key = `${op.file}:${op.importSource}`;

      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        // Merge specifiers, avoiding duplicates
        for (const spec of op.specifiers) {
          const exists = existing.specifiers.some(
            (s) =>
              s.imported === spec.imported &&
              s.type === spec.type
          );
          if (!exists) {
            existing.specifiers.push(spec);
          }
        }
      } else {
        // Clone the operation
        grouped.set(key, {
          ...op,
          id: op.id,
          specifiers: [...op.specifiers],
        });
      }
    }

    // Sort specifiers within each operation
    for (const op of grouped.values()) {
      op.specifiers.sort((a, b) => {
        // Default first, then named (alphabetically), then namespace
        if (a.type !== b.type) {
          const order = { default: 0, named: 1, namespace: 2 };
          return order[a.type] - order[b.type];
        }
        return a.imported.localeCompare(b.imported);
      });
    }

    return Array.from(grouped.values());
  }

  /**
   * Create import operations for cross-file dependency hoisting
   */
  createCrossFileImports(
    dependencies: InternalDependency[],
    sourceFile: string,
    targetFile: string,
    targetAst: t.File
  ): ImportOperation[] {
    const operations: ImportOperation[] = [];

    for (const dep of dependencies) {
      // Skip if import already exists
      if (this.hasImport(targetAst, sourceFile, dep.symbol)) {
        continue;
      }

      // Create import operation
      const specifierType = this.determineSpecifierType(dep);
      operations.push(
        createImportOperation({
          file: targetFile,
          importSource: this.normalizeImportPath(sourceFile, targetFile),
          specifiers: [
            createImportSpecifier({
              type: specifierType,
              imported: dep.symbol,
              local: dep.symbol,
            }),
          ],
          position: 'grouped',
        })
      );
    }

    return this.mergeImports(operations);
  }

  /**
   * Generate AST node for an import declaration
   */
  generateImportDeclaration(operation: ImportOperation): t.ImportDeclaration {
    const specifiers: Array<t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier> = [];

    for (const spec of operation.specifiers) {
      if (spec.type === 'default') {
        specifiers.push(t.importDefaultSpecifier(t.identifier(spec.local)));
      } else if (spec.type === 'namespace') {
        specifiers.push(t.importNamespaceSpecifier(t.identifier(spec.local)));
      } else {
        specifiers.push(
          t.importSpecifier(
            t.identifier(spec.local),
            t.identifier(spec.imported)
          )
        );
      }
    }

    return t.importDeclaration(
      specifiers,
      t.stringLiteral(operation.importSource)
    );
  }

  /**
   * Find the best position to insert an import
   */
  findImportInsertPosition(
    ast: t.File,
    importSource: string,
    position: 'start' | 'end' | 'grouped'
  ): number {
    const body = ast.program.body;
    let lastImportIndex = -1;
    let targetIndex = -1;

    // Find imports and their positions
    for (let i = 0; i < body.length; i++) {
      const node = body[i];
      if (node.type === 'ImportDeclaration') {
        lastImportIndex = i;

        if (position === 'grouped') {
          // Group by import type (node modules vs relative)
          const isRelative = importSource.startsWith('.');
          const currentIsRelative = node.source.value.startsWith('.');

          if (isRelative === currentIsRelative) {
            // Further group by source prefix
            if (this.shouldGroupWith(importSource, node.source.value)) {
              targetIndex = i + 1;
            }
          }
        }
      }
    }

    if (position === 'start') {
      return 0;
    }

    if (position === 'end' || targetIndex === -1) {
      return lastImportIndex + 1;
    }

    return targetIndex;
  }

  /**
   * Add an import to a file's AST
   */
  addImportToAst(
    ast: t.File,
    operation: ImportOperation
  ): void {
    const importDecl = this.generateImportDeclaration(operation);
    const insertPos = this.findImportInsertPosition(
      ast,
      operation.importSource,
      operation.position
    );

    ast.program.body.splice(insertPos, 0, importDecl);
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Extract import source from a dependency
   */
  private extractImportSource(dependency: InternalDependency): string | null {
    const node = dependency.origin.node;

    // If the dependency node is an import specifier, get the source
    if (node.type === 'ImportSpecifier' || node.type === 'ImportDefaultSpecifier') {
      // Need to find the parent ImportDeclaration
      // This would require path information, so for now we use the origin file
      return null;
    }

    // For import dependencies, the origin file is typically the source module
    return dependency.origin.file;
  }

  /**
   * Determine the specifier type for a dependency
   */
  private determineSpecifierType(
    dependency: InternalDependency
  ): 'default' | 'named' | 'namespace' {
    // Check the original node to determine type
    const node = dependency.origin.node;

    if (node.type === 'ImportDefaultSpecifier') {
      return 'default';
    }

    if (node.type === 'ImportNamespaceSpecifier') {
      return 'namespace';
    }

    // Default to named
    return 'named';
  }

  /**
   * Normalize import path (convert absolute to relative)
   */
  private normalizeImportPath(
    sourceFile: string,
    targetFile: string
  ): string {
    // Simple relative path calculation
    // In production, this would use proper path resolution

    // If source is already a package name, return as-is
    if (!sourceFile.startsWith('/') && !sourceFile.startsWith('.')) {
      return sourceFile;
    }

    // Calculate relative path from target to source
    const sourceParts = sourceFile.split('/');
    const targetParts = targetFile.split('/');

    // Find common prefix
    let commonLength = 0;
    while (
      commonLength < sourceParts.length - 1 &&
      commonLength < targetParts.length - 1 &&
      sourceParts[commonLength] === targetParts[commonLength]
    ) {
      commonLength++;
    }

    // Build relative path
    const upCount = targetParts.length - commonLength - 1;
    const upPath = upCount > 0 ? '../'.repeat(upCount) : './';
    const downPath = sourceParts.slice(commonLength).join('/');

    // Remove file extension if present
    const relativePath = upPath + downPath;
    return relativePath.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '');
  }

  /**
   * Check if two import sources should be grouped together
   */
  private shouldGroupWith(source1: string, source2: string): boolean {
    // Group by first path segment
    const prefix1 = source1.split('/')[0];
    const prefix2 = source2.split('/')[0];

    return prefix1 === prefix2;
  }
}

/**
 * Create a new ImportManager instance
 */
export function createImportManager(): ImportManager {
  return new ImportManager();
}

// ===============================================================================
// Utility Functions
// ===============================================================================

/**
 * Check if an import source is a relative path
 */
export function isRelativeImport(source: string): boolean {
  return source.startsWith('.') || source.startsWith('/');
}

/**
 * Check if an import source is a node module
 */
export function isNodeModule(source: string): boolean {
  return !isRelativeImport(source);
}

/**
 * Sort import declarations by convention
 * Order: node_modules first (alphabetically), then relative (alphabetically)
 */
export function sortImports(imports: t.ImportDeclaration[]): t.ImportDeclaration[] {
  return [...imports].sort((a, b) => {
    const aIsRelative = isRelativeImport(a.source.value);
    const bIsRelative = isRelativeImport(b.source.value);

    if (aIsRelative !== bIsRelative) {
      return aIsRelative ? 1 : -1;
    }

    return a.source.value.localeCompare(b.source.value);
  });
}

/**
 * Remove unused imports from an AST
 */
export function removeUnusedImports(
  ast: t.File,
  usedIdentifiers: Set<string>
): void {
  traverse(ast, {
    ImportDeclaration(path) {
      const unusedSpecifiers: number[] = [];

      path.node.specifiers.forEach((spec, index) => {
        if (!usedIdentifiers.has(spec.local.name)) {
          unusedSpecifiers.push(index);
        }
      });

      // Remove unused specifiers (reverse order to maintain indices)
      for (let i = unusedSpecifiers.length - 1; i >= 0; i--) {
        path.node.specifiers.splice(unusedSpecifiers[i], 1);
      }

      // Remove entire declaration if no specifiers left
      if (path.node.specifiers.length === 0) {
        path.remove();
      }
    },
  });
}
