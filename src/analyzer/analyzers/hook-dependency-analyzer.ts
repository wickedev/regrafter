/**
 * Hook Dependency Analyzer
 *
 * Analyzes identifiers to find those that come from React hooks.
 */

import type { NodePath, Binding } from "@babel/traverse";
import * as t from "@babel/types";

import type { ScopeInfo } from "../../scope/index.js";
import { DependencyType, type IdentifierReference, type HookDependency } from "../types.js";

/**
 * Set of React hooks
 */
const REACT_HOOKS = new Set([
  "useState",
  "useEffect",
  "useContext",
  "useReducer",
  "useCallback",
  "useMemo",
  "useRef",
  "useImperativeHandle",
  "useLayoutEffect",
  "useDebugValue",
  "useDeferredValue",
  "useTransition",
  "useId",
  "useSyncExternalStore",
  "useInsertionEffect",
]);

/**
 * Interface for hook dependency analyzer
 */
export interface IHookDependencyAnalyzer {
  /**
   * Analyzes identifiers to find those that come from React hooks.
   */
  detectHookDependencies(
    identifiers: IdentifierReference[],
    elementScope: ScopeInfo | null
  ): HookDependency[];

  /**
   * Get hook info from a binding
   */
  getHookInfo(binding: Binding): {
    hookName: string;
    bindings: string[];
    path: NodePath;
    dependencies?: string[];
  } | null;

  /**
   * Check if a binding is from a hook
   */
  isFromHook(binding: Binding): boolean;
}

/**
 * HookDependencyAnalyzer implementation
 */
export class HookDependencyAnalyzer implements IHookDependencyAnalyzer {
  /**
   * Find binding for an identifier
   */
  private findBinding(path: NodePath, name: string): Binding | null {
    return path.scope.getBinding(name) ?? null;
  }

  /**
   * Analyzes identifiers to find those that come from React hooks.
   *
   * @param identifiers - Identifier references to analyze
   * @param elementScope - The scope of the JSX element
   * @returns Array of hook dependencies
   */
  detectHookDependencies(
    identifiers: IdentifierReference[],
    _elementScope: ScopeInfo | null
  ): HookDependency[] {
    const hookDeps: HookDependency[] = [];
    const processed = new Set<string>();

    for (const idRef of identifiers) {
      if (processed.has(idRef.name)) continue;

      // Try to find the binding for this identifier
      const binding = this.findBinding(idRef.path, idRef.name);
      if (!binding) continue;

      // Check if this binding comes from a hook
      const hookInfo = this.getHookInfo(binding);
      if (hookInfo) {
        hookDeps.push({
          hookName: hookInfo.hookName,
          bindings: hookInfo.bindings,
          path: hookInfo.path,
          type: DependencyType.Hook,
          hookDeps: hookInfo.dependencies,
        });

        // Mark all bindings from this hook as processed
        for (const b of hookInfo.bindings) {
          processed.add(b);
        }
      }
    }

    return hookDeps;
  }

  /**
   * Check if a binding is from a hook
   */
  isFromHook(binding: Binding): boolean {
    const declarator = binding.path.parent;

    if (t.isVariableDeclaration(declarator)) {
      const declarations = declarator.declarations;
      for (const decl of declarations) {
        if (t.isCallExpression(decl.init)) {
          const callee = decl.init.callee;
          if (t.isIdentifier(callee) && REACT_HOOKS.has(callee.name)) {
            return true;
          }
          if (
            t.isMemberExpression(callee) &&
            t.isIdentifier(callee.property) &&
            REACT_HOOKS.has(callee.property.name)
          ) {
            return true;
          }
          // Custom hooks
          if (t.isIdentifier(callee) && /^use[A-Z]/.test(callee.name)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Get hook info from a binding
   */
  getHookInfo(binding: Binding): {
    hookName: string;
    bindings: string[];
    path: NodePath;
    dependencies?: string[];
  } | null {
    const parent = binding.path.parent;

    if (!t.isVariableDeclaration(parent)) return null;

    for (const decl of parent.declarations) {
      if (t.isCallExpression(decl.init)) {
        const callee = decl.init.callee;
        let hookName: string | null = null;

        if (
          t.isIdentifier(callee) &&
          (REACT_HOOKS.has(callee.name) || /^use[A-Z]/.test(callee.name))
        ) {
          hookName = callee.name;
        } else if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.property) &&
          REACT_HOOKS.has(callee.property.name)
        ) {
          hookName = callee.property.name;
        }

        if (hookName !== null && hookName !== "") {
          // Get all bindings created by this hook
          const bindings: string[] = [];
          if (t.isIdentifier(decl.id)) {
            bindings.push(decl.id.name);
          } else if (t.isArrayPattern(decl.id)) {
            for (const elem of decl.id.elements) {
              if (t.isIdentifier(elem)) {
                bindings.push(elem.name);
              }
            }
          } else if (t.isObjectPattern(decl.id)) {
            for (const prop of decl.id.properties) {
              if (t.isObjectProperty(prop) && t.isIdentifier(prop.value)) {
                bindings.push(prop.value.name);
              }
            }
          }

          // Get hook dependencies if applicable
          let dependencies: string[] | undefined;
          const depsArg = decl.init.arguments[1];
          if (
            ["useEffect", "useLayoutEffect", "useMemo", "useCallback"].includes(
              hookName
            ) &&
            t.isArrayExpression(depsArg)
          ) {
            dependencies = depsArg.elements
              .filter((e): e is t.Identifier => t.isIdentifier(e))
              .map((e) => e.name);
          }

          return {
            hookName,
            bindings,
            path: binding.path,
            dependencies,
          };
        }
      }
    }

    return null;
  }
}

/**
 * Create a new HookDependencyAnalyzer instance
 */
export function createHookDependencyAnalyzer(): IHookDependencyAnalyzer {
  return new HookDependencyAnalyzer();
}
