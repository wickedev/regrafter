/**
 * Sink Analyzer
 *
 * Analyzes hoisted declarations to identify candidates that can be sunk
 * to more optimal scope locations. Implements LCA (Lowest Common Ancestor)
 * computation for determining optimal sink targets.
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import type * as t from '@babel/types';

import { isJSXElement, isJSXFragment } from '../core/index.js';
import { createInternalError } from '../errors/index.js';
import {
  createScopeInfo,
  createConsumerInfo,
  createSinkCandidate,
  generateId,
} from '../types/factories.js';
import {
  ScopeType,
  type ScopeInfo,
  type InternalDependency,
  type ConsumerInfo,
  type SinkCandidate,
  type DependencyGraph,
  DependencyType,
} from '../types/index.js';
import type { FileInput } from '../types/public.js';
import { loadTraverseFunction } from '../utils/index.js';

import type {
  ISinkAnalyzer,
  SinkAnalysisOptions,
  SinkAnalysisResult,
  LCAResult,
  ScopeTree,
} from './types.js';


const traverse = loadTraverseFunction(traverseModule);

/**
 * Default options for sink analysis.
 */
const DEFAULT_SINK_OPTIONS: Required<SinkAnalysisOptions> = {
  minDepthImprovement: 1,
  analyzeTransitive: true,
  maxConsumers: 100,
  allowHookSinking: false,
};

/**
 * SinkAnalyzer handles detection and analysis of hoisted declarations
 * that can potentially be sunk to more optimal locations.
 */
export class SinkAnalyzer implements ISinkAnalyzer {
  private scopeCache: WeakMap<t.File, ScopeTree> = new WeakMap();
  private readonly consumerCache: Map<string, ConsumerInfo[]> = new Map();

  /**
   * Analyze files for sink candidates.
   *
   * @param files - Input files to analyze
   * @param graph - Dependency graph from prior analysis
   * @param options - Analysis options
   * @returns Analysis result with sink candidates
   */
  analyze(
    _files: FileInput[],
    graph: DependencyGraph,
    options?: SinkAnalysisOptions
  ): SinkAnalysisResult {
    const opts = { ...DEFAULT_SINK_OPTIONS, ...options };
    const candidates: SinkCandidate[] = [];
    const sinkable: SinkCandidate[] = [];
    const unsinkable: Array<{ candidate: SinkCandidate; reason: string }> = [];

    // Collect all dependencies that might be sink candidates
    const potentialCandidates = this.identifyPotentialCandidates(graph, opts);

    // Analyze each candidate
    for (const dep of potentialCandidates) {
      // Find all consumers
      const consumers = this.findConsumers(dep, graph);

      if (consumers.length === 0) {
        // No consumers - this is dead code, not a sink candidate
        continue;
      }

      if (consumers.length > opts.maxConsumers) {
        // Too many consumers to analyze efficiently
        continue;
      }

      // Compute LCA of consumer scopes
      const consumerScopes = consumers.map((c) => c.scope);
      const lca = this.computeLCA(consumerScopes);

      // Check if sinking would improve depth
      const currentDepth = dep.scope.depth;
      const optimalDepth = lca.scope.depth;
      const improvement = currentDepth - optimalDepth;

      const candidate = createSinkCandidate({
        dependency: dep,
        currentScope: dep.scope,
        optimalScope: lca.scope,
        consumers,
        sinkable: improvement >= opts.minDepthImprovement,
        reason:
          improvement < opts.minDepthImprovement
            ? `Depth improvement (${improvement}) below threshold (${opts.minDepthImprovement})`
            : undefined,
      });

      candidates.push(candidate);

      // Check additional sinkability constraints
      const canSink = this.checkSinkability(candidate, opts);
      if (canSink.sinkable) {
        sinkable.push(candidate);
      } else {
        unsinkable.push({ candidate, reason: canSink.reason ?? 'Unknown' });
      }
    }

    // Compute dependency order for safe sinking
    const dependencyOrder = this.computeSinkOrder(sinkable, graph);

    return {
      candidates,
      sinkable,
      unsinkable,
      dependencyOrder,
    };
  }

