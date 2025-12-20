/**
 * Interfaces Module
 *
 * This module contains interfaces for all major components in the regrafter library.
 * These interfaces define contracts for dependency injection and testing.
 *
 * Phase 2 of SOLID refactoring: Interface definition
 * See docs/remaining-tasks.md for details.
 *
 * @module interfaces
 */

// Export dependency analysis interfaces
export type { IDependencyAnalyzer } from './IDependencyAnalyzer.js';

// Export scope management interfaces (legacy, deprecated)
export type { IScopeManager } from './IScopeManager.js';

// Export focused scope interfaces (ISP-compliant)
export type {
  IScopeTreeBuilder,
  IScopeQuery,
  IScopeAccessibility,
  IBindingQuery,
  IComponentInfo,
} from './scope-interfaces.js';

// Export code generation interfaces
export type { ICodeGenerator } from './ICodeGenerator.js';

// Export transformation interfaces
export type { IJSXTransformer } from './IJSXTransformer.js';

// Export hoisting interfaces
export type { IHoistPlanner } from './IHoistPlanner.js';
export type { IHoistExecutor } from './IHoistExecutor.js';

// Export selector interfaces
export type { ISelectorResolver } from './ISelectorResolver.js';

// Export parser interfaces
export type { IParser } from './IParser.js';
