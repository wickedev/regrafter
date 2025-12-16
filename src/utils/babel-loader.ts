/**
 * Babel Module Loader Utilities
 *
 * Provides helper functions to load Babel modules with ESM/CJS compatibility.
 * Handles both @babel/traverse and @babel/generator modules.
 */

import type * as t from '@babel/types';

/**
 * Type for traverse function
 */
export type TraverseFunction = (ast: t.Node, visitor: object) => void;

/**
 * Type for generator function
 */
export type GenerateFunction = (
  ast: t.Node,
  options?: object
) => { code: string; map?: object };

/**
 * Type guard for module with default export
 */
interface ModuleWithDefault {
  default: unknown;
}

function hasDefaultExport(value: unknown): value is ModuleWithDefault {
  return (
    typeof value === 'object' &&
    value !== null &&
    'default' in value
  );
}

/**
 * Type guard for traverse function
 */
function isTraverseFunction(value: unknown): value is TraverseFunction {
  return typeof value === 'function';
}

/**
 * Type guard for generator function
 */
function isGenerateFunction(value: unknown): value is GenerateFunction {
  return typeof value === 'function';
}

/**
 * Loads the traverse function from @babel/traverse module.
 * Handles both ESM (default export) and CJS exports.
 *
 * @param traverseModule - The imported @babel/traverse module
 * @returns The traverse function
 * @throws Error if the module is not properly loaded
 */
export function loadTraverseFunction(traverseModule: unknown): TraverseFunction {
  // Type narrowing: first check if it's an object with a 'default' property
  if (hasDefaultExport(traverseModule)) {
    if (isTraverseFunction(traverseModule.default)) {
      return traverseModule.default;
    }
  }

  // Check if the module itself is a function (CJS export)
  if (isTraverseFunction(traverseModule)) {
    return traverseModule;
  }

  throw new Error('@babel/traverse module is not properly loaded');
}

/**
 * Loads the generate function from @babel/generator module.
 * Handles both ESM (default export) and CJS exports.
 *
 * @param generateModule - The imported @babel/generator module
 * @returns The generate function
 * @throws Error if the module is not properly loaded
 */
export function loadGenerateFunction(generateModule: unknown): GenerateFunction {
  // Type narrowing: first check if it's an object with a 'default' property
  if (hasDefaultExport(generateModule)) {
    if (isGenerateFunction(generateModule.default)) {
      return generateModule.default;
    }
  }

  // Check if the module itself is a function (CJS export)
  if (isGenerateFunction(generateModule)) {
    return generateModule;
  }

  throw new Error('@babel/generator module is not properly loaded');
}
