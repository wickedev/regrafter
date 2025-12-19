/**
 * Extract Feature Module
 *
 * Task 1: 프로젝트 구조 및 타입 정의 설정
 * Exports all extract feature types and utilities
 */

// Types
export type {
  ExtractOptions,
  RangeSelector,
  ExtractResult,
  ExtractAnalysis,
  ComponentInfo,
  PropInfo,
  ExtractStats,
  ExtractPlan,
  ExtractDependencies,
  VariableDependency,
  FunctionDependency,
  StateDependency,
  HookDependency,
  ImportDependency,
  PropType,
  HookDeclaration,
  FormattingOptions,
} from './types.js';

// Errors
export {
  ExtractErrorCode,
  ERROR_MESSAGES,
  createExtractError,
  isExtractError,
} from './errors.js';

// Components
export type { INodeSelector } from './node-selector.js';
export { NodeSelector, createNodeSelector } from './node-selector.js';

// Public API
export { extract, canExtract, analyzeExtract } from './extract.js';

// Type Guards
export { isRangeSelector, isExtractSuccess } from './type-guards.js';
