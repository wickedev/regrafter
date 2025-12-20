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
      const symbol =
        "name" in dep
          ? dep.name
          : "bindings" in dep
            ? dep.bindings.join(",")
            : "localName" in dep
              ? dep.localName
              : "unknown";

      const existing = seenSymbols.get(symbol);
      if (existing) {
        if (
          existing.type === DependencyType.Hook &&
          dep.type === DependencyType.Ref
        ) {
          continue;
        }
        if (
          existing.type === DependencyType.Ref &&
          dep.type === DependencyType.Hook
        ) {
          const index = deduplicatedDeps.indexOf(existing);
          if (index !== -1) {
            deduplicatedDeps[index] = dep;
          }
          seenSymbols.set(symbol, dep);
          continue;
        }
      }

      seenSymbols.set(symbol, dep);
      deduplicatedDeps.push(dep);
    }

    return deduplicatedDeps;
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
          : "bindings" in dep
            ? dep.bindings.join(", ")
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
        const enclosingResult = this.scopeQuery.findEnclosingComponent(dep.path);
        if (!isErr(enclosingResult)) {
          scope = enclosingResult.value;
        }
      }

      // Fallback to original logic for other types or if no component found
      scope ??=
        this.scopeQuery.getScopeForPath(dep.path) ??
        elementScope ??
        this.scopeTreeBuilder.getScopeTree()?.root ??
        null;

      const name =
        "name" in dep
          ? dep.name
          : "bindings" in dep
            ? dep.bindings.join(", ")
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
