/**
 * Dependency Name Helper
 *
 * Provides a registry-based approach to getting dependency names,
 * eliminating the need for switch statements.
 */

import type { DependencyType } from '../../types/public.js';
import type { SpecificDependency } from '../../analyzer/types.js';

/**
 * Map of dependency types to their name extraction functions.
 *
 * This eliminates the need for switch statements when getting dependency names.
 */
const DEPENDENCY_NAME_EXTRACTORS: Record<
  string,
  (dep: any) => string
> = {
  Hook: (dep) => dep.hookName,
  Import: (dep) => dep.localName,
  Variable: (dep) => dep.name,
  Prop: (dep) => dep.propName,
  Context: (dep) => dep.contextName ?? dep.name,
  Ref: (dep) => dep.refName ?? dep.name,
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

  if (!extractor) {
    // Fallback for unknown dependency types
    return (dep as any).name ?? (dep as any).symbol ?? 'unknown';
  }

  return extractor(dep);
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
  extractor: (dep: any) => string
): void {
  DEPENDENCY_NAME_EXTRACTORS[type] = extractor;
}
