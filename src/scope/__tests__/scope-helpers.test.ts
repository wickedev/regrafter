/**
 * Tests for Scope Helper Utilities
 *
 * Comprehensive test coverage for all 7 scope helper functions.
 * Tests cover normal cases, edge cases, and error handling.
 */

import { describe, it, expect } from 'vitest';
import type { NodePath } from '@babel/traverse';

import { ok, err } from '../../result/index.js';
import type { IScopeManager } from '../../interfaces/IScopeManager.js';
import type { ScopeInfo, ComponentScope } from '../types.js';
import { ScopeType } from '../types.js';

import {
  getScopeWithFallback,
  getEnclosingComponentOrNull,
  buildScopePath,
  findCommonAncestor,
  isAncestorOf,
  findNearestAncestor,
  computeScopeDistance,
} from '../scope-helpers.js';

/**
 * Helper: Create mock scope
 */
function createMockScope(id: string, parent: ScopeInfo | null = null): ScopeInfo {
  return {
    id,
    type: ScopeType.Block,
    path: {} as NodePath,
    parent,
    bindings: new Map(),
    children: [],
  };
}

/**
 * Helper: Create mock component scope
 */
function createMockComponentScope(
  id: string,
  componentName: string,
  parent: ScopeInfo | null = null
): ComponentScope {
  return {
    id,
    type: ScopeType.Component,
    path: {} as NodePath,
    parent,
    bindings: new Map(),
    children: [],
    componentName,
    isComponent: true,
    hooks: [],
  };
}

/**
 * Helper: Create mock scope manager
 */
function createMockScopeManager(overrides?: Partial<IScopeManager>): IScopeManager {
  return {
    getScopeForPath: () => null,
    findEnclosingComponent: () => ok(null),
    ...overrides,
  } as IScopeManager;
}

describe('getScopeWithFallback', () => {
  it('should return scope from direct lookup when available', () => {
    const mockScope = createMockScope('scope1');
    const mockPath = {} as NodePath;

    const scopeManager = createMockScopeManager({
      getScopeForPath: () => mockScope,
    });

    const result = getScopeWithFallback(mockPath, scopeManager);

    expect(result).toBe(mockScope);
  });

  it('should fall back to enclosing component when direct lookup returns null', () => {
    const mockComponent = createMockComponentScope('comp1', 'MyComponent');
    const mockPath = {} as NodePath;

    const scopeManager = createMockScopeManager({
      getScopeForPath: () => null,
      findEnclosingComponent: () => ok(mockComponent),
    });

    const result = getScopeWithFallback(mockPath, scopeManager);

    expect(result).toBe(mockComponent);
  });

  it('should return null when both direct lookup and component fallback fail', () => {
    const mockPath = {} as NodePath;

    const scopeManager = createMockScopeManager({
      getScopeForPath: () => null,
      findEnclosingComponent: () => ok(null),
    });

    const result = getScopeWithFallback(mockPath, scopeManager);

    expect(result).toBeNull();
  });

  it('should return null when findEnclosingComponent returns error', () => {
    const mockPath = {} as NodePath;

    const scopeManager = createMockScopeManager({
      getScopeForPath: () => null,
      findEnclosingComponent: () => err({ code: 'INTERNAL_ERROR', message: 'Error' } as any),
    });

    const result = getScopeWithFallback(mockPath, scopeManager);

    expect(result).toBeNull();
  });

  it('should prefer direct scope over component fallback', () => {
    const directScope = createMockScope('scope1');
    const componentScope = createMockComponentScope('comp1', 'MyComponent');
    const mockPath = {} as NodePath;

    const scopeManager = createMockScopeManager({
      getScopeForPath: () => directScope,
      findEnclosingComponent: () => ok(componentScope),
    });

    const result = getScopeWithFallback(mockPath, scopeManager);

    // Should return direct scope, not component
    expect(result).toBe(directScope);
  });
});

