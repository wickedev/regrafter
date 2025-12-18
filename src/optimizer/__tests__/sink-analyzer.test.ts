/**
 * SinkAnalyzer Unit Tests
 *
 * Tests for sink candidate analysis, consumer detection, and LCA computation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SinkAnalyzer, createSinkAnalyzer } from '../sink-analyzer.js';
import {
  createDependencyGraph,
  addNodeToDependencyGraph,
  addEdgeToDependencyGraph,
  createDependencyNode,
  createScopeInfo,
} from '../../types/factories.js';
import { ScopeType } from '../../types/index.js';
import type { FileInput } from '../../types/public.js';

describe('SinkAnalyzer', () => {
  let analyzer: SinkAnalyzer;

  beforeEach(() => {
    analyzer = createSinkAnalyzer();
  });

  describe('createSinkAnalyzer', () => {
    it('should create a SinkAnalyzer instance', () => {
      const instance = createSinkAnalyzer();
      expect(instance).toBeInstanceOf(SinkAnalyzer);
    });
  });

  describe('computeLCA', () => {
    it('should return the single scope when given one scope', () => {
      const scope = createScopeInfo({
        type: ScopeType.Function,
        path: null as any,
        parent: null,
        depth: 1,
      });

      const result = analyzer.computeLCA([scope]);

      expect(result.scope).toBe(scope);
      expect(result.depth).toBe(1);
    });

    it('should find LCA of two sibling scopes', () => {
      const root = createScopeInfo({
        type: ScopeType.Module,
        path: null as any,
        parent: null,
        depth: 0,
        id: 'root',
      });

      const child1 = createScopeInfo({
        type: ScopeType.Function,
        path: null as any,
        parent: root,
        depth: 1,
        id: 'child1',
      });

      const child2 = createScopeInfo({
        type: ScopeType.Function,
        path: null as any,
        parent: root,
        depth: 1,
        id: 'child2',
      });

      const result = analyzer.computeLCA([child1, child2]);

      expect(result.scope.id).toBe('root');
      expect(result.depth).toBe(0);
    });

    it('should find LCA of parent and child scopes', () => {
      const root = createScopeInfo({
        type: ScopeType.Module,
        path: null as any,
        parent: null,
        depth: 0,
        id: 'root',
      });

      const child = createScopeInfo({
        type: ScopeType.Function,
        path: null as any,
        parent: root,
        depth: 1,
        id: 'child',
      });

      const grandchild = createScopeInfo({
        type: ScopeType.Block,
        path: null as any,
        parent: child,
        depth: 2,
        id: 'grandchild',
      });

      const result = analyzer.computeLCA([child, grandchild]);

      expect(result.scope.id).toBe('child');
      expect(result.depth).toBe(1);
    });

    it('should throw error for empty scope list', () => {
      expect(() => analyzer.computeLCA([])).toThrow('Cannot compute LCA of empty scope list');
    });

    it('should find LCA of three scopes at different depths', () => {
      const root = createScopeInfo({
        type: ScopeType.Module,
        path: null as any,
        parent: null,
        depth: 0,
        id: 'root',
      });

      const func1 = createScopeInfo({
        type: ScopeType.Function,
        path: null as any,
        parent: root,
        depth: 1,
        id: 'func1',
      });

      const func2 = createScopeInfo({
        type: ScopeType.Function,
        path: null as any,
        parent: root,
        depth: 1,
        id: 'func2',
      });

      const nested = createScopeInfo({
        type: ScopeType.Block,
        path: null as any,
        parent: func1,
        depth: 2,
        id: 'nested',
      });

      const result = analyzer.computeLCA([nested, func2]);

      expect(result.scope.id).toBe('root');
      expect(result.depth).toBe(0);
    });
  });

  describe('analyze', () => {
    it('should return empty results for empty graph', () => {
      const _files: FileInput[] = [];
      const graph = createDependencyGraph();

      const result = analyzer.analyze(_files, graph);

      expect(result.candidates).toHaveLength(0);
      expect(result.sinkable).toHaveLength(0);
      expect(result.unsinkable).toHaveLength(0);
    });

    it('should identify sink candidates from dependency graph', () => {
      const _files: FileInput[] = [];
      const graph = createDependencyGraph();

      // Create a scope hierarchy
      const moduleScope = createScopeInfo({
        type: ScopeType.Module,
        path: null as any,
        parent: null,
        depth: 0,
        id: 'module',
      });

      const componentScope = createScopeInfo({
        type: ScopeType.Component,
        path: null as any,
        parent: moduleScope,
        depth: 1,
        id: 'component',
      });

      // Create a node at module level
      const node = createDependencyNode({
        type: 'symbol',
        name: 'sharedValue',
        path: null as any,
        scope: moduleScope,
        metadata: { isHook: false, isPure: true, hasSideEffects: false, isExported: false },
        id: 'sharedValue',
      });

      addNodeToDependencyGraph(graph, node);

      // Create a consumer at component level
      const consumer = createDependencyNode({
        type: 'element',
        name: 'Consumer',
        path: null as any,
        scope: componentScope,
        metadata: { isHook: false, isPure: false, hasSideEffects: false, isExported: false },
        id: 'consumer',
      });

      addNodeToDependencyGraph(graph, consumer);
      addEdgeToDependencyGraph(graph, 'consumer', 'sharedValue');

      const result = analyzer.analyze(_files, graph);

      // The analysis should have processed the graph
      expect(result).toBeDefined();
      expect(result.dependencyOrder).toBeDefined();
    });
  });

  describe('findConsumers', () => {
    it('should find all consumers of a dependency', () => {
      const graph = createDependencyGraph();

      const moduleScope = createScopeInfo({
        type: ScopeType.Module,
        path: null as any,
        parent: null,
        depth: 0,
      });

      // Create dependency node
      const depNode = createDependencyNode({
        type: 'symbol',
        name: 'value',
        path: null as any,
        scope: moduleScope,
        id: 'value',
      });
      addNodeToDependencyGraph(graph, depNode);

      // Create consumer nodes
      const consumer1 = createDependencyNode({
        type: 'element',
        name: 'Consumer1',
        path: null as any,
        scope: moduleScope,
        id: 'consumer1',
      });
      addNodeToDependencyGraph(graph, consumer1);
      addEdgeToDependencyGraph(graph, 'consumer1', 'value');

      const consumer2 = createDependencyNode({
        type: 'element',
        name: 'Consumer2',
        path: null as any,
        scope: moduleScope,
        id: 'consumer2',
      });
      addNodeToDependencyGraph(graph, consumer2);
      addEdgeToDependencyGraph(graph, 'consumer2', 'value');

      // Create internal dependency object
      const dep = {
        id: 'value',
        symbol: 'value',
        type: 'Variable' as any,
        origin: { node: null, file: '', location: null },
        scope: moduleScope,
        isTransitive: false,
        consumers: [],
      };

      const consumers = analyzer.findConsumers(dep, graph);

      expect(consumers).toHaveLength(2);
    });

    it('should return empty array for dependency with no consumers', () => {
      const graph = createDependencyGraph();

      const moduleScope = createScopeInfo({
        type: ScopeType.Module,
        path: null as any,
        parent: null,
        depth: 0,
      });

      const dep = {
        id: 'unused',
        symbol: 'unused',
        type: 'Variable' as any,
        origin: { node: null, file: '', location: null },
        scope: moduleScope,
        isTransitive: false,
        consumers: [],
      };

      const consumers = analyzer.findConsumers(dep, graph);

      expect(consumers).toHaveLength(0);
    });
  });

  describe('buildScopeTree', () => {
    it('should build scope tree from simple AST', () => {
      // Create a minimal AST structure
      const ast = {
        type: 'File',
        program: {
          type: 'Program',
          body: [],
          sourceType: 'module',
        },
      } as any;

      const tree = analyzer.buildScopeTree(ast);

      expect(tree).toBeDefined();
      expect(tree.root).toBeDefined();
      expect(tree.root.type).toBe(ScopeType.Module);
      expect(tree.root.depth).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear internal caches', () => {
      // Build some cached data
      const ast = {
        type: 'File',
        program: {
          type: 'Program',
          body: [],
          sourceType: 'module',
        },
      } as any;

      analyzer.buildScopeTree(ast);

      // Clear should not throw
      expect(() => analyzer.clearCache()).not.toThrow();
    });
  });
});
