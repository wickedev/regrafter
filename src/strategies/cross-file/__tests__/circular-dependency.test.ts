/**
 * Unit tests for Circular Dependency Module
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';

import {
  createImportGraph,
  addFileToGraph,
  addImportEdge,
  buildImportGraph,
  detectCircularDependencies,
  wouldCreateCycle,
  findCyclesInvolving,
  resolveCircularDependencies,
  validateImportsWontCycle,
} from '../circular-dependency.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Utilities
// ═══════════════════════════════════════════════════════════════════════════════

function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Import Graph Construction Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('createImportGraph', () => {
  it('should create an empty graph', () => {
    const graph = createImportGraph();

    expect(graph.files.size).toBe(0);
    expect(graph.imports.size).toBe(0);
    expect(graph.importedBy.size).toBe(0);
    expect(graph.edges).toHaveLength(0);
  });
});

describe('addFileToGraph', () => {
  it('should add a file to the graph', () => {
    const graph = createImportGraph();
    addFileToGraph(graph, 'src/A.ts');

    expect(graph.files.has('src/A.ts')).toBe(true);
    expect(graph.imports.has('src/A.ts')).toBe(true);
    expect(graph.importedBy.has('src/A.ts')).toBe(true);
  });

  it('should normalize file paths', () => {
    const graph = createImportGraph();
    addFileToGraph(graph, './src/A.ts');

    expect(graph.files.has('src/A.ts')).toBe(true);
  });

  it('should not duplicate files', () => {
    const graph = createImportGraph();
    addFileToGraph(graph, 'src/A.ts');
    addFileToGraph(graph, 'src/A.ts');

    expect(graph.files.size).toBe(1);
  });
});

describe('addImportEdge', () => {
  it('should add import edge between files', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'src/A.ts', 'src/B.ts', ['foo', 'bar']);

    expect(graph.imports.get('src/A.ts')?.has('src/B.ts')).toBe(true);
    expect(graph.importedBy.get('src/B.ts')?.has('src/A.ts')).toBe(true);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.symbols).toEqual(['foo', 'bar']);
  });

  it('should automatically add files when adding edges', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'src/A.ts', 'src/B.ts', []);

    expect(graph.files.has('src/A.ts')).toBe(true);
    expect(graph.files.has('src/B.ts')).toBe(true);
  });
});

describe('buildImportGraph', () => {
  it('should build graph from ASTs', () => {
    const files = new Map<string, t.File>([
      ['src/A.ts', parseCode(`import { foo } from './B';`)],
      ['src/B.ts', parseCode(`export const foo = 1;`)],
    ]);

    const graph = buildImportGraph(files);

    expect(graph.files.size).toBe(2);
    expect(graph.imports.get('src/A.ts')?.has('src/B.ts')).toBe(true);
  });

  it('should ignore external imports', () => {
    const files = new Map<string, t.File>([
      ['src/A.ts', parseCode(`import React from 'react';`)],
    ]);

    const graph = buildImportGraph(files);

    // Only src/A.ts should be in the graph, not 'react'
    expect(graph.files.size).toBe(1);
    expect(graph.imports.get('src/A.ts')?.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Circular Dependency Detection Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectCircularDependencies', () => {
  it('should detect simple A -> B -> A cycle', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'A.ts', []);

    const result = detectCircularDependencies(graph);

    expect(result.hasCircular).toBe(true);
    expect(result.cycles.length).toBeGreaterThan(0);
  });

  it('should detect A -> B -> C -> A cycle', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'C.ts', []);
    addImportEdge(graph, 'C.ts', 'A.ts', []);

    const result = detectCircularDependencies(graph);

    expect(result.hasCircular).toBe(true);
    expect(result.shortestCycle).not.toBeNull();
    expect(result.shortestCycle!.length).toBeGreaterThanOrEqual(3);
  });

  it('should not detect cycle in acyclic graph', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'C.ts', []);
    addImportEdge(graph, 'A.ts', 'C.ts', []);

    const result = detectCircularDependencies(graph);

    expect(result.hasCircular).toBe(false);
    expect(result.cycles).toHaveLength(0);
  });

  it('should detect multiple cycles', () => {
    const graph = createImportGraph();
    // Cycle 1: A -> B -> A
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'A.ts', []);
    // Cycle 2: C -> D -> C
    addImportEdge(graph, 'C.ts', 'D.ts', []);
    addImportEdge(graph, 'D.ts', 'C.ts', []);

    const result = detectCircularDependencies(graph);

    expect(result.hasCircular).toBe(true);
    expect(result.cycles.length).toBeGreaterThanOrEqual(2);
  });

  it('should find shortest cycle', () => {
    const graph = createImportGraph();
    // Short cycle: A -> B -> A
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'A.ts', []);
    // Long cycle: A -> C -> D -> E -> A
    addImportEdge(graph, 'A.ts', 'C.ts', []);
    addImportEdge(graph, 'C.ts', 'D.ts', []);
    addImportEdge(graph, 'D.ts', 'E.ts', []);
    addImportEdge(graph, 'E.ts', 'A.ts', []);

    const result = detectCircularDependencies(graph);

    expect(result.shortestCycle).not.toBeNull();
    // Shortest cycle should be A -> B -> A (length 3 including repeat)
    expect(result.shortestCycle!.length).toBeLessThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// wouldCreateCycle Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('wouldCreateCycle', () => {
  it('should detect potential cycle', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'C.ts', []);

    // Adding C -> A would create a cycle
    expect(wouldCreateCycle(graph, 'C.ts', 'A.ts')).toBe(true);
  });

  it('should allow non-cyclic import', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'C.ts', []);

    // Adding A -> C would not create a cycle
    expect(wouldCreateCycle(graph, 'A.ts', 'C.ts')).toBe(false);
  });

  it('should detect direct cycle', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);

    // Adding B -> A would create direct cycle
    expect(wouldCreateCycle(graph, 'B.ts', 'A.ts')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findCyclesInvolving Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('findCyclesInvolving', () => {
  it('should find cycles involving specific file', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'A.ts', []);
    addImportEdge(graph, 'C.ts', 'D.ts', []);

    const cycles = findCyclesInvolving(graph, 'A.ts');

    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles.every((c) => c.includes('A.ts'))).toBe(true);
  });

  it('should return empty for file not in any cycle', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'A.ts', []);
    addFileToGraph(graph, 'C.ts');

    const cycles = findCyclesInvolving(graph, 'C.ts');

    expect(cycles).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// resolveCircularDependencies Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('resolveCircularDependencies', () => {
  it('should return success for acyclic graph', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', ['foo']);
    addImportEdge(graph, 'B.ts', 'C.ts', ['bar']);

    const result = resolveCircularDependencies(graph, new Map());

    expect(result.success).toBe(true);
    expect(result.resolutions).toHaveLength(0);
  });

  it('should create resolution for cyclic graph', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', ['foo']);
    addImportEdge(graph, 'B.ts', 'A.ts', ['bar']);

    const result = resolveCircularDependencies(graph, new Map());

    expect(result.resolutions.length).toBeGreaterThan(0);
    expect(result.resolutions[0]!.type).toBe('extract_shared');
  });

  it('should include shared module path in resolution', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'src/A.ts', 'src/B.ts', ['foo']);
    addImportEdge(graph, 'src/B.ts', 'src/A.ts', ['bar']);

    const result = resolveCircularDependencies(graph, new Map());

    if (result.resolutions.length > 0) {
      expect(result.resolutions[0]!.sharedModulePath).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateImportsWontCycle Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateImportsWontCycle', () => {
  it('should pass for valid imports', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);

    const result = validateImportsWontCycle(graph, [
      { from: 'B.ts', to: 'C.ts' },
      { from: 'C.ts', to: 'D.ts' },
    ]);

    expect(result.valid).toBe(true);
    expect(result.wouldCreateCycles).toHaveLength(0);
  });

  it('should fail for cyclic imports', () => {
    const graph = createImportGraph();
    addImportEdge(graph, 'A.ts', 'B.ts', []);
    addImportEdge(graph, 'B.ts', 'C.ts', []);

    const result = validateImportsWontCycle(graph, [
      { from: 'C.ts', to: 'A.ts' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.wouldCreateCycles).toHaveLength(1);
    expect(result.wouldCreateCycles[0]).toEqual({ from: 'C.ts', to: 'A.ts' });
  });

  it('should handle sequential validation correctly', () => {
    const graph = createImportGraph();

    // These imports together would create a cycle
    const result = validateImportsWontCycle(graph, [
      { from: 'A.ts', to: 'B.ts' },
      { from: 'B.ts', to: 'C.ts' },
      { from: 'C.ts', to: 'A.ts' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.wouldCreateCycles.length).toBeGreaterThan(0);
  });
});
