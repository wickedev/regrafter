/**
 * Debugging test for extract() dependency detection
 *
 * This test helps diagnose why ExtractDependencyAnalyzer
 * fails to detect variable dependencies
 */

import { describe, it, expect } from 'vitest';
import { parseFile } from '../../parser/index.js';
import { ScopeManager } from '../../scope/index.js';
import { ScopeType, createScopeInfo } from '../../types/index.js';
import { ExtractDependencyAnalyzer } from '../extract-dependency-analyzer.js';
import { createNodeSelector } from '../node-selector.js';

describe('ExtractDependencyAnalyzer - Dependency Detection Debug', () => {
  it('should detect variable dependencies in simple case', () => {
    const sourceCode = `
function App() {
  const title = "Dashboard";
  const count = 42;

  return (
    <div>
      <div className="stats">
        <h1>{title}</h1>
        <p>Count: {count}</p>
      </div>
    </div>
  );
}`;

    // Parse
    const parseResult = parseFile('test.tsx', sourceCode);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const ast = parseResult.value;

    // Select the <div className="stats"> node
    const nodeSelector = createNodeSelector();
    const selectResult = nodeSelector.selectNodes(ast, {
      file: 'test.tsx',
      line: 8,
      column: 6,
    });

    expect(selectResult.ok).toBe(true);
    if (!selectResult.ok) {
      console.error('Selection failed:', selectResult.error);
      return;
    }

    const selectedNodes = selectResult.value;
    console.log('Selected nodes count:', selectedNodes.length);
    expect(selectedNodes.length).toBeGreaterThan(0);

    const firstNode = selectedNodes[0];
    if (!firstNode) {
      throw new Error('No nodes selected');
    }

    // Analyze dependencies
    const scopeManager = new ScopeManager();
    const analyzer = new ExtractDependencyAnalyzer(scopeManager);

    const sourceScope = createScopeInfo({
      type: ScopeType.Module,
      path: firstNode.scope.getProgramParent().path,
      parent: null,
    });

    const result = analyzer.analyze(selectedNodes, sourceScope);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.error('Analysis failed:', result.error);
      return;
    }

    const dependencies = result.value;

    console.log('Variables found:', dependencies.variables.map(v => v.name));
    console.log('Functions found:', dependencies.functions.map(f => f.name));
    console.log('States found:', dependencies.states.map(s => s.stateName));
    console.log('Imports found:', dependencies.imports.map(i => i.name));

    // EXPECTED: Should detect 'title' and 'count' as variable dependencies
    expect(dependencies.variables.length).toBe(2);

    const variableNames = dependencies.variables.map(v => v.name);
    expect(variableNames).toContain('title');
    expect(variableNames).toContain('count');
  });

  it('should detect function dependencies', () => {
    const sourceCode = `
function App() {
  const handleClick = () => {
    console.log('Clicked');
  };

  return (
    <div>
      <button onClick={handleClick}>
        Click Me
      </button>
    </div>
  );
}`;

    const parseResult = parseFile('test.tsx', sourceCode);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const ast = parseResult.value;

    const nodeSelector = createNodeSelector();
    const selectResult = nodeSelector.selectNodes(ast, {
      file: 'test.tsx',
      line: 9,
      column: 6,
    });

    expect(selectResult.ok).toBe(true);
    if (!selectResult.ok) return;

    const selectedNodes = selectResult.value;
    const firstNode = selectedNodes[0];
    if (!firstNode) return;

    const scopeManager = new ScopeManager();
    const analyzer = new ExtractDependencyAnalyzer(scopeManager);

    const sourceScope = createScopeInfo({
      type: ScopeType.Module,
      path: firstNode.scope.getProgramParent().path,
      parent: null,
    });

    const result = analyzer.analyze(selectedNodes, sourceScope);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const dependencies = result.value;

    console.log('Functions detected:', dependencies.functions.map(f => f.name));

    // EXPECTED: Should detect 'handleClick' as function dependency
    expect(dependencies.functions.length).toBe(1);
    expect(dependencies.functions[0]?.name).toBe('handleClick');
  });

  it('should detect useState dependencies', () => {
    const sourceCode = `
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <div className="counter">
        <p>Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>Increment</button>
      </div>
    </div>
  );
}`;

    const parseResult = parseFile('test.tsx', sourceCode);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const ast = parseResult.value;

    const nodeSelector = createNodeSelector();
    const selectResult = nodeSelector.selectNodes(ast, {
      file: 'test.tsx',
      line: 9,
      column: 6,
    });

    expect(selectResult.ok).toBe(true);
    if (!selectResult.ok) return;

    const selectedNodes = selectResult.value;
    const firstNode = selectedNodes[0];
    if (!firstNode) return;

    const scopeManager = new ScopeManager();
    const analyzer = new ExtractDependencyAnalyzer(scopeManager);

    const sourceScope = createScopeInfo({
      type: ScopeType.Module,
      path: firstNode.scope.getProgramParent().path,
      parent: null,
    });

    const result = analyzer.analyze(selectedNodes, sourceScope);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const dependencies = result.value;

    console.log('States detected:', dependencies.states.map(s => `${s.stateName}, ${s.setterName}`));

    // EXPECTED: Should detect 'count' and 'setCount' as state dependency
    expect(dependencies.states.length).toBe(1);
    expect(dependencies.states[0]?.stateName).toBe('count');
    expect(dependencies.states[0]?.setterName).toBe('setCount');
  });
});
