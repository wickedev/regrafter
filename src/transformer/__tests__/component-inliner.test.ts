/**
 * ComponentInliner Integration Tests
 *
 * Tests for inlining React components by replacing component calls
 * with their implementation.
 *
 * Following TDD: Red → Green → Refactor
 * Phase 1: Simple components without props or hooks
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import type * as t from '@babel/types';
import { ComponentInliner } from '../component-inliner.js';

// =============================================================================
// Test Fixtures - Simple React Components
// =============================================================================

const simpleComponentNoProps = `
function Greeting() {
  return <div>Hello World</div>;
}

function App() {
  return (
    <div>
      <Greeting />
    </div>
  );
}
`;

const expectedInlinedNoProps = `
function App() {
  return (
    <div>
      <div>Hello World</div>
    </div>
  );
}
`;

const multipleUsagesComponent = `
function Button() {
  return <button>Click me</button>;
}

function App() {
  return (
    <div>
      <Button />
      <Button />
      <Button />
    </div>
  );
}
`;

const expectedMultipleInlined = `
function App() {
  return (
    <div>
      <button>Click me</button>
      <button>Click me</button>
      <button>Click me</button>
    </div>
  );
}
`;

const componentWithProps = `
function Greeting({ name }) {
  return <div>Hello {name}</div>;
}

function App() {
  return (
    <div>
      <Greeting name="World" />
    </div>
  );
}
`;

const expectedInlinedWithProps = `
function App() {
  return (
    <div>
      <div>Hello {"World"}</div>
    </div>
  );
}
`;

const componentWithMultipleProps = `
function Button({ text, onClick }) {
  return <button onClick={onClick}>{text}</button>;
}

function App() {
  const handleClick = () => console.log('clicked');
  return (
    <div>
      <Button text="Click me" onClick={handleClick} />
    </div>
  );
}
`;

const expectedInlinedMultipleProps = `
function App() {
  const handleClick = () => console.log('clicked');
  return (
    <div>
      <button onClick={handleClick}>{"Click me"}</button>
    </div>
  );
}
`;

// Phase 2: Components with Hooks
const componentWithUseState = `
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

function App() {
  return (
    <div>
      <h1>My App</h1>
      <Counter />
    </div>
  );
}
`;

const expectedInlinedUseState = `
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1>My App</h1>
      <div>
        <p>Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>Increment</button>
      </div>
    </div>
  );
}
`;

const componentWithUseEffect = `
import { useState, useEffect } from 'react';

function Timer({ interval }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1);
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  return <div>Seconds: {seconds}</div>;
}

function App() {
  return <Timer interval={1000} />;
}
`;

const expectedInlinedUseEffect = `
import { useState, useEffect } from 'react';

function App() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [1000]);

  return <div>Seconds: {seconds}</div>;
}
`;

const componentWithMultipleHooks = `
import { useState, useEffect, useCallback } from 'react';

function SearchBox({ onSearch }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query) {
      onSearch(query).then(setResults);
    }
  }, [query, onSearch]);

  const handleChange = useCallback((e) => {
    setQuery(e.target.value);
  }, []);

  return (
    <div>
      <input value={query} onChange={handleChange} />
      <ul>
        {results.map(r => <li key={r}>{r}</li>)}
      </ul>
    </div>
  );
}

function App() {
  const handleSearch = async (q) => {
    return ['result1', 'result2'];
  };

  return <SearchBox onSearch={handleSearch} />;
}
`;

// Phase 3: Cross-File Components
const buttonComponentFile = `
export function Button({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}
`;

const appFileUsingButton = `
import { Button } from './Button';

function App() {
  const handleClick = () => console.log('clicked');
  return (
    <div>
      <h1>My App</h1>
      <Button label="Click me" onClick={handleClick} />
    </div>
  );
}
`;

const expectedCrossFileInlined = `
function App() {
  const handleClick = () => console.log('clicked');
  return (
    <div>
      <h1>My App</h1>
      <button onClick={handleClick}>{"Click me"}</button>
    </div>
  );
}
`;

// =============================================================================
// Helper Functions
// =============================================================================

function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

function normalizeCode(code: string): string {
  const ast = parseCode(code);
  const output = generate(ast, { retainLines: false, compact: false });
  return output.code.trim();
}

// =============================================================================
// Test Suite
// =============================================================================

describe('ComponentInliner - Phase 1: Simple Components', () => {
  describe('Iteration 1: Basic Inlining with No Props', () => {
    it('should inline a simple component with no props', () => {
      // ARRANGE
      const ast = parseCode(simpleComponentNoProps);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'Greeting');

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);

      // Verify the output matches expected
      const output = generate(result.ast, { retainLines: false, compact: false });
      const expected = normalizeCode(expectedInlinedNoProps);
      const actual = normalizeCode(output.code);

      expect(actual).toBe(expected);
    });

    it('should handle component not found', () => {
      // ARRANGE
      const ast = parseCode(simpleComponentNoProps);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'NonExistent');

      // ASSERT
      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.error).toContain('not found');
    });

    it('should inline multiple usages of the same component', () => {
      // ARRANGE
      const ast = parseCode(multipleUsagesComponent);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'Button');

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(3);

      // Verify the output matches expected
      const output = generate(result.ast, { retainLines: false, compact: false });
      const expected = normalizeCode(expectedMultipleInlined);
      const actual = normalizeCode(output.code);

      expect(actual).toBe(expected);
    });

    it('should remove the component definition after inlining', () => {
      // ARRANGE
      const ast = parseCode(simpleComponentNoProps);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'Greeting');

      // ASSERT
      expect(result.success).toBe(true);

      // Verify Greeting function is removed
      const output = generate(result.ast, { retainLines: false, compact: false });
      expect(output.code).not.toContain('function Greeting');
    });
  });

  describe('Iteration 2: Prop Substitution', () => {
    it('should inline a component with a single prop', () => {
      // RED: This test should fail because prop substitution is not implemented yet
      const ast = parseCode(componentWithProps);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'Greeting');

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);

      // Verify the output matches expected
      const output = generate(result.ast, { retainLines: false, compact: false });
      const expected = normalizeCode(expectedInlinedWithProps);
      const actual = normalizeCode(output.code);

      expect(actual).toBe(expected);
    });

    it('should inline a component with multiple props', () => {
      // RED: This test should fail because prop substitution is not implemented yet
      const ast = parseCode(componentWithMultipleProps);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'Button');

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);

      // Verify the output matches expected
      const output = generate(result.ast, { retainLines: false, compact: false });
      const expected = normalizeCode(expectedInlinedMultipleProps);
      const actual = normalizeCode(output.code);

      expect(actual).toBe(expected);
    });
  });

  describe('Phase 2: Components with Hooks', () => {
    it('should inline a component with useState hook', () => {
      // RED: This test should fail - hook support not implemented yet
      const ast = parseCode(componentWithUseState);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'Counter');

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);

      // Verify hooks are merged correctly
      const output = generate(result.ast, { retainLines: false, compact: false });
      const actual = normalizeCode(output.code);
      const expected = normalizeCode(expectedInlinedUseState);

      // Should have useState in App
      expect(actual).toContain('useState');
      expect(actual).toContain('count');
      expect(actual).toContain('setCount');
      expect(actual).not.toContain('function Counter');
    });

    it('should inline a component with useEffect and dependency substitution', () => {
      // RED: This test should fail - dependency substitution not implemented yet
      const ast = parseCode(componentWithUseEffect);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'Timer');

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);

      const output = generate(result.ast, { retainLines: false, compact: false });

      // Should have useEffect with substituted dependency
      expect(output.code).toContain('useEffect');
      expect(output.code).toContain('[1000]'); // interval prop substituted
      expect(output.code).not.toContain('function Timer');
    });

    it('should inline a component with multiple hooks', () => {
      // RED: This test should fail - multiple hook handling not implemented yet
      const ast = parseCode(componentWithMultipleHooks);
      const inliner = new ComponentInliner();

      // ACT
      const result = inliner.inline(ast, 'SearchBox');

      // ASSERT
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);

      const output = generate(result.ast, { retainLines: false, compact: false });

      // Should have all hooks
      expect(output.code).toContain('useState');
      expect(output.code).toContain('useEffect');
      expect(output.code).toContain('useCallback');
      expect(output.code).not.toContain('function SearchBox');
    });
  });
});
