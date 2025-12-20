/**
 * Dependency Converter
 *
 * Converts and deduplicates dependency lists.
 *
 * Responsibilities:
 * - Convert SpecificDependency → InternalDependency
 * - Deduplicate dependencies by symbol name
 * - Build dependency path maps
 *
 * Single Responsibility: Type conversion and normalization
 */

import type { NodePath } from "@babel/traverse";

import type { IScopeQuery, IScopeTreeBuilder } from "../interfaces/index.js";
import { isErr } from "../result/index.js";
import { ScopeType } from "../scope/index.js";
import type { ScopeInfo } from "../scope/index.js";
import {
  createDependencyOrigin,
  createInternalDependency,
  createScopeInfo,
} from "../types/factories.js";

import {
  DependencyType,
  type InternalDependency,
  type SpecificDependency,
} from "./types.js";

/**
 * Interface for DependencyConverter
 */
export interface IDependencyConverter {
  /**
   * Convert specific dependencies to internal format
   */
  convertToInternal(
    deps: SpecificDependency[],
    elementScope: ScopeInfo | null
  ): InternalDependency[];

  /**
   * Deduplicate dependencies by symbol name
   *
   * Rules:
   * - Keep first occurrence by source location
   * - Merge related dependencies
   * - Preserve dependency origin information
   */
  deduplicate(deps: SpecificDependency[]): SpecificDependency[];

  /**
   * Build map of dependency symbols to their NodePaths
   */
  buildDependencyPaths(
    deps: SpecificDependency[]
  ): Map<string, NodePath>;

  /**
   * Set the current file being analyzed
   */
  setCurrentFile(filePath: string): void;
}

/**
 * DependencyConverter class for converting and deduplicating dependencies
 */
export class DependencyConverter implements IDependencyConverter {
  private currentFile = "";

  constructor(
    private readonly scopeQuery: IScopeQuery,
    private readonly scopeTreeBuilder: IScopeTreeBuilder
  ) {}

  /**
   * Set the current file being analyzed
   */
  setCurrentFile(filePath: string): void {
    this.currentFile = filePath;
  }

  /**
   * Deduplicate dependencies by symbol name
   */
  deduplicate(allDeps: SpecificDependency[]): SpecificDependency[] {
    const deduplicatedDeps: SpecificDependency[] = [];
    const seenSymbols = new Map<string, SpecificDependency>();

    for (const dep of allDeps) {
      const symbol = this.extractSymbolName(dep);

      // Handle Hook/Ref priority deduplication
      if (this.shouldSkipHookRefDuplicate(dep, symbol, seenSymbols, deduplicatedDeps)) {
        continue;
      }

      // Include type in the key to keep dependencies with same name but different types separate
      const key = `${symbol}:${dep.type}`;
      const existing = seenSymbols.get(key);
      if (existing) {
        // General duplicate of same type - skip
        continue;
      }

      // Add new dependency
      seenSymbols.set(key, dep);
      deduplicatedDeps.push(dep);
    }

    return deduplicatedDeps;
  }

  /**
   * Extract symbol name from a dependency
   */
  private extractSymbolName(dep: SpecificDependency): string {
    return "name" in dep
      ? dep.name
      : "bindings" in dep && dep.bindings.length > 0
        ? dep.bindings.join(",")
        : "hookName" in dep
          ? dep.hookName
          : "localName" in dep
            ? dep.localName
            : "unknown";
  }

