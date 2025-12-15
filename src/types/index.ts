/**
 * Regrafter Types Module
 *
 * Re-exports all public types and selected internal types/factories.
 */

// Public API types
export {
  // Enums
  Move,
  DependencyType,
  ResolutionStrategy,

  // Selector types
  type PositionSelector,
  type PathSelector,
  type Selector,

  // Configuration types
  type Options,

  // Result types
  type Result,
  type Code,
  type MoveAnalysis,
  type AnalysisStats,

  // Dependency types
  type Dependency,
  type SuggestedFix,

  // Input types
  type FileInput,

  // Type guards
  isPositionSelector,
  isPathSelector,
  isValidMove,
  isValidDependencyType,
  isValidSelector,
  isValidOptions,

  // Defaults
  DEFAULT_OPTIONS,
  mergeOptions,
} from './public.js';

// Internal types (exported for advanced usage)
export {
  // Scope types
  ScopeType,
  type ScopeInfo,
  type ComponentScope,
  type HookUsage,

  // Dependency graph types
  type DependencyGraph,
  type DependencyNode,
  type NodeMetadata,
  type DependencyOrigin,
  type InternalDependency,

  // AST store types
  type ASTStore,
  type ASTEntry,

  // Transform plan types
  HoistStrategy,
  AtomicUnitType,
  type TransformPlan,
  type MoveOperation,
  type HoistOperation,
  type PropThreadOperation,
  type ImportOperation,
  type ImportSpecifier,
  type SharedModuleOperation,
  type ExportDeclaration,
  type ValidationResult,

  // Transform result types
  type TransformResult,
  type TransformStats,
  type Modification,

  // Parser types
  type ParseResult,
  type ParseError,
  type SourceLocation,

  // Selector resolution types
  type ResolveResult,
  type AtomicUnit,
  type SelectorError,

  // Dependency analysis types
  type DependencyAnalysis,
  type AnalyzabilityResult,
  type UnanalyzableCode,

  // Optimizer types
  type OptimizeResult,
  type SinkCandidate,
  type ConsumerInfo,
  type PropRemoval,
} from './internal.js';

// Factory functions
export {
  // ID utilities
  generateId,
  resetIdCounter,
  hashContent,

  // Public type factories
  createDependency,
  createSuggestedFix,
  createAnalysisStats,
  createMoveAnalysis,
  createCode,
  createResult,
  createSuccessResult,
  createFailureResult,

  // Internal type factories
  createScopeInfo,
  createComponentScope,
  createNodeMetadata,
  createDependencyNode,
  createDependencyGraph,
  addNodeToDependencyGraph,
  addEdgeToDependencyGraph,
  createASTStore,
  createASTEntry,
  createDependencyOrigin,
  createInternalDependency,
  createValidationResult,
  createTransformPlan,
  createMoveOperation,
  createHoistOperation,
  createPropThreadOperation,
  createImportSpecifier,
  createImportOperation,
  createExportDeclaration,
  createSharedModuleOperation,
  createTransformStats,
  createTransformResult,
  createParseError,
  createParseResult,
  createSelectorError,
  createAtomicUnit,
  createResolveResult,
  createDependencyAnalysis,
  createConsumerInfo,
  createSinkCandidate,
  createPropRemoval,
  createOptimizeResult,
  createModification,
} from './factories.js';
