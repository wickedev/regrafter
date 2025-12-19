/**
 * Variable Dependency Analyzer
 *
 * Analyzes identifiers to find local variable references.
 */

import type { NodePath, Binding } from "@babel/traverse";
import * as t from "@babel/types";

import type { ScopeInfo } from "../../scope/index.js";
import { DependencyType, type IdentifierReference, type VariableDependency } from "../types.js";

/**
 * Interface for variable dependency analyzer
 */
export interface IVariableDependencyAnalyzer {
  /**
   * Analyzes identifiers to find local variable references.
   */
  detectVariableDependencies(
    identifiers: IdentifierReference[],
    elementScope: ScopeInfo | null,
    isFromHook: (binding: Binding) => boolean,
    isImportBinding: (binding: Binding) => boolean,
    isParameterBinding: (binding: Binding) => boolean
  ): VariableDependency[];
}

/**
 * VariableDependencyAnalyzer implementation
 */
export class VariableDependencyAnalyzer implements IVariableDependencyAnalyzer {
  /**
   * Find binding for an identifier
   */
  private findBinding(path: NodePath, name: string): Binding | null {
    return path.scope.getBinding(name) ?? null;
  }

  /**
   * Analyzes identifiers to find local variable references.
   *
   * @param identifiers - Identifier references to analyze
   * @param elementScope - The scope of the JSX element
   * @param isFromHook - Function to check if binding is from a hook
   * @param isImportBinding - Function to check if binding is from import
   * @param isParameterBinding - Function to check if binding is a parameter
   * @returns Array of variable dependencies
   */
  detectVariableDependencies(
    identifiers: IdentifierReference[],
    _elementScope: ScopeInfo | null,
    isFromHook: (binding: Binding) => boolean,
    isImportBinding: (binding: Binding) => boolean,
    isParameterBinding: (binding: Binding) => boolean
  ): VariableDependency[] {
    const varDeps: VariableDependency[] = [];
    const processed = new Set<string>();

    for (const idRef of identifiers) {
      if (processed.has(idRef.name)) continue;
      processed.add(idRef.name);

      // Try to find the binding for this identifier
      const binding = this.findBinding(idRef.path, idRef.name);
      if (!binding) continue;

      // Skip if this is from a hook (handled separately)
      if (isFromHook(binding)) continue;

      // Skip if this is an import (handled separately)
      if (isImportBinding(binding)) continue;

      // Skip if this is a function parameter (might be props)
      if (isParameterBinding(binding)) continue;

      // This is a variable dependency
      const declarator = binding.path.node;
      if (t.isVariableDeclarator(declarator)) {
        varDeps.push({
          name: idRef.name,
          path: binding.path,
          type: DependencyType.Variable,
          isConst: binding.kind === "const",
          initializer: declarator.init ?? undefined,
        });
      } else if (t.isFunctionDeclaration(declarator)) {
        // Function declarations are also variable bindings
        varDeps.push({
          name: idRef.name,
          path: binding.path,
          type: DependencyType.Variable,
          isConst: true, // Functions are effectively const
        });
      }
    }

    return varDeps;
  }
}

/**
 * Create a new VariableDependencyAnalyzer instance
 */
export function createVariableDependencyAnalyzer(): IVariableDependencyAnalyzer {
  return new VariableDependencyAnalyzer();
}
