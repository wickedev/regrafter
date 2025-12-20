/**
 * Dependency Handler Registry
 *
 * This module provides a registry for dependency handlers following the Strategy Pattern.
 * It allows handlers to be registered and retrieved by dependency type, eliminating
 * the need for switch statements throughout the codebase.
 *
 * This follows the Open/Closed Principle: new dependency types can be added by
 * registering new handlers without modifying this registry or existing code.
 */

import type { DependencyType } from '../../types/public.js';
import type { IDependencyHandler } from './dependency-handler.js';

/**
 * Registry for dependency type handlers.
 *
 * This class maintains a map of dependency types to their handlers and provides
 * methods to register and retrieve handlers.
 *
 * Usage:
 * ```typescript
 * const registry = new DependencyHandlerRegistry();
 * registry.register(new HookDependencyHandler(validator, selector));
 * registry.register(new VariableDependencyHandler(selector));
 *
 * const handler = registry.getHandler(DependencyType.Hook);
 * if (handler) {
 *   const plan = handler.plan(dependency, context);
 * }
 * ```
 */
export class DependencyHandlerRegistry {
  private handlers = new Map<DependencyType, IDependencyHandler>();

  /**
   * Register a handler for a specific dependency type.
   *
   * If a handler for this type already exists, it will be replaced.
   *
   * @param handler - The handler to register
   */
  register(handler: IDependencyHandler): void {
    const type = handler.getName();
    this.handlers.set(type, handler);
  }

  /**
   * Get a handler for a specific dependency type.
   *
   * @param type - The dependency type to get a handler for
   * @returns The handler if registered, null otherwise
   */
  getHandler(type: DependencyType): IDependencyHandler | null {
    return this.handlers.get(type) ?? null;
  }

  /**
   * Get all registered handlers.
   *
   * @returns Array of all registered handlers
   */
  getAllHandlers(): IDependencyHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Check if a handler is registered for a specific dependency type.
   *
   * @param type - The dependency type to check
   * @returns True if a handler is registered, false otherwise
   */
  hasHandler(type: DependencyType): boolean {
    return this.handlers.has(type);
  }

  /**
   * Unregister a handler for a specific dependency type.
   *
   * @param type - The dependency type to unregister
   * @returns True if a handler was unregistered, false if no handler was registered
   */
  unregister(type: DependencyType): boolean {
    return this.handlers.delete(type);
  }

  /**
   * Clear all registered handlers.
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get the number of registered handlers.
   *
   * @returns The count of registered handlers
   */
  get size(): number {
    return this.handlers.size;
  }
}

/**
 * Create a new DependencyHandlerRegistry instance with all standard handlers registered.
 *
 * This factory function provides a convenient way to create a fully configured registry.
 *
 * @param handlers - Array of handlers to register
 * @returns A configured registry instance
 */
export function createDependencyHandlerRegistry(
  handlers: IDependencyHandler[]
): DependencyHandlerRegistry {
  const registry = new DependencyHandlerRegistry();

  for (const handler of handlers) {
    registry.register(handler);
  }

  return registry;
}
