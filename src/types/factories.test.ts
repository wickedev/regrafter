/**
 * Unit tests for factory functions
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  generateId,
  resetIdCounter,
  hashContent,
  createDependency,
  createSuggestedFix,
  createAnalysisStats,
  createMoveAnalysis,
  createCode,
  createResult,
  createSuccessResult,
  createFailureResult,
  createDependencyGraph,
  addNodeToDependencyGraph,
  addEdgeToDependencyGraph,
  createASTStore,
  createValidationResult,
  createTransformPlan,
  createTransformStats,
} from './factories.js';
import { DependencyType } from './public.js';

describe('generateId', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should use provided prefix', () => {
    const id = generateId('test');
    expect(id).toMatch(/^test_/);
  });

  it('should use default prefix "id"', () => {
    const id = generateId();
    expect(id).toMatch(/^id_/);
  });
});

describe('hashContent', () => {
  it('should return consistent hash for same content', () => {
    const content = 'hello world';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);
    expect(hash1).toBe(hash2);
  });

  it('should return different hashes for different content', () => {
    const hash1 = hashContent('hello');
    const hash2 = hashContent('world');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const hash = hashContent('');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe('createDependency', () => {
  it('should create dependency with required fields', () => {
    const dep = createDependency({
      symbol: 'useState',
      type: DependencyType.Hook,
      origin: 'App.tsx',
      scope: 'App',
    });

    expect(dep.symbol).toBe('useState');
    expect(dep.type).toBe(DependencyType.Hook);
    expect(dep.origin).toBe('App.tsx');
    expect(dep.scope).toBe('App');
    expect(dep.isTransitive).toBe(false);
    expect(dep.resolution).toBeUndefined();
  });

  it('should respect isTransitive when provided', () => {
    const dep = createDependency({
      symbol: 'count',
      type: DependencyType.Variable,
      origin: 'App.tsx',
      scope: 'App',
      isTransitive: true,
    });

    expect(dep.isTransitive).toBe(true);
  });
});

describe('createSuggestedFix', () => {
  it('should create fix with default automatic = false', () => {
    const fix = createSuggestedFix({
      description: 'Move hook to parent component',
      action: 'hoist_hook',
    });

    expect(fix.description).toBe('Move hook to parent component');
    expect(fix.action).toBe('hoist_hook');
    expect(fix.automatic).toBe(false);
  });

  it('should respect automatic when provided', () => {
    const fix = createSuggestedFix({
      description: 'Add import',
      action: 'add_import',
      automatic: true,
    });

    expect(fix.automatic).toBe(true);
  });
});

describe('createAnalysisStats', () => {
  it('should create stats with all zeros by default', () => {
    const stats = createAnalysisStats();

    expect(stats.totalDependencies).toBe(0);
    expect(stats.hookDependencies).toBe(0);
    expect(stats.variableDependencies).toBe(0);
    expect(stats.importDependencies).toBe(0);
    expect(stats.propDependencies).toBe(0);
    expect(stats.transitiveDependencies).toBe(0);
  });

  it('should accept partial stats', () => {
    const stats = createAnalysisStats({
      totalDependencies: 5,
      hookDependencies: 2,
    });

    expect(stats.totalDependencies).toBe(5);
    expect(stats.hookDependencies).toBe(2);
    expect(stats.variableDependencies).toBe(0);
  });
});

describe('createMoveAnalysis', () => {
  it('should create analysis with required fields', () => {
    const analysis = createMoveAnalysis({
      canMove: true,
    });

    expect(analysis.canMove).toBe(true);
    expect(analysis.dependencies).toEqual([]);
    expect(analysis.hoistedDeps).toEqual([]);
    expect(analysis.reason).toBeUndefined();
  });

  it('should include reason when canMove is false', () => {
    const analysis = createMoveAnalysis({
      canMove: false,
      reason: 'Hook rules violation',
    });

    expect(analysis.canMove).toBe(false);
    expect(analysis.reason).toBe('Hook rules violation');
  });
});

describe('createCode', () => {
  it('should create code with default changed = false', () => {
    const code = createCode({
      file: 'App.tsx',
      content: 'const x = 1;',
    });

    expect(code.file).toBe('App.tsx');
    expect(code.content).toBe('const x = 1;');
    expect(code.changed).toBe(false);
  });

  it('should accept changed flag', () => {
    const code = createCode({
      file: 'App.tsx',
      content: 'const x = 1;',
      changed: true,
      original: 'const x = 0;',
    });

    expect(code.changed).toBe(true);
    expect(code.original).toBe('const x = 0;');
  });
});

describe('createResult', () => {
  it('should create result with empty codes by default', () => {
    const analysis = createMoveAnalysis({ canMove: true });
    const result = createResult({
      success: true,
      analysis,
    });

    expect(result.success).toBe(true);
    expect(result.codes).toEqual([]);
    expect(result.analysis).toBe(analysis);
  });
});

describe('createSuccessResult', () => {
  it('should create successful result', () => {
    const codes = [createCode({ file: 'App.tsx', content: 'code' })];
    const analysis = createMoveAnalysis({ canMove: true });
    
    const result = createSuccessResult(codes, analysis);

    expect(result.success).toBe(true);
    expect(result.codes).toBe(codes);
    expect(result.analysis).toBe(analysis);
  });
});

describe('createFailureResult', () => {
  it('should create failed result', () => {
    const result = createFailureResult('Invalid selector');

    expect(result.success).toBe(false);
    expect(result.codes).toEqual([]);
    expect(result.analysis.canMove).toBe(false);
    expect(result.analysis.reason).toBe('Invalid selector');
  });

  it('should include suggested fixes when provided', () => {
    const fix = createSuggestedFix({
      description: 'Fix suggestion',
      action: 'fix',
    });
    const result = createFailureResult('Error', [], [fix]);

    expect(result.analysis.suggestedFixes).toHaveLength(1);
    expect(result.analysis.suggestedFixes![0]).toBe(fix);
  });
});

describe('createDependencyGraph', () => {
  it('should create empty graph', () => {
    const graph = createDependencyGraph();

    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
    expect(graph.reverseEdges.size).toBe(0);
  });
});

describe('addNodeToDependencyGraph', () => {
  it('should add node to graph', () => {
    const graph = createDependencyGraph();
    const node = {
      id: 'node1',
      type: 'symbol' as const,
      name: 'test',
      path: {} as any,
      scope: {} as any,
      metadata: {
        isHook: false,
        isPure: true,
        hasSideEffects: false,
        isExported: false,
      },
    };

    addNodeToDependencyGraph(graph, node);

    expect(graph.nodes.has('node1')).toBe(true);
    expect(graph.edges.has('node1')).toBe(true);
    expect(graph.reverseEdges.has('node1')).toBe(true);
  });
});

describe('addEdgeToDependencyGraph', () => {
  it('should add edge between nodes', () => {
    const graph = createDependencyGraph();
    const node1 = {
      id: 'node1',
      type: 'symbol' as const,
      name: 'test1',
      path: {} as any,
      scope: {} as any,
      metadata: { isHook: false, isPure: true, hasSideEffects: false, isExported: false },
    };
    const node2 = {
      id: 'node2',
      type: 'symbol' as const,
      name: 'test2',
      path: {} as any,
      scope: {} as any,
      metadata: { isHook: false, isPure: true, hasSideEffects: false, isExported: false },
    };

    addNodeToDependencyGraph(graph, node1);
    addNodeToDependencyGraph(graph, node2);
    addEdgeToDependencyGraph(graph, 'node1', 'node2');

    expect(graph.edges.get('node1')!.has('node2')).toBe(true);
    expect(graph.reverseEdges.get('node2')!.has('node1')).toBe(true);
  });
});

describe('createASTStore', () => {
  it('should create empty store', () => {
    const store = createASTStore();

    expect(store.files.size).toBe(0);
    expect(store.scopeMap).toBeInstanceOf(WeakMap);
    expect(store.bindingCache).toBeInstanceOf(WeakMap);
    expect(store.dependencyGraphCache).toBeInstanceOf(WeakMap);
  });
});

describe('createValidationResult', () => {
  it('should create valid result by default', () => {
    const result = createValidationResult();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should accept errors and warnings', () => {
    const result = createValidationResult({
      valid: false,
      errors: ['Error 1'],
      warnings: ['Warning 1'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Error 1']);
    expect(result.warnings).toEqual(['Warning 1']);
  });
});

describe('createTransformPlan', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it('should create empty plan', () => {
    const plan = createTransformPlan();

    expect(plan.id).toMatch(/^plan_/);
    expect(plan.moves).toEqual([]);
    expect(plan.hoists).toEqual([]);
    expect(plan.propThreads).toEqual([]);
    expect(plan.imports).toEqual([]);
    expect(plan.sharedModules).toEqual([]);
    expect(plan.validation.valid).toBe(true);
  });
});

describe('createTransformStats', () => {
  it('should create stats with all zeros by default', () => {
    const stats = createTransformStats();

    expect(stats.elementsMoved).toBe(0);
    expect(stats.dependenciesHoisted).toBe(0);
    expect(stats.propsAdded).toBe(0);
    expect(stats.importsAdded).toBe(0);
    expect(stats.filesModified).toBe(0);
    expect(stats.filesCreated).toBe(0);
  });

  it('should accept partial stats', () => {
    const stats = createTransformStats({
      elementsMoved: 1,
      importsAdded: 3,
    });

    expect(stats.elementsMoved).toBe(1);
    expect(stats.importsAdded).toBe(3);
    expect(stats.dependenciesHoisted).toBe(0);
  });
});
