/**
 * Unified ImportManager
 *
 * Consolidates import management logic from src/strategies/import-manager.ts
 * and src/extract/import-manager.ts to eliminate ~70% code overlap.
 *
 * Phase 1.2 of functional duplication consolidation.
 */

import path from 'path';

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { loadTraverseFunction } from '../utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

/**
 * Import dependency interface (from extract module)
 */
export interface ImportDependency {
  name: string;
  source: string;
  isDefault: boolean;
}

/**
 * Unified ImportManager
 *
 * Provides both simple direct AST manipulation (from extract) and
 * advanced import management features (from strategies).
 */
export class ImportManager {
  /**
   * Find an existing import declaration by source path
   * Private helper used by multiple methods
   */
  private findImportDeclaration(
    program: t.Program,
    source: string
  ): t.ImportDeclaration | null {
    for (const statement of program.body) {
      if (t.isImportDeclaration(statement) && statement.source.value === source) {
        return statement;
      }
    }
    return null;
  }

  /**
   * Add an import statement to the AST
   * Simple API from extract module - directly modifies AST
   *
   * @param ast - File AST to modify
   * @param importName - Name to import
   * @param sourcePath - Import source path
   * @param isDefault - Whether this is a default import
   */
  addImport(
    ast: t.File,
    importName: string,
    sourcePath: string,
    isDefault = false
  ): void {
    const program = ast.program;

    // Find existing import statement with same source
    const existingImport = this.findImportDeclaration(program, sourcePath);

    // Check if identical import already exists
    if (existingImport) {
      const hasExisting = existingImport.specifiers.some((spec) => {
        if (isDefault && t.isImportDefaultSpecifier(spec)) {
          return spec.local.name === importName;
        } else if (!isDefault && t.isImportSpecifier(spec)) {
          return spec.local.name === importName;
        }
        return false;
      });

      if (hasExisting) {
        return; // Prevent duplication
      }

      // Add specifier to existing import statement
      if (isDefault) {
        // default import is always at first position
        existingImport.specifiers.unshift(
          t.importDefaultSpecifier(t.identifier(importName))
        );
      } else {
        // Add named import
        existingImport.specifiers.push(
          t.importSpecifier(t.identifier(importName), t.identifier(importName))
        );
      }
    } else {
      // Create new import statement
      const specifiers: Array<t.ImportSpecifier | t.ImportDefaultSpecifier> = isDefault
        ? [t.importDefaultSpecifier(t.identifier(importName))]
        : [t.importSpecifier(t.identifier(importName), t.identifier(importName))];

      const newImport = t.importDeclaration(specifiers, t.stringLiteral(sourcePath));

      // Add import at top of file
      program.body.unshift(newImport);
    }
  }

  /**
   * Remove an import statement from the AST
   * From extract module
   *
   * @param ast - File AST to modify
   * @param importName - Name to remove
   */
  removeImport(ast: t.File, importName: string): void {
    const program = ast.program;

    for (let i = program.body.length - 1; i >= 0; i--) {
      const statement = program.body[i];
      if (!t.isImportDeclaration(statement)) continue;

      // Find specifier
      const specifierIndex = statement.specifiers.findIndex((spec) => {
        if (t.isImportDefaultSpecifier(spec) || t.isImportSpecifier(spec)) {
          return spec.local.name === importName;
        }
        return false;
      });

      if (specifierIndex !== -1) {
        // Remove specifier
        statement.specifiers.splice(specifierIndex, 1);

        // Remove entire import statement if no specifiers remain
        if (statement.specifiers.length === 0) {
          program.body.splice(i, 1);
        }

        return;
      }
    }
  }

  /**
   * Check if an import already exists in the file
   * From strategies module
   *
   * @param ast - File AST to check
   * @param source - Import source path
   * @param specifier - Specifier name to check
   * @returns True if import exists
   */
  hasImport(ast: t.File, source: string, specifier: string): boolean {
    let found = false;

    traverse(ast, {
      ImportDeclaration(nodePath: NodePath<t.ImportDeclaration>) {
        if (nodePath.node.source.value === source) {
          for (const spec of nodePath.node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
              if (spec.local.name === specifier) {
                found = true;
                nodePath.stop();
              }
            } else if (spec.type === 'ImportSpecifier') {
              const imported =
                spec.imported.type === 'Identifier'
                  ? spec.imported.name
                  : spec.imported.value;
              if (imported === specifier || spec.local.name === specifier) {
                found = true;
                nodePath.stop();
              }
            } else {
              // ImportNamespaceSpecifier
              if (spec.local.name === specifier) {
                found = true;
                nodePath.stop();
              }
            }
          }
        }
      },
    });

    return found;
  }

  /**
   * Get all import sources in a file
   * From strategies module
   *
   * @param ast - File AST to analyze
   * @returns Set of import source paths
   */
  getAllImportSources(ast: t.File): Set<string> {
    const sources = new Set<string>();

    traverse(ast, {
      ImportDeclaration(nodePath: NodePath<t.ImportDeclaration>) {
        sources.add(nodePath.node.source.value);
      },
    });

    return sources;
  }

  /**
   * Resolve relative path between two files
   * From extract module - uses Node's path module for accuracy
   *
   * @param fromFile - Source file path
   * @param toFile - Target file path
   * @returns Relative import path
   */
  resolveRelativePath(fromFile: string, toFile: string): string {
    const fromDir = path.dirname(fromFile);
    let relativePath = path.relative(fromDir, toFile);

    // Remove extension
    relativePath = relativePath.replace(/\.(tsx?|jsx?)$/, '');

    // Add ./ if in same directory
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }

    // Convert Windows path to Unix style
    relativePath = relativePath.replace(/\\/g, '/');

    return relativePath;
  }

  /**
   * Batch add imports from dependency array
   * From extract module
   *
   * @param ast - File AST to modify
   * @param dependencies - Array of import dependencies
   */
  addDependencyImports(ast: t.File, dependencies: ImportDependency[]): void {
    for (const dep of dependencies) {
      this.addImport(ast, dep.name, dep.source, dep.isDefault);
    }
  }

  /**
   * Ensure React import exists (for JSX files)
   * From extract module
   *
   * @param ast - File AST to modify
   */
  ensureReactImport(ast: t.File): void {
    // Check if React import already exists
    const program = ast.program;
    const reactImport = this.findImportDeclaration(program, 'react');
    const hasReactImport = reactImport?.specifiers.some(
      (spec) => t.isImportDefaultSpecifier(spec) && spec.local.name === 'React'
    );

    // Add React import if not exists
    if (hasReactImport !== true) {
      this.addImport(ast, 'React', 'react', true);
    }
  }
}
