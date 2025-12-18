/**
 * Circular Dependency Prevention Module
 *
 * Detects and resolves circular dependencies in import graphs.
 * Implements tasks 4.3.1 and 4.3.2 from the task list.
 */

import type * as TraverseNS from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import {
  createSharedModuleOperation,
  createExportDeclaration,
} from '../../types/factories.js';
import type {
  SharedModuleOperation,
} from '../../types/internal.js';
import { loadTraverseFunction } from '../../utils/index.js';

type NodePath<T = t.Node> = TraverseNS.NodePath<T>;

const traverse = loadTraverseFunction(traverseModule);

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Represents an edge in the import graph.
 */
export interface ImportEdge {
  /** Source file (the importer) */
  from: string;
  /** Target file (the importee) */
  to: string;
  /** Imported symbols */
  symbols: string[];
}

/**
 * Import graph for tracking file dependencies.
 */
export interface ImportGraph {
  /** All files in the graph */
  files: Set<string>;
  /** Forward edges: file -> files it imports */
  imports: Map<string, Set<string>>;
  /** Reverse edges: file -> files that import it */
  importedBy: Map<string, Set<string>>;
  /** Detailed edge information */
  edges: ImportEdge[];
}

/**
 * Result of circular dependency detection.
 */
export interface CircularDependencyResult {
  /** Whether circular dependencies exist */
  hasCircular: boolean;
  /** All cycles found (each cycle is a path of files) */
  cycles: string[][];
  /** The shortest cycle (if any) */
  shortestCycle: string[] | null;
}

/**
 * Resolution strategy for breaking a cycle.
 */
export interface CycleResolution {
  /** Type of resolution */
  type: 'extract_shared' | 'restructure_imports' | 'inline';
  /** Files involved in the resolution */
  files: string[];
  /** Symbols to extract to break the cycle */
  symbolsToExtract: string[];
  /** New shared module path (if type is 'extract_shared') */
  sharedModulePath?: string;
  /** Operations to perform */
  operations: SharedModuleOperation[];
}

/**
 * Result of circular dependency resolution.
 */
export interface CircularResolutionResult {
  /** Whether resolution was successful */
  success: boolean;
  /** Resolutions applied */
  resolutions: CycleResolution[];
  /** Updated import graph */
  updatedGraph: ImportGraph;
  /** Error message if resolution failed */
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Import Graph Construction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates an empty import graph.
 */
export function createImportGraph(): ImportGraph {
  return {
    files: new Set(),
    imports: new Map(),
    importedBy: new Map(),
    edges: [],
  };
}

/**
 * Adds a file to the import graph.
 */
export function addFileToGraph(graph: ImportGraph, file: string): void {
  const normalized = normalizePath(file);
  graph.files.add(normalized);
  if (!graph.imports.has(normalized)) {
    graph.imports.set(normalized, new Set());
  }
  if (!graph.importedBy.has(normalized)) {
    graph.importedBy.set(normalized, new Set());
  }
}

/**
 * Adds an import edge to the graph.
 */
export function addImportEdge(
  graph: ImportGraph,
  from: string,
  to: string,
  symbols: string[]
): void {
  const normalizedFrom = normalizePath(from);
  const normalizedTo = normalizePath(to);

  // Ensure both files are in the graph
  addFileToGraph(graph, normalizedFrom);
  addFileToGraph(graph, normalizedTo);

  // Add edges - guaranteed to exist after addFileToGraph
  const fromImports = getGraphSet(graph.imports, normalizedFrom);
  const toImportedBy = getGraphSet(graph.importedBy, normalizedTo);

  fromImports.add(normalizedTo);
  toImportedBy.add(normalizedFrom);

  // Add detailed edge
  graph.edges.push({
    from: normalizedFrom,
    to: normalizedTo,
    symbols,
  });
}

/**
 * Builds an import graph from a collection of ASTs.
 *
 * @param files - Map of file path to AST
 * @returns Import graph
 */
export function buildImportGraph(files: Map<string, t.File>): ImportGraph {
  const graph = createImportGraph();

  for (const [filePath, ast] of files) {
    addFileToGraph(graph, filePath);
    const imports = extractImports(ast);

    for (const imp of imports) {
      // Only add internal imports (relative paths)
      if (imp.source.startsWith('.')) {
        const resolvedPath = resolveImportPath(filePath, imp.source);
        addImportEdge(graph, filePath, resolvedPath, imp.symbols);
      }
    }
  }

  return graph;
}

/**
 * Extracts import information from an AST.
 */
function extractImports(
  ast: t.File
): Array<{ source: string; symbols: string[] }> {
  const imports: Array<{ source: string; symbols: string[] }> = [];

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const source = path.node.source.value;
      const symbols: string[] = [];

      for (const spec of path.node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          symbols.push(spec.local.name);
        } else if (spec.type === 'ImportDefaultSpecifier') {
          symbols.push('default');
        } else {
          // ImportNamespaceSpecifier
          symbols.push('*');
        }
      }

