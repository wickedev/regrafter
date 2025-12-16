/**
 * MoveAnalysis Builder
 *
 * Builds MoveAnalysis objects from dependency analysis results.
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import { ScopeType } from '../scope/index.js';
import type { ScopeManager, ScopeInfo } from '../scope/index.js';
import {
  createMoveAnalysis,
  createAnalysisStats,
  createDependency,
  createSuggestedFix,
} from '../types/factories.js';
import type { DependencyAnalysis, InternalDependency } from '../types/internal.js';
import {
  type MoveAnalysis,
  type Dependency,
  type AnalysisStats,
  type SuggestedFix,
  DependencyType,
  ResolutionStrategy,
} from '../types/public.js';

import { DependencyAnalyzer } from './DependencyAnalyzer.js';
import type { AnalyzerOptions } from './types.js';

/**
 * MoveAnalysisBuilder creates MoveAnalysis objects for the public API
 */
export class MoveAnalysisBuilder {
  private readonly scopeManager: ScopeManager;
  private readonly analyzer: DependencyAnalyzer;

  constructor(scopeManager: ScopeManager, options?: AnalyzerOptions) {
    this.scopeManager = scopeManager;
    this.analyzer = new DependencyAnalyzer(scopeManager, options);
  }

  /**
   * Set the current file being analyzed
   */
  setCurrentFile(file: string): void {
    this.analyzer.setCurrentFile(file);
  }

  /**
   * Converts internal dependency analysis to public MoveAnalysis format.
   *
   * @param elementPath - Path to the source JSX element
   * @param _targetPath - Path to the target location (reserved for future use)
   * @param sourceScope - Scope of the source element
   * @param targetScope - Scope of the target location
   * @returns MoveAnalysis for the proposed move
   */
  buildMoveAnalysis(
    elementPath: NodePath,
    _targetPath: NodePath,
    sourceScope: ScopeInfo | null,
    targetScope: ScopeInfo | null
  ): MoveAnalysis {
    // Perform dependency analysis
    const analysis = this.analyzer.analyzeElement(elementPath, targetScope);

    // Check if move is possible
    const canMoveResult = this.checkCanMove(analysis, sourceScope, targetScope);

    if (!canMoveResult.canMove) {
      return createMoveAnalysis({
        canMove: false,
        reason: canMoveResult.reason,
        dependencies: this.convertToPublicDeps(analysis.dependencies, targetScope),
        hoistedDeps: [],
        suggestedFixes: this.generateSuggestedFixes(analysis, canMoveResult.reason ?? ''),
        stats: this.computeStats(analysis),
      });
    }

    // Convert dependencies to public format
    const dependencies = this.convertToPublicDeps(analysis.dependencies, targetScope);
    const hoistedDeps = this.convertToPublicDeps(analysis.needsHoisting, targetScope);

    return createMoveAnalysis({
      canMove: true,
      dependencies,
      hoistedDeps,
      stats: this.computeStats(analysis),
      suggestedFixes: this.generateOptimizationSuggestions(analysis),
    });
  }

  /**
   * Public method to analyze a proposed move operation.
   *
   * @param ast - The AST containing the elements
   * @param sourcePath - Path to the source element
   * @param targetPath - Path to the target location
   * @returns MoveAnalysis describing what would happen
   */
  analyze(
    ast: t.File,
    sourcePath: NodePath,
    targetPath: NodePath
  ): MoveAnalysis {
    // Build scope tree if not already built
    this.scopeManager.buildScopeTree(ast);

    // Get scopes for source and target
    const sourceScope = this.scopeManager.getScopeForPath(sourcePath);
    const targetScope = this.scopeManager.getScopeForPath(targetPath);

    // Build and return the analysis
    return this.buildMoveAnalysis(sourcePath, targetPath, sourceScope, targetScope);
  }

