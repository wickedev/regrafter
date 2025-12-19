/**
 * Import Utility Functions
 *
 * Helper functions for import management that complement the core ImportManager.
 * These are kept in the strategies module as they are specific to the hoisting strategies.
 */

import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import { loadTraverseFunction } from '../utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

/**
 * Check if an import source is a relative path
 */
export function isRelativeImport(source: string): boolean {
  return source.startsWith('.') || source.startsWith('/');
}

/**
 * Check if an import source is a node module
 */
export function isNodeModule(source: string): boolean {
  return !isRelativeImport(source);
}

/**
 * Sort import declarations by convention
 * Order: node_modules first (alphabetically), then relative (alphabetically)
 */
export function sortImports(imports: t.ImportDeclaration[]): t.ImportDeclaration[] {
  return [...imports].sort((a, b) => {
    const aIsRelative = isRelativeImport(a.source.value);
    const bIsRelative = isRelativeImport(b.source.value);

    if (aIsRelative !== bIsRelative) {
      return aIsRelative ? 1 : -1;
    }

    return a.source.value.localeCompare(b.source.value);
  });
}

/**
 * Remove unused imports from an AST
 */
export function removeUnusedImports(
  ast: t.File,
  usedIdentifiers: Set<string>
): void {
  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const unusedSpecifiers: number[] = [];

      path.node.specifiers.forEach((spec, index) => {
        if (!usedIdentifiers.has(spec.local.name)) {
          unusedSpecifiers.push(index);
        }
      });

      // Remove unused specifiers (reverse order to maintain indices)
      for (let i = unusedSpecifiers.length - 1; i >= 0; i--) {
        const index = unusedSpecifiers[i];
        if (index !== undefined) {
          path.node.specifiers.splice(index, 1);
        }
      }

      // Remove entire declaration if no specifiers left
      if (path.node.specifiers.length === 0) {
        path.remove();
      }
    },
  });
}
