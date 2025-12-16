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
  const moduleRecord: Record<string, unknown> =
    traverseModule as Record<string, unknown>;

  if (isTraverseFunction(moduleRecord.default)) {
    return moduleRecord.default;
  }
  if (isTraverseFunction(traverseModule)) {
    return traverseModule as TraverseFunction;
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
  const moduleRecord: Record<string, unknown> =
    generateModule as Record<string, unknown>;

  if (isGenerateFunction(moduleRecord.default)) {
    return moduleRecord.default;
  }
  if (isGenerateFunction(generateModule)) {
    return generateModule as GenerateFunction;
  }
  throw new Error('@babel/generator module is not properly loaded');
}