describe('getEnclosingComponentOrNull', () => {
  it('should return component scope when found', () => {
    const mockComponent = createMockComponentScope('comp1', 'MyComponent');
    const mockPath = {} as NodePath;

    const scopeManager = createMockScopeManager({
      findEnclosingComponent: () => ok(mockComponent),
    });

    const result = getEnclosingComponentOrNull(mockPath, scopeManager);

    expect(result).toBe(mockComponent);
  });

  it('should return null when no component found', () => {
    const mockPath = {} as NodePath;

    const scopeManager = createMockScopeManager({
      findEnclosingComponent: () => ok(null),
    });

    const result = getEnclosingComponentOrNull(mockPath, scopeManager);

    expect(result).toBeNull();
  });

  it('should return null when findEnclosingComponent returns error', () => {
    const mockPath = {} as NodePath;

    const scopeManager = createMockScopeManager({
      findEnclosingComponent: () => err({ code: 'INTERNAL_ERROR', message: 'Error' } as any),
    });

    const result = getEnclosingComponentOrNull(mockPath, scopeManager);

    expect(result).toBeNull();
  });
});

describe('buildScopePath', () => {
  it('should build path from root to current scope', () => {
    // Create scope tree: root -> parent -> child
    const root = createMockScope('root');
    const parent = createMockScope('parent', root);
    const child = createMockScope('child', parent);

    // Link children
    root.children = [parent];
    parent.children = [child];

    const path = buildScopePath(child);

    expect(path).toHaveLength(3);
    expect(path[0]).toBe(root);
    expect(path[1]).toBe(parent);
    expect(path[2]).toBe(child);
  });

  it('should return single-element array for root scope', () => {
    const root = createMockScope('root');

    const path = buildScopePath(root);

    expect(path).toHaveLength(1);
    expect(path[0]).toBe(root);
  });

  it('should handle deep nesting', () => {
    // Create 10-level deep tree
    let current = createMockScope('scope0');
    const root = current;

    for (let i = 1; i < 10; i++) {
      const next = createMockScope(`scope${i}`, current);
      current.children = [next];
      current = next;
    }

    const path = buildScopePath(current);

    expect(path).toHaveLength(10);
    expect(path[0]).toBe(root);
    expect(path[9]).toBe(current);
  });

  it('should maintain correct order from root to leaf', () => {
    const scope1 = createMockScope('1');
    const scope2 = createMockScope('2', scope1);
    const scope3 = createMockScope('3', scope2);
    const scope4 = createMockScope('4', scope3);

    const path = buildScopePath(scope4);

    expect(path.map(s => s.id)).toEqual(['1', '2', '3', '4']);
  });
});

describe('findCommonAncestor', () => {
  it('should find LCA for sibling scopes', () => {
    // Tree: root -> [childA, childB]
    const root = createMockScope('root');
    const childA = createMockScope('childA', root);
    const childB = createMockScope('childB', root);

    root.children = [childA, childB];

    const lca = findCommonAncestor(childA, childB);

    expect(lca).toBe(root);
  });

  it('should find LCA for parent-child relationship', () => {
    // Tree: parent -> child
    const parent = createMockScope('parent');
    const child = createMockScope('child', parent);

    parent.children = [child];

    const lca = findCommonAncestor(parent, child);

    expect(lca).toBe(parent);
  });

  it('should return same scope when comparing scope to itself', () => {
    const scope = createMockScope('scope');

    const lca = findCommonAncestor(scope, scope);

    expect(lca).toBe(scope);
  });

  it('should find LCA for distant cousins', () => {
    // Tree: root -> [branchA -> leafA, branchB -> leafB]
    const root = createMockScope('root');
    const branchA = createMockScope('branchA', root);
    const branchB = createMockScope('branchB', root);
    const leafA = createMockScope('leafA', branchA);
    const leafB = createMockScope('leafB', branchB);

    root.children = [branchA, branchB];
    branchA.children = [leafA];
    branchB.children = [leafB];

    const lca = findCommonAncestor(leafA, leafB);

    expect(lca).toBe(root);
  });

  it('should find deepest common ancestor', () => {
    // Tree: root -> mid -> [leafA, leafB]
    const root = createMockScope('root');
    const mid = createMockScope('mid', root);
    const leafA = createMockScope('leafA', mid);
    const leafB = createMockScope('leafB', mid);

    root.children = [mid];
    mid.children = [leafA, leafB];

    const lca = findCommonAncestor(leafA, leafB);

    // Should be 'mid', not 'root'
    expect(lca).toBe(mid);
  });

  it('should return null for scopes in different trees', () => {
    // Two separate trees
    const tree1 = createMockScope('tree1');
    const tree2 = createMockScope('tree2');

    const lca = findCommonAncestor(tree1, tree2);

    expect(lca).toBeNull();
  });

  it('should handle asymmetric tree depths', () => {
    // Tree: root -> [shallow, deep -> deeper -> deepest]
    const root = createMockScope('root');
    const shallow = createMockScope('shallow', root);
    const deep = createMockScope('deep', root);
    const deeper = createMockScope('deeper', deep);
    const deepest = createMockScope('deepest', deeper);

    root.children = [shallow, deep];
    deep.children = [deeper];
    deeper.children = [deepest];

    const lca = findCommonAncestor(shallow, deepest);

    expect(lca).toBe(root);
  });
});

