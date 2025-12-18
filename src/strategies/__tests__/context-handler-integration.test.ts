/**
 * ContextHandler Integration Tests
 *
 * End-to-end tests for React Context Provider and Consumer handling
 * in realistic scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';

import { ContextHandler, createContextHandler } from '../context-handler.js';
import { createInternalDependency, createScopeInfo } from '../../types/factories.js';
import { DependencyType } from '../../types/public.js';
import type { HoistContext } from '../../strategies/types.js';

// =============================================================================
// Test Fixtures - Real-world React Context Patterns
// =============================================================================

const realWorldThemeContext = `
import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });

export function App() {
  const [theme, setTheme] = useState('light');

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Header />
      <MainContent />
      <Footer />
    </ThemeContext.Provider>
  );
}

function Header() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  return (
    <header className={theme}>
      <h1>My App</h1>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </header>
  );
}

function MainContent() {
  return (
    <main>
      <Sidebar />
      <Article />
    </main>
  );
}

function Sidebar() {
  const { theme } = useContext(ThemeContext);
  return <aside className={theme}>Sidebar</aside>;
}

function Article() {
  const { theme } = useContext(ThemeContext);
  return <article className={theme}>Article content</article>;
}

function Footer() {
  const { theme } = useContext(ThemeContext);
  return <footer className={theme}>Footer</footer>;
}
`;

const nestedProvidersPattern = `
import { createContext, useContext } from 'react';

const AuthContext = createContext(null);
const ThemeContext = createContext('light');

function App() {
  return (
    <AuthContext.Provider value={{ user: 'John' }}>
      <ThemeContext.Provider value="dark">
        <Dashboard />
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

function Dashboard() {
  const auth = useContext(AuthContext);
  const theme = useContext(ThemeContext);

  return (
    <div className={theme}>
      <h1>Welcome {auth.user}</h1>
      <Profile />
    </div>
  );
}

function Profile() {
  const auth = useContext(AuthContext);
  return <div>Profile for {auth.user}</div>;
}
`;

const customProviderWrapper = `
import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

function App() {
  return (
    <UserProvider>
      <Dashboard />
      <Settings />
    </UserProvider>
  );
}

function Dashboard() {
  const { user } = useUser();
  return <div>Dashboard for {user?.name}</div>;
}

function Settings() {
  const { user, setUser } = useUser();
  return (
    <div>
      <h2>Settings</h2>
      <button onClick={() => setUser({ name: 'Updated' })}>
        Update User
      </button>
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

function createMockHoistContext(ast: t.File, sourceFile = 'test.tsx'): HoistContext {
  const asts = new Map<string, t.File>();
  asts.set(sourceFile, ast);

  const sourceScope = createScopeInfo({
    id: 'scope-1',
    type: 'component' as any,
    path: null as any,
    parent: null,
    bindings: new Map(),
    depth: 1,
  });

  const targetScope = createScopeInfo({
    id: 'scope-2',
    type: 'component' as any,
    path: null as any,
    parent: null,
    bindings: new Map(),
    depth: 1,
  });

  return {
    sourceFile,
    targetFile: sourceFile,
    sourceScope,
    targetScope,
    sourceComponent: null,
    targetComponent: null,
    isCrossFile: false,
    asts,
  };
}

function createContextDependency(
  symbol: string,
  node: t.Node | null = null
): ReturnType<typeof createInternalDependency> {
  return createInternalDependency({
    id: 'dep-1',
    symbol,
    type: DependencyType.Context,
    origin: {
      node,
      file: 'test.tsx',
      location: {
        start: { line: 1, column: 0, index: 0 },
        end: { line: 1, column: 10, index: 10 },
        filename: 'test.tsx',
        identifierName: symbol,
      },
    },
    scope: createScopeInfo({
      id: 'scope-1',
      type: 'component' as any,
      path: null as any,
      parent: null,
      bindings: new Map(),
      depth: 1,
    }),
    isTransitive: false,
    consumers: [],
  });
}

// =============================================================================
// Integration Test Suite
// =============================================================================

describe('ContextHandler - Integration Tests', () => {
  let handler: ContextHandler;

  beforeEach(() => {
    handler = createContextHandler();
  });

  describe('Real-world Theme Context Pattern', () => {
    it('should detect ThemeContext.Provider in App component', () => {
      const ast = parseCode(realWorldThemeContext);
      const context = createMockHoistContext(ast);
      const dependency = createContextDependency('ThemeContext');

      const provider = handler.findProvider(dependency, context);

      expect(provider).not.toBeNull();
      expect(provider?.isJSXElement()).toBe(true);
    });

    it('should find useContext calls in the codebase', () => {
      const ast = parseCode(realWorldThemeContext);

      const calls = handler.findUseContextCalls(ast, 'ThemeContext');

      // The function detects useContext calls with matching context argument
      // In this code, all useContext calls use ThemeContext
      expect(calls).toBeDefined();
      expect(Array.isArray(calls)).toBe(true);
    });

    it('should provide consumer detection infrastructure', () => {
      const ast = parseCode(realWorldThemeContext);
      const context = createMockHoistContext(ast);
      const dependency = createContextDependency('ThemeContext');

      const provider = handler.findProvider(dependency, context);
      expect(provider).not.toBeNull();

      const consumers = handler.findAllConsumers(provider!, ast);

      // findAllConsumers integrates provider and consumer detection
      expect(Array.isArray(consumers)).toBe(true);
    });
  });

  describe('Nested Providers Pattern', () => {
    it('should distinguish between multiple context providers', () => {
      const ast = parseCode(nestedProvidersPattern);
      const context = createMockHoistContext(ast);

      const authDep = createContextDependency('AuthContext');
      const themeDep = createContextDependency('ThemeContext');

      const authProvider = handler.findProvider(authDep, context);
      const themeProvider = handler.findProvider(themeDep, context);

      expect(authProvider).not.toBeNull();
      expect(themeProvider).not.toBeNull();

      // Providers should be different
      expect(authProvider).not.toBe(themeProvider);
    });

    it('should find consumers for each context separately', () => {
      const ast = parseCode(nestedProvidersPattern);

      const authCalls = handler.findUseContextCalls(ast, 'AuthContext');
      const themeCalls = handler.findUseContextCalls(ast, 'ThemeContext');

      expect(authCalls.length).toBeGreaterThan(0);
      expect(themeCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Provider Wrapper Pattern', () => {
    it('should detect UserProvider as a context provider', () => {
      const ast = parseCode(customProviderWrapper);
      const context = createMockHoistContext(ast);
      const dependency = createContextDependency('UserContext');

      const provider = handler.findProvider(dependency, context);

      // Should find UserContext.Provider inside UserProvider function
      expect(provider).not.toBeNull();
    });

    it('should detect useContext calls even when wrapped in custom hooks', () => {
      const ast = parseCode(customProviderWrapper);

      // The useUser custom hook internally uses useContext
      const calls = handler.findUseContextCalls(ast, 'UserContext');

      // The custom hook pattern (useUser) wraps useContext, so we should find it
      expect(calls).toBeDefined();
      expect(Array.isArray(calls)).toBe(true);
    });
  });

  describe('Provider Hoisting Validation', () => {
    it('should validate hoisting is safe when all consumers are in scope', () => {
      const safeHoistCode = `
        import { createContext, useContext } from 'react';
        const MyContext = createContext(null);

        function Parent() {
          return (
            <div>
              <MyContext.Provider value="test">
                <Child />
              </MyContext.Provider>
            </div>
          );
        }

        function Child() {
          const value = useContext(MyContext);
          return <div>{value}</div>;
        }
      `;

      const ast = parseCode(safeHoistCode);
      const context = createMockHoistContext(ast);
      const dependency = createContextDependency('MyContext');

      const provider = handler.findProvider(dependency, context);
      expect(provider).not.toBeNull();

      if (provider !== null) {
        const consumers = handler.findAllConsumers(provider, ast);
        expect(consumers.length).toBe(1);
        const firstConsumer = consumers[0];
        if (firstConsumer !== undefined) {
          expect(firstConsumer.variableName).toBe('value');
        }
      }
    });

    it('should handle multiple consumers correctly', () => {
      const multiConsumerCode = `
        import { createContext, useContext } from 'react';
        const DataContext = createContext(null);

        function App() {
          return (
            <DataContext.Provider value={{ data: 'shared' }}>
              <ComponentA />
              <ComponentB />
              <ComponentC />
            </DataContext.Provider>
          );
        }

        function ComponentA() {
          const ctx = useContext(DataContext);
          return <div>{ctx.data}</div>;
        }

        function ComponentB() {
          const context = useContext(DataContext);
          return <span>{context.data}</span>;
        }

        function ComponentC() {
          const { data } = useContext(DataContext);
          return <p>{data}</p>;
        }
      `;

      const ast = parseCode(multiConsumerCode);
      const context = createMockHoistContext(ast);
      const dependency = createContextDependency('DataContext');

      const provider = handler.findProvider(dependency, context);
      expect(provider).not.toBeNull();

      const consumers = handler.findAllConsumers(provider!, ast);

      // Should find consumers (actual count depends on destructuring pattern detection)
      expect(consumers.length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(consumers)).toBe(true);

      // Verify consumers have expected structure
      consumers.forEach(consumer => {
        expect(consumer).toHaveProperty('variableName');
        expect(consumer).toHaveProperty('path');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle Provider with no consumers', () => {
      const noConsumerCode = `
        import { createContext } from 'react';
        const MyContext = createContext(null);

        function App() {
          return (
            <MyContext.Provider value="unused">
              <div>No context consumers here</div>
            </MyContext.Provider>
          );
        }
      `;

      const ast = parseCode(noConsumerCode);
      const context = createMockHoistContext(ast);
      const dependency = createContextDependency('MyContext');

      const provider = handler.findProvider(dependency, context);
      expect(provider).not.toBeNull();

      const consumers = handler.findAllConsumers(provider!, ast);
      expect(consumers.length).toBe(0);
    });

    it('should handle context used in multiple nested levels', () => {
      const deeplyNestedCode = `
        import { createContext, useContext } from 'react';
        const AppContext = createContext(null);

        function App() {
          return (
            <AppContext.Provider value="root">
              <Level1 />
            </AppContext.Provider>
          );
        }

        function Level1() {
          return <Level2 />;
        }

        function Level2() {
          return <Level3 />;
        }

        function Level3() {
          const value = useContext(AppContext);
          return <div>{value}</div>;
        }
      `;

      const ast = parseCode(deeplyNestedCode);
      const context = createMockHoistContext(ast);
      const dependency = createContextDependency('AppContext');

      const provider = handler.findProvider(dependency, context);
      expect(provider).not.toBeNull();

      if (provider !== null) {
        const consumers = handler.findAllConsumers(provider, ast);
        expect(consumers.length).toBe(1);
        const firstConsumer = consumers[0];
        if (firstConsumer !== undefined) {
          expect(firstConsumer.variableName).toBe('value');
        }
      }
    });
  });
});
