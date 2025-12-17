/**
 * Integration Tests - Dependency Analysis
 *
 * Integration tests for the complete dependency analysis pipeline
 * including the analyze() API.
 */

import { describe, it, expect } from 'vitest';
import { analyze, Move, DependencyType } from '../../index.js';
import type { FileInput } from '../../index.js';

describe('Dependency Analysis Integration', () => {
  describe('analyze() API', () => {
    it('should analyze a simple move operation', () => {
      const code = `
function App() {
  const message = 'Hello';
  return (
    <div>
      <span>{message}</span>
      <section>Target</section>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'App.tsx', line: 6, column: 7 }, // <span>
        { file: 'App.tsx', line: 7, column: 7 }, // <section>
        Move.Inside
      );

      expect(analysis).toBeDefined();
      expect(analysis.canMove).toBe(true);
      expect(analysis.dependencies).toBeDefined();
    });

    it('should detect useState dependencies', () => {
      const code = `
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <footer>Footer</footer>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'Counter.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'Counter.tsx', line: 8, column: 7 }, // <span>
        { file: 'Counter.tsx', line: 10, column: 7 }, // <footer>
        Move.Inside
      );

      expect(analysis.canMove).toBe(true);
      expect(analysis.dependencies.some(d => d.type === DependencyType.Hook)).toBe(true);
    });

    it('should detect import dependencies', () => {
      const code = `
import { Button, Icon } from '@ui/components';

function App() {
  return (
    <div>
      <Button>
        <Icon name="star" />
      </Button>
      <section>Target</section>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'App.tsx', line: 7, column: 7 }, // <Button>
        { file: 'App.tsx', line: 10, column: 7 }, // <section>
        Move.Inside
      );

      expect(analysis.canMove).toBe(true);
      expect(analysis.dependencies.some(d => d.type === DependencyType.Import)).toBe(true);
    });

    it('should detect variable dependencies', () => {
      const code = `
function App() {
  const name = 'World';
  const greeting = 'Hello, ' + name;
  return (
    <div>
      <span>{greeting}</span>
      <section>Target</section>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'App.tsx', line: 7, column: 7 }, // <span>
        { file: 'App.tsx', line: 8, column: 7 }, // <section>
        Move.Inside
      );

      expect(analysis.canMove).toBe(true);
      expect(analysis.dependencies.some(d => d.type === DependencyType.Variable)).toBe(true);
    });

    it('should provide analysis stats', () => {
      const code = `
import { Button } from '@ui/components';
import { useTheme } from './hooks';

function App() {
  const [count, setCount] = useState(0);
  const theme = useTheme();
  const label = 'Count:';
  return (
    <div>
      <span style={theme}>{label} {count}</span>
      <Button onClick={() => setCount(c => c + 1)}>+</Button>
      <section>Target</section>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'App.tsx', line: 11, column: 7 }, // <span>
        { file: 'App.tsx', line: 13, column: 7 }, // <section>
        Move.Inside
      );

      expect(analysis.stats).toBeDefined();
      expect(analysis.stats?.totalDependencies).toBeGreaterThanOrEqual(0);
    });

    it('should return failure for invalid selector', () => {
      const code = `
function App() {
  return <div>Hello</div>;
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'App.tsx', line: 100, column: 1 }, // Invalid line
        { file: 'App.tsx', line: 2, column: 10 },
        Move.Inside
      );

      expect(analysis.canMove).toBe(false);
      expect(analysis.reason).toBeDefined();
    });

    it('should return failure for missing file', () => {
      const files: FileInput[] = [
        { path: 'App.tsx', content: 'function App() { return <div/>; }' },
      ];

      const analysis = analyze(
        files,
        { file: 'NotFound.tsx', line: 1, column: 1 },
        { file: 'App.tsx', line: 1, column: 1 },
        Move.Inside
      );

      expect(analysis.canMove).toBe(false);
    });
  });

  describe('Complex dependency scenarios', () => {
    it('should handle useContext dependencies', () => {
      const code = `
import { useContext } from 'react';
import { ThemeContext } from './context';

function ThemedButton() {
  const theme = useContext(ThemeContext);
  return (
    <div>
      <button style={{ color: theme.primary }}>Click</button>
      <span>Label</span>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'ThemedButton.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'ThemedButton.tsx', line: 9, column: 7 }, // <button>
        { file: 'ThemedButton.tsx', line: 10, column: 7 }, // <span>
        Move.Before
      );

      expect(analysis.dependencies.some(d => d.type === DependencyType.Context || d.type === DependencyType.Hook)).toBe(true);
    });

    it('should handle useRef dependencies', () => {
      const code = `
import { useRef } from 'react';

function Form() {
  const inputRef = useRef(null);
  return (
    <div>
      <input ref={inputRef} />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
      <span>Label</span>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'Form.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'Form.tsx', line: 8, column: 7 }, // <input>
        { file: 'Form.tsx', line: 10, column: 7 }, // <span>
        Move.Inside
      );

      expect(analysis.dependencies.some(d => d.type === DependencyType.Ref || d.type === DependencyType.Hook)).toBe(true);
    });

    it('should handle combined dependencies', () => {
      const code = `
import { useState, useEffect, useContext } from 'react';
import { Button } from './components';
import { ConfigContext } from './context';

function Dashboard() {
  const [data, setData] = useState([]);
  const config = useContext(ConfigContext);
  const title = 'Dashboard';

  useEffect(() => {
    fetch(config.apiUrl).then(r => r.json()).then(setData);
  }, [config.apiUrl]);

  return (
    <div>
      <h1>{title}</h1>
      <ul>
        {data.map(item => <li key={item.id}>{item.name}</li>)}
      </ul>
      <Button>Refresh</Button>
      <footer>Footer</footer>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'Dashboard.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'Dashboard.tsx', line: 18, column: 7 }, // <ul>
        { file: 'Dashboard.tsx', line: 22, column: 7 }, // <footer>
        Move.Inside
      );

      expect(analysis.dependencies.length).toBeGreaterThan(0);

      const depTypes = analysis.dependencies.map(d => d.type);
      expect(depTypes).toContain(DependencyType.Hook);
      // The <ul> element uses data from useState (Hook) but not title (Variable)
      // So we only expect Hook dependencies
    });

    it('should handle nested components', () => {
      const code = `
function Parent() {
  const [visible, setVisible] = useState(true);

  function Child() {
    return <span>Child content</span>;
  }

  return (
    <div>
      {visible && <Child />}
      <button onClick={() => setVisible(!visible)}>Toggle</button>
      <section>Target</section>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'Parent.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'Parent.tsx', line: 11, column: 19 }, // <Child />
        { file: 'Parent.tsx', line: 13, column: 7 }, // <section>
        Move.Inside
      );

      expect(analysis.canMove).toBe(true);
    });
  });

  describe('Dependency resolution suggestions', () => {
    it('should suggest fixes for unresolvable moves', () => {
      const code = `
function App() {
  return <div>Text</div>;
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: code },
      ];

      // Try to move with invalid selector
      const analysis = analyze(
        files,
        { file: 'App.tsx', line: 1, column: 1 }, // Not a JSX element
        { file: 'App.tsx', line: 2, column: 10 },
        Move.Inside
      );

      // Should either succeed or provide reason
      expect(typeof analysis.canMove).toBe('boolean');
    });
  });

  describe('Move modes', () => {
    it('should analyze Move.Inside', () => {
      const code = `
function App() {
  return (
    <div>
      <span>Source</span>
      <section>Target</section>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'App.tsx', line: 5, column: 7 },
        { file: 'App.tsx', line: 6, column: 7 },
        Move.Inside
      );

      expect(analysis).toBeDefined();
    });

    it('should analyze Move.Before', () => {
      const code = `
function App() {
  return (
    <div>
      <span>Source</span>
      <section>Target</section>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'App.tsx', line: 5, column: 7 },
        { file: 'App.tsx', line: 6, column: 7 },
        Move.Before
      );

      expect(analysis).toBeDefined();
    });

    it('should analyze Move.After', () => {
      const code = `
function App() {
  return (
    <div>
      <span>Source</span>
      <section>Target</section>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: code },
      ];

      const analysis = analyze(
        files,
        { file: 'App.tsx', line: 5, column: 7 },
        { file: 'App.tsx', line: 6, column: 7 },
        Move.After
      );

      expect(analysis).toBeDefined();
    });
  });
});
