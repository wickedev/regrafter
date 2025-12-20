/**
 * Dependency Name Helper
 *
 * Provides a registry-based approach to getting dependency names,
 * eliminating the need for switch statements.
 */

import type { SpecificDependency } from '../../analyzer/types.js';
import type { DependencyType } from '../../types/public.js';

/**
 * Type for dependency name extractor functions.
 */
type DependencyExtractor = (dep: SpecificDependency) => string;

/**
 * Map of dependency types to their name extraction functions.
 *
 * This eliminates the need for switch statements when getting dependency names.
 * Uses type guards with the `in` operator to safely narrow dependency types.
 * Marked as Partial to support runtime extensibility via registerDependencyNameExtractor.
 */
const DEPENDENCY_NAME_EXTRACTORS: Partial<
  Record<DependencyType, DependencyExtractor>
> = {
  Hook: (dep) => ('hookName' in dep ? dep.hookName : 'unknown'),
  Import: (dep) => ('localName' in dep ? dep.localName : 'unknown'),
  Variable: (dep) => ('name' in dep ? dep.name : 'unknown'),
  Prop: (dep) => ('name' in dep ? dep.name : 'unknown'),
  Context: (dep) => ('contextName' in dep ? dep.contextName : 'unknown'),
  Ref: (dep) => ('name' in dep ? dep.name : 'unknown'),
};

/**
 * Get the name from a dependency without using switch statements.
 *
 * This function uses a registry-based approach following the Open/Closed Principle.
 * New dependency types can be added to the extractors map without modifying this function.
 *
 * @param dep - The dependency to extract the name from
 * @returns The dependency name
 */
export function getDependencyName(dep: SpecificDependency): string {
  const extractor = DEPENDENCY_NAME_EXTRACTORS[dep.type];

  if (extractor) {
    return extractor(dep);
  }

  // Fallback for unknown dependency types using type narrowing
  if ('name' in dep && typeof dep.name === 'string') {
    return dep.name;
  }
  return 'unknown';
}

/**
 * Register a custom name extractor for a dependency type.
 *
 * This allows extending the system with new dependency types without modifying existing code.
 *
 * @param type - The dependency type
 * @param extractor - Function to extract the name from a dependency of this type
 */
export function registerDependencyNameExtractor(
  type: DependencyType,
  extractor: DependencyExtractor
): void {
  DEPENDENCY_NAME_EXTRACTORS[type] = extractor;
}
