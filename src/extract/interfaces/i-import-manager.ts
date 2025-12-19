/**
 * IImportManager interface
 *
 * Manages import statements in AST
 */

import type * as t from '@babel/types';
import type { ImportDependency } from '../types.js';

export interface IImportManager {
  /**
   * Add an import statement to the AST
   *
   * @param ast - AST to modify
   * @param importName - Name to import
   * @param sourcePath - Source path for import
   * @param isDefault - Whether this is a default import
   */
  addImport(
    ast: t.File,
    importName: string,
    sourcePath: string,
    isDefault?: boolean
  ): void;

  /**
   * Remove an import statement from the AST
   *
   * @param ast - AST to modify
   * @param importName - Name to remove
   */
  removeImport(ast: t.File, importName: string): void;

  /**
   * Resolve relative path between two files
   *
   * @param fromFile - Source file path
   * @param toFile - Target file path
   * @returns Relative path
   */
  resolveRelativePath(fromFile: string, toFile: string): string;

  /**
   * Add multiple dependency imports
   *
   * @param ast - AST to modify
   * @param dependencies - Import dependencies to add
   */
  addDependencyImports(ast: t.File, dependencies: ImportDependency[]): void;

  /**
   * Ensure React import exists
   *
   * @param ast - AST to modify
   */
  ensureReactImport(ast: t.File): void;
}
