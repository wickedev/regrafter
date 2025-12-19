/**
 * ImportManager
 *
 * Manages import statements in AST
 * Task 16.2: ImportManager implementation
 * Task 17.3: Automatic dependency import addition
 */

import * as t from '@babel/types';
import path from 'path';
import type { ImportDependency } from './types.js';

export class ImportManager {
  /**
   * Add an import statement to the AST
   */
  addImport(
    ast: t.File,
    importName: string,
    sourcePath: string,
    isDefault: boolean = false,
  ): void {
    const program = ast.program;

    // Find existing import statement with same source
    let existingImport: t.ImportDeclaration | null = null;
    for (const statement of program.body) {
      if (t.isImportDeclaration(statement) && statement.source.value === sourcePath) {
        existingImport = statement;
        break;
      }
    }

    // Check if identical import already exists
    if (existingImport) {
      const hasExisting = existingImport.specifiers.some(spec => {
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
      const specifiers: t.ImportSpecifier[] | t.ImportDefaultSpecifier[] = isDefault
        ? [t.importDefaultSpecifier(t.identifier(importName))]
        : [t.importSpecifier(t.identifier(importName), t.identifier(importName))];

      const newImport = t.importDeclaration(
        specifiers,
        t.stringLiteral(sourcePath)
      );

      // Add import at top of file
      program.body.unshift(newImport);
    }
  }

  /**
   * Remove an import statement from the AST
   */
  removeImport(ast: t.File, importName: string): void {
    const program = ast.program;

    for (let i = program.body.length - 1; i >= 0; i--) {
      const statement = program.body[i];
      if (!t.isImportDeclaration(statement)) continue;

      // Find specifier
      const specifierIndex = statement.specifiers.findIndex(spec => {
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
   * Resolve relative path between two files
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
   * Task 17.3: Automatic dependency import addition
   *
   * Receives ImportDependency array and automatically adds imports to AST
   */
  addDependencyImports(
    ast: t.File,
    dependencies: ImportDependency[]
  ): void {
    for (const dep of dependencies) {
      this.addImport(ast, dep.name, dep.source, dep.isDefault);
    }
  }

  /**
   * Task 17.3: Automatic React import addition
   *
   * Automatically add React import to files using JSX
   */
  ensureReactImport(ast: t.File): void {
    // Check if React import already exists
    const program = ast.program;
    const hasReactImport = program.body.some(
      statement =>
        t.isImportDeclaration(statement) &&
        statement.source.value === 'react' &&
        statement.specifiers.some(
          spec =>
            t.isImportDefaultSpecifier(spec) && spec.local.name === 'React'
        )
    );

    // Add React import if not exists
    if (!hasReactImport) {
      this.addImport(ast, 'React', 'react', true);
    }
  }
}