describe('isAncestorOf', () => {
  it('should return true for direct parent-child', () => {
    const parent = createMockScope('parent');
    const child = createMockScope('child', parent);

    expect(isAncestorOf(parent, child)).toBe(true);
  });

  it('should return true for grandparent-grandchild', () => {
    const grandparent = createMockScope('grandparent');
    const parent = createMockScope('parent', grandparent);
    const child = createMockScope('child', parent);

    expect(isAncestorOf(grandparent, child)).toBe(true);
  });

  it('should return true for deep ancestry', () => {
    const root = createMockScope('root');
    let current = root;

    for (let i = 0; i < 5; i++) {
      const next = createMockScope(`level${i}`, current);
      current.children = [next];
      current = next;
    }

    expect(isAncestorOf(root, current)).toBe(true);
  });

  it('should return false for sibling scopes', () => {
    const parent = createMockScope('parent');
    const childA = createMockScope('childA', parent);
    const childB = createMockScope('childB', parent);

    parent.children = [childA, childB];

    expect(isAncestorOf(childA, childB)).toBe(false);
    expect(isAncestorOf(childB, childA)).toBe(false);
  });

  it('should return false for reversed parent-child', () => {
    const parent = createMockScope('parent');
    const child = createMockScope('child', parent);

    // Child is NOT an ancestor of parent
    expect(isAncestorOf(child, parent)).toBe(false);
  });

  it('should return true for same scope', () => {
    const scope = createMockScope('scope');

    // A scope is considered its own ancestor
    expect(isAncestorOf(scope, scope)).toBe(true);
  });

  it('should return false for unrelated scopes', () => {
    const tree1 = createMockScope('tree1');
    const tree2 = createMockScope('tree2');

    expect(isAncestorOf(tree1, tree2)).toBe(false);
  });

  it('should prevent infinite loops with max depth', () => {
    // Create deep nesting that exceeds MAX_DEPTH
    let current = createMockScope('scope0');
    const root = current;

    // Create 101 levels (exceeds MAX_DEPTH of 100)
    for (let i = 1; i <= 101; i++) {
      const next = createMockScope(`scope${i}`, current);
      current.children = [next];
      current = next;
    }

    // Should return false because it hits MAX_DEPTH before finding root
    expect(isAncestorOf(root, current)).toBe(false);
  });
});

