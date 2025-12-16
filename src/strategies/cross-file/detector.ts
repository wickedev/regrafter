/**
 * Cross-File Detection Module
 *
 * Detects when moves are cross-file and analyzes dependency exports.
 * Implements tasks 4.1.1 and 4.1.2 from the task list.
 */

import type * as TraverseNS from '@babel/traverse';
import traverseModule from '@babel/traverse';
import type * as t from '@babel/types';

type NodePath<T = t.Node> = TraverseNS.NodePath<T>;

import { loadTraverseFunction } from '../../utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

import type {
  InternalDependency,
} from '../../types/internal.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Information about an export in a file.
 */
export interface ExportInfo {
  /** Name of the exported symbol */
  name: string;
  /** Local name (may differ from exported name) */
  localName: string;
  /** Type of export */
  type: 'named' | 'default' | 'namespace';
  /** Whether it's a re-export from another module */
  isReExport: boolean;
  /** Source module if it's a re-export */
  reExportSource?: string;
}

/**
 * Result of cross-file detection.
 */
export interface CrossFileDetectionResult {
  /** Whether this is a cross-file move */
  isCrossFile: boolean;
  /** Source file path */
  sourceFile: string;
  /** Target file path */
  targetFile: string;
}

/**
 * Result of dependency export analysis.
 */
export interface DependencyExportAnalysis {
  /** Dependencies that are already exported */
  exportedDeps: InternalDependency[];
  /** Dependencies that need to be exported */
  unexportedDeps: InternalDependency[];
  /** Dependencies used elsewhere in the source file */
  sharedDeps: InternalDependency[];
  /** All exports in the source file */
  existingExports: ExportInfo[];
}

/**
 * Information about where a dependency is used.
 */
export interface DependencyUsage {
  /** The dependency */
  dependency: InternalDependency;
  /** Files where this dependency is used */
  usedInFiles: string[];
  /** Whether it's used outside the element being moved */
  usedElsewhere: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-File Detection (4.1.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detects if a move operation is cross-file.
 *
 * @param fromFile - Source file path
 * @param toFile - Target file path
 * @returns Cross-file detection result
 */
export function detectCrossFileMove(
  fromFile: string,
  toFile: string
): CrossFileDetectionResult {
  // Normalize paths for comparison
  const normalizedFrom = normalizePath(fromFile);
  const normalizedTo = normalizePath(toFile);

  return {
    isCrossFile: normalizedFrom !== normalizedTo,
    sourceFile: normalizedFrom,
    targetFile: normalizedTo,
  };
}

/**
 * Normalizes a file path for comparison.
 */
function normalizePath(filePath: string): string {
  // Remove leading ./ if present
  let normalized = filePath.replace(/^\.\//, '');

  // Normalize path separators to forward slashes
  normalized = normalized.replace(/\\/g, '/');

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  return normalized;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export Analysis (4.1.2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyzes exports in an AST file.
 *
 * @param ast - The AST to analyze
 * @returns Array of export information
 */
export function analyzeExports(ast: t.File): ExportInfo[] {
  const exports: ExportInfo[] = [];

  traverse(ast, {
    // Named exports: export { foo, bar }
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      const node = path.node;

      // Handle export specifiers: export { foo, bar as baz }
      if (node.specifiers.length > 0) {
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ExportSpecifier') {
            const exportedNode = specifier.exported;
            let exported: string;
            if (exportedNode.type === 'Identifier') {
              exported = exportedNode.name;
            } else {
              exported = String(exportedNode.value);
            }

            // specifier.local is always an Identifier in ExportSpecifier
            const local: string = specifier.local.name;

            exports.push({
              name: exported,
              localName: local,
              type: 'named',
              isReExport: node.source !== undefined,
              reExportSource: node.source?.value,
            });
          }
        }
      }

      // Handle export declarations: export const foo = 1
      if (node.declaration) {
        const declaration = node.declaration;

        if (
          declaration.type === 'VariableDeclaration'
        ) {
          for (const declarator of declaration.declarations) {
            if (declarator.id.type === 'Identifier') {
              exports.push({
                name: declarator.id.name,
                localName: declarator.id.name,
                type: 'named',
                isReExport: false,
              });
            } else if (declarator.id.type === 'ObjectPattern') {
              // Handle destructuring: export const { a, b } = obj
              extractIdentifiersFromPattern(declarator.id, exports);
            }
          }
        } else if (
          declaration.type === 'FunctionDeclaration' ||
          declaration.type === 'ClassDeclaration'
        ) {
          if (declaration.id) {
            exports.push({
              name: declaration.id.name,
              localName: declaration.id.name,
              type: 'named',
              isReExport: false,
            });
          }
        }
      }
    },

    // Default export: export default foo
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      const node = path.node;
      let name = 'default';

      if (
        node.declaration.type === 'Identifier'
      ) {
        name = node.declaration.name;
      } else if (
        (node.declaration.type === 'FunctionDeclaration' ||
          node.declaration.type === 'ClassDeclaration') &&
        node.declaration.id
      ) {
        name = node.declaration.id.name;
      }

      exports.push({
        name: 'default',
        localName: name,
        type: 'default',
        isReExport: false,
      });
    },

    // Export all: export * from './module'
    ExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
      exports.push({
        name: '*',
        localName: '*',
        type: 'namespace',
        isReExport: true,
        reExportSource: path.node.source.value,
      });
    },
  });