  /**
   * Quick check if a move is possible without full analysis
   */
  canMove(
    ast: t.File,
    sourcePath: NodePath,
    targetPath: NodePath
  ): boolean {
    const analysis = this.analyze(ast, sourcePath, targetPath);
    return analysis.canMove;
  }

  /**
   * Get the underlying DependencyAnalyzer
   */
  getDependencyAnalyzer(): DependencyAnalyzer {
    return this.analyzer;
  }

  // ===================================================================
  // Private helper methods
  // ===================================================================

  /**
   * Check if a move operation is possible
   */
  private checkCanMove(
    analysis: DependencyAnalysis,
    sourceScope: ScopeInfo | null,
    targetScope: ScopeInfo | null
  ): { canMove: boolean; reason?: string } {
    // Check if analysis succeeded
    if (!analysis.canResolve) {
      return {
        canMove: false,
        reason: analysis.unresolvedReason ?? 'Cannot resolve all dependencies',
      };
    }

    // Check for hook violations
    const hookDeps = analysis.dependencies.filter(d => d.type === DependencyType.Hook);
    if (hookDeps.length > 0 && targetScope?.type === ScopeType.Module) {
      return {
        canMove: false,
        reason: 'Cannot move element with hook dependencies to module scope',
      };
    }

    // Check for unresolvable context dependencies
    const contextDeps = analysis.dependencies.filter(d => d.type === DependencyType.Context);
    if (contextDeps.length > 0) {
      // Context dependencies need special handling
      // For now, check if target is within the same component tree
      if (sourceScope && targetScope) {
        const accessibility = this.scopeManager.checkAccessibility(sourceScope, targetScope);
        if (!accessibility.lca) {
          return {
            canMove: false,
            reason: 'Context dependencies cannot be resolved outside component tree',
          };
        }
      }
    }

    // Check for ref dependencies in loops
    const refDeps = analysis.dependencies.filter(d => d.type === DependencyType.Ref);
    if (refDeps.length > 0 && targetScope?.type === ScopeType.Loop) {
      return {
        canMove: false,
        reason: 'Cannot move element with ref dependencies into a loop',
      };
    }

    return { canMove: true };
  }

  /**
   * Convert internal dependencies to public format
   */
  private convertToPublicDeps(
    internalDeps: InternalDependency[],
    targetScope: ScopeInfo | null
  ): Dependency[] {
    return internalDeps.map((dep) => {
      const resolution = this.determineResolution(dep, targetScope);

      return createDependency({
        symbol: dep.symbol,
        type: dep.type,
        origin: dep.origin.file,
        scope: this.getScopeName(dep.scope),
        isTransitive: dep.isTransitive,
        resolution,
      });
    });
  }

  /**
   * Determine the resolution strategy for a dependency
   */
  private determineResolution(
    dep: InternalDependency,
    targetScope: ScopeInfo | null
  ): ResolutionStrategy | undefined {
    // Imports are resolved by adding import statements
    if (dep.type === DependencyType.Import) {
      return ResolutionStrategy.Import;
    }

    // Hooks need special handling based on target
    if (dep.type === DependencyType.Hook) {
      if (targetScope?.type === ScopeType.Component) {
        // Same component type - may need prop threading
        return ResolutionStrategy.PropThread;
      }
      // Need to hoist the hook
      return ResolutionStrategy.Hoist;
    }

    // Context dependencies
    if (dep.type === DependencyType.Context) {
      // Check if we can hoist the provider
      return ResolutionStrategy.ProviderHoist;
    }

    // Regular variables
    if (dep.type === DependencyType.Variable) {
      if (targetScope) {
        const accessibility = this.scopeManager.checkAccessibility(dep.scope, targetScope);
        if (!accessibility.accessible) {
          return ResolutionStrategy.Hoist;
        }
      }
    }

    // Props need threading
    if (dep.type === DependencyType.Prop) {
      return ResolutionStrategy.PropThread;
    }

    return undefined;
  }