  /**
   * Find all consumers of a dependency.
   *
   * @param dependency - The dependency to find consumers for
   * @param graph - Dependency graph
   * @returns Array of consumer information
   */
  findConsumers(
    dependency: InternalDependency,
    graph: DependencyGraph
  ): ConsumerInfo[] {
    // Check cache first
    const cacheKey = dependency.id;
    const cached = this.consumerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const consumers: ConsumerInfo[] = [];

    // Get reverse edges (nodes that depend on this dependency)
    const reverseEdges = graph.reverseEdges.get(dependency.id);
    if (!reverseEdges) {
      return consumers;
    }

    for (const consumerId of reverseEdges) {
      const consumerNode = graph.nodes.get(consumerId);
      if (!consumerNode) continue;

      // Determine usage type based on how the dependency is consumed
      // For nodes without a path, use 'direct' as default
      let usageType: 'direct' | 'prop' | 'closure' = 'direct';

      if (consumerNode.path !== null) {
        // At this point, TypeScript knows path is not null
        const consumerWithPath: { path: NodePath; scope: ScopeInfo } = {
          path: consumerNode.path,
          scope: consumerNode.scope,
        };
        usageType = this.determineUsageType(consumerWithPath, dependency);
      }

      consumers.push(
        createConsumerInfo({
          path: consumerNode.path,
          scope: consumerNode.scope,
          usageType,
        })
      );
    }

    // Cache the result
    this.consumerCache.set(cacheKey, consumers);

    return consumers;
  }

  /**
   * Compute the Lowest Common Ancestor of multiple scopes.
   *
   * Uses a path-to-root algorithm for efficient LCA computation.
   *
   * @param scopes - Array of scopes to find LCA for
   * @returns LCA result with scope and path
   */
  computeLCA(scopes: ScopeInfo[]): LCAResult {
    if (scopes.length === 0) {
      const error = createInternalError({
        code: 'E001',
        message: 'Cannot compute LCA of empty scope list - scope array must contain at least one element',
      });
      throw new Error(error.message);
    }

    if (scopes.length === 1) {
      const scope = scopes[0];
      if (!scope) {
        const error = createInternalError({
          code: 'E001',
          message: 'computeLCA: Scope array unexpectedly empty after length check - first scope element is undefined',
        });
        throw new Error(error.message);
      }
      return {
        scope,
        depth: scope.depth,
        pathFromRoot: this.getPathToRoot(scope).reverse(),
      };
    }

    // Get paths to root for all scopes
    const paths = scopes.map((scope) => this.getPathToRoot(scope));

    // Find common ancestors by comparing paths from root
    // Make a copy before reversing to avoid mutating the original array
    const firstPath = paths[0];
    if (!firstPath || firstPath.length === 0) {
      const error = createInternalError({
        code: 'E001',
        message: 'computeLCA: First scope path is empty - unable to compute path to root for first scope',
      });
      throw new Error(error.message);
    }
    const firstPathReversed = [...firstPath].reverse(); // Start from root
    let lcaIndex = -1;

    for (let i = 0; i < firstPathReversed.length; i++) {
      const scopeAtDepth = firstPathReversed[i];
      if (!scopeAtDepth) continue;

      const allMatch = paths.every((path) => {
        const reversed = [...path].reverse();
        return reversed[i]?.id === scopeAtDepth.id;
      });

      if (allMatch) {
        lcaIndex = i;
      } else {
        break;
      }
    }

    // LCA is the deepest common ancestor
    const lcaScope = lcaIndex >= 0
      ? firstPathReversed[lcaIndex]
      : firstPathReversed[0];

    if (!lcaScope) {
      const error = createInternalError({
        code: 'E001',
        message: 'computeLCA: Unable to determine LCA scope - no common ancestor found',
      });
      throw new Error(error.message);
    }

    const pathFromRoot = firstPathReversed.slice(0, lcaIndex + 1);

    return {
      scope: lcaScope,
      depth: lcaScope.depth,
      pathFromRoot,
    };
  }

