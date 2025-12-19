/**
 * Prop Dependency Analyzer
 *
 * Detects and analyzes prop dependencies in JSX elements.
 */

import type { NodePath, Binding } from "@babel/traverse";
import * as t from "@babel/types";

import type { PropDependency, IdentifierReference } from "../types.js";
import { DependencyType } from "../types.js";
import type { ComponentScope } from "../../scope/index.js";

/**
 * Interface for prop dependency analysis
 */
export interface IPropDependencyAnalyzer {
  /**
   * Detect prop dependencies from identifiers
   */
  detectPropDependencies(
    identifiers: IdentifierReference[],
    componentScope: ComponentScope | null
  ): PropDependency[];

  /**
   * Get prop information from a binding
   */
  getPropInfo(
    binding: Binding,
    componentScope: ComponentScope | null
  ): {
    name: string;
    component: string;
    isDestructured: boolean;
  } | null;
}

/**
 * Implementation of prop dependency analyzer
 */
export class PropDependencyAnalyzer implements IPropDependencyAnalyzer {
  constructor(
    private readonly findBinding: (path: NodePath, name: string) => Binding | null,
    private readonly isParameterBinding: (binding: Binding) => boolean
  ) {}

  /**
   * Analyzes identifiers to find component prop references.
   *
   * @param identifiers - Identifier references to analyze
   * @param componentScope - The component scope if available
   * @returns Array of prop dependencies
   */
  detectPropDependencies(
    identifiers: IdentifierReference[],
    componentScope: ComponentScope | null
  ): PropDependency[] {
    const propDeps: PropDependency[] = [];
    const processed = new Set<string>();

    for (const idRef of identifiers) {
      if (processed.has(idRef.name)) continue;
      processed.add(idRef.name);

      // Try to find the binding for this identifier
      const binding = this.findBinding(idRef.path, idRef.name);
      if (!binding) continue;

      // Check if this binding is from props
      const propInfo = this.getPropInfo(binding, componentScope);
      if (propInfo) {
        propDeps.push({
          name: propInfo.name,
          component: propInfo.component,
          path: binding.path,
          type: DependencyType.Prop,
          isDestructured: propInfo.isDestructured,
        });
      }
    }

    return propDeps;
  }

  /**
   * Get prop info from a binding
   */
  getPropInfo(
    binding: Binding,
    componentScope: ComponentScope | null
  ): {
    name: string;
    component: string;
    isDestructured: boolean;
  } | null {
    // Check if this binding is from a function parameter (likely props)
    if (!this.isParameterBinding(binding)) return null;

    // Get the function that contains this parameter
    let funcPath: NodePath | null = binding.path;
    while (funcPath && !funcPath.isFunction()) {
      funcPath = funcPath.parentPath;
    }

    if (!funcPath) return null;

    // Check if this is the first parameter (props)
    const funcNode = funcPath.node;
    if (
      !t.isFunctionDeclaration(funcNode) &&
      !t.isFunctionExpression(funcNode) &&
      !t.isArrowFunctionExpression(funcNode)
    ) {
      return null;
    }

    const firstParam = funcNode.params[0];
    if (!firstParam) return null;

    // Check if binding is from the first param
    if (t.isIdentifier(binding.path.node)) {
      // Direct props access: function Component(props)
      if (firstParam === binding.path.node) {
        return null; // This is the props object itself, not a specific prop
      }

      // Destructured prop: function Component({ name })
      if (t.isObjectPattern(firstParam)) {
        for (const prop of firstParam.properties) {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.value) &&
            prop.value.name === binding.identifier.name
          ) {
            const propName = t.isIdentifier(prop.key)
              ? prop.key.name
              : t.isStringLiteral(prop.key)
                ? prop.key.value
                : binding.identifier.name;
            return {
              name: propName,
              component: componentScope?.componentName ?? "Unknown",
              isDestructured: true,
            };
          }
        }
      }
    }

    return null;
  }
}

/**
 * Create a new PropDependencyAnalyzer instance
 */
export function createPropDependencyAnalyzer(
  findBinding: (path: NodePath, name: string) => Binding | null,
  isParameterBinding: (binding: Binding) => boolean
): IPropDependencyAnalyzer {
  return new PropDependencyAnalyzer(findBinding, isParameterBinding);
}
