/**
 * Error Handling Module
 *
 * Exports all error-related types, classes, and utilities.
 */

// Error categories and base classes
export {
  ErrorCategory,
  RegraffErrorClass,
  ParseError,
  SelectorError,
  DependencyError,
  ValidationError,
  TransformError,
  CircularError,
  InternalError,
  // Error interface types (Task 9)
  type ParseErrorType,
  type SelectorErrorType,
  type DependencyErrorType,
  type ValidationErrorType,
  type TransformErrorType,
  type CircularErrorType,
  type InternalErrorType,
  // RegraffError union type (Task 9)
  type RegraffError,
  // Factory functions (Task 9)
  createParseError,
  createSelectorError,
  createDependencyError,
  createValidationError,
  createTransformError,
  createCircularError,
  createInternalError,
  // Type guards (Task 9)
  isRegraffError,
  isParseError,
  isSelectorError,
  isDependencyError,
  isValidationError,
  isTransformError,
  isCircularError,
  isInternalError,
} from './error-category.js';

// Error codes and factories
export {
  ERROR_CODES,
  type ErrorCodeDefinition,
  // Error factory functions
  createParseErrorWithCode,
  createSelectorErrorWithCode,
  createDependencyErrorWithCode,
  createValidationErrorWithCode,
  createCircularErrorWithCode,
  createTransformErrorWithCode,
  createInternalErrorWithCode,
  // Lookup functions
  getErrorCodeDefinition,
  getErrorCodesByCategory,
  isRecoverableErrorCode,
} from './error-codes.js';

// Suggested fixes
export {
  type FixAction,
  createSuggestedFix,
  getSuggestedFixesForParseError,
  getSuggestedFixesForSelectorError,
  getSuggestedFixesForDependencyError,
  getSuggestedFixesForValidationError,
  getSuggestedFixesForCircularError,
  getSuggestedFixesForTransformError,
  getSuggestedFixesForDependency,
  getSuggestedFixesForError,
} from './suggested-fixes.js';

// Error recovery
export {
  type RecoveryResult,
  type RecoveryStrategy,
  RECOVERY_STRATEGIES,
  isRecoverable,
  getRecoveryStrategy,
  attemptRecovery,
  getRecoverySuggestions,
  recoverFromCircularDependency,
  recoverFromHookValidationError,
  recoverFromMissingDependency,
  mergeRecoveryResults,
  failedRecovery,
  successfulRecovery,
} from './error-recovery.js';

// Error Builder (Phase 3.1: Error Handling Ergonomics)
export { ErrorBuilder, error } from './error-builder.js';
