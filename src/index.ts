/**
 * Regrafter - Programmatic AST Transformation Library for React
 *
 * A library for safely relocating React/JSX elements within and across files
 * with automatic dependency analysis, hoisting, and optimization.
 *
 * @packageDocumentation
 */

// Re-export all public types
export {
  // Main enums
  Move,
  DependencyType,
  ResolutionStrategy,

  // Selector types
  type PositionSelector,
  type PathSelector,
  type Selector,

  // Options and results
  type Options,
  // Result is exported separately from result module
  type Code,
  type MoveAnalysis,
  type AnalysisStats,
  type Dependency,
  type SuggestedFix,
  type FileInput,

  // Type guards
  isPositionSelector,
  isPathSelector,
  isValidMove,
  isValidDependencyType,
  isValidSelector,
  isValidOptions,

  // Utilities
  DEFAULT_OPTIONS,
  mergeOptions,
} from './types/index.js';

// Export hoisting executor
export {
  HoistExecutor,
  createHoistExecutor,
  type HoistExecutionContext,
} from './strategies/index.js';

// Export internal types for advanced usage
export {
  // Scope types
  ScopeType,
  type ScopeInfo,
  type ComponentScope,

  // Strategy types
  HoistStrategy,
  AtomicUnitType,
} from './types/index.js';

// Export error handling
export {
  // Error categories and classes
  ErrorCategory,
  RegraffErrorClass,
  type RegraffError,
  ParseError,
  SelectorError,
  DependencyError,
  ValidationError,
  TransformError,
  CircularError,
  InternalError,
  // Error type guards
  isRegraffError,
  isParseError,
  isSelectorError,
  isDependencyError,
  isValidationError,
  isTransformError,
  isCircularError,
  isInternalError,
  // Error codes
  ERROR_CODES,
  type ErrorCodeDefinition,
  getErrorCodeDefinition,
  getErrorCodesByCategory,
  isRecoverableErrorCode,
  // Error recovery
  type RecoveryResult,
  type RecoveryStrategy,
  isRecoverable,
  attemptRecovery,
} from './errors/index.js';

// Export validation utilities
export {
  InputValidationError,
  type ValidationResult,
  validateSelector,
  validateMove,
  validateOptions,
  validateFileInputArray,
  validateRegraftInput,
  type RegraftInput,
  assertRegraftInput,
  assertSelector,
  assertMove,
  assertOptions,
} from './validation/index.js';

// Export Result type and helpers (Task 17.1-17.5)
export {
  type Result,
  type Ok,
  type Err,
  ok,
  err,
  isOk,
  isErr,
  map,
  flatMap,
  mapErr,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  all,
  any,
  tryCatch,
  tryCatchAsync,
  mapAsync,
  flatMapAsync,
  // Batch processing (Task 17.3-17.4)
  type BatchResult,
  processBatch,
} from './result/index.js';

// Import Result helpers for internal use

// Export new API types (Task 17.2)
export {
  type TransformedCode,
} from './api/types.js';

// Export analyzer utilities
export {
  // Atomic unit detection
  detectAtomicUnit,
  detectConditionalExpression,
  detectTernaryExpression,
  detectMapExpression,
  detectCompoundComponent,
  getAtomicUnitType,
  findEnclosingAtomicUnit,
  isJSXNode,
  containsJSXElement,

  // Move validation
  validateMoveOperation,
  canMoveElement,
  MoveValidationError,
  type MoveValidationResult,
  type ConditionalExpressionInfo,
  type TernaryExpressionInfo,
  type MapExpressionInfo,
  type CompoundComponentInfo,

  // Dependency analysis
  DependencyAnalyzer,
  createDependencyAnalyzer,
  MoveAnalysisBuilder,
  createMoveAnalysisBuilder,
} from './analyzer/index.js';

// Export scope utilities
export {
  ScopeManager,
  createScopeManager,
} from './scope/index.js';

// Export selector utilities
export {
  SelectorResolver,
  createSelectorResolver,
} from './selector/index.js';

// Export strategy utilities for dependency hoisting
export {
  // Main planner
  HoistPlanner,
  createHoistPlanner,
  createConfiguredHoistPlanner,

  // Individual strategies
  HookHoister,
  createHookHoister,
  VariableHoister,
  createVariableHoister,
  PropThreader,
  createPropThreader,
  ImportManager,
  createImportManager,
  ContextHandler,
  createContextHandler,
  SuspenseHandler,
  createSuspenseHandler,

  // Utility functions
  isHookName,
  classifyHook,
  HookCategory,
  createStrategies,
  getAllHoistStrategies,

  // Type exports
  type HoistContext,
  type HoistPlanItem,
  type HoistPlan,
  type IHoistStrategy,
  type StrategyRegistry,
} from './strategies/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Public API Functions
// ═══════════════════════════════════════════════════════════════════════════════

// Export main API functions from api module
export { regraft } from './api/regraft.js';
export { canMove, move } from './api/move.js';
export { analyze } from './api/analyze.js';
export { optimize } from './api/optimize.js';
export { inline, type InlineResult, type Component } from './api/inline.js';

// Export extract API from extract module
export { extract, canExtract, analyzeExtract } from './extract/index.js';
