/**
 * Debugging test for IdentifierCollector
 *
 * This test helps diagnose whether identifiers are being collected correctly
 */

import { describe, it, expect } from 'vitest';
import { parseFile } from '../../parser/index.js';
import { IdentifierCollector } from '../../core/index.js';
import { createNodeSelector } from '../node-selector.js';

describe('IdentifierCollector Debug', () => {
  it('should collect identifiers from JSX expression', () => {
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

    const firstNode = selectedNodes[0];
    if (!firstNode) {
      throw new Error('No nodes selected');
    }

    // Collect identifiers
    const collector = new IdentifierCollector({ includeJSXElements: true });
    const identifierNames = collector.collectNames(firstNode);

    console.log('Collected identifier names:', Array.from(identifierNames));

    // EXPECTED: Should collect 'title', 'count', and possibly 'h1', 'p', 'div'
    expect(identifierNames.size).toBeGreaterThan(0);
    expect(identifierNames.has('title')).toBe(true);
    expect(identifierNames.has('count')).toBe(true);
  });

  it('should debug scope bindings', () => {
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

    const parseResult = parseFile('test.tsx', sourceCode);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const ast = parseResult.value;

    const nodeSelector = createNodeSelector();
    const selectResult = nodeSelector.selectNodes(ast, {
      file: 'test.tsx',
      line: 8,
      column: 6,
    });

    expect(selectResult.ok).toBe(true);
    if (!selectResult.ok) return;

    const selectedNodes = selectResult.value;
    const firstNode = selectedNodes[0];
    if (!firstNode) return;

    // Check scope and bindings
    console.log('\n=== Scope Debug ===');
    console.log('Node type:', firstNode.node.type);
    console.log('Scope type:', firstNode.scope.constructor.name);

    // Check if 'title' and 'count' are in scope
    const titleBinding = firstNode.scope.getBinding('title');
    const countBinding = firstNode.scope.getBinding('count');

    console.log('\ntitle binding:', titleBinding ? 'FOUND' : 'NOT FOUND');
    if (titleBinding) {
      console.log('  - kind:', titleBinding.kind);
      console.log('  - path type:', titleBinding.path.node.type);
      console.log('  - constant:', titleBinding.constant);
    }

    console.log('\ncount binding:', countBinding ? 'FOUND' : 'NOT FOUND');
    if (countBinding) {
      console.log('  - kind:', countBinding.kind);
      console.log('  - path type:', countBinding.path.node.type);
      console.log('  - constant:', countBinding.constant);
    }

    // List all bindings in scope
    console.log('\nAll bindings in scope:');
    const allBindings = Object.keys(firstNode.scope.bindings);
    console.log(allBindings);

    expect(titleBinding).toBeDefined();
    expect(countBinding).toBeDefined();
  });
});
