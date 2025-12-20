/**
 * Utility functions and helpers
 */

export { Logger, createLogger, logger } from './logger.js';
export {
  loadTraverseFunction,
  loadGenerateFunction,
  type TraverseFunction,
  type GenerateFunction,
} from './babel-loader.js';

// AST Traversal Utilities
export {
  traverseIdentifierReferences,
  isDeclarationIdentifier,
  isPropertyKey,
  isJSXAttribute,
  isTypeAnnotation,
  type TraverseIdentifierOptions,
  type IdentifierCallback,
} from './ast-traversal.js';

// AST Helper Utilities
export {
  extractFunctionName,
  isReactHookName,
  isComponentName,
} from './ast-helpers.js';