  return exports;
}

/**
 * Extracts identifiers from a destructuring pattern.
 */
function extractIdentifiersFromPattern(
  pattern: t.ObjectPattern | t.ArrayPattern,
  exports: ExportInfo[]
): void {
  if (pattern.type === 'ObjectPattern') {
    for (const prop of pattern.properties) {
      if (prop.type === 'ObjectProperty') {
        if (prop.value.type === 'Identifier') {
          exports.push({
            name: prop.value.name,
            localName: prop.value.name,
            type: 'named',
            isReExport: false,
          });
        } else if (
          prop.value.type === 'ObjectPattern' ||
          prop.value.type === 'ArrayPattern'
        ) {
          extractIdentifiersFromPattern(prop.value, exports);
        }
      }
    }
  } else {
    // ArrayPattern
    for (const element of pattern.elements) {
      if (element?.type === 'Identifier') {
        exports.push({
          name: element.name,
          localName: element.name,
          type: 'named',
          isReExport: false,
        });
      } else if (
        element?.type === 'ObjectPattern' ||
        element?.type === 'ArrayPattern'
      ) {
        extractIdentifiersFromPattern(element, exports);
      }
    }
  }
}

/**
 * Analyzes which dependencies are exported and which need to be exported.
 *
 * @param ast - Source file AST
 * @param dependencies - Dependencies of the element being moved
 * @param sourceFile - Source file path
 * @returns Dependency export analysis result
 */
export function analyzeDependencyExports(
  ast: t.File,
  dependencies: InternalDependency[],
  sourceFile: string
): DependencyExportAnalysis {
  const existingExports = analyzeExports(ast);
  const exportedNames = new Set(existingExports.map((e) => e.localName));

  const exportedDeps: InternalDependency[] = [];
  const unexportedDeps: InternalDependency[] = [];

  // Categorize dependencies based on export status
  for (const dep of dependencies) {
    // Only consider dependencies from the source file
    if (normalizePath(dep.origin.file) !== normalizePath(sourceFile)) {
      continue;
    }

    if (exportedNames.has(dep.symbol)) {
      exportedDeps.push(dep);
    } else {
      unexportedDeps.push(dep);
    }
  }

  // Find shared dependencies (used elsewhere in the file)
  const sharedDeps = findSharedDependencies(ast, dependencies, sourceFile);

  return {
    exportedDeps,
    unexportedDeps,
    sharedDeps,
    existingExports,
  };
}

/**
 * Finds dependencies that are used elsewhere in the source file
 * (outside the element being moved).
 *
 * @param ast - Source file AST
 * @param dependencies - Dependencies of the element being moved
 * @param sourceFile - Source file path
 * @returns Dependencies that are used elsewhere
 */
