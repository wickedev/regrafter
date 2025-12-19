/**
 * Dependency Analyzer
 *
 * Analyzes dependencies of JSX elements for safe move operations.
 */

import type { NodePath, Binding } from "@babel/traverse";
import * as t from "@babel/types";

import {
  createDependencyError,
  type DependencyErrorType,
} from "../errors/error-category.js";
import type { IDependencyAnalyzer } from "../interfaces/index.js";
import { ok, err, tryCatch, isErr, type Result } from "../result/index.js";
import { ScopeType } from "../scope/index.js";
import type {
  ScopeManager,
  ScopeInfo,
  ComponentScope,
} from "../scope/index.js";
import {
  createInternalDependency,
  createDependencyOrigin,
  createDependencyAnalysis,
  createScopeInfo,
} from "../types/factories.js";

import { createDynamicCodeDetector } from "./dynamic-code-detector.js";
import {
  DependencyType,
  type IdentifierReference,
  type IdentifierCollectionResult,
  type HookDependency,
  type VariableDependency,
  type ImportDependency,
  type PropDependency,
  type ContextDependency,
  type RefDependency,
  type SpecificDependency,
  type AnalyzerOptions,
  type InternalDependency,
  type DependencyAnalysis,
  type UnanalyzableCode,
  type AnalyzabilityResult,
  mergeAnalyzerOptions,
} from "./types.js";

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
 * Helper function to safely get the name from a SpecificDependency
 */
function getDependencyName(dep: SpecificDependency): string {
  switch (dep.type) {
    case DependencyType.Hook:
      return dep.hookName;
    case DependencyType.Import:
      return dep.localName;
    case DependencyType.Variable:
    case DependencyType.Prop:
    case DependencyType.Context:
    case DependencyType.Ref:
      return dep.name;
  }
}

/**
 * DependencyAnalyzer class for analyzing JSX element dependencies
 */
export class DependencyAnalyzer implements IDependencyAnalyzer {
  private readonly scopeManager: ScopeManager;
  private readonly options: Required<AnalyzerOptions>;
  private currentFile = "";

  constructor(scopeManager: ScopeManager, options?: AnalyzerOptions) {
    this.scopeManager = scopeManager;
    this.options = mergeAnalyzerOptions(options);
  }

  /**
   * Set the current file being analyzed
   */
  setCurrentFile(file: string): void {
    this.currentFile = file;
  }