  /**
   * Build a scope tree from a parsed AST.
   *
   * @param ast - The parsed AST
   * @returns Scope tree structure
   */
  buildScopeTree(ast: t.File): ScopeTree {
    // Check cache
    const cached = this.scopeCache.get(ast);
    if (cached) {
      return cached;
    }

    const scopes = new Map<string, ScopeInfo>();
    const depths = new Map<string, number>();
    const parents = new Map<string, string | null>();
    const children = new Map<string, Set<string>>();

    // Initialize root scope from Program node
    // Every valid Babel AST has a Program node as root
    let programPath: NodePath | undefined;

    traverse(ast, {
      Program(path: NodePath) {
        programPath = path;
        path.stop();
      },
    });

    if (!programPath) {
      const error = createInternalError({
        code: 'E001',
        message: 'buildScopeTree: No Program node found in AST',
      });
      throw new Error(error.message);
    }

    const rootScope = createScopeInfo({
      type: ScopeType.Module,
      path: programPath,
      parent: null,
      depth: 0,
      id: generateId('scope_root'),
    });

    scopes.set(rootScope.id, rootScope);
    depths.set(rootScope.id, 0);
    parents.set(rootScope.id, null);
    children.set(rootScope.id, new Set());

    let currentScope: ScopeInfo = rootScope;
    const scopeStack: ScopeInfo[] = [rootScope];

    // Traverse AST to build scope tree
    traverse(ast, {
      enter(path: NodePath) {
        // Skip the Program node (already processed)
        if (path.isProgram()) {
          return;
        }

        // Detect scope-creating nodes
        let scopeType: ScopeType | null = null;

        if (
          path.isFunctionDeclaration() ||
          path.isFunctionExpression() ||
          path.isArrowFunctionExpression()
        ) {
          // Check if this is a React component
          scopeType = isReactComponent(path)
            ? ScopeType.Component
            : ScopeType.Function;
        } else if (path.isBlockStatement()) {
          // Block scope for if/for/while/etc.
          const parent = path.parentPath;
          if (parent.isIfStatement() || parent.isConditionalExpression()) {
            scopeType = ScopeType.Conditional;
          } else if (
            parent.isForStatement() ||
            parent.isWhileStatement() ||
            parent.isDoWhileStatement() ||
            parent.isForInStatement() ||
            parent.isForOfStatement()
          ) {
            scopeType = ScopeType.Loop;
          } else if (
            !parent.isFunction() &&
            !parent.isProgram() &&
            !parent.isCatchClause()
          ) {
            scopeType = ScopeType.Block;
          }
        }

        if (scopeType !== null) {
          const newScope = createScopeInfo({
            type: scopeType,
            path,
            parent: currentScope,
            depth: currentScope.depth + 1,
            id: generateId('scope'),
          });

          scopes.set(newScope.id, newScope);
          depths.set(newScope.id, newScope.depth);
          parents.set(newScope.id, currentScope.id);

          const parentChildren = children.get(currentScope.id);
          if (parentChildren) {
            parentChildren.add(newScope.id);
          }
          children.set(newScope.id, new Set());

          scopeStack.push(newScope);
          currentScope = newScope;
        }
      },
      exit(path: NodePath) {
        // Skip the Program node (already processed)
        if (path.isProgram()) {
          return;
        }

        // Pop scope when exiting scope-creating nodes
        if (
          path.isFunctionDeclaration() ||
          path.isFunctionExpression() ||
          path.isArrowFunctionExpression() ||
          (path.isBlockStatement() && scopeStack.length > 1)
        ) {
          const topScope = scopeStack[scopeStack.length - 1];
          // Only pop if this path matches the current scope's path
          if (topScope?.path === path) {
            scopeStack.pop();
            const newCurrentScope = scopeStack[scopeStack.length - 1];
            currentScope = newCurrentScope ?? rootScope;
          }
        }
      },
    });

    const tree: ScopeTree = {
      root: rootScope,
      scopes,
      depths,
      parents,
      children,
    };

    // Cache the result
    this.scopeCache.set(ast, tree);

    return tree;
  }

