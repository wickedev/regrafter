/**
 * Import Dependency Analyzer
 *
 * Detects and analyzes import dependencies in JSX elements.
 */

import type { NodePath, Binding } from "@babel/traverse";
import * as t from "@babel/types";

import type { ImportDependency, IdentifierReference } from "../types.js";
import { DependencyType } from "../types.js";

/**
 * Interface for import dependency analysis
 */
export interface IImportDependencyAnalyzer {
  /**
   * Detect import dependencies from identifiers
   */
  detectImportDependencies(
    identifiers: IdentifierReference[]
  ): ImportDependency[];

  /**
   * Check if a binding is from an import
   */
  isImportBinding(binding: Binding): boolean;

  /**
   * Get import information from a binding
   */
  getImportInfo(binding: Binding): {
    localName: string;
    importedName: string;
    source: string;
    type: "default" | "named" | "namespace";
  } | null;
}

/**
 * Implementation of import dependency analyzer
 */
export class ImportDependencyAnalyzer implements IImportDependencyAnalyzer {
  constructor(
    private readonly includeImports: boolean,
    private readonly findBinding: (path: NodePath, name: string) => Binding | null
  ) {}

  /**
   * Analyzes identifiers to find import references.
   *
   * @param identifiers - Identifier references to analyze
   * @returns Array of import dependencies
   */
  detectImportDependencies(
    identifiers: IdentifierReference[]
  ): ImportDependency[] {
    if (!this.includeImports) return [];

    const importDeps: ImportDependency[] = [];
    const processed = new Set<string>();

    for (const idRef of identifiers) {
      if (processed.has(idRef.name)) continue;
      processed.add(idRef.name);

      // Try to find the binding for this identifier
      const binding = this.findBinding(idRef.path, idRef.name);
      if (!binding) continue;

      // Check if this is an import binding
      if (!this.isImportBinding(binding)) continue;

      const importInfo = this.getImportInfo(binding);
      if (importInfo) {
        importDeps.push({
          localName: importInfo.localName,
          importedName: importInfo.importedName,
          source: importInfo.source,
          path: binding.path,
          importType: importInfo.type,
          type: DependencyType.Import,
        });
      }
    }

    return importDeps;
  }

  /**
   * Check if a binding is from an import
   */
  isImportBinding(binding: Binding): boolean {
    return (
      t.isImportSpecifier(binding.path.node) ||
      t.isImportDefaultSpecifier(binding.path.node) ||
      t.isImportNamespaceSpecifier(binding.path.node)
    );
  }

  /**
   * Get import info from a binding
   */
  getImportInfo(binding: Binding): {
    localName: string;
    importedName: string;
    source: string;
    type: "default" | "named" | "namespace";
  } | null {
    const node = binding.path.node;
    const importDecl = binding.path.parent;

    if (!t.isImportDeclaration(importDecl)) return null;

    const source = importDecl.source.value;

    if (t.isImportDefaultSpecifier(node)) {
      return {
        localName: node.local.name,
        importedName: "default",
        source,
        type: "default",
      };
    }

    if (t.isImportNamespaceSpecifier(node)) {
      return {
        localName: node.local.name,
        importedName: "*",
        source,
        type: "namespace",
      };
    }

    if (t.isImportSpecifier(node)) {
      const imported = t.isIdentifier(node.imported)
        ? node.imported.name
        : node.imported.value;
      return {
        localName: node.local.name,
        importedName: imported,
        source,
        type: "named",
      };
    }

    return null;
  }
}

/**
 * Create a new ImportDependencyAnalyzer instance
 */
export function createImportDependencyAnalyzer(
  includeImports: boolean,
  findBinding: (path: NodePath, name: string) => Binding | null
): IImportDependencyAnalyzer {
  return new ImportDependencyAnalyzer(includeImports, findBinding);
}
