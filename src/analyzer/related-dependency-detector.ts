/**
 * Related Dependency Detector
 *
 * Detects related dependencies that should be hoisted together with primary dependencies.
 *
 * Responsibilities:
 * - Detect useEffect calls that reference hoisted symbols
 * - Detect helper functions that reference hoisted symbols
 * - Detect variables that reference hoisted symbols
 * - Identify transitive dependency relationships
 *
 * Single Responsibility: Related dependency detection
 */

import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

import type { ScopeInfo } from "../scope/index.js";
import {
  createDependencyOrigin,
  createInternalDependency,
} from "../types/factories.js";

import { DependencyType, type InternalDependency } from "./types.js";

/**
 * Interface for RelatedDependencyDetector
 */
export interface IRelatedDependencyDetector {
  /**
   * Detect related dependencies that should be hoisted together.
   * This includes:
   * - useEffect calls that reference hoisted state
   * - Helper functions that use hoisted variables
   * - Variables that reference hoisted symbols
   *
   * @param dependencies - All dependencies detected so far
   * @param elementScope - Scope of the element being moved
   * @param elementPath - Path to the element being moved
   * @returns Array of {dependency, path} tuples
   */
  detectRelatedDependencies(
    dependencies: InternalDependency[],
    elementScope: ScopeInfo | null,
    elementPath: NodePath
  ): Array<{ dependency: InternalDependency; path: NodePath }>;

  /**
   * Check if a path references any of the given symbols
   *
   * @param path - AST path to check
   * @param symbols - Set of symbol names to look for
   * @returns True if any symbol is referenced
   */
  referencesAnySymbol(path: NodePath, symbols: Set<string>): boolean;
}

/**
 * RelatedDependencyDetector class for detecting transitive dependencies
 */
export class RelatedDependencyDetector implements IRelatedDependencyDetector {
  constructor(private readonly currentFile: string) {}

  /**
   * Detect related dependencies that should be hoisted together.
   * This includes:
   * - useEffect calls that reference hoisted state
   * - Helper functions that use hoisted variables
   *
   * @param dependencies - All dependencies detected so far
   * @param elementScope - Scope of the element being moved
   * @param elementPath - Path to the element being moved
   * @returns Array of {dependency, path} tuples
   */
  detectRelatedDependencies(
    dependencies: InternalDependency[],
    elementScope: ScopeInfo | null,
    elementPath: NodePath
  ): Array<{ dependency: InternalDependency; path: NodePath }> {
    if (!elementScope) return [];

    const relatedDeps: Array<{
      dependency: InternalDependency;
      path: NodePath;
    }> = [];
    const processed = new Set<string>();

    const { hoistedSymbols, existingSymbols } =
      this.collectHoistedSymbols(dependencies);
    const statements = this.findFunctionBody(elementPath);
    if (!statements) return [];

    for (const stmtPath of statements) {
      const key = `${stmtPath.node.loc?.start.line}:${stmtPath.node.loc?.start.column}`;
      if (processed.has(key)) continue;
      processed.add(key);

      if (stmtPath.isExpressionStatement()) {
        const result = this.checkUseEffectStatement(
          stmtPath,
          hoistedSymbols,
          existingSymbols,
          elementScope
        );
        if (result) relatedDeps.push(result);
      } else if (stmtPath.isVariableDeclaration()) {
        const results = this.checkVariableDeclarationStatement(
          stmtPath,
          hoistedSymbols,
          existingSymbols,
          elementScope
        );
        relatedDeps.push(...results);
      } else if (stmtPath.isFunctionDeclaration()) {
        const result = this.checkFunctionDeclarationStatement(
          stmtPath,
          hoistedSymbols,
          existingSymbols,
          elementScope
        );
        if (result) relatedDeps.push(result);
      }
    }

    return relatedDeps;
  }

  /**
   * Check if a path references any of the given symbols
   */
  referencesAnySymbol(path: NodePath, symbols: Set<string>): boolean {
    let found = false;

    path.traverse({
      Identifier(idPath: NodePath<t.Identifier>) {
        if (found) return;

        // Skip if this is a binding identifier (like function parameter names)
        const parent = idPath.parent;
        if (
          (t.isVariableDeclarator(parent) && parent.id === idPath.node) ||
          (t.isFunctionDeclaration(parent) && parent.id === idPath.node) ||
          (t.isFunctionExpression(parent) && parent.id === idPath.node) ||
          (t.isArrowFunctionExpression(parent) &&
            parent.params.includes(idPath.node))
        ) {
          return;
        }

        if (symbols.has(idPath.node.name)) {
          found = true;
        }
      },
    });

    return found;
  }

