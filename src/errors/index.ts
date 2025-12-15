/**
 * Error Handling Module
 *
 * Exports all error-related types, classes, and utilities.
 */

// Error categories and base classes
export {
  ErrorCategory,
  RegraffError,
  ParseError,
  SelectorError,
  DependencyError,
  ValidationError,
  TransformError,
  CircularError,
  InternalError,
  // Type guards
  isRegraffError,
  isParseError,
  isSelectorError,
  isDependencyError,
  isValidationError,
  isTransformError,
  isCircularError,
  isInternalError,
} from './ErrorCategory.js';

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
} from './ErrorCodes.js';

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
} from './SuggestedFixes.js';

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
} from './ErrorRecovery.js';
