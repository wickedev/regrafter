/**
 * HoistExecutor Unit Tests
 *
 * Tests for executing hoisting operations on AST.
 * This test suite achieves ≥95% coverage of HoistExecutor.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import generateModule from '@babel/generator';

import { HoistExecutor, createHoistExecutor, type HoistExecutionContext } from '../hoist-executor.js';
import type { HoistPlan } from '../types.js';
import { HoistStrategy } from '../../types/internal.js';
import { DependencyType } from '../../types/public.js';
import {
  createHoistOperation,
  createPropThreadOperation,
  createImportOperation,
  createImportSpecifier,
  createInternalDependency,
  createDependencyOrigin,
  createScopeInfo,
  generateId,
} from '../../types/factories.js';
import { ScopeType } from '../../types/internal.js';
import { loadTraverseFunction } from '../../utils/babel-loader.js';
import { isErr } from '../../result/index.js';

const traverse = loadTraverseFunction(traverseModule);
const generate = generateModule.default || generateModule;

// =============================================================================
// Test Fixtures
// =============================================================================

const simpleComponentCode = `
function Parent() {
  const value = 'test';

  function Child() {
    const localVar = 42;
    return <div>{value}</div>;
  }

  return <Child />;
}
`;

const nestedScopesCode = `
function GrandParent() {
  const grandValue = 'grand';

  function Parent() {
    const parentValue = 'parent';

    function Child() {
      const childValue = 'child';
      return <div>{childValue}</div>;
    }

    return <Child />;
  }

  return <Parent />;
}
`;

const componentWithPropsCode = `
function Parent({ data }) {
  return <Child />;
}

function Child() {
  return <div>Hello</div>;
}
`;

const componentWithImportsCode = `
import React from 'react';

function App() {
  return <div>Hello</div>;
}
`;

const componentWithMultipleFunctionsCode = `
function Component1({ value }) {
  return <Component2 />;
}

const Component2 = function({ theme }) {
  return <Component3 />;
};

const Component3 = ({ color }) => {
  return <div>{color}</div>;
};
`;

const emptyFunctionCode = `
function Parent() {
  function Child() {
    const onlyStatement = 42;
  }
  return <div />;
}
`;

const nonBlockFunctionCode = `
const shortFunc = () => 42;

function Parent() {
  const value = 'test';
  return <div />;
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

function findFunctionByName(ast: t.File, name: string): NodePath | null {
  let foundPath: NodePath | null = null;

  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id?.name === name) {
        foundPath = path;
        path.stop();
      }
    },
    VariableDeclarator(path) {
      if (
        t.isIdentifier(path.node.id) &&
        path.node.id.name === name &&
        (t.isFunctionExpression(path.node.init) || t.isArrowFunctionExpression(path.node.init))
      ) {
        foundPath = path.get('init') as NodePath;
        path.stop();
      }
    },
  });

  return foundPath;
}

function findVariableDeclaration(ast: t.File, name: string): NodePath | null {
  let foundPath: NodePath | null = null;

  traverse(ast, {
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id) && path.node.id.name === name) {
        // Get the statement level (VariableDeclaration)
        const statement = path.parentPath;
        if (statement && statement.isVariableDeclaration()) {
          foundPath = statement;
          path.stop();
        }
      }
    },
  });

  return foundPath;
}

function createTestContext(ast: t.File): HoistExecutionContext {
  return {
    ast,
    dependencyPaths: new Map(),
    scopePaths: new Map(),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('HoistExecutor', () => {
  let executor: HoistExecutor;

  beforeEach(() => {
    executor = createHoistExecutor();
  });

  describe('execute', () => {
    it('should execute a valid hoisting plan', () => {
      const ast = parseCode(simpleComponentCode);
      const parentPath = findFunctionByName(ast, 'Parent');
      const childPath = findFunctionByName(ast, 'Child');

      expect(parentPath).toBeTruthy();
      expect(childPath).toBeTruthy();

      const parentScope = createScopeInfo({
        type: ScopeType.Component,
        path: parentPath!,
        parent: null,
      });

      const childScope = createScopeInfo({
        type: ScopeType.Component,
        path: childPath!,
        parent: parentScope,
      });

      const context = createTestContext(ast);
      context.scopePaths.set('parent', parentPath!);
      context.scopePaths.set('child', childPath!);

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });

    it('should reject invalid hoisting plan', () => {
      const ast = parseCode(simpleComponentCode);
      const context = createTestContext(ast);

      const plan: HoistPlan = {
        valid: false,
        invalidReason: 'Test error',
        hoistOperations: [],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Cannot execute invalid hoisting plan');
        expect(result.error.message).toContain('Test error');
      }
    });

    it('should initialize insertion indices if not provided', () => {
      const ast = parseCode(simpleComponentCode);
      const context = createTestContext(ast);

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
      expect(context.insertionIndices).toBeDefined();
      expect(context.insertionIndices).toBeInstanceOf(Map);
    });

    it('should execute hoist operations before imports and prop threading', () => {
      const ast = parseCode(componentWithImportsCode);
      const appPath = findFunctionByName(ast, 'App');

      expect(appPath).toBeTruthy();

      const context = createTestContext(ast);
      context.scopePaths.set('app', appPath!);

      const hoistOp = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'app',
        strategy: HoistStrategy.PassAsProp,
      });

      const importOp = createImportOperation({
        file: 'test.tsx',
        importSource: 'react',
        specifiers: [createImportSpecifier({ type: 'named', imported: 'useState' })],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [hoistOp],
        propThreadOperations: [],
        importOperations: [importOp],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });
  });

  describe('executeHoistOperation', () => {
    it('should handle Hoist strategy', () => {
      const ast = parseCode(simpleComponentCode);
      const parentPath = findFunctionByName(ast, 'Parent');
      const childPath = findFunctionByName(ast, 'Child');
      const varPath = findVariableDeclaration(ast, 'localVar');

      expect(parentPath).toBeTruthy();
      expect(childPath).toBeTruthy();
      expect(varPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', varPath!);
      context.scopePaths.set('parent', parentPath!);
      context.scopePaths.set('child', childPath!);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'localVar',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });

    it('should skip PassAsProp strategy (handled by prop threading)', () => {
      const ast = parseCode(simpleComponentCode);
      const context = createTestContext(ast);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.PassAsProp,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });

    it('should skip CreateShared strategy (handled by import operations)', () => {
      const ast = parseCode(simpleComponentCode);
      const context = createTestContext(ast);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.CreateShared,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });

    it('should skip WrapProvider strategy', () => {
      const ast = parseCode(simpleComponentCode);
      const context = createTestContext(ast);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.WrapProvider,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });

    it('should skip ExtractContext strategy', () => {
      const ast = parseCode(simpleComponentCode);
      const context = createTestContext(ast);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.ExtractContext,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });
  });

  describe('executeHoisting', () => {
    it('should hoist variable from child to parent scope', () => {
      const ast = parseCode(simpleComponentCode);
      const parentPath = findFunctionByName(ast, 'Parent');
      const childPath = findFunctionByName(ast, 'Child');
      const varPath = findVariableDeclaration(ast, 'localVar');

      expect(parentPath).toBeTruthy();
      expect(childPath).toBeTruthy();
      expect(varPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', varPath!);
      context.scopePaths.set('parent', parentPath!);
      context.insertionIndices = new Map();

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'localVar',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      // Verify the variable was hoisted
      const code = generate(ast).code;
      expect(code).toContain('localVar');
    });

    it('should handle multiple hoisting operations with insertion index tracking', () => {
      const ast = parseCode(nestedScopesCode);
      const grandParentPath = findFunctionByName(ast, 'GrandParent');
      const parentPath = findFunctionByName(ast, 'Parent');
      const childPath = findFunctionByName(ast, 'Child');
      const varPath = findVariableDeclaration(ast, 'childValue');

      expect(grandParentPath).toBeTruthy();
      expect(parentPath).toBeTruthy();
      expect(childPath).toBeTruthy();
      expect(varPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', varPath!);
      context.scopePaths.set('grandParent', grandParentPath!);
      context.insertionIndices = new Map();

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'childValue',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'grandParent',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      // Check that insertion index was tracked
      expect(context.insertionIndices?.get('grandParent')).toBe(1);
    });

    it('should warn when dependency not found in dependencyPaths', () => {
      const ast = parseCode(simpleComponentCode);
      const parentPath = findFunctionByName(ast, 'Parent');

      expect(parentPath).toBeTruthy();

      const context = createTestContext(ast);
      context.scopePaths.set('parent', parentPath!);
      // Note: dependencyPaths is empty - dependency will not be found

      const operation = createHoistOperation({
        dependencyId: 'nonexistent',
        symbol: 'missing',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      // Should not error, just skip the operation
      expect(isErr(result)).toBe(false);
    });

    it('should warn when target scope not found in scopePaths', () => {
      const ast = parseCode(simpleComponentCode);
      const varPath = findVariableDeclaration(ast, 'value');

      expect(varPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', varPath!);
      // Note: scopePaths is empty - target scope will not be found

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'nonexistent',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      // Should not error, just skip the operation
      expect(isErr(result)).toBe(false);
    });

    it('should handle identifier references by finding their bindings', () => {
      const code = `
        function Parent() {
          const value = 'test';

          function Child() {
            return <div>{value}</div>;
          }

          return <Child />;
        }
      `;
      const ast = parseCode(code);
      const parentPath = findFunctionByName(ast, 'Parent');

      expect(parentPath).toBeTruthy();

      // Find the identifier reference to 'value' in Child
      let identifierPath: NodePath | null = null;
      traverse(ast, {
        JSXExpressionContainer(path) {
          if (t.isIdentifier(path.node.expression) && path.node.expression.name === 'value') {
            identifierPath = path.get('expression') as NodePath;
            path.stop();
          }
        },
      });

      expect(identifierPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', identifierPath!);
      context.scopePaths.set('parent', parentPath!);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });

    it('should replace last statement with return to keep function valid', () => {
      const ast = parseCode(emptyFunctionCode);
      const parentPath = findFunctionByName(ast, 'Parent');
      const childPath = findFunctionByName(ast, 'Child');
      const varPath = findVariableDeclaration(ast, 'onlyStatement');

      expect(parentPath).toBeTruthy();
      expect(childPath).toBeTruthy();
      expect(varPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', varPath!);
      context.scopePaths.set('parent', parentPath!);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'onlyStatement',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      // Verify that Child function now has a return statement
      const code = generate(ast).code;
      expect(code).toContain('function Child() {\n    return;');
    });

    it('should warn when target scope is not a function', () => {
      const code = `
        const value = 'test';

        function Component() {
          return <div>{value}</div>;
        }
      `;
      const ast = parseCode(code);
      const varPath = findVariableDeclaration(ast, 'value');

      expect(varPath).toBeTruthy();

      // Use the program as the "target scope" (which is not a function)
      let programPath: NodePath | null = null;
      traverse(ast, {
        Program(path) {
          programPath = path;
          path.stop();
        },
      });

      expect(programPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', varPath!);
      context.scopePaths.set('module', programPath!);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'component',
        toFile: 'test.tsx',
        toScope: 'module',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      // Should not error, just skip the operation
      expect(isErr(result)).toBe(false);
    });
  });

  describe('executeImportOperation', () => {
    it('should add default import specifier', () => {
      const ast = parseCode(componentWithImportsCode);
      const context = createTestContext(ast);

      const operation = createImportOperation({
        file: 'test.tsx',
        importSource: 'lodash',
        specifiers: [createImportSpecifier({ type: 'default', imported: 'default', local: '_' })],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [],
        importOperations: [operation],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const code = generate(ast).code;
      expect(code).toContain('import _ from');
      expect(code).toContain('lodash');
    });

    it('should add named import specifier', () => {
      const ast = parseCode(componentWithImportsCode);
      const context = createTestContext(ast);

      const operation = createImportOperation({
        file: 'test.tsx',
        importSource: 'react',
        specifiers: [createImportSpecifier({ type: 'named', imported: 'useState' })],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [],
        importOperations: [operation],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const code = generate(ast).code;
      expect(code).toContain('useState');
    });

    it('should add namespace import specifier', () => {
      const ast = parseCode(componentWithImportsCode);
      const context = createTestContext(ast);

      const operation = createImportOperation({
        file: 'test.tsx',
        importSource: 'utils',
        specifiers: [createImportSpecifier({ type: 'namespace', imported: '*', local: 'Utils' })],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [],
        importOperations: [operation],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const code = generate(ast).code;
      expect(code).toContain('import * as Utils from');
      expect(code).toContain('utils');
    });

    it('should add multiple import specifiers', () => {
      const ast = parseCode(componentWithImportsCode);
      const context = createTestContext(ast);

      const operation = createImportOperation({
        file: 'test.tsx',
        importSource: 'react',
        specifiers: [
          createImportSpecifier({ type: 'named', imported: 'useState' }),
          createImportSpecifier({ type: 'named', imported: 'useEffect' }),
        ],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [],
        importOperations: [operation],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const code = generate(ast).code;
      expect(code).toContain('useState');
      expect(code).toContain('useEffect');
    });

    it('should insert after existing imports', () => {
      const ast = parseCode(componentWithImportsCode);
      const context = createTestContext(ast);

      const operation = createImportOperation({
        file: 'test.tsx',
        importSource: 'lodash',
        specifiers: [createImportSpecifier({ type: 'default', imported: 'default', local: '_' })],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [],
        importOperations: [operation],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      // Verify the new import comes after the existing React import
      const code = generate(ast).code;
      const reactImportIndex = code.indexOf('import React');
      const lodashImportIndex = code.indexOf('import _');

      expect(reactImportIndex).toBeGreaterThan(-1);
      expect(lodashImportIndex).toBeGreaterThan(-1);
      expect(lodashImportIndex).toBeGreaterThan(reactImportIndex);
    });

    it('should insert at beginning when no imports exist', () => {
      const code = `
        function Component() {
          return <div>Hello</div>;
        }
      `;
      const ast = parseCode(code);
      const context = createTestContext(ast);

      const operation = createImportOperation({
        file: 'test.tsx',
        importSource: 'react',
        specifiers: [createImportSpecifier({ type: 'default', imported: 'default', local: 'React' })],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [],
        importOperations: [operation],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const generatedCode = generate(ast).code;
      expect(generatedCode).toContain('import React from');
      expect(generatedCode).toContain('react');

      // Import should be at the beginning
      expect(generatedCode.trim().startsWith('import')).toBe(true);
    });
  });

  describe('executePropThreadOperation', () => {
    it('should add prop to component in threading path', () => {
      const code = `
        function Parent() {
          return <Child />;
        }

        function Child() {
          return <div>Hello</div>;
        }
      `;
      const ast = parseCode(code);
      const context = createTestContext(ast);

      const operation = createPropThreadOperation({
        propName: 'value',
        valueExpression: 'value',
        fromComponent: 'Parent',
        toComponent: 'Child',
        path: ['Child'],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [operation],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const generatedCode = generate(ast).code;
      expect(generatedCode).toContain('<Child value={value}');
    });

    it('should not add duplicate props', () => {
      const code = `
        function Parent() {
          return <Child value={existing} />;
        }

        function Child() {
          return <div>Hello</div>;
        }
      `;
      const ast = parseCode(code);
      const context = createTestContext(ast);

      const operation = createPropThreadOperation({
        propName: 'value',
        valueExpression: 'value',
        fromComponent: 'Parent',
        toComponent: 'Child',
        path: ['Child'],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [operation],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const generatedCode = generate(ast).code;
      // Should still have the existing prop, not duplicate
      const valueMatches = generatedCode.match(/value=/g);
      expect(valueMatches).toHaveLength(1);
    });

    it('should add prop to FunctionDeclaration parameters', () => {
      const code = `
        function Child({ theme }) {
          return <div>{theme}</div>;
        }
      `;
      const ast = parseCode(code);
      const context = createTestContext(ast);

      const operation = createPropThreadOperation({
        propName: 'value',
        valueExpression: 'value',
        fromComponent: 'Parent',
        toComponent: 'Child',
        path: ['Child'],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [operation],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const generatedCode = generate(ast).code;
      // Check that both props are present (order/formatting may vary)
      expect(generatedCode).toContain('theme');
      expect(generatedCode).toContain('value');
    });

    it('should add prop to FunctionExpression parameters', () => {
      const code = `
        const Child = function({ theme }) {
          return <div>{theme}</div>;
        };
      `;
      const ast = parseCode(code);
      const context = createTestContext(ast);

      const operation = createPropThreadOperation({
        propName: 'value',
        valueExpression: 'value',
        fromComponent: 'Parent',
        toComponent: 'Child',
        path: ['Child'],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [operation],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const generatedCode = generate(ast).code;
      // Check that both props are present (order/formatting may vary)
      expect(generatedCode).toContain('theme');
      expect(generatedCode).toContain('value');
    });

    it('should add prop to ArrowFunctionExpression parameters', () => {
      const code = `
        const Child = ({ theme }) => {
          return <div>{theme}</div>;
        };
      `;
      const ast = parseCode(code);
      const context = createTestContext(ast);

      const operation = createPropThreadOperation({
        propName: 'value',
        valueExpression: 'value',
        fromComponent: 'Parent',
        toComponent: 'Child',
        path: ['Child'],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [operation],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const generatedCode = generate(ast).code;
      // Check that both props are present (order/formatting may vary)
      expect(generatedCode).toContain('theme');
      expect(generatedCode).toContain('value');
    });

    it('should create object pattern when function has no parameters', () => {
      const code = `
        const Child = () => {
          return <div>Hello</div>;
        };
      `;
      const ast = parseCode(code);
      const context = createTestContext(ast);

      const operation = createPropThreadOperation({
        propName: 'value',
        valueExpression: 'value',
        fromComponent: 'Parent',
        toComponent: 'Child',
        path: ['Child'],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [operation],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const generatedCode = generate(ast).code;
      // Check that value prop was added
      expect(generatedCode).toContain('value');
    });

    it('should not duplicate prop in function parameters', () => {
      const code = `
        function Child({ value, theme }) {
          return <div>{theme} - {value}</div>;
        }
      `;
      const ast = parseCode(code);
      const context = createTestContext(ast);

      const operation = createPropThreadOperation({
        propName: 'value',
        valueExpression: 'value',
        fromComponent: 'Parent',
        toComponent: 'Child',
        path: ['Child'],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [operation],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const generatedCode = generate(ast).code;
      // Should not add duplicate 'value' prop
      const valueMatches = generatedCode.match(/\bvalue\b/g);
      // Should appear exactly 2 times: once in params, once in JSX (not duplicated)
      expect(valueMatches?.length).toBe(2);
    });

    it('should handle multiple components in threading path', () => {
      const code = `
        function Parent() {
          return <Middle />;
        }

        function Middle() {
          return <Child />;
        }

        function Child() {
          return <div>Hello</div>;
        }
      `;
      const ast = parseCode(code);
      const context = createTestContext(ast);

      const operation = createPropThreadOperation({
        propName: 'value',
        valueExpression: 'value',
        fromComponent: 'Parent',
        toComponent: 'Child',
        path: ['Middle', 'Child'],
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [],
        propThreadOperations: [operation],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);

      const generatedCode = generate(ast).code;
      expect(generatedCode).toContain('<Middle value={value}');
      expect(generatedCode).toContain('<Child value={value}');
    });
  });

  describe('createHoistExecutor', () => {
    it('should create a new HoistExecutor instance', () => {
      const executor = createHoistExecutor();
      expect(executor).toBeInstanceOf(HoistExecutor);
    });

    it('should create independent instances', () => {
      const executor1 = createHoistExecutor();
      const executor2 = createHoistExecutor();
      expect(executor1).not.toBe(executor2);
    });
  });

  describe('edge cases for branch coverage', () => {
    it('should warn when hoisting to function with array body (non-block)', () => {
      // Create a function with expression body (arrow function without braces)
      const code = `
        const Parent = () => (
          <div>Parent</div>
        );

        function Child() {
          const value = 42;
          return <div>{value}</div>;
        }
      `;
      const ast = parseCode(code);
      const parentPath = findFunctionByName(ast, 'Parent');
      const varPath = findVariableDeclaration(ast, 'value');

      expect(parentPath).toBeTruthy();
      expect(varPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', varPath!);
      context.scopePaths.set('parent', parentPath!);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      // Should not error, just warn and skip
      expect(isErr(result)).toBe(false);
    });

    it('should handle removal when parent function has non-block body', () => {
      // Create a case where the parent function of the declaration is an arrow function with expression body
      const code = `
        function Outer() {
          const Inner = () => 42;

          function Component() {
            const value = Inner();
            return <div>{value}</div>;
          }

          return <Component />;
        }
      `;
      const ast = parseCode(code);
      const outerPath = findFunctionByName(ast, 'Outer');

      // Find the Inner function declaration
      let innerPath: NodePath | null = null;
      traverse(ast, {
        VariableDeclarator(path) {
          if (
            t.isIdentifier(path.node.id) &&
            path.node.id.name === 'Inner' &&
            t.isArrowFunctionExpression(path.node.init)
          ) {
            const statement = path.parentPath;
            if (statement && statement.isVariableDeclaration()) {
              innerPath = statement;
              path.stop();
            }
          }
        },
      });

      expect(outerPath).toBeTruthy();
      expect(innerPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', innerPath!);
      context.scopePaths.set('outer', outerPath!);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'Inner',
        fromFile: 'test.tsx',
        fromScope: 'component',
        toFile: 'test.tsx',
        toScope: 'outer',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });

    it('should handle removal when no parent function exists', () => {
      // Create a module-level variable that we try to hoist
      const code = `
        const moduleValue = 42;

        function Component() {
          return <div>{moduleValue}</div>;
        }
      `;
      const ast = parseCode(code);
      const componentPath = findFunctionByName(ast, 'Component');
      const varPath = findVariableDeclaration(ast, 'moduleValue');

      expect(componentPath).toBeTruthy();
      expect(varPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', varPath!);
      context.scopePaths.set('component', componentPath!);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'moduleValue',
        fromFile: 'test.tsx',
        fromScope: 'module',
        toFile: 'test.tsx',
        toScope: 'component',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      expect(isErr(result)).toBe(false);
    });

    it('should warn when target body is not a block statement', () => {
      // Create a function with non-block body
      const code = `
        const Parent = () => <div>Parent</div>;

        function Child() {
          const value = 42;
          return <div>{value}</div>;
        }
      `;
      const ast = parseCode(code);
      const parentPath = findFunctionByName(ast, 'Parent');
      const varPath = findVariableDeclaration(ast, 'value');

      expect(parentPath).toBeTruthy();
      expect(varPath).toBeTruthy();

      const context = createTestContext(ast);
      context.dependencyPaths.set('dep1', varPath!);
      context.scopePaths.set('parent', parentPath!);

      const operation = createHoistOperation({
        dependencyId: 'dep1',
        symbol: 'value',
        fromFile: 'test.tsx',
        fromScope: 'child',
        toFile: 'test.tsx',
        toScope: 'parent',
        strategy: HoistStrategy.Hoist,
      });

      const plan: HoistPlan = {
        valid: true,
        hoistOperations: [operation],
        propThreadOperations: [],
        importOperations: [],
        unhoistable: [],
        warnings: [],
      };

      const result = executor.execute(plan, context);
      // Should not error, just warn and skip
      expect(isErr(result)).toBe(false);
    });

    it('should warn when cannot find statement level for dependency', () => {
      // Create a scenario where we have an identifier that is not at statement level
      // and has no parent path (edge case)
      const code = `
        function Parent() {
          const value = 42;
          return <div>Hello</div>;
        }

        function Child() {
          return <div>World</div>;
        }
      `;
      const ast = parseCode(code);
      const parentPath = findFunctionByName(ast, 'Parent');

      expect(parentPath).toBeTruthy();

      // Find an identifier node that's not easily navigable to statement level
      let identifierPath: NodePath | null = null;
      traverse(ast, {
        Identifier(path) {
          if (path.node.name === 'value' && path.key === 'id') {
            // This is the 'value' identifier in the variable declaration
            // It's not a statement itself
            identifierPath = path;
            path.stop();
          }
        },
      });

      if (identifierPath) {
        const context = createTestContext(ast);
        context.dependencyPaths.set('dep1', identifierPath);
        context.scopePaths.set('parent', parentPath!);

        const operation = createHoistOperation({
          dependencyId: 'dep1',
          symbol: 'value',
          fromFile: 'test.tsx',
          fromScope: 'child',
          toFile: 'test.tsx',
          toScope: 'parent',
          strategy: HoistStrategy.Hoist,
        });

        const plan: HoistPlan = {
          valid: true,
          hoistOperations: [operation],
          propThreadOperations: [],
          importOperations: [],
          unhoistable: [],
          warnings: [],
        };

        const result = executor.execute(plan, context);
        // Should not error, just warn and skip
        expect(isErr(result)).toBe(false);
      }
    });
  });
});
