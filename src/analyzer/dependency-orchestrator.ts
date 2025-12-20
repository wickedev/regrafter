/**
 * Dependency Orchestrator
 *
 * Orchestrates dependency analysis for JSX elements by coordinating
 * specialized analyzers, converters, and resolvers.
 *
 * Responsibilities:
 * - Coordinate dependency detection across all analyzers
 * - Delegate to specialized components (converters, resolvers, detectors)
 * - Aggregate results into final DependencyAnalysis
 *
 * Single Responsibility: Orchestration and coordination
 */

import type { NodePath, Binding } from "@babel/traverse";
import * as t from "@babel/types";

import { DependencyErrorBuilder } from "../errors/dependency-error-builder.js";
import type { DependencyErrorType } from "../errors/error-category.js";
import type { IDependencyAnalyzer } from "../interfaces/index.js";
import { ok, err, tryCatch, mapErr } from "../result/index.js";
import type { Result } from "../result/index.js";
import {
  getScopeWithFallback,
  getEnclosingComponentOrNull,
} from "../scope/index.js";
import type {
  ScopeManager,
  ScopeInfo,
  ComponentScope,
} from "../scope/index.js";
import {
  createInternalDependency,
  createDependencyOrigin,
  createDependencyAnalysis,
} from "../types/factories.js";

import {
  createDependencyClassifier,
  type IDependencyClassifier,
} from "./analyzers/dependency-classifier.js";
import {
  createHookDependencyAnalyzer,
  type IHookDependencyAnalyzer,
} from "./analyzers/hook-dependency-analyzer.js";
import {
  createIdentifierCollector,
  type IIdentifierCollector,
} from "./analyzers/identifier-collector.js";
import {
  createImportDependencyAnalyzer,
  type IImportDependencyAnalyzer,
} from "./analyzers/import-dependency-analyzer.js";
import {
  createPropDependencyAnalyzer,
  type IPropDependencyAnalyzer,
} from "./analyzers/prop-dependency-analyzer.js";
import {
  createVariableDependencyAnalyzer,
  type IVariableDependencyAnalyzer,
} from "./analyzers/variable-dependency-analyzer.js";
import {
  createDependencyConverter,
  type IDependencyConverter,
} from "./dependency-converter.js";
import { createDependencyResolver } from "./dependency-resolver.js";
import { createDynamicCodeDetector } from "./dynamic-code-detector.js";
import type { IDependencyResolver } from "./interfaces.js";
import {
  createRelatedDependencyDetector,
  type IRelatedDependencyDetector,
} from "./related-dependency-detector.js";
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
 * DependencyOrchestrator class for orchestrating JSX element dependency analysis
 */
export class DependencyOrchestrator implements IDependencyAnalyzer {
  private readonly scopeManager: ScopeManager;
  private readonly options: Required<AnalyzerOptions>;
  private readonly identifierCollector: IIdentifierCollector;
  private readonly classifier: IDependencyClassifier;
  private readonly hookAnalyzer: IHookDependencyAnalyzer;
  private readonly variableAnalyzer: IVariableDependencyAnalyzer;
  private readonly importAnalyzer: IImportDependencyAnalyzer;
  private readonly propAnalyzer: IPropDependencyAnalyzer;
  private readonly converter: IDependencyConverter;
  private readonly resolver: IDependencyResolver;
  private relatedDependencyDetector: IRelatedDependencyDetector;
  private currentFile = "";

  constructor(scopeManager: ScopeManager, options?: AnalyzerOptions) {
    this.scopeManager = scopeManager;
    this.options = mergeAnalyzerOptions(options);
    this.identifierCollector = createIdentifierCollector(scopeManager);
    this.classifier = createDependencyClassifier(scopeManager);
    this.hookAnalyzer = createHookDependencyAnalyzer();
    this.variableAnalyzer = createVariableDependencyAnalyzer();
    this.importAnalyzer = createImportDependencyAnalyzer(
      this.options.includeImports,
      (path, name) => this.findBinding(path, name)
    );
    this.propAnalyzer = createPropDependencyAnalyzer(
      (path, name) => this.findBinding(path, name),
      (binding) => this.isParameterBinding(binding)
    );
    this.converter = createDependencyConverter(scopeManager);
    this.resolver = createDependencyResolver(scopeManager, scopeManager);
    this.relatedDependencyDetector = createRelatedDependencyDetector("");
  }

