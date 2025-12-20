/**
 * Dependency Handlers
 *
 * This module exports all dependency handlers and the registry for managing them.
 */

export type { IDependencyHandler } from './dependency-handler.js';
export { HookDependencyHandler } from './hook-dependency-handler.js';
export { VariableDependencyHandler } from './variable-dependency-handler.js';
export { PropDependencyHandler } from './prop-dependency-handler.js';
export { ImportDependencyHandler } from './import-dependency-handler.js';
export {
  DependencyHandlerRegistry,
  createDependencyHandlerRegistry,
} from './dependency-handler-registry.js';
export { getDependencyName, registerDependencyNameExtractor } from './dependency-name-helper.js';