  /**
   * Get a human-readable scope name
   */
  private getScopeName(scope: ScopeInfo): string {
    if (scope.type === ScopeType.Component) {
      // When type is Component, scope has componentName property
      return 'componentName' in scope && typeof scope.componentName === 'string'
        ? scope.componentName
        : 'Component';
    }
    if (scope.type === ScopeType.Module) {
      return 'module';
    }
    if (scope.type === ScopeType.Function) {
      return 'function';
    }
    return scope.type;
  }

  /**
   * Compute analysis statistics
   */
  private computeStats(analysis: DependencyAnalysis): AnalysisStats {
    const deps = analysis.dependencies;

    return createAnalysisStats({
      totalDependencies: deps.length,
      hookDependencies: deps.filter(d => d.type === DependencyType.Hook).length,
      variableDependencies: deps.filter(d => d.type === DependencyType.Variable).length,
      importDependencies: deps.filter(d => d.type === DependencyType.Import).length,
      propDependencies: deps.filter(d => d.type === DependencyType.Prop).length,
      transitiveDependencies: deps.filter(d => d.isTransitive).length,
    });
  }

  /**
   * Generate suggested fixes for a failed move
   */
  private generateSuggestedFixes(
    _analysis: DependencyAnalysis,
    reason: string
  ): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];

    // Hook-related fixes
    if (reason.includes('hook')) {
      fixes.push(
        createSuggestedFix({
          description: 'Extract hook to a custom hook that can be called from multiple components',
          action: 'extract_custom_hook',
          automatic: false,
        })
      );
      fixes.push(
        createSuggestedFix({
          description: 'Move the target element to the same component as the hook',
          action: 'move_target',
          automatic: false,
        })
      );
    }

    // Context-related fixes
    if (reason.includes('context') || reason.includes('Context')) {
      fixes.push(
        createSuggestedFix({
          description: 'Wrap the target component tree with the required Context.Provider',
          action: 'wrap_provider',
          automatic: true,
        })
      );
      fixes.push(
        createSuggestedFix({
          description: 'Extract context value to props and pass it down',
          action: 'context_to_props',
          automatic: true,
        })
      );
    }

    // Ref-related fixes
    if (reason.includes('ref') || reason.includes('Ref')) {
      fixes.push(
        createSuggestedFix({
          description: 'Use callback ref instead of ref object',
          action: 'use_callback_ref',
          automatic: false,
        })
      );
    }

    // General unresolvable dependency fix
    if (reason.includes('resolve')) {
      fixes.push(
        createSuggestedFix({
          description: 'Manually review and restructure the dependent code',
          action: 'manual_review',
          automatic: false,
        })
      );
    }

    return fixes;
  }

  /**
   * Generate optimization suggestions for a successful move
   */
  private generateOptimizationSuggestions(
    analysis: DependencyAnalysis
  ): SuggestedFix[] | undefined {
    const suggestions: SuggestedFix[] = [];

    // Suggest reducing prop threading
    if (analysis.needsPropThreading.length > 3) {
      suggestions.push(
        createSuggestedFix({
          description: 'Consider using Context to avoid deep prop threading',
          action: 'suggest_context',
          automatic: false,
        })
      );
    }

    // Suggest memo for frequently re-rendered components
    const hookDeps = analysis.dependencies.filter(d => d.type === DependencyType.Hook);
    if (hookDeps.length > 2) {
      suggestions.push(
        createSuggestedFix({
          description: 'Consider memoizing the component to prevent unnecessary re-renders',
          action: 'suggest_memo',
          automatic: false,
        })
      );
    }

    return suggestions.length > 0 ? suggestions : undefined;
  }
}

/**
 * Create a new MoveAnalysisBuilder instance
 */
export function createMoveAnalysisBuilder(
  scopeManager: ScopeManager,
  options?: AnalyzerOptions
): MoveAnalysisBuilder {
  return new MoveAnalysisBuilder(scopeManager, options);
}
