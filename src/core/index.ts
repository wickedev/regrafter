/**
 * Core utilities
 *
 * Shared utilities used across multiple modules to eliminate functional duplication.
 */

export {
  IdentifierCollector,
  type IdentifierCollectorOptions,
  type IdentifierReference,
  type DetailedCollectionResult,
} from './identifier-collector.js';

export {
  ImportManager,
  type ImportDependency,
} from './import-manager.js';

export {
  isJSXNode,
  isAnyJSXNode,
  isJSXElement,
  isJSXFragment,
  isJSXExpressionContainer,
  isJSXText,
} from './ast-guards.js';
