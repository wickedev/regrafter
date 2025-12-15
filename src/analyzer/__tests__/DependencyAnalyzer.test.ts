/**
 * DependencyAnalyzer Tests
 *
 * Tests for dependency detection including hooks, variables, imports,
 * props, context, refs, and transitive dependencies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import { DependencyAnalyzer, DependencyType } from '../index.js';
import { ScopeManager } from '../../scope/index.js';

describe('DependencyAnalyzer', () => {
  let scopeManager: ScopeManager;
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    scopeManager = new ScopeManager();
    analyzer = new DependencyAnalyzer(scopeManager);
  });

  /**
   * Helper to parse code and return AST
   */
  function parseCode(code: string): t.File {
    return parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  }

  /**
   * Helper to find a JSX element path by tag name
   */
  function findJSXElementPath(ast: t.File, tagName: string): NodePath | null {
    scopeManager.buildScopeTree(ast);

    let found: NodePath | null = null;

    traverse(ast, {
      JSXElement(path) {
        const name = path.node.openingElement.name;
        if (t.isJSXIdentifier(name) && name.name === tagName) {
          found = path;
          path.stop();
        }
      },
    });

    return found;
  }

  /**
   * Helper to find the first JSX element in a component
   */
  function findFirstJSXInComponent(ast: t.File, componentName: string): NodePath | null {
    scopeManager.buildScopeTree(ast);

    let found: NodePath | null = null;

    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id?.name === componentName) {
          path.traverse({
            JSXElement(jsxPath) {
              found = jsxPath;
              jsxPath.stop();
            },
          });
          path.stop();
        }
      },
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === componentName) {
          path.traverse({
            JSXElement(jsxPath) {
              found = jsxPath;
              jsxPath.stop();
            },
          });
          path.stop();
        }
      },
    });

    return found;
  }

  describe('collectIdentifiers', () => {
    it('should collect identifiers from JSX element', () => {
      const code = `
        function App() {
          const name = 'World';
          const count = 42;
          return <div>{name} - {count}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findJSXElementPath(ast, 'div');

      expect(jsxPath).not.toBeNull();

      const result = analyzer.collectIdentifiers(jsxPath!);

      const names = result.identifiers.map(id => id.name);
      expect(names).toContain('name');
      expect(names).toContain('count');
    });

    it('should collect component references from JSX', () => {
      const code = `
        function App() {
          return (
            <div>
              <Button onClick={handleClick}>Click</Button>
              <Header title="Hello" />
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findJSXElementPath(ast, 'div');

      expect(jsxPath).not.toBeNull();

      const result = analyzer.collectIdentifiers(jsxPath!);

      expect(result.jsxElementNames).toContain('Button');
      expect(result.jsxElementNames).toContain('Header');
    });

    it('should collect identifiers from function calls', () => {
      const code = `
        function App() {
          const formatName = (n) => n.toUpperCase();
          const name = 'world';
          return <div>{formatName(name)}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findJSXElementPath(ast, 'div');

      expect(jsxPath).not.toBeNull();

      const result = analyzer.collectIdentifiers(jsxPath!);

      const names = result.identifiers.map(id => id.name);
      expect(names).toContain('formatName');
      expect(names).toContain('name');
    });

    it('should collect identifiers from member expressions', () => {
      const code = `
        function App() {
          const user = { name: 'John' };
          return <div>{user.name}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findJSXElementPath(ast, 'div');

      expect(jsxPath).not.toBeNull();

      const result = analyzer.collectIdentifiers(jsxPath!);

      const names = result.identifiers.map(id => id.name);
      expect(names).toContain('user');
    });

    it('should detect spread attributes', () => {
      const code = `
        function App() {
          const props = { id: 'test' };
          return <div {...props}>Content</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findJSXElementPath(ast, 'div');

      expect(jsxPath).not.toBeNull();

      const result = analyzer.collectIdentifiers(jsxPath!);

      expect(result.spreads.length).toBeGreaterThan(0);
      const names = result.identifiers.map(id => id.name);
      expect(names).toContain('props');
    });
  });

  describe('detectHookDependencies', () => {
    it('should detect useState dependencies', () => {
      const code = `
        function App() {
          const [count, setCount] = useState(0);
          return <div onClick={() => setCount(c => c + 1)}>{count}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const collection = analyzer.collectIdentifiers(jsxPath!);
      const scope = scopeManager.getScopeForPath(jsxPath!);
      const hookDeps = analyzer.detectHookDependencies(collection.identifiers, scope);

      expect(hookDeps.length).toBeGreaterThan(0);
      expect(hookDeps.some(h => h.hookName === 'useState')).toBe(true);
      expect(hookDeps.some(h => h.bindings.includes('count'))).toBe(true);
      expect(hookDeps.some(h => h.bindings.includes('setCount'))).toBe(true);
    });

    it('should detect useEffect dependencies', () => {
      const code = `
        function App() {
          const [count, setCount] = useState(0);

          useEffect(() => {
            document.title = String(count);
          }, [count]);

          return <div>{count}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const collection = analyzer.collectIdentifiers(jsxPath!);
      const scope = scopeManager.getScopeForPath(jsxPath!);
      const hookDeps = analyzer.detectHookDependencies(collection.identifiers, scope);

      expect(hookDeps.length).toBeGreaterThan(0);
    });

    it('should detect custom hooks', () => {
      const code = `
        function App() {
          const { data, loading } = useCustomFetch('/api/data');
          return <div>{loading ? 'Loading...' : data}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const collection = analyzer.collectIdentifiers(jsxPath!);
      const scope = scopeManager.getScopeForPath(jsxPath!);
      const hookDeps = analyzer.detectHookDependencies(collection.identifiers, scope);

      expect(hookDeps.some(h => h.hookName === 'useCustomFetch')).toBe(true);
    });
  });

  describe('detectVariableDependencies', () => {
    it('should detect const variable dependencies', () => {
      const code = `
        function App() {
          const message = 'Hello';
          const count = 42;
          return <div>{message} - {count}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const collection = analyzer.collectIdentifiers(jsxPath!);
      const scope = scopeManager.getScopeForPath(jsxPath!);
      const varDeps = analyzer.detectVariableDependencies(collection.identifiers, scope);

      expect(varDeps.length).toBe(2);
      expect(varDeps.every(v => v.isConst)).toBe(true);
    });

    it('should detect let variable dependencies', () => {
      const code = `
        function App() {
          let counter = 0;
          return <div>{counter}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const collection = analyzer.collectIdentifiers(jsxPath!);
      const scope = scopeManager.getScopeForPath(jsxPath!);
      const varDeps = analyzer.detectVariableDependencies(collection.identifiers, scope);

      expect(varDeps.length).toBe(1);
      expect(varDeps[0]?.isConst).toBe(false);
    });
  });

  describe('detectImportDependencies', () => {
    it('should detect named imports', () => {
      const code = `
        import { Button, Icon } from '@ui/components';

        function App() {
          return (
            <div>
              <Button>
                <Icon name="star" />
              </Button>
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const collection = analyzer.collectIdentifiers(jsxPath!);
      const importDeps = analyzer.detectImportDependencies(collection.identifiers);

      expect(importDeps.length).toBe(2);
      expect(importDeps.some(d => d.localName === 'Button')).toBe(true);
      expect(importDeps.some(d => d.localName === 'Icon')).toBe(true);
    });

    it('should detect default imports', () => {
      const code = `
        import React from 'react';

        function App() {
          return React.createElement('div');
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const collection = analyzer.collectIdentifiers(jsxPath!);
      const importDeps = analyzer.detectImportDependencies(collection.identifiers);

      expect(importDeps.some(d => d.importType === 'default')).toBe(true);
    });
  });

  describe('detectContextDependencies', () => {
    it('should detect useContext dependencies', () => {
      const code = `
        function App() {
          const theme = useContext(ThemeContext);
          return <div style={{ color: theme.primary }}>Themed</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const collection = analyzer.collectIdentifiers(jsxPath!);
      const contextDeps = analyzer.detectContextDependencies(collection.identifiers);

      expect(contextDeps.length).toBeGreaterThan(0);
      expect(contextDeps[0]?.contextName).toBe('ThemeContext');
    });
  });

  describe('detectRefDependencies', () => {
    it('should detect useRef dependencies', () => {
      const code = `
        function App() {
          const inputRef = useRef(null);
          return <input ref={inputRef} />;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const collection = analyzer.collectIdentifiers(jsxPath!);
      const refDeps = analyzer.detectRefDependencies(collection.identifiers);

      expect(refDeps.length).toBe(1);
      expect(refDeps[0]?.name).toBe('inputRef');
    });
  });

  describe('checkAnalyzability', () => {
    it('should detect eval usage as unanalyzable', () => {
      const code = `
        function App() {
          const value = eval('42');
          return <div>{value}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const result = analyzer.checkAnalyzability(jsxPath!);

      expect(result.analyzable).toBe(false);
      expect(result.blockers?.some(b => b.type === 'eval')).toBe(true);
    });

    it('should allow normal code as analyzable', () => {
      const code = `
        function App() {
          const count = 42;
          return <div>{count}</div>;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      const result = analyzer.checkAnalyzability(jsxPath!);

      expect(result.analyzable).toBe(true);
      expect(result.blockers).toBeUndefined();
    });
  });

  describe('analyzeElement', () => {
    it('should perform full dependency analysis', () => {
      const code = `
        import { Button } from '@ui/components';

        function App() {
          const [count, setCount] = useState(0);
          const label = 'Count:';

          return (
            <div>
              <span>{label} {count}</span>
              <Button onClick={() => setCount(c => c + 1)}>Increment</Button>
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      analyzer.setCurrentFile('App.tsx');
      const analysis = analyzer.analyzeElement(jsxPath!, null);

      expect(analysis.canResolve).toBe(true);
      expect(analysis.dependencies.length).toBeGreaterThan(0);

      const depTypes = analysis.dependencies.map(d => d.type);
      expect(depTypes).toContain(DependencyType.Hook);
      expect(depTypes).toContain(DependencyType.Variable);
      expect(depTypes).toContain(DependencyType.Import);
    });

    it('should classify which dependencies need hoisting', () => {
      const code = `
        function App() {
          const [value, setValue] = useState('');
          const computed = value.toUpperCase();

          return <input value={computed} onChange={e => setValue(e.target.value)} />;
        }
      `;

      const ast = parseCode(code);
      const jsxPath = findFirstJSXInComponent(ast, 'App');

      expect(jsxPath).not.toBeNull();

      analyzer.setCurrentFile('App.tsx');
      const analysis = analyzer.analyzeElement(jsxPath!, null);

      expect(analysis.dependencies.length).toBeGreaterThan(0);
    });
  });
});