  /**
   * Set the current file being analyzed
   */
  setCurrentFile(file: string): void {
    this.currentFile = file;
    this.converter.setCurrentFile(file);
    // Create new detector with updated file
    this.relatedDependencyDetector = createRelatedDependencyDetector(file);
  }

  /**
   * Traverses the JSX element to find all identifier references that
   * the element depends on.
   *
   * @param elementPath - Path to the JSX element to analyze
   * @returns Collection result with all identifiers found
   */
  collectIdentifiers(elementPath: NodePath): IdentifierCollectionResult {
    return this.identifierCollector.collectIdentifiers(elementPath);
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
    elementScope: ScopeInfo | null
  ): HookDependency[] {
    return this.hookAnalyzer.detectHookDependencies(identifiers, elementScope);
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
    elementScope: ScopeInfo | null
  ): VariableDependency[] {
    return this.variableAnalyzer.detectVariableDependencies(
      identifiers,
      elementScope,
      (binding) => this.hookAnalyzer.isFromHook(binding),
      (binding) => this.importAnalyzer.isImportBinding(binding),
      (binding) => this.isParameterBinding(binding)
    );
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
    return this.importAnalyzer.detectImportDependencies(identifiers);
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
    return this.propAnalyzer.detectPropDependencies(identifiers, componentScope);
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
    return this.relatedDependencyDetector.detectRelatedDependencies(
      dependencies,
      elementScope,
      elementPath
    );
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
      const description =
        blocker?.description ?? "Code contains unanalyzable patterns";
      return err(
        new DependencyErrorBuilder()
          .code("E030")
          .message(description)
          .reason(description)
          .inFile(this.currentFile)
          .at(blocker?.location)
          .recoverable(false)
          .build()
      );
    }

    // Collect all identifiers
    const collection = this.collectIdentifiers(elementPath);
    const elementScope = getScopeWithFallback(elementPath, this.scopeManager);
    const componentScope = getEnclosingComponentOrNull(elementPath, this.scopeManager);

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
    const deduplicatedDeps = this.converter.deduplicate(allSpecificDeps);

    // Build temporary map from symbol:type to NodePath
    const tempPathMap = this.converter.buildDependencyPaths(deduplicatedDeps);

    // Convert to internal dependencies - wrapped in tryCatch to handle any throws
    const allDepsResult = mapErr(
      tryCatch(() =>
        this.converter.convertToInternal(deduplicatedDeps, elementScope)
      ),
      (error) => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return new DependencyErrorBuilder()
          .code("E032")
          .message(errorMsg)
          .reason(`Failed to convert dependencies: ${errorMsg}`)
          .inFile(this.currentFile)
          .at(elementPath.node.loc)
          .recoverable(false)
          .build();
      }
    );
    if (!allDepsResult.ok) return allDepsResult;
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
      this.classifier.classifyDependencies(allDeps, elementScope, targetScope);

    // Check if all dependencies can be resolved
    const canResolve = this.resolver.checkResolution(allDeps, targetScope);

    // If dependencies cannot be resolved, return error
    if (!canResolve.can) {
      const reason = canResolve.reason ?? "Cannot resolve all dependencies";
      return err(
        new DependencyErrorBuilder()
          .code("E031")
          .message(reason)
          .reason(reason)
          .inFile(this.currentFile)
          .at(elementPath.node.loc)
          .recoverable(false)
          .build()
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

  // ===================================================================
  // Private helper methods
  // ===================================================================

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
   * Find binding for an identifier
   */
  private findBinding(path: NodePath, name: string): Binding | null {
    return path.scope.getBinding(name) ?? null;
  }

  /**
   * Check if a binding is a function parameter
   */
  private isParameterBinding(binding: Binding): boolean {
    return binding.kind === "param";
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
          if (!this.importAnalyzer.isImportBinding(binding) && !this.hookAnalyzer.isFromHook(binding)) {
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
}

/**
 * Create a new DependencyOrchestrator instance
 */
export function createDependencyOrchestrator(
  scopeManager: ScopeManager,
  options?: AnalyzerOptions
): DependencyOrchestrator {
  return new DependencyOrchestrator(scopeManager, options);
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use createDependencyOrchestrator instead
 */
export function createDependencyAnalyzer(
  scopeManager: ScopeManager,
  options?: AnalyzerOptions
): DependencyOrchestrator {
  return createDependencyOrchestrator(scopeManager, options);
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use DependencyOrchestrator instead
 */
export const DependencyAnalyzer = DependencyOrchestrator;