  /**
   * Clear internal caches.
   */
  clearCache(): void {
    this.scopeCache = new WeakMap();
    this.consumerCache.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Identify potential sink candidates from the dependency graph.
   */
  private identifyPotentialCandidates(
    graph: DependencyGraph,
    opts: Required<SinkAnalysisOptions>
  ): InternalDependency[] {
    const candidates: InternalDependency[] = [];

    for (const [, node] of graph.nodes) {
      if (node.type !== 'symbol') continue;

      // Check if this is a dependency that might be over-hoisted
      // We look for declarations at higher scope levels than necessary

      // Skip hooks unless explicitly allowed
      if (node.metadata.isHook && !opts.allowHookSinking) {
        continue;
      }

      // Create an InternalDependency-like object from the node
      const dep: InternalDependency = {
        id: node.id,
        symbol: node.name,
        type: node.metadata.isHook
          ? DependencyType.Hook
          : DependencyType.Variable,
        origin: {
          node: node.path !== null ? node.path.node : null,
          file: '', // Would need file context
          location: node.path !== null ? (node.path.node.loc ?? null) : null,
        },
        scope: node.scope,
        isTransitive: false,
        consumers: [],
      };

      candidates.push(dep);
    }

    return candidates;
  }

  /**
   * Determine how a consumer uses a dependency.
   */
  private determineUsageType(
    consumerNode: { path: NodePath; scope: ScopeInfo },
    _dependency: InternalDependency
  ): 'direct' | 'prop' | 'closure' {
    const path = consumerNode.path;

    // Check if used as a prop
    const parentPath = path.parentPath;
    if (parentPath?.isJSXAttribute() === true) {
      return 'prop';
    }

    // Check if used in a closure (referenced from a different scope)
    const consumerDepth = consumerNode.scope.depth;
    if (consumerDepth > 0) {
      // If consumer is deeper than dependency origin, it's a closure reference
      return 'closure';
    }

    return 'direct';
  }

  /**
   * Get the path from a scope to the root.
   */
  private getPathToRoot(scope: ScopeInfo): ScopeInfo[] {
    const path: ScopeInfo[] = [];
    let current: ScopeInfo | null = scope;

    while (current !== null) {
      path.push(current);
      current = current.parent;
    }

    return path;
  }

  /**
   * Check additional sinkability constraints.
   */
  private checkSinkability(
    candidate: SinkCandidate,
    opts: Required<SinkAnalysisOptions>
  ): { sinkable: boolean; reason?: string } {
    // Check if already at optimal location
    if (candidate.currentScope.id === candidate.optimalScope.id) {
      return { sinkable: false, reason: 'Already at optimal scope' };
    }

    // Check minimum depth improvement
    const improvement =
      candidate.currentScope.depth - candidate.optimalScope.depth;
    if (improvement < opts.minDepthImprovement) {
      return {
        sinkable: false,
        reason: `Depth improvement (${improvement}) below threshold (${opts.minDepthImprovement})`,
      };
    }

    // Check hook rules
    if (
      candidate.dependency.type === DependencyType.Hook &&
      !opts.allowHookSinking
    ) {
      // Check if sinking would violate hook rules
      if (candidate.optimalScope.type === ScopeType.Conditional) {
        return {
          sinkable: false,
          reason: 'Cannot sink hook into conditional scope',
        };
      }
      if (candidate.optimalScope.type === ScopeType.Loop) {
        return { sinkable: false, reason: 'Cannot sink hook into loop scope' };
      }
    }

    // Check for side effects
    if (candidate.dependency.type === DependencyType.Variable) {
      // Pure declarations can be sunk more freely
      // Side-effectful declarations need more careful analysis
    }

    return { sinkable: true };
  }

  /**
   * Compute safe order for sinking operations.
   */
  private computeSinkOrder(
    candidates: SinkCandidate[],
    graph: DependencyGraph
  ): string[] {
    // Build dependency map between candidates
    const candidateIds = new Set(candidates.map((c) => c.dependency.id));
    const dependencies = new Map<string, Set<string>>();

    for (const candidate of candidates) {
      const deps = new Set<string>();
      const edges = graph.edges.get(candidate.dependency.id);
      if (edges) {
        for (const edgeTarget of edges) {
          if (candidateIds.has(edgeTarget)) {
            deps.add(edgeTarget);
          }
        }
      }
      dependencies.set(candidate.dependency.id, deps);
    }

    // Topological sort
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): boolean => {
      if (visited.has(id)) return true;
      if (visiting.has(id)) return false; // Cycle detected

      visiting.add(id);

      const deps = dependencies.get(id);
      if (deps) {
        for (const dep of deps) {
          if (!visit(dep)) return false;
        }
      }

      visiting.delete(id);
      visited.add(id);
      order.push(id);

      return true;
    };

    for (const candidate of candidates) {
      visit(candidate.dependency.id);
    }

    return order.reverse();
  }
}

/**
 * Check if a function path represents a React component.
 */
function isReactComponent(path: NodePath): boolean {
  // Check for capitalized function name (convention for React components)
  if (path.isFunctionDeclaration()) {
    const name = path.node.id?.name;
    if (typeof name === 'string' && name.length > 0 && /^[A-Z]/.test(name)) {
      return true;
    }
  }

  // Check for JSX return
  let hasJSXReturn = false;
  path.traverse({
    ReturnStatement(returnPath: NodePath<t.ReturnStatement>) {
      const argument = returnPath.node.argument;
      if (argument && (isJSXElement(argument) || isJSXFragment(argument))) {
        hasJSXReturn = true;
        returnPath.stop();
      }
    },
    JSXElement(_path: NodePath<t.JSXElement>) {
      hasJSXReturn = true;
    },
    JSXFragment(_path: NodePath<t.JSXFragment>) {
      hasJSXReturn = true;
    },
  });

  return hasJSXReturn;
}

// Removed: isJSXNode and isJSXFragment now imported from core/ast-guards.js

/**
 * Create a SinkAnalyzer instance.
 */
export function createSinkAnalyzer(): SinkAnalyzer {
  return new SinkAnalyzer();
}