      imports.push({ source, symbols });
    },
  });

  return imports;
}

/**
 * Resolves an import path relative to a file.
 */
function resolveImportPath(fromFile: string, importPath: string): string {
  const fromDir = fromFile.split('/').slice(0, -1).join('/');
  const parts = importPath.split('/');
  const resultParts = fromDir.split('/').filter((p) => p.length > 0);

  for (const part of parts) {
    if (part === '.') {
      continue;
    } else if (part === '..') {
      resultParts.pop();
    } else {
      resultParts.push(part);
    }
  }

  // Add .ts extension if not present (simplified resolution)
  let result = resultParts.join('/');
  const hasExtension = /\.(tsx?|jsx?|mjs)$/.test(result);
  if (!hasExtension) {
    result += '.ts';
  }

  return result;
}

/**
 * Normalizes a file path.
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/^\.\//, '').replace(/\\/g, '/');
}

/**
 * Helper to get a Set from a Map, guaranteed to exist after addFileToGraph.
 * Returns empty Set if key doesn't exist (defensive programming).
 */
function getGraphSet(map: Map<string, Set<string>>, key: string): Set<string> {
  const value = map.get(key);
  if (value === undefined) {
    // Key should exist after addFileToGraph, but return empty Set defensively
    return new Set<string>();
  }
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Circular Dependency Detection (4.3.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detects circular dependencies in an import graph.
 *
 * @param graph - The import graph to analyze
 * @returns Detection result with all cycles found
 */
export function detectCircularDependencies(
  graph: ImportGraph
): CircularDependencyResult {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  // DFS to find cycles
  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.imports.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = [...path.slice(cycleStart), neighbor];
        cycles.push(cycle);
      }
    }

    recursionStack.delete(node);
  }

  // Run DFS from each unvisited node
  for (const file of graph.files) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }

  // Find the shortest cycle
  let shortestCycle: string[] | null = null;
  for (const cycle of cycles) {
    if (!shortestCycle || cycle.length < shortestCycle.length) {
      shortestCycle = cycle;
    }
  }

  return {
    hasCircular: cycles.length > 0,
    cycles,
    shortestCycle,
  };
}

/**
 * Checks if adding a new import would create a circular dependency.
 *
 * @param graph - The current import graph
 * @param from - The file that would contain the import
 * @param to - The file being imported
 * @returns True if adding this import would create a cycle
 */