export function findSharedDependencies(
  ast: t.File,
  dependencies: InternalDependency[],
  sourceFile: string
): InternalDependency[] {
  const depSymbols = new Set(dependencies.map((d) => d.symbol));
  const usageCount = new Map<string, number>();

  // Initialize counts
  for (const symbol of depSymbols) {
    usageCount.set(symbol, 0);
  }

  // Count all identifier usages
  traverse(ast, {
    Identifier(path: NodePath<t.Identifier>) {
      const name = path.node.name;
      if (depSymbols.has(name)) {
        // Check if this is a reference (not a declaration)
        if (isReference(path)) {
          usageCount.set(name, (usageCount.get(name) ?? 0) + 1);
        }
      }
    },
  });

  // Find dependencies with more than one usage (shared)
  const sharedDeps: InternalDependency[] = [];
  for (const dep of dependencies) {
    if (normalizePath(dep.origin.file) !== normalizePath(sourceFile)) {
      continue;
    }

    const count = usageCount.get(dep.symbol) ?? 0;
    // If used more than once, it's shared
    // (one usage is within the element being moved, others are elsewhere)
    if (count > 1) {
      sharedDeps.push(dep);
    }
  }

  return sharedDeps;
}

/**
 * Checks if an identifier path is a reference (not a declaration).
 */
function isReference(path: NodePath<t.Identifier>): boolean {
  const parent = path.parent;

  // Not a reference if it's a variable declarator id
  if (
    parent.type === 'VariableDeclarator' &&
    (parent).id === path.node
  ) {
    return false;
  }

  // Not a reference if it's a function/class declaration id
  if (
    (parent.type === 'FunctionDeclaration' ||
      parent.type === 'ClassDeclaration') &&
    (parent).id === path.node
  ) {
    return false;
  }

  // Not a reference if it's a function parameter
  if (parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' || parent.type === 'ArrowFunctionExpression') {
    if (parent.params.includes(path.node)) {
      return false;
    }
  }

  // Not a reference if it's an import specifier
  if (
    parent.type === 'ImportSpecifier' ||
    parent.type === 'ImportDefaultSpecifier' ||
    parent.type === 'ImportNamespaceSpecifier'
  ) {
    return false;
  }

  // Not a reference if it's an export specifier local name
  if (parent.type === 'ExportSpecifier' && parent.local === path.node) {
    return false;
  }

  // Not a reference if it's an object property key (non-computed)
  if (parent.type === 'ObjectProperty' && parent.key === path.node && !parent.computed) {
    return false;
  }

  // Not a reference if it's a member expression property (non-computed)
  if (parent.type === 'MemberExpression' && parent.property === path.node && !parent.computed) {
    return false;
  }

  return true;
}

/**
 * Checks if a dependency needs to be in a shared module.
 * A dependency needs a shared module if:
 * 1. It's not exported from the source file
 * 2. It's used in the source file outside the element being moved
 *
 * @param dep - The dependency to check
 * @param analysis - The export analysis result
 * @returns Whether the dependency needs a shared module
 */
export function needsSharedModule(
  dep: InternalDependency,
  analysis: DependencyExportAnalysis
): boolean {
  const isUnexported = analysis.unexportedDeps.some(
    (d) => d.id === dep.id
  );
  const isShared = analysis.sharedDeps.some((d) => d.id === dep.id);

  return isUnexported && isShared;
}

/**
 * Computes the import path from one file to another.
 *
 * @param fromFile - The file that will contain the import
 * @param toFile - The file being imported
 * @returns Relative import path
 */
export function computeImportPath(fromFile: string, toFile: string): string {
  const fromParts = normalizePath(fromFile).split('/');
  const toParts = normalizePath(toFile).split('/');

  // Remove file names
  fromParts.pop();
  const toFileName = toParts.pop() ?? '';

  // Remove extension from target file
  const toFileBase = toFileName.replace(/\.(tsx?|jsx?|mjs)$/, '');

  // Find common prefix length
  let commonLength = 0;
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const downPath = toParts.slice(commonLength);

  let relativePath: string;
  if (upCount === 0 && downPath.length === 0) {
    relativePath = './' + toFileBase;
  } else if (upCount === 0) {
    relativePath = './' + [...downPath, toFileBase].join('/');
  } else {
    const upParts: string[] = [];
    for (let i = 0; i < upCount; i++) {
      upParts.push('..');
    }
    relativePath = [...upParts, ...downPath, toFileBase].join('/');
  }

  return relativePath;
}