describe('findNearestAncestor', () => {
  it('should find nearest matching ancestor', () => {
    const root = createMockComponentScope('root', 'RootComponent');
    const block = createMockScope('block', root);
    const child = createMockScope('child', block);

    const result = findNearestAncestor(
      child,
      (s) => s.type === ScopeType.Component
    );

    expect(result).toBe(root);
  });

  it('should skip current scope', () => {
    const component1 = createMockComponentScope('comp1', 'Component1');
    const component2 = createMockComponentScope('comp2', 'Component2', component1);

    // Should find parent component, not current
    const result = findNearestAncestor(
      component2,
      (s) => s.type === ScopeType.Component
    );

    expect(result).toBe(component1);
  });

  it('should return null when no match found', () => {
    const root = createMockScope('root');
    const child = createMockScope('child', root);

    const result = findNearestAncestor(
      child,
      (s) => s.type === ScopeType.Component
    );

    expect(result).toBeNull();
  });

  it('should return first matching ancestor, not deepest', () => {
    const comp1 = createMockComponentScope('comp1', 'Comp1');
    const comp2 = createMockComponentScope('comp2', 'Comp2', comp1);
    const comp3 = createMockComponentScope('comp3', 'Comp3', comp2);
    const block = createMockScope('block', comp3);

    // Should find comp3 (nearest), not comp1
    const result = findNearestAncestor(
      block,
      (s) => s.type === ScopeType.Component
    );

    expect(result).toBe(comp3);
  });

  it('should work with custom predicates', () => {
    const scope1 = createMockScope('scope1');
    const scope2 = createMockScope('scope2', scope1);
    const scope3 = createMockScope('target-scope', scope2);
    const scope4 = createMockScope('scope4', scope3);

    const result = findNearestAncestor(
      scope4,
      (s) => s.id.startsWith('target')
    );

    expect(result).toBe(scope3);
  });

  it('should prevent infinite loops with max depth', () => {
    const scope1 = createMockScope('scope1');
    const scope2 = createMockScope('scope2', scope1);

    // Create cycle
    (scope1 as any).parent = scope2;

    const result = findNearestAncestor(
      scope2,
      () => false
    );

    expect(result).toBeNull();
  });
});

describe('computeScopeDistance', () => {
  it('should return 0 for same scope', () => {
    const scope = createMockScope('scope');

    expect(computeScopeDistance(scope, scope)).toBe(0);
  });

  it('should return 1 for direct parent-child', () => {
    const parent = createMockScope('parent');
    const child = createMockScope('child', parent);

    expect(computeScopeDistance(parent, child)).toBe(1);
    expect(computeScopeDistance(child, parent)).toBe(1);
  });

  it('should return 2 for grandparent-grandchild', () => {
    const grandparent = createMockScope('grandparent');
    const parent = createMockScope('parent', grandparent);
    const child = createMockScope('child', parent);

    expect(computeScopeDistance(grandparent, child)).toBe(2);
    expect(computeScopeDistance(child, grandparent)).toBe(2);
  });

  it('should compute distance through LCA for siblings', () => {
    const parent = createMockScope('parent');
    const childA = createMockScope('childA', parent);
    const childB = createMockScope('childB', parent);

    // Distance: childA -> parent -> childB = 2
    expect(computeScopeDistance(childA, childB)).toBe(2);
  });

  it('should compute distance through LCA for cousins', () => {
    const root = createMockScope('root');
    const branchA = createMockScope('branchA', root);
    const branchB = createMockScope('branchB', root);
    const leafA = createMockScope('leafA', branchA);
    const leafB = createMockScope('leafB', branchB);

    // Distance: leafA -> branchA -> root -> branchB -> leafB = 4
    expect(computeScopeDistance(leafA, leafB)).toBe(4);
  });

  it('should return -1 for scopes in different trees', () => {
    const tree1 = createMockScope('tree1');
    const tree2 = createMockScope('tree2');

    expect(computeScopeDistance(tree1, tree2)).toBe(-1);
  });

  it('should handle asymmetric distances', () => {
    const root = createMockScope('root');
    const shallow = createMockScope('shallow', root);
    const deep = createMockScope('deep', root);
    const deeper = createMockScope('deeper', deep);
    const deepest = createMockScope('deepest', deeper);

    // Distance: shallow -> root -> deep -> deeper -> deepest = 4
    expect(computeScopeDistance(shallow, deepest)).toBe(4);
  });

  it('should compute correct distance for complex tree', () => {
    // Tree:
    //       root
    //      /    \
    //    m1      m2
    //   /  \      \
    //  l1  l2     l3
    const root = createMockScope('root');
    const m1 = createMockScope('m1', root);
    const m2 = createMockScope('m2', root);
    const l1 = createMockScope('l1', m1);
    const l2 = createMockScope('l2', m1);
    const l3 = createMockScope('l3', m2);

    expect(computeScopeDistance(l1, l2)).toBe(2); // l1 -> m1 -> l2
    expect(computeScopeDistance(l1, l3)).toBe(4); // l1 -> m1 -> root -> m2 -> l3
    expect(computeScopeDistance(l2, l3)).toBe(4); // l2 -> m1 -> root -> m2 -> l3
  });
});