export function wouldCreateCycle(
  graph: ImportGraph,
  from: string,
  to: string
): boolean {
  const normalizedFrom = normalizePath(from);
  const normalizedTo = normalizePath(to);

  // Check if 'to' can reach 'from' (which would create a cycle)
  const visited = new Set<string>();
  const queue = [normalizedTo];

  const MAX_ITERATIONS = 10000; // Prevent infinite loops in very large graphs
  let iterations = 0;

  while (queue.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    if (current === normalizedFrom) {
      return true;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const neighbors = graph.imports.get(current) ?? new Set();
    for (const neighbor of neighbors) {
      queue.push(neighbor);
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    // If we hit the limit, assume no cycle found (or graph is too large)
    // This is a safety measure - in practice, most graphs are much smaller
    return false;
  }

  return false;
}

/**
 * Finds the files involved in a cycle with the given file.
 *
 * @param graph - The import graph
 * @param file - The file to check
 * @returns Files in cycles involving this file, or empty if no cycles
 */
export function findCyclesInvolving(
  graph: ImportGraph,
  file: string
): string[][] {
  const result = detectCircularDependencies(graph);
  const normalizedFile = normalizePath(file);

  return result.cycles.filter((cycle) => cycle.includes(normalizedFile));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Circular Dependency Resolution (4.3.2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolves circular dependencies by extracting shared code.
 *
 * @param graph - The import graph with cycles
 * @param asts - Map of file path to AST
 * @returns Resolution result
 */
export function resolveCircularDependencies(
  graph: ImportGraph,
  asts: Map<string, t.File>
): CircularResolutionResult {
  const detection = detectCircularDependencies(graph);

  if (!detection.hasCircular) {
    return {
      success: true,
      resolutions: [],
      updatedGraph: graph,
    };
  }

  const resolutions: CycleResolution[] = [];
  const updatedGraph = cloneImportGraph(graph);

  // Process each cycle
  for (const cycle of detection.cycles) {
    const resolution = resolveSingleCycle(cycle, updatedGraph, asts);
    if (resolution) {
      resolutions.push(resolution);
      applyResolution(updatedGraph, resolution);
    }
  }

  // Verify no remaining cycles
  const verification = detectCircularDependencies(updatedGraph);
  if (verification.hasCircular) {
    return {
      success: false,
      resolutions,
      updatedGraph,
      error: `Unable to resolve all circular dependencies. Remaining cycles: ${verification.cycles.length}`,
    };
  }

  return {
    success: true,
    resolutions,
    updatedGraph,
  };
}

/**
 * Resolves a single cycle.
 */
function resolveSingleCycle(
  cycle: string[],
  graph: ImportGraph,
  _asts: Map<string, t.File>
): CycleResolution | null {
  // Find the edge to break (prefer edges with fewer symbols)
  const edgesToBreak = findEdgesToBreak(cycle, graph);

  if (edgesToBreak.length === 0) {
    return null;
  }

  // Choose the best edge to break
  const edgeToBreak = edgesToBreak[0];

  if (edgeToBreak === undefined) {
    return null;
  }

  // Get symbols that need to be extracted
  const symbolsToExtract = edgeToBreak.symbols;

  // Generate shared module path
  const sharedModulePath = generateSharedModulePathForCycle(cycle);

  // Create the resolution
  return {
    type: 'extract_shared',
    files: [edgeToBreak.from, edgeToBreak.to],
    symbolsToExtract,
    sharedModulePath,
    operations: [
      createSharedModuleOperation({
        newFilePath: sharedModulePath,
        exports: symbolsToExtract.map((symbol) =>
          createExportDeclaration({
            name: symbol,
            type: 'named',
            node: t.identifier(symbol), // Placeholder - actual node would come from AST
          })
        ),
        importers: [edgeToBreak.from, edgeToBreak.to],
      }),
    ],
  };
}

/**
 * Finds edges that could be broken to resolve a cycle.
 */
function findEdgesToBreak(cycle: string[], graph: ImportGraph): ImportEdge[] {
  const edgesInCycle: ImportEdge[] = [];

  for (let i = 0; i < cycle.length - 1; i++) {
    const from = cycle[i];
    const to = cycle[i + 1];

    const edge = graph.edges.find((e) => e.from === from && e.to === to);
    if (edge) {
      edgesInCycle.push(edge);
    }
  }

  // Sort by number of symbols (prefer breaking edges with fewer symbols)
  return edgesInCycle.sort((a, b) => a.symbols.length - b.symbols.length);
}

/**
 * Generates a shared module path for a cycle.
 */
function generateSharedModulePathForCycle(cycle: string[]): string {
  // Get the common directory
  const dirs = cycle.map((f) => f.split('/').slice(0, -1).join('/'));
  const commonDir = findCommonPrefix(dirs);

  // Generate a name based on the cycle
  const fileNames = cycle.slice(0, -1).map((f) => {
    const fileParts = f.split('/');
    const fileName = fileParts[fileParts.length - 1];
    const name = fileName !== undefined ? fileName.replace(/\.[^.]+$/, '') : 'module';
    return name;
  });

  const sharedName = `${fileNames.join('-')}.shared.ts`;

  const hasCommonDir = commonDir.length > 0;
  return hasCommonDir ? `${commonDir}/${sharedName}` : sharedName;
}

/**
 * Finds the common prefix of an array of paths.
 */
function findCommonPrefix(paths: string[]): string {
  if (paths.length === 0) {
    return '';
  }

  const firstPath = paths[0];
  if (paths.length === 1) {
    return firstPath ?? '';
  }

  const parts = paths.map((p) => p.split('/'));
  const minLength = Math.min(...parts.map((p) => p.length));

  const commonParts: string[] = [];
  const firstParts = parts[0];
  if (firstParts === undefined) {
    return '';
  }

  for (let i = 0; i < minLength; i++) {
    const segment = firstParts[i];
    if (segment !== undefined && segment.length > 0 && parts.every((p) => p[i] === segment)) {
      commonParts.push(segment);
    } else {
      break;
    }
  }

  return commonParts.join('/');
}

/**
 * Applies a resolution to the import graph.
 */
function applyResolution(graph: ImportGraph, resolution: CycleResolution): void {
  const sharedPath = resolution.sharedModulePath;
  if (resolution.type !== 'extract_shared' || sharedPath === undefined || sharedPath.length === 0) {
    return;
  }

  // Add the shared module to the graph
  addFileToGraph(graph, sharedPath);

  // Update edges: remove direct import, add imports to shared module
  for (const file of resolution.files) {
    // Remove the edge being broken
    const otherFile = resolution.files.find((f) => f !== file);
    if (otherFile !== undefined && otherFile.length > 0) {
      const imports = graph.imports.get(file);
      if (imports) {
        imports.delete(otherFile);
      }
      const importedBy = graph.importedBy.get(otherFile);
      if (importedBy) {
        importedBy.delete(file);
      }
    }

    // Add edge to shared module
    addImportEdge(graph, file, sharedPath, resolution.symbolsToExtract);
  }

  // Remove the broken edge from detailed edges
  graph.edges = graph.edges.filter((edge) => {
    const isInvolved =
      resolution.files.includes(edge.from) &&
      resolution.files.includes(edge.to);
    return !isInvolved;
  });
}

/**
 * Clones an import graph.
 */
function cloneImportGraph(graph: ImportGraph): ImportGraph {
  return {
    files: new Set(graph.files),
    imports: new Map(
      Array.from(graph.imports.entries()).map(([k, v]) => [k, new Set(v)])
    ),
    importedBy: new Map(
      Array.from(graph.importedBy.entries()).map(([k, v]) => [k, new Set(v)])
    ),
    edges: [...graph.edges],
  };
}

/**
 * Validates that adding imports won't create circular dependencies.
 *
 * @param currentGraph - The current import graph
 * @param newImports - Proposed new imports (from -> to)
 * @returns Validation result
 */
export function validateImportsWontCycle(
  currentGraph: ImportGraph,
  newImports: Array<{ from: string; to: string }>
): { valid: boolean; wouldCreateCycles: Array<{ from: string; to: string }> } {
  const wouldCreateCycles: Array<{ from: string; to: string }> = [];

  // Clone the graph for testing
  const testGraph = cloneImportGraph(currentGraph);

  for (const { from, to } of newImports) {
    if (wouldCreateCycle(testGraph, from, to)) {
      wouldCreateCycles.push({ from, to });
    } else {
      // Add to test graph for subsequent checks
      addImportEdge(testGraph, from, to, []);
    }
  }

  return {
    valid: wouldCreateCycles.length === 0,
    wouldCreateCycles,
  };
}