  // ===================================================================
  // Private helper methods
  // ===================================================================

  /**
   * Collect hoisted symbols from dependencies
   */
  private collectHoistedSymbols(dependencies: InternalDependency[]): {
    hoistedSymbols: Set<string>;
    existingSymbols: Set<string>;
  } {
    const hoistedSymbols = new Set<string>();
    const existingSymbols = new Set<string>();

    for (const dep of dependencies) {
      existingSymbols.add(dep.symbol);
      const parts = dep.symbol.split(", ");
      for (const part of parts) {
        hoistedSymbols.add(part.trim());
      }
    }

    return { hoistedSymbols, existingSymbols };
  }

  /**
   * Find the function body containing the element
   */
  private findFunctionBody(elementPath: NodePath): NodePath[] | null {
    let currentPath: NodePath | null = elementPath;

    // Find the enclosing function
    while (currentPath) {
      if (currentPath.isFunction()) {
        const bodyPath = currentPath.get("body");
        if (!Array.isArray(bodyPath) && bodyPath.isBlockStatement()) {
          const statements = bodyPath.get("body");
          return Array.isArray(statements) ? statements : null;
        }
        return null;
      }
      currentPath = currentPath.parentPath;
    }

    return null;
  }

  /**
   * Check useEffect statement for hoisted symbol references
   */
  private checkUseEffectStatement(
    stmtPath: NodePath,
    hoistedSymbols: Set<string>,
    existingSymbols: Set<string>,
    elementScope: ScopeInfo
  ): { dependency: InternalDependency; path: NodePath } | null {
    const expr = stmtPath.get("expression");
    if (!expr.isCallExpression()) return null;

    const callee = expr.get("callee");
    if (!callee.isIdentifier() || callee.node.name !== "useEffect") return null;

    if (!this.referencesAnySymbol(expr, hoistedSymbols)) return null;
    if (existingSymbols.has("useEffect")) return null;

    return {
      dependency: createInternalDependency({
        symbol: "useEffect",
        type: DependencyType.Hook,
        origin: createDependencyOrigin({
          node: stmtPath.node,
          file: this.currentFile,
          location: stmtPath.node.loc,
        }),
        scope: elementScope,
        isTransitive: false,
      }),
      path: stmtPath,
    };
  }

  /**
   * Check variable declaration for hoisted symbol references
   */
  private checkVariableDeclarationStatement(
    stmtPath: NodePath,
    hoistedSymbols: Set<string>,
    existingSymbols: Set<string>,
    elementScope: ScopeInfo
  ): Array<{ dependency: InternalDependency; path: NodePath }> {
    const results: Array<{ dependency: InternalDependency; path: NodePath }> =
      [];

    for (const declarator of stmtPath.get("declarations")) {
      if (!declarator.isVariableDeclarator()) continue;

      const init = declarator.get("init");
      const id = declarator.get("id");

      if (!id.isIdentifier()) continue;
      const functionName = id.node.name;

      if (!init.isFunctionExpression() && !init.isArrowFunctionExpression())
        continue;
      if (!this.referencesAnySymbol(init, hoistedSymbols)) continue;
      if (existingSymbols.has(functionName)) continue;

      results.push({
        dependency: createInternalDependency({
          symbol: functionName,
          type: DependencyType.Variable,
          origin: createDependencyOrigin({
            node: stmtPath.node,
            file: this.currentFile,
            location: stmtPath.node.loc,
          }),
          scope: elementScope,
          isTransitive: false,
        }),
        path: stmtPath,
      });
    }

    return results;
  }

  /**
   * Check function declaration for hoisted symbol references
   */
  private checkFunctionDeclarationStatement(
    stmtPath: NodePath,
    hoistedSymbols: Set<string>,
    existingSymbols: Set<string>,
    elementScope: ScopeInfo
  ): { dependency: InternalDependency; path: NodePath } | null {
    const id = stmtPath.get("id");
    if (!id.isIdentifier()) return null;

    const functionName = id.node.name;
    if (!this.referencesAnySymbol(stmtPath, hoistedSymbols)) return null;
    if (existingSymbols.has(functionName)) return null;

    return {
      dependency: createInternalDependency({
        symbol: functionName,
        type: DependencyType.Variable,
        origin: createDependencyOrigin({
          node: stmtPath.node,
          file: this.currentFile,
          location: stmtPath.node.loc,
        }),
        scope: elementScope,
        isTransitive: false,
      }),
      path: stmtPath,
    };
  }
}

/**
 * Create a new RelatedDependencyDetector instance
 */
export function createRelatedDependencyDetector(
  currentFile: string
): RelatedDependencyDetector {
  return new RelatedDependencyDetector(currentFile);
}
