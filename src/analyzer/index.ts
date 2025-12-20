/**
 * Analyzer Module
 *
 * Provides analysis utilities for understanding JSX code structure,
 * including atomic unit detection and dependency analysis.
 */

// Atomic Unit Detection
export {
  // Type guards
  isJSXNode,
  isJSXExpressionWithElement,
  containsJSXElement,

  // Conditional expression (condition && element)
  detectConditionalExpression,
  isConditionalExpressionPath,
  type ConditionalExpressionInfo,

  // Ternary expression (condition ? A : B)
  detectTernaryExpression,
  isTernaryExpressionPath,
  type TernaryExpressionInfo,

  // Map expression (items.map(...))
  detectMapExpression,
  isMapExpressionPath,
  type MapExpressionInfo,

  // Compound component (Component.SubComponent)
  detectCompoundComponent,
  isCompoundComponentPath,
  type CompoundComponentInfo,

  // Unified detection
  detectAtomicUnit,
  getAtomicUnitType,
  findEnclosingAtomicUnit,
} from './atomic-unit-detector.js';

// Move validation
export {
  validateMove as validateMoveOperation,
  canMoveElement,
  type MoveValidationResult,
  type ValidationRule,
  MoveValidationError,
} from './move-validator.js';

// Dependency Analysis
export {
  DependencyOrchestrator,
  createDependencyOrchestrator,
  // Legacy exports for backward compatibility
  DependencyAnalyzer,
  createDependencyAnalyzer,
} from './dependency-orchestrator.js';

// MoveAnalysis Builder
export {
  MoveAnalysisBuilder,
  createMoveAnalysisBuilder,
} from './move-analysis-builder.js';

// Types
export {
  DependencyType,
  type Dependency,
  type MoveAnalysis,
  type AnalysisStats,
  type InternalDependency,
  type DependencyAnalysis,
  type UnanalyzableCode,
  type AnalyzabilityResult,
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
  DEFAULT_ANALYZER_OPTIONS,
  mergeAnalyzerOptions,
} from './types.js';