  /**
   * Traverses the JSX element to find all identifier references that
   * the element depends on.
   *
   * @param elementPath - Path to the JSX element to analyze
   * @returns Collection result with all identifiers found
   */
  collectIdentifiers(elementPath: NodePath): IdentifierCollectionResult {
    const identifiers: IdentifierReference[] = [];
    const jsxElementNames: string[] = [];
    const spreads: NodePath[] = [];
    const errors: string[] = [];
    const seenIdentifiers = new Set<string>();

    const addIdentifier = (ref: IdentifierReference): void => {
      // Create unique key for deduplication
      const key = `${ref.name}:${ref.path.node.start}`;
      if (!seenIdentifiers.has(key)) {
        seenIdentifiers.add(key);
        identifiers.push(ref);
      }
    };

    // Traverse the JSX element subtree
    elementPath.traverse({
      // Regular identifier references
      Identifier: (idPath) => {
        // Skip if this is a JSX element name (handled separately)
        if (this.isJSXElementName(idPath)) {
          return;
        }

        // Skip if this is a property key
        if (this.isPropertyKey(idPath)) {
          return;
        }

        // Skip if this is a declaration
        if (this.isDeclaration(idPath)) {
          return;
        }

        const scope = this.scopeManager.getScopeForPath(idPath);
        addIdentifier({
          name: idPath.node.name,
          path: idPath,
          usage: this.getIdentifierUsage(idPath),
          scope,
        });
      },

      // JSX element opening names
      JSXOpeningElement: (jsxPath) => {
        const nameNode = jsxPath.node.name;
        if (t.isJSXIdentifier(nameNode)) {
          // Only track user-defined components (start with uppercase)
          if (/^[A-Z]/.test(nameNode.name)) {
            jsxElementNames.push(nameNode.name);

            // Also add as identifier reference
            const scope = this.scopeManager.getScopeForPath(jsxPath);
            addIdentifier({
              name: nameNode.name,
              path: jsxPath,
              usage: "jsx-element",
              scope,
            });
          }
        } else if (t.isJSXMemberExpression(nameNode)) {
          // Handle Compound.Component pattern
          const names = this.extractMemberExpressionNames(nameNode);
          if (names.length > 0 && names[0] !== undefined && names[0] !== "") {
            jsxElementNames.push(names.join("."));

            const scope = this.scopeManager.getScopeForPath(jsxPath);
            addIdentifier({
              name: names[0],
              path: jsxPath,
              usage: "jsx-element",
              scope,
            });
          }
        }
      },

      // JSX spread attributes
      JSXSpreadAttribute: (spreadPath) => {
        spreads.push(spreadPath);

        // Get the argument identifier if it's a simple identifier
        const arg = spreadPath.node.argument;
        if (t.isIdentifier(arg)) {
          const scope = this.scopeManager.getScopeForPath(spreadPath);
          addIdentifier({
            name: arg.name,
            path: spreadPath,
            usage: "spread",
            scope,
          });
        }
      },

      // Member expressions (like obj.prop or arr[0])
      MemberExpression: (memberPath) => {
        // Get the root object of the member expression
        const rootObject = this.getRootObject(memberPath.node);
        if (rootObject && t.isIdentifier(rootObject)) {
          const scope = this.scopeManager.getScopeForPath(memberPath);
          addIdentifier({
            name: rootObject.name,
            path: memberPath,
            usage: "value",
            scope,
          });
        }
      },

      // Call expressions
      CallExpression: (callPath) => {
        const callee = callPath.node.callee;

        // Handle direct function calls: foo()
        if (t.isIdentifier(callee)) {
          const scope = this.scopeManager.getScopeForPath(callPath);
          addIdentifier({
            name: callee.name,
            path: callPath,
            usage: "call",
            scope,
          });
        }

        // Handle method calls: obj.method()
        if (t.isMemberExpression(callee)) {
          const rootObject = this.getRootObject(callee);
          if (rootObject && t.isIdentifier(rootObject)) {
            const scope = this.scopeManager.getScopeForPath(callPath);
            addIdentifier({
              name: rootObject.name,
              path: callPath,
              usage: "call",
              scope,
            });
          }
        }
      },
    });

    return {
      identifiers,
      jsxElementNames,
      spreads,
      errors,
    };
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
   * Analyzes identifiers to find local variable references.
   *
   * @param identifiers - Identifier references to analyze
   * @param elementScope - The scope of the JSX element
   * @returns Array of variable dependencies
   */
  detectVariableDependencies(
    identifiers: IdentifierReference[],
    _elementScope: ScopeInfo | null
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
      if (this.isFromHook(binding)) continue;

      // Skip if this is an import (handled separately)
      if (this.isImportBinding(binding)) continue;

      // Skip if this is a function parameter (might be props)
      if (this.isParameterBinding(binding)) continue;

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

  /**
   * Analyzes identifiers to find import references.
   *
   * @param identifiers - Identifier references to analyze
   * @returns Array of import dependencies
   */
  detectImportDependencies(
    identifiers: IdentifierReference[]
  ): ImportDependency[] {
    if (!this.options.includeImports) return [];

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
   * Analyzes identifiers to find React context value references.
   *
   * @param identifiers - Identifier references to analyze
   * @returns Array of context dependencies
   */
  detectContextDependencies(
    identifiers: IdentifierReference[]
  ): ContextDependency[] {
    const contextDeps: ContextDependency[] = [];
    const processed = new Set<string>();

    for (const idRef of identifiers) {
      if (processed.has(idRef.name)) continue;
      processed.add(idRef.name);

      // Try to find the binding for this identifier
      const binding = this.findBinding(idRef.path, idRef.name);
      if (!binding) continue;

      // Check if this binding is from useContext
      const contextInfo = this.getContextInfo(binding);
      if (contextInfo) {
        contextDeps.push({
          name: contextInfo.name,
          contextName: contextInfo.contextName,
          path: binding.path,
          type: DependencyType.Context,
        });
      }
    }

    return contextDeps;
  }

  /**
   * Analyzes identifiers to find React ref references.
   *
   * @param identifiers - Identifier references to analyze
   * @returns Array of ref dependencies
   */
  detectRefDependencies(identifiers: IdentifierReference[]): RefDependency[] {
    const refDeps: RefDependency[] = [];
    const processed = new Set<string>();

    for (const idRef of identifiers) {
      if (processed.has(idRef.name)) continue;
      processed.add(idRef.name);

      // Try to find the binding for this identifier
      const binding = this.findBinding(idRef.path, idRef.name);
      if (!binding) continue;

      // Check if this binding is from useRef
      const refInfo = this.getRefInfo(binding);
      if (refInfo) {
        refDeps.push({
          name: refInfo.name,
          path: binding.path,
          type: DependencyType.Ref,
          initialValue: refInfo.initialValue,
        });
      }
    }

    return refDeps;
  }

  /**
   * Analyzes dependencies to find their own dependencies recursively.
   *
   * @param dependencies - Direct dependencies to analyze
   * @param depth - Current recursion depth
   * @returns Array of transitive dependencies
   */
  detectTransitiveDependencies(
    dependencies: SpecificDependency[],
    depth = 0
  ): InternalDependency[] {
    if (!this.options.trackTransitive) return [];
    if (depth >= this.options.maxTransitiveDepth) return [];

    const transitiveDeps: InternalDependency[] = [];
    const processed = new Set<string>();

    for (const dep of dependencies) {
      // Skip imports - they don't have transitive deps in the same file
      if (dep.type === DependencyType.Import) continue;

      // Analyze the dependency's initializer for more dependencies
      const transitives = this.analyzeForTransitiveDeps(dep, processed);

      for (const trans of transitives) {
        // Mark as transitive
        const scope =
          this.scopeManager.getScopeForPath(trans.path) ??
          this.scopeManager.getScopeTree()?.root;

        if (scope) {
          transitiveDeps.push(
            createInternalDependency({
              symbol: getDependencyName(trans),
              type: trans.type,
              origin: createDependencyOrigin({
                node: trans.path.node,
                file: this.currentFile,
                location: trans.path.node.loc,
              }),
              scope,
              isTransitive: true,
            })
          );
        }
      }
    }

    return transitiveDeps;
  }

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

    const { hoistedSymbols, existingSymbols } = this.collectHoistedSymbols(dependencies);
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
    const results: Array<{ dependency: InternalDependency; path: NodePath }> = [];

    for (const declarator of stmtPath.get("declarations")) {
      if (!declarator.isVariableDeclarator()) continue;

      const init = declarator.get("init");
      const id = declarator.get("id");

      if (!id.isIdentifier()) continue;
      const functionName = id.node.name;

      if (!init.isFunctionExpression() && !init.isArrowFunctionExpression()) continue;
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

  /**
   * Check if a path references any of the given symbols
   */
  private referencesAnySymbol(path: NodePath, symbols: Set<string>): boolean {
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

  /**
   * Identifies code patterns that cannot be statically analyzed,
   * such as eval(), dynamic property access, etc.
   *
   * @param elementPath - Path to the JSX element to check
   * @returns Analyzability result
   */
  checkAnalyzability(elementPath: NodePath): AnalyzabilityResult {
    const detector = createDynamicCodeDetector();
    const dynamicCode = detector.detect(elementPath);

    if (dynamicCode.length === 0) {
      return {
        analyzable: true,
      };
    }

    // Convert DynamicCodeInfo to UnanalyzableCode
    const blockers: UnanalyzableCode[] = dynamicCode.map((dc) => ({
      type: dc.type === "eval" ? "eval" : "dynamicCode",
      location: dc.location,
      description:
        dc.type === "eval"
          ? "Use of eval() makes static analysis impossible"
          : dc.type === "Function"
            ? "Use of Function constructor creates dynamic code"
            : "Dynamic import with non-static argument cannot be statically analyzed",
    }));

    return {
      analyzable: false,
      blockers,
    };
  }

  /**
   * Perform full dependency analysis on a JSX element
   *
   * @param elementPath - Path to the JSX element
   * @param targetScope - Target scope for the move
   * @returns Result containing full dependency analysis or DependencyError
   */
  analyzeElement(
    elementPath: NodePath,
    targetScope: ScopeInfo | null
  ): Result<DependencyAnalysis, DependencyErrorType> {
    // First check analyzability
    const analyzability = this.checkAnalyzability(elementPath);
    if (!analyzability.analyzable) {
      const blocker = analyzability.blockers?.[0];
      return err(
        createDependencyError({
          code: "E030",
          message:
            blocker?.description ?? "Code contains unanalyzable patterns",
          unresolvableReason:
            blocker?.description ?? "Code contains unanalyzable patterns",
          file: this.currentFile,
          location: blocker?.location,
          suggestions: [],
          recoverable: false,
        })
      );
    }

    // Collect all identifiers
    const collection = this.collectIdentifiers(elementPath);
    let elementScope = this.scopeManager.getScopeForPath(elementPath);

    // If element doesn't have its own scope (e.g., JSX elements), use enclosing component
    if (!elementScope) {
      const enclosingResult = this.scopeManager.findEnclosingComponent(elementPath);
      if (!isErr(enclosingResult)) {
        elementScope = enclosingResult.value;
      }
    }

    const componentScopeResult = this.scopeManager.findEnclosingComponent(elementPath);
    const componentScope = !isErr(componentScopeResult) ? componentScopeResult.value : null;

    // Detect different types of dependencies
    const hookDeps = this.detectHookDependencies(
      collection.identifiers,
      elementScope
    );
    const varDeps = this.detectVariableDependencies(
      collection.identifiers,
      elementScope
    );
    const importDeps = this.detectImportDependencies(collection.identifiers);
    const propDeps = this.detectPropDependencies(
      collection.identifiers,
      componentScope
    );
    const contextDeps = this.detectContextDependencies(collection.identifiers);
    const refDeps = this.detectRefDependencies(collection.identifiers);

    // Combine all specific dependencies
    const allSpecificDeps: SpecificDependency[] = [
      ...hookDeps,
      ...varDeps,
      ...importDeps,
      ...propDeps,
      ...contextDeps,
      ...refDeps,
    ];

    // Deduplicate dependencies - useRef creates both Hook and Ref dependencies
    // Deduplicate dependencies
    const deduplicatedDeps = this.deduplicateDependencies(allSpecificDeps);

    // Build temporary map from symbol:type to NodePath
    const tempPathMap = this.buildDependencyPathsMap(deduplicatedDeps);

    // Convert to internal dependencies - wrapped in tryCatch to handle any throws
    const allDepsResult = tryCatch(() =>
      this.convertToInternalDeps(deduplicatedDeps, elementScope)
    );
    if (isErr(allDepsResult)) {
      const errorMsg =
        allDepsResult.error instanceof Error
          ? allDepsResult.error.message
          : String(allDepsResult.error);
      return err(
        createDependencyError({
          code: "E032",
          message: errorMsg,
          unresolvableReason: `Failed to convert dependencies: ${errorMsg}`,
          file: this.currentFile,
          location: elementPath.node.loc ?? undefined,
          suggestions: [],
          recoverable: false,
        })
      );
    }
    const allDeps = allDepsResult.value;

    // Build final dependency paths map using InternalDependency IDs
    const dependencyPaths = new Map<string, NodePath>();
    for (const dep of allDeps) {
      const key = `${dep.symbol}:${dep.type}`;
      const path = tempPathMap.get(key);
      if (path) {
        dependencyPaths.set(dep.id, path);
      }
    }

    // Detect transitive dependencies using deduplicated dependencies
    const transitiveDeps = this.detectTransitiveDependencies(deduplicatedDeps);
    allDeps.push(...transitiveDeps);

    // Detect related dependencies (useEffect, helper functions that use hoisted deps)
    const relatedDepsWithPaths = this.detectRelatedDependencies(
      allDeps,
      elementScope,
      elementPath
    );

    // Add related dependencies and their paths
    for (const { dependency, path } of relatedDepsWithPaths) {
      allDeps.push(dependency);
      dependencyPaths.set(dependency.id, path);
    }

    // Classify dependencies by what action is needed
    const { needsHoisting, needsImport, needsPropThreading } =
      this.classifyDependencies(allDeps, elementScope, targetScope);

    // Check if all dependencies can be resolved
    const canResolve = this.canResolveDependencies(allDeps, targetScope);

    // If dependencies cannot be resolved, return error
    if (!canResolve.can) {
      return err(
        createDependencyError({
          code: "E031",
          message: canResolve.reason ?? "Cannot resolve all dependencies",
          unresolvableReason:
            canResolve.reason ?? "Cannot resolve all dependencies",
          file: this.currentFile,
          location: elementPath.node.loc ?? undefined,
          suggestions: [],
          recoverable: false,
        })
      );
    }

    return ok(
      createDependencyAnalysis({
        dependencies: allDeps,
        needsHoisting,
        needsImport,
        needsPropThreading,
        canResolve: canResolve.can,
        unresolvedReason: canResolve.reason,
        dependencyPaths,
      })
    );
  }

  /**
   * Deduplicate dependencies, preferring Hook over Ref types
   */
  private deduplicateDependencies(
    allDeps: SpecificDependency[]
  ): SpecificDependency[] {
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
   * Build path map from deduplicated dependencies
   */
  private buildDependencyPathsMap(
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
   * Classify dependencies by required action
   */
  private classifyDependencies(
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

  // ===================================================================
  // Private helper methods
  // ===================================================================

  /**
   * Check if an identifier is a JSX element name
   */
  private isJSXElementName(path: NodePath<t.Identifier>): boolean {
    const parent = path.parent;
    return (
      t.isJSXOpeningElement(parent) &&
      ((t.isJSXIdentifier(parent.name) &&
        parent.name.name === path.node.name) ||
        this.isPartOfJSXName(parent.name, path.node))
    );
  }

  /**
   * Check if identifier is part of a JSX member expression name
   */
  private isPartOfJSXName(
    name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
    node: t.Identifier
  ): boolean {
    if (t.isJSXMemberExpression(name)) {
      if (
        t.isJSXIdentifier(name.property) &&
        name.property.name === node.name
      ) {
        return true;
      }
      if (t.isJSXIdentifier(name.object) && name.object.name === node.name) {
        return true;
      }
      if (t.isJSXMemberExpression(name.object)) {
        return this.isPartOfJSXName(name.object, node);
      }
    }
    return false;
  }

  /**
   * Check if an identifier is a property key
   */
  private isPropertyKey(path: NodePath<t.Identifier>): boolean {
    const parent = path.parent;
    return (
      (t.isObjectProperty(parent) &&
        parent.key === path.node &&
        !parent.computed) ||
      (t.isMemberExpression(parent) &&
        parent.property === path.node &&
        !parent.computed)
    );
  }

  /**
   * Check if an identifier is a declaration
   */
  private isDeclaration(path: NodePath<t.Identifier>): boolean {
    const parent = path.parent;
    return (
      (t.isVariableDeclarator(parent) && parent.id === path.node) ||
      (t.isFunctionDeclaration(parent) && parent.id === path.node) ||
      (t.isClassDeclaration(parent) && parent.id === path.node) ||
      t.isImportSpecifier(parent) ||
      t.isImportDefaultSpecifier(parent) ||
      t.isImportNamespaceSpecifier(parent)
    );
  }

  /**
   * Get how an identifier is used
   */
  private getIdentifierUsage(
    path: NodePath<t.Identifier>
  ): IdentifierReference["usage"] {
    const parent = path.parent;

    if (t.isCallExpression(parent) && parent.callee === path.node) {
      return "call";
    }

    if (t.isJSXExpressionContainer(parent)) {
      return "value";
    }

    if (t.isJSXAttribute(parent)) {
      return "jsx-attribute";
    }

    return "value";
  }

  /**
   * Extract names from a JSX member expression
   */
  private extractMemberExpressionNames(node: t.JSXMemberExpression): string[] {
    const names: string[] = [];

    if (t.isJSXIdentifier(node.object)) {
      names.push(node.object.name);
    } else if (t.isJSXMemberExpression(node.object)) {
      names.push(...this.extractMemberExpressionNames(node.object));
    }

    if (t.isJSXIdentifier(node.property)) {
      names.push(node.property.name);
    }

    return names;
  }

  /**
   * Get root object of a member expression
   */
  private getRootObject(node: t.MemberExpression): t.Expression | null {
    let current: t.Expression = node;

    while (t.isMemberExpression(current)) {
      current = current.object;
    }

    return current;
  }

  /**
   * Find binding for an identifier
   */
  private findBinding(path: NodePath, name: string): Binding | null {
    return path.scope.getBinding(name) ?? null;
  }

  /**
   * Check if a binding is from a hook
   */
  private isFromHook(binding: Binding): boolean {
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
  private getHookInfo(binding: Binding): {
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

  /**
   * Check if a binding is from an import
   */
  private isImportBinding(binding: Binding): boolean {
    return (
      t.isImportSpecifier(binding.path.node) ||
      t.isImportDefaultSpecifier(binding.path.node) ||
      t.isImportNamespaceSpecifier(binding.path.node)
    );
  }

  /**
   * Check if a binding is a function parameter
   */
  private isParameterBinding(binding: Binding): boolean {
    return binding.kind === "param";
  }

  /**
   * Get import info from a binding
   */
  private getImportInfo(binding: Binding): {
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

  /**
   * Get prop info from a binding
   */
  private getPropInfo(
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

  /**
   * Get context info from a binding (useContext)
   */
  private getContextInfo(binding: Binding): {
    name: string;
    contextName: string;
  } | null {
    const parent = binding.path.parent;

    if (!t.isVariableDeclaration(parent)) return null;

    for (const decl of parent.declarations) {
      if (t.isCallExpression(decl.init)) {
        const callee = decl.init.callee;

        // Check for useContext call
        const isUseContext =
          (t.isIdentifier(callee) && callee.name === "useContext") ||
          (t.isMemberExpression(callee) &&
            t.isIdentifier(callee.property) &&
            callee.property.name === "useContext");

        if (!isUseContext) continue;

        // Get context name from argument
        const contextArg = decl.init.arguments[0];
        let contextName = "UnknownContext";
        if (t.isIdentifier(contextArg)) {
          contextName = contextArg.name;
        } else if (
          t.isMemberExpression(contextArg) &&
          t.isIdentifier(contextArg.property)
        ) {
          contextName = contextArg.property.name;
        }

        // Get binding name
        let name: string | null = null;
        if (t.isIdentifier(decl.id)) {
          name = decl.id.name;
        }

        if (name !== null && name !== "") {
          return { name, contextName };
        }
      }
    }

    return null;
  }

  /**
   * Get ref info from a binding (useRef)
   */
  private getRefInfo(binding: Binding): {
    name: string;
    initialValue?: t.Expression;
  } | null {
    const parent = binding.path.parent;

    if (!t.isVariableDeclaration(parent)) return null;

    for (const decl of parent.declarations) {
      if (t.isCallExpression(decl.init)) {
        const callee = decl.init.callee;

        // Check for useRef call
        const isUseRef =
          (t.isIdentifier(callee) && callee.name === "useRef") ||
          (t.isMemberExpression(callee) &&
            t.isIdentifier(callee.property) &&
            callee.property.name === "useRef");

        if (!isUseRef) continue;

        // Get binding name
        let name: string | null = null;
        if (t.isIdentifier(decl.id)) {
          name = decl.id.name;
        }

        // Get initial value if any
        const firstArg = decl.init.arguments[0];
        const initialValue =
          firstArg !== undefined && t.isExpression(firstArg)
            ? firstArg
            : undefined;

        if (name !== null && name !== "") {
          return { name, initialValue };
        }
      }
    }

    return null;
  }

  /**
   * Analyze a dependency for transitive dependencies
   */
  private analyzeForTransitiveDeps(
    dep: SpecificDependency,
    processed: Set<string>
  ): SpecificDependency[] {
    const transitives: SpecificDependency[] = [];

    // For variables, analyze their initializers
    if (
      dep.type === DependencyType.Variable &&
      "initializer" in dep &&
      dep.initializer
    ) {
      const initPath = dep.path;

      // Traverse the initializer for identifiers
      initPath.traverse({
        Identifier: (idPath: NodePath<t.Identifier>) => {
          if (this.isPropertyKey(idPath) || this.isDeclaration(idPath)) {
            return;
          }

          const name = idPath.node.name;
          if (processed.has(name)) return;
          processed.add(name);

          const binding = this.findBinding(idPath, name);
          if (!binding) return;

          // Create a variable dependency for this transitive
          if (!this.isImportBinding(binding) && !this.isFromHook(binding)) {
            transitives.push({
              name,
              path: binding.path,
              type: DependencyType.Variable,
              isConst: binding.kind === "const",
            });
          }
        },
      });
    }

    return transitives;
  }

  /**
   * Convert specific dependencies to internal dependencies
   */
  private convertToInternalDeps(
    deps: SpecificDependency[],
    elementScope: ScopeInfo | null
  ): InternalDependency[] {
    return deps.map((dep) => {
      // For variable dependencies, find the enclosing component scope
      // instead of using getScopeForPath which may return module scope
      let scope: ScopeInfo | null = null;

      if (dep.type === DependencyType.Variable) {
        // For variables, find the component they're declared in
        const enclosingResult = this.scopeManager.findEnclosingComponent(dep.path);
        if (!isErr(enclosingResult)) {
          scope = enclosingResult.value;
        }
      }

      // Fallback to original logic for other types or if no component found
      scope ??=
        this.scopeManager.getScopeForPath(dep.path) ??
        elementScope ??
        this.scopeManager.getScopeTree()?.root ??
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

  /**
   * Check if a dependency needs hoisting
   */
  private needsHoisting(
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
  private needsImport(
    dep: InternalDependency,
    _targetScope: ScopeInfo | null
  ): boolean {
    // Only imports need import operations
    return dep.type === DependencyType.Import;
  }

  /**
   * Check if a dependency needs prop threading
   */
  private needsPropThreading(
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

  /**
   * Check if all dependencies can be resolved
   */
  private canResolveDependencies(
    deps: InternalDependency[],
    targetScope: ScopeInfo | null
  ): { can: boolean; reason?: string } {
    for (const dep of deps) {
      // Context dependencies may not be resolvable
      if (dep.type === DependencyType.Context) {
        // Check if context is available at target
        // For now, assume context needs special handling
        // In a real implementation, we'd check the provider hierarchy
      }

      // Hook dependencies can't be moved outside of components
      if (dep.type === DependencyType.Hook) {
        // null targetScope or Module scope both indicate moving to module level
        if (!targetScope || targetScope.type === ScopeType.Module) {
          return {
            can: false,
            reason: `Hook dependency "${dep.symbol}" cannot be moved to module scope`,
          };
        }
      }
    }

    return { can: true };
  }
}

/**
 * Create a new DependencyAnalyzer instance
 */
export function createDependencyAnalyzer(
  scopeManager: ScopeManager,
  options?: AnalyzerOptions
): DependencyAnalyzer {
  return new DependencyAnalyzer(scopeManager, options);
}
