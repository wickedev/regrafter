/**
 * Dependency Classifier
 *
 * Classifies dependencies by required action (hoisting, import, prop threading).
 */

import type { ScopeManager, ScopeInfo } from "../../scope/index.js";
import { DependencyType, type InternalDependency } from "../types.js";

/**
 * Interface for dependency classifier
 */
export interface IDependencyClassifier {
  /**
   * Classify dependencies by required action
   */
  classifyDependencies(
    allDeps: InternalDependency[],
    elementScope: ScopeInfo | null,
    targetScope: ScopeInfo | null
  ): {
    needsHoisting: InternalDependency[];
    needsImport: InternalDependency[];
    needsPropThreading: InternalDependency[];
  };

  /**
   * Check if a dependency needs hoisting
   */
  needsHoisting(
    dep: InternalDependency,
    elementScope: ScopeInfo | null,
    targetScope: ScopeInfo | null
  ): boolean;

  /**
   * Check if an import needs to be added
   */
  needsImport(dep: InternalDependency, targetScope: ScopeInfo | null): boolean;

  /**
   * Check if a dependency needs prop threading
   */
  needsPropThreading(
    dep: InternalDependency,
    elementScope: ScopeInfo | null,
    targetScope: ScopeInfo | null
  ): boolean;
}

/**
 * DependencyClassifier implementation
 */
export class DependencyClassifier implements IDependencyClassifier {
  constructor(private readonly scopeManager: ScopeManager) {}

  /**
   * Classify dependencies by required action
   */
  classifyDependencies(
    allDeps: InternalDependency[],
    elementScope: ScopeInfo | null,
    targetScope: ScopeInfo | null
  ): {
    needsHoisting: InternalDependency[];
    needsImport: InternalDependency[];
    needsPropThreading: InternalDependency[];
  } {
    const needsHoisting = allDeps.filter((d) =>
      this.needsHoisting(d, elementScope, targetScope)
    );
    const needsImport = allDeps.filter(
      (d) =>
        d.type === DependencyType.Import && this.needsImport(d, targetScope)
    );
    const needsPropThreading = allDeps.filter((d) =>
      this.needsPropThreading(d, elementScope, targetScope)
    );

    return { needsHoisting, needsImport, needsPropThreading };
  }

  /**
   * Check if a dependency needs hoisting
   */
  needsHoisting(
    dep: InternalDependency,
    elementScope: ScopeInfo | null,
    targetScope: ScopeInfo | null
  ): boolean {
    if (!elementScope || !targetScope) return false;

    // Imports don't need hoisting, they need re-importing
    if (dep.type === DependencyType.Import) return false;

    // Check if target scope already has bindings for all required symbols
    // If yes, the references will be rebound to the target scope's bindings (no hoisting needed)
    const targetBindings = this.scopeManager.getBindingsInScope(targetScope);

    // Parse comma-separated symbols (e.g., "theme, toggleTheme" -> ["theme", "toggleTheme"])
    const symbols = dep.symbol.split(',').map(s => s.trim());
    const allSymbolsExist = symbols.every(symbol => targetBindings.has(symbol));

    if (allSymbolsExist) {
      return false;
    }

    // Check if dependency scope is accessible from target
    const accessibility = this.scopeManager.checkAccessibility(
      dep.scope,
      targetScope
    );
    return !accessibility.accessible;
  }

  /**
   * Check if an import needs to be added
   */
  needsImport(
    dep: InternalDependency,
    _targetScope: ScopeInfo | null
  ): boolean {
    // Only imports need import operations
    return dep.type === DependencyType.Import;
  }

  /**
   * Check if a dependency needs prop threading
   */
  needsPropThreading(
    dep: InternalDependency,
    elementScope: ScopeInfo | null,
    targetScope: ScopeInfo | null
  ): boolean {
    if (!elementScope || !targetScope) return false;

    // Hooks may need prop threading when moved out of component
    if (dep.type === DependencyType.Hook) {
      const accessibility = this.scopeManager.checkAccessibility(
        dep.scope,
        targetScope
      );
      return !accessibility.accessible;
    }

    return false;
  }
}

/**
 * Create a new DependencyClassifier instance
 */
export function createDependencyClassifier(
  scopeManager: ScopeManager
): IDependencyClassifier {
  return new DependencyClassifier(scopeManager);
}