  /**
   * Check if a Hook/Ref dependency should be skipped due to priority
   */
  private shouldSkipHookRefDuplicate(
    dep: SpecificDependency,
    symbol: string,
    seenSymbols: Map<string, SpecificDependency>,
    deduplicatedDeps: SpecificDependency[]
  ): boolean {
    // Special case: Hook/Ref priority uses symbol-only matching
    if (dep.type === DependencyType.Hook || dep.type === DependencyType.Ref) {
      // Look for matching Hook or Ref by symbol only
      for (const [existingKey, existingDep] of seenSymbols.entries()) {
        if (
          existingKey.startsWith(symbol + ":") &&
          (existingDep.type === DependencyType.Hook || existingDep.type === DependencyType.Ref)
        ) {
          // Found a Hook or Ref with the same symbol
          if (existingDep.type === DependencyType.Hook && dep.type === DependencyType.Ref) {
            return true; // Skip Ref, keep Hook
          }
          if (existingDep.type === DependencyType.Ref && dep.type === DependencyType.Hook) {
            // Replace Ref with Hook
            const index = deduplicatedDeps.indexOf(existingDep);
            if (index !== -1) {
              deduplicatedDeps[index] = dep;
            }
            seenSymbols.delete(existingKey);
            seenSymbols.set(`${symbol}:${dep.type}`, dep);
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Build map of dependency symbols to their NodePaths
   */
  buildDependencyPaths(
    deduplicatedDeps: SpecificDependency[]
  ): Map<string, NodePath> {
    const tempPathMap = new Map<string, NodePath>();

    for (const dep of deduplicatedDeps) {
      const name =
        "name" in dep
          ? dep.name
          : "bindings" in dep && dep.bindings.length > 0
            ? dep.bindings.join(", ")
            : "hookName" in dep
              ? dep.hookName
              : "localName" in dep
                ? dep.localName
                : "unknown";
      const key = `${name}:${dep.type}`;
      tempPathMap.set(key, dep.path);
    }

    return tempPathMap;
  }

  /**
   * Convert specific dependencies to internal format
   */
  convertToInternal(
    deps: SpecificDependency[],
    elementScope: ScopeInfo | null
  ): InternalDependency[] {
    return deps.map((dep) => {
      // For variable dependencies, find the enclosing component scope
      // instead of using getScopeForPath which may return module scope
      let scope: ScopeInfo | null = null;

      if (dep.type === DependencyType.Variable) {
        // For variables, find the component they're declared in
        try {
          const enclosingResult = this.scopeQuery.findEnclosingComponent(dep.path);
          if (!isErr(enclosingResult)) {
            scope = enclosingResult.value;
          }
        } catch {
          // Babel scope errors can occur with improperly initialized paths
          // Fall through to fallback logic
        }
      }

      // Fallback to original logic for other types or if no component found
      try {
        scope ??=
          this.scopeQuery.getScopeForPath(dep.path) ??
          elementScope ??
          this.scopeTreeBuilder.getScopeTree()?.root ??
          null;
      } catch {
        // Babel scope errors can occur with improperly initialized paths
        scope ??= elementScope ?? this.scopeTreeBuilder.getScopeTree()?.root ?? null;
      }

      const name =
        "name" in dep
          ? dep.name
          : "bindings" in dep && dep.bindings.length > 0
            ? dep.bindings.join(", ")
            : "hookName" in dep
              ? dep.hookName
              : "localName" in dep
                ? dep.localName
                : "unknown";

      if (!scope) {
        // Return a placeholder dependency with error information
        // This maintains backward compatibility while allowing graceful error handling
        return createInternalDependency({
          symbol: name,
          type: dep.type,
          origin: createDependencyOrigin({
            node: dep.path.node,
            file: this.currentFile,
            location: dep.path.node.loc,
          }),
          scope: createScopeInfo({
            type: ScopeType.Module,
            path: dep.path,
            parent: null,
          }),
        });
      }

      return createInternalDependency({
        symbol: name,
        type: dep.type,
        origin: createDependencyOrigin({
          node: dep.path.node,
          file: this.currentFile,
          location: dep.path.node.loc,
        }),
        scope,
        isTransitive: false,
      });
    });
  }
}

/**
 * Create a new DependencyConverter instance
 */
export function createDependencyConverter(
  scopeManager: IScopeQuery & IScopeTreeBuilder
): DependencyConverter {
  return new DependencyConverter(scopeManager, scopeManager);
}
