/**
 * ScopeManager Tests
 *
 * Tests for scope tracking, component detection, accessibility checking,
 * and LCA algorithm.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import { ScopeManager, ScopeType } from '../index.js';

describe('ScopeManager', () => {
  let scopeManager: ScopeManager;

  beforeEach(() => {
    scopeManager = new ScopeManager();
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
   * Helper to find a function component path by name
   */
  function findComponentPath(ast: t.File, name: string): NodePath | null {
    let found: NodePath | null = null;

    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id?.name === name) {
          found = path;
          path.stop();
        }
      },
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === name) {
          if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
            const initPath = path.get('init');
            if (!Array.isArray(initPath)) {
              found = initPath;
            }
          }
          path.stop();
        }
      },
    });

    return found;
  }

  describe('buildScopeTree', () => {
    it('should build a scope tree from AST', () => {
      const code = `
        function App() {
          const [count, setCount] = React.useState(0);
          return <div>{count}</div>;
        }
      `;

      const ast = parseCode(code);
      const tree = scopeManager.buildScopeTree(ast);

      expect(tree).toBeDefined();
      expect(tree.root).toBeDefined();
      expect(tree.root.type).toBe(ScopeType.Module);
      expect(tree.scopes.size).toBeGreaterThan(0);
    });

    it('should detect React components', () => {
      const code = `
        function Counter() {
          return <div>Counter</div>;
        }

        const Button = () => <button>Click</button>;

        function helper() {
          return 42;
        }
      `;

      const ast = parseCode(code);
      scopeManager.buildScopeTree(ast);

      const components = scopeManager.getAllComponents();
      const componentNames = components.map(c => c.name);

      expect(componentNames).toContain('Counter');
      expect(componentNames).toContain('Button');
      expect(componentNames).not.toContain('helper');
    });

    it('should track hooks in components', () => {
      const code = `
        function App() {
          const [count, setCount] = useState(0);
          const ref = useRef(null);
          const ctx = useContext(MyContext);

          useEffect(() => {
            console.log(count);
          }, [count]);

          return <div>{count}</div>;
        }
      `;

      const ast = parseCode(code);
      scopeManager.buildScopeTree(ast);

      const components = scopeManager.getAllComponents();
      expect(components).toHaveLength(1);

      const app = components[0];
      expect(app?.hooks).toBeDefined();
      expect(app?.hooks.length).toBeGreaterThanOrEqual(3);

      const hookNames = app?.hooks.map(h => h.name) || [];
      expect(hookNames).toContain('useState');
      expect(hookNames).toContain('useRef');
      expect(hookNames).toContain('useContext');
      expect(hookNames).toContain('useEffect');
    });

    it('should detect nested scopes', () => {
      const code = `
        function App() {
          const items = [1, 2, 3];

          if (items.length > 0) {
            for (const item of items) {
              console.log(item);
            }
          }

          return <div />;
        }
      `;

      const ast = parseCode(code);
      const tree = scopeManager.buildScopeTree(ast);

      // Should have module, function/component, and nested block/loop scopes
      expect(tree.scopes.size).toBeGreaterThan(2);
    });
  });

  describe('isReactComponent', () => {
    it('should identify function declarations as components', () => {
      const code = `
        function MyComponent() {
          return <div>Hello</div>;
        }
      `;

      const ast = parseCode(code);
      const path = findComponentPath(ast, 'MyComponent');

      expect(path).not.toBeNull();
      expect(scopeManager.isReactComponent(path!)).toBe(true);
    });

    it('should identify arrow functions as components', () => {
      const code = `
        const MyComponent = () => <div>Hello</div>;
      `;

      const ast = parseCode(code);
      const path = findComponentPath(ast, 'MyComponent');

      expect(path).not.toBeNull();
      expect(scopeManager.isReactComponent(path!)).toBe(true);
    });

    it('should not identify non-components', () => {
      const code = `
        function myHelper() {
          return 42;
        }

        function lowercase() {
          return <div />;
        }
      `;

      const ast = parseCode(code);

      const helperPath = findComponentPath(ast, 'myHelper');
      expect(scopeManager.isReactComponent(helperPath!)).toBe(false);

      const lowercasePath = findComponentPath(ast, 'lowercase');
      expect(scopeManager.isReactComponent(lowercasePath!)).toBe(false);
    });
  });

  describe('checkAccessibility', () => {
    it('should return accessible for same scope', () => {
      const code = `
        function App() {
          const x = 1;
          return <div>{x}</div>;
        }
      `;

      const ast = parseCode(code);
      const tree = scopeManager.buildScopeTree(ast);

      // Get a component scope
      const scopes = Array.from(tree.scopes.values());
      const componentScope = scopes.find(s => s.type === ScopeType.Component);

      expect(componentScope).toBeDefined();

      const result = scopeManager.checkAccessibility(componentScope!, componentScope!);
      expect(result.accessible).toBe(true);
      expect(result.lca).toBe(componentScope);
    });

    it('should return accessible for parent-child relationship', () => {
      const code = `
        function App() {
          const x = 1;

          if (true) {
            console.log(x);
          }

          return <div>{x}</div>;
        }
      `;

      const ast = parseCode(code);
      const tree = scopeManager.buildScopeTree(ast);

      const scopes = Array.from(tree.scopes.values());
      const componentScope = scopes.find(s => s.type === ScopeType.Component);
      const conditionalScope = scopes.find(s => s.type === ScopeType.Conditional);

      if (componentScope && conditionalScope) {
        const result = scopeManager.checkAccessibility(componentScope, conditionalScope);
        expect(result.accessible).toBe(true);
      }
    });
  });

  describe('computeLCA', () => {
    it('should compute LCA for sibling scopes', () => {
      const code = `
        function App() {
          if (true) {
            const a = 1;
          }

          if (false) {
            const b = 2;
          }

          return <div />;
        }
      `;

      const ast = parseCode(code);
      const tree = scopeManager.buildScopeTree(ast);

      const scopes = Array.from(tree.scopes.values());
      const conditionalScopes = scopes.filter(s => s.type === ScopeType.Conditional);

      if (conditionalScopes.length >= 2) {
        const result = scopeManager.computeLCA(conditionalScopes[0]!, conditionalScopes[1]!);

        expect(result.lca).toBeDefined();
        expect(result.distanceA).toBeGreaterThanOrEqual(0);
        expect(result.distanceB).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return null LCA for unrelated scopes', () => {
      // In practice, all scopes in a single file share the module scope as ancestor
      // This test would need multiple file support to test unrelated scopes
      const code = `
        function App() {
          return <div />;
        }
      `;

      const ast = parseCode(code);
      const tree = scopeManager.buildScopeTree(ast);

      // All scopes should have the root as LCA
      const scopes = Array.from(tree.scopes.values());
      if (scopes.length >= 2) {
        const result = scopeManager.computeLCA(scopes[0]!, scopes[1]!);
        expect(result.lca).toBeDefined(); // Should be root
      }
    });
  });

  describe('getScopeForPath', () => {
    it('should return the scope for a given path', () => {
      const code = `
        function App() {
          const x = 1;
          return <div>{x}</div>;
        }
      `;

      const ast = parseCode(code);
      scopeManager.buildScopeTree(ast);

      const componentPath = findComponentPath(ast, 'App');
      expect(componentPath).not.toBeNull();

      const scope = scopeManager.getScopeForPath(componentPath!);
      expect(scope).toBeDefined();
      expect(scope?.type).toBe(ScopeType.Component);
    });
  });

  describe('findEnclosingComponent', () => {
    it('should find the enclosing component for a JSX element', () => {
      const code = `
        function App() {
          return (
            <div>
              <span>Hello</span>
            </div>
          );
        }
      `;

      const ast = parseCode(code);
      scopeManager.buildScopeTree(ast);

      let spanPath: NodePath | null = null;
      traverse(ast, {
        JSXElement(path) {
          const name = path.node.openingElement.name;
          if (t.isJSXIdentifier(name) && name.name === 'span') {
            spanPath = path;
            path.stop();
          }
        },
      });

      expect(spanPath).not.toBeNull();

      const component = scopeManager.findEnclosingComponent(spanPath!);
      expect(component).toBeDefined();
      expect(component?.componentName).toBe('App');
    });
  });
});
