/**
 * Interface Compliance Unit Tests
 *
 * Tests that verify all implementing classes correctly satisfy their interface contracts.
 * These tests ensure method signatures, return types, and type safety are maintained.
 *
 * Test File: src/interfaces/__tests__/interface-compliance.test.ts
 *
 * Test Purpose:
 * - Validate all required interface methods are implemented
 * - Validate method signatures match interface definitions
 * - Validate return types follow Result<T, E> pattern
 * - Validate type safety and polymorphic usage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// Import interfaces
import type {
  IDependencyOrchestrator,
  IScopeManager,
  ICodeGenerator,
} from '../index.js';

// Import implementing classes
import { DependencyOrchestrator } from '../../analyzer/dependency-orchestrator.js';
import { ScopeManager } from '../../scope/scope-manager.js';
import { createCodeGenerator } from '../../generator/index.js';

// Import types and utilities
import { isErr, isOk } from '../../result/index.js';
import type { ScopeInfo } from '../../scope/types.js';
import { ScopeType } from '../../scope/types.js';

// Handle traverse module
const traverse =
  typeof traverseModule === 'function'
    ? traverseModule
    : (traverseModule as any).default;

// =============================================================================
// Test Cases Overview
// =============================================================================
/**
 * | Case ID | Feature Description | Test Type |
 * |---------|---------------------|-------------|
 * | IC-01   | DependencyOrchestrator implements IDependencyOrchestrator | Structural Test |
 * | IC-02   | DependencyOrchestrator.setCurrentFile signature | Signature Test |
 * | IC-03   | DependencyOrchestrator.analyzeElement signature | Signature Test |
 * | IC-04   | DependencyOrchestrator.checkAnalyzability signature | Signature Test |
 * | IC-05   | DependencyOrchestrator.analyzeElement returns Result | Return Type Test |
 * | IC-06   | ScopeManager implements IScopeManager | Structural Test |
 * | IC-07   | ScopeManager.buildScopeTree signature | Signature Test |
 * | IC-08   | ScopeManager.getScopeTree signature | Signature Test |
 * | IC-09   | ScopeManager.isReactComponent signature | Signature Test |
 * | IC-10   | ScopeManager.createComponentScopeFromPath signature | Signature Test |
 * | IC-11   | ScopeManager.checkAccessibility signature | Signature Test |
 * | IC-12   | ScopeManager.computeLCA signature | Signature Test |
 * | IC-13   | ScopeManager.getScopeForNode signature | Signature Test |
 * | IC-14   | ScopeManager.getScopeForPath signature | Signature Test |
 * | IC-15   | ScopeManager.findEnclosingComponent signature | Signature Test |
 * | IC-16   | ScopeManager.getBindingsInScope signature | Signature Test |
 * | IC-17   | ScopeManager.isBindingAccessible signature | Signature Test |
 * | IC-18   | ScopeManager.getAllComponents signature | Signature Test |
 * | IC-19   | ScopeManager.getComponentInfo signature | Signature Test |
 * | IC-20   | ScopeManager.buildScopeTree returns Result | Return Type Test |
 * | IC-21   | ScopeManager.findEnclosingComponent returns Result | Return Type Test |
 * | IC-22   | CodeGenerator implements ICodeGenerator | Structural Test |
 * | IC-23   | CodeGenerator.generate signature | Signature Test |
 * | IC-24   | CodeGenerator.generateMultiple signature | Signature Test |
 * | IC-25   | CodeGenerator.attachComments signature | Signature Test |
 * | IC-26   | CodeGenerator.extractComments signature | Signature Test |
 * | IC-27   | CodeGenerator.removeComments signature | Signature Test |
 * | IC-28   | CodeGenerator.transferComments signature | Signature Test |
 * | IC-29   | CodeGenerator.detectIndentation signature | Signature Test |
 * | IC-30   | CodeGenerator.adjustIndentation signature | Signature Test |
 * | IC-31   | CodeGenerator.adjustNodeIndentation signature | Signature Test |
 * | IC-32   | CodeGenerator.updateOptions signature | Signature Test |
 * | IC-33   | CodeGenerator.getOptions signature | Signature Test |
 * | IC-34   | CodeGenerator.generate returns Result | Return Type Test |
 * | IC-35   | CodeGenerator.generateMultiple returns Result | Return Type Test |
 * | IC-36   | Interface assignability (IDependencyOrchestrator) | Type Safety Test |
 * | IC-37   | Interface assignability (IScopeManager) | Type Safety Test |
 * | IC-38   | Interface assignability (ICodeGenerator) | Type Safety Test |
 */

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Parse JSX code into AST
 */
function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

/**
 * Create a minimal scope manager for testing
 */
function createTestScopeManager(): ScopeManager {
  return new ScopeManager();
}

/**
 * Create a simple test AST with a component
 */
function createTestAST(): t.File {
  const code = `
    function TestComponent() {
      const [count, setCount] = useState(0);
      return <div>{count}</div>;
    }
  `;
  return parseCode(code);
}

/**
 * Get a JSX element path from code
 */
function getJSXElementPath(code: string): NodePath | null {
  const ast = parseCode(code);
  let elementPath: NodePath | null = null;

  traverse(ast, {
    JSXElement(path: NodePath<t.JSXElement>) {
      if (!elementPath) {
        elementPath = path;
      }
    },
  });

  return elementPath;
}

/**
 * Create a minimal ScopeInfo for testing
 */
function createTestScopeInfo(): ScopeInfo {
  const code = 'function test() {}';
  const ast = parseCode(code);
  let funcPath: NodePath | null = null;

  traverse(ast, {
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      funcPath = path;
    },
  });

  if (!funcPath) {
    throw new Error('Failed to create test scope');
  }

  return {
    id: 'test-scope-1',
    type: ScopeType.Function,
    path: funcPath,
    parent: null,
    bindings: new Map(),
    depth: 0,
  };
}

// =============================================================================
// IDependencyOrchestrator Interface Compliance Tests
// =============================================================================

describe('IDependencyOrchestrator Interface Compliance', () => {
  let scopeManager: ScopeManager;
  let analyzer: DependencyOrchestrator;

  beforeEach(() => {
    scopeManager = createTestScopeManager();
    analyzer = new DependencyOrchestrator(scopeManager);
  });

  it('IC-01: DependencyOrchestrator implements IDependencyOrchestrator', () => {
    // Verify class implements interface
    const asInterface: IDependencyOrchestrator = analyzer;

    // Verify all required methods exist
    expect(asInterface).toBeDefined();
    expect(typeof asInterface.setCurrentFile).toBe('function');
    expect(typeof asInterface.analyzeElement).toBe('function');
    expect(typeof asInterface.checkAnalyzability).toBe('function');
  });

  it('IC-02: DependencyOrchestrator.setCurrentFile has correct signature', () => {
    // Test that setCurrentFile accepts string and returns void
    const result = analyzer.setCurrentFile('test.tsx');

    expect(result).toBeUndefined();
  });

  it('IC-03: DependencyOrchestrator.analyzeElement has correct signature', () => {
    // Create test data
    const code = `
      function TestComponent() {
        const count = 1;
        return <div>{count}</div>;
      }
    `;
    const elementPath = getJSXElementPath(code);
    const targetScope = null;

    // Verify method accepts correct parameters
    expect(elementPath).not.toBeNull();

    if (elementPath) {
      const result = analyzer.analyzeElement(elementPath, targetScope);

      // Verify return type is Result
      expect(result).toBeDefined();
      expect('value' in result || 'error' in result).toBe(true);
    }
  });

  it('IC-04: DependencyOrchestrator.checkAnalyzability has correct signature', () => {
    // Create test data
    const code = `
      function TestComponent() {
        return <div>test</div>;
      }
    `;
    const elementPath = getJSXElementPath(code);

    expect(elementPath).not.toBeNull();

    if (elementPath) {
      const result = analyzer.checkAnalyzability(elementPath);

      // Verify return type is AnalyzabilityResult
      expect(result).toBeDefined();
      expect(typeof result.analyzable).toBe('boolean');
      // blockers is optional
      if (result.blockers) {
        expect(Array.isArray(result.blockers)).toBe(true);
      }
    }
  });

  it('IC-05: DependencyOrchestrator.analyzeElement returns Result pattern', () => {
    // Create valid test data
    const code = `
      function TestComponent() {
        const count = 1;
        return <div>{count}</div>;
      }
    `;
    const ast = parseCode(code);
    const buildResult = scopeManager.buildScopeTree(ast);

    expect(isOk(buildResult)).toBe(true);

    const elementPath = getJSXElementPath(code);
    expect(elementPath).not.toBeNull();

    if (elementPath) {
      const result = analyzer.analyzeElement(elementPath, null);

      // Verify Result pattern with isErr/isOk helpers
      const hasError = isErr(result);
      const hasValue = isOk(result);

      expect(hasError || hasValue).toBe(true);

      if (isOk(result)) {
        expect(result.value).toBeDefined();
        expect(result.value.dependencies).toBeDefined();
        expect(Array.isArray(result.value.dependencies)).toBe(true);
        expect(typeof result.value.canResolve).toBe('boolean');
      }

      if (isErr(result)) {
        expect(result.error).toBeDefined();
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
      }
    }
  });

  it('IC-36: Interface assignability (IDependencyOrchestrator)', () => {
    // Create instance and assign to interface type
    const asInterface: IDependencyOrchestrator = analyzer;

    // Call methods through interface reference
    asInterface.setCurrentFile('test.tsx');

    const code = '<div>test</div>';
    const elementPath = getJSXElementPath(code);

    if (elementPath) {
      const analyzability = asInterface.checkAnalyzability(elementPath);
      expect(analyzability).toBeDefined();

      const analysis = asInterface.analyzeElement(elementPath, null);
      expect(analysis).toBeDefined();
    }

    // No TypeScript errors should occur
    expect(asInterface).toBe(analyzer);
  });
});

// =============================================================================
// IScopeManager Interface Compliance Tests
// =============================================================================

describe('IScopeManager Interface Compliance', () => {
  let scopeManager: ScopeManager;

  beforeEach(() => {
    scopeManager = new ScopeManager();
  });

  it('IC-06: ScopeManager implements IScopeManager', () => {
    // Verify class implements interface
    const asInterface: IScopeManager = scopeManager;

    // Verify all required methods exist
    expect(asInterface).toBeDefined();
    expect(typeof asInterface.buildScopeTree).toBe('function');
    expect(typeof asInterface.getScopeTree).toBe('function');
    expect(typeof asInterface.isReactComponent).toBe('function');
    expect(typeof asInterface.createComponentScopeFromPath).toBe('function');
    expect(typeof asInterface.checkAccessibility).toBe('function');
    expect(typeof asInterface.computeLCA).toBe('function');
    expect(typeof asInterface.getScopeForNode).toBe('function');
    expect(typeof asInterface.getScopeForPath).toBe('function');
    expect(typeof asInterface.findEnclosingComponent).toBe('function');
    expect(typeof asInterface.getBindingsInScope).toBe('function');
    expect(typeof asInterface.isBindingAccessible).toBe('function');
    expect(typeof asInterface.getAllComponents).toBe('function');
    expect(typeof asInterface.getComponentInfo).toBe('function');
  });

  it('IC-07: ScopeManager.buildScopeTree has correct signature', () => {
    // Create test AST
    const ast = createTestAST();

    // Call buildScopeTree
    const result = scopeManager.buildScopeTree(ast);

    // Verify return type is Result
    expect(result).toBeDefined();
    expect('value' in result || 'error' in result).toBe(true);
  });

  it('IC-08: ScopeManager.getScopeTree has correct signature', () => {
    // Call getScopeTree
    const result = scopeManager.getScopeTree();

    // Verify return type is ScopeTree | null
    expect(result === null || (result && typeof result === 'object')).toBe(true);
  });

  it('IC-09: ScopeManager.isReactComponent has correct signature', () => {
    // Create test path
    const code = 'function TestComponent() { return <div />; }';
    const ast = parseCode(code);
    let funcPath: NodePath | null = null;

    traverse(ast, {
      FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
        funcPath = path;
      },
    });

    expect(funcPath).not.toBeNull();

    if (funcPath) {
      const result = scopeManager.isReactComponent(funcPath);

      // Verify return type is boolean
      expect(typeof result).toBe('boolean');
    }
  });

  it('IC-10: ScopeManager.createComponentScopeFromPath has correct signature', () => {
    // Note: createComponentScopeFromPath is an internal method that requires
    // a properly initialized scope tree with nodeToScope mappings.
    // For interface compliance testing, we verify the method exists and has
    // the correct type signature without calling it in this isolated test.

    // Verify method exists and has correct signature
    expect(typeof scopeManager.createComponentScopeFromPath).toBe('function');

    // The method signature is:
    // createComponentScopeFromPath(
    //   path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>,
    //   parent: ScopeInfo | null
    // ): ComponentScope | null

    // This is verified at compile time by TypeScript
  });

  it('IC-11: ScopeManager.checkAccessibility has correct signature', () => {
    // Build scope tree first
    const ast = createTestAST();
    scopeManager.buildScopeTree(ast);

    // Create test scopes
    const sourceScope = createTestScopeInfo();
    const targetScope = createTestScopeInfo();

    // Call checkAccessibility
    const result = scopeManager.checkAccessibility(sourceScope, targetScope);

    // Verify return type is AccessibilityResult
    expect(result).toBeDefined();
    expect(typeof result.accessible).toBe('boolean');
  });

  it('IC-12: ScopeManager.computeLCA has correct signature', () => {
    // Create test scopes
    const scopeA = createTestScopeInfo();
    const scopeB = createTestScopeInfo();

    // Call computeLCA
    const result = scopeManager.computeLCA(scopeA, scopeB);

    // Verify return type is LCAResult
    expect(result).toBeDefined();
    expect(result.lca === null || typeof result.lca === 'object').toBe(true);
    expect(typeof result.distanceA).toBe('number');
    expect(typeof result.distanceB).toBe('number');
  });

  it('IC-13: ScopeManager.getScopeForNode has correct signature', () => {
    // Create test node
    const node = t.identifier('test');

    // Call getScopeForNode
    const result = scopeManager.getScopeForNode(node);

    // Verify return type is ScopeInfo | null
    expect(result === null || (result && typeof result === 'object')).toBe(true);
  });

  it('IC-14: ScopeManager.getScopeForPath has correct signature', () => {
    // Create test path
    const code = 'const x = 1;';
    const ast = parseCode(code);
    let varPath: NodePath | null = null;

    traverse(ast, {
      VariableDeclaration(path: NodePath<t.VariableDeclaration>) {
        varPath = path;
      },
    });

    expect(varPath).not.toBeNull();

    if (varPath) {
      const result = scopeManager.getScopeForPath(varPath);

      // Verify return type is ScopeInfo | null
      expect(result === null || (result && typeof result === 'object')).toBe(
        true
      );
    }
  });

  it('IC-15: ScopeManager.findEnclosingComponent has correct signature', () => {
    // Create test path
    const code = 'function TestComponent() { return <div />; }';
    const ast = parseCode(code);
    let jsxPath: NodePath | null = null;

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        jsxPath = path;
      },
    });

    expect(jsxPath).not.toBeNull();

    if (jsxPath) {
      const result = scopeManager.findEnclosingComponent(jsxPath);

      // Verify return type is Result
      expect(result).toBeDefined();
      expect('value' in result || 'error' in result).toBe(true);
    }
  });

  it('IC-16: ScopeManager.getBindingsInScope has correct signature', () => {
    // Create test scope
    const scope = createTestScopeInfo();

    // Call getBindingsInScope
    const result = scopeManager.getBindingsInScope(scope);

    // Verify return type is Map<string, BindingInfo>
    expect(result instanceof Map).toBe(true);
  });

  it('IC-17: ScopeManager.isBindingAccessible has correct signature', () => {
    // Create test scopes
    const fromScope = createTestScopeInfo();
    const bindingScope = createTestScopeInfo();

    // Call isBindingAccessible
    const result = scopeManager.isBindingAccessible(
      'testBinding',
      fromScope,
      bindingScope
    );

    // Verify return type is boolean
    expect(typeof result).toBe('boolean');
  });

  it('IC-18: ScopeManager.getAllComponents has correct signature', () => {
    // Call getAllComponents
    const result = scopeManager.getAllComponents();

    // Verify return type is ComponentInfo[]
    expect(Array.isArray(result)).toBe(true);
  });

  it('IC-19: ScopeManager.getComponentInfo has correct signature', () => {
    // Call getComponentInfo
    const result = scopeManager.getComponentInfo('test-scope-id');

    // Verify return type is ComponentInfo | null
    expect(result === null || (result && typeof result === 'object')).toBe(true);
  });

  it('IC-20: ScopeManager.buildScopeTree returns Result pattern', () => {
    // Create test AST
    const ast = createTestAST();

    // Call buildScopeTree
    const result = scopeManager.buildScopeTree(ast);

    // Verify Result pattern
    const hasError = isErr(result);
    const hasValue = isOk(result);

    expect(hasError || hasValue).toBe(true);

    if (isOk(result)) {
      expect(result.value).toBeDefined();
      expect(result.value.root).toBeDefined();
      expect(result.value.scopes).toBeDefined();
    }

    if (isErr(result)) {
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
      expect(result.error.message).toBeDefined();
    }
  });

  it('IC-21: ScopeManager.findEnclosingComponent returns Result pattern', () => {
    // Create test path
    const code = `
      function TestComponent() {
        return <div>test</div>;
      }
    `;
    const ast = parseCode(code);
    scopeManager.buildScopeTree(ast);

    let jsxPath: NodePath | null = null;
    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        jsxPath = path;
      },
    });

    expect(jsxPath).not.toBeNull();

    if (jsxPath) {
      const result = scopeManager.findEnclosingComponent(jsxPath);

      // Verify Result pattern
      const hasError = isErr(result);
      const hasValue = isOk(result);

      expect(hasError || hasValue).toBe(true);

      if (isOk(result)) {
        expect('value' in result).toBe(true);
      }

      if (isErr(result)) {
        expect(result.error).toBeDefined();
        expect(result.error.code).toBeDefined();
      }
    }
  });

  it('IC-37: Interface assignability (IScopeManager)', () => {
    // Create instance and assign to interface type
    const asInterface: IScopeManager = scopeManager;

    // Call methods through interface reference
    const ast = createTestAST();
    const buildResult = asInterface.buildScopeTree(ast);
    expect(buildResult).toBeDefined();

    const scopeTree = asInterface.getScopeTree();
    expect(scopeTree === null || typeof scopeTree === 'object').toBe(true);

    const components = asInterface.getAllComponents();
    expect(Array.isArray(components)).toBe(true);

    // No TypeScript errors should occur
    expect(asInterface).toBe(scopeManager);
  });
});

// =============================================================================
// ICodeGenerator Interface Compliance Tests
// =============================================================================

describe('ICodeGenerator Interface Compliance', () => {
  let generator: CodeGenerator;

  beforeEach(() => {
    generator = createCodeGenerator();
  });

  it('IC-22: CodeGenerator implements ICodeGenerator', () => {
    // Verify class implements interface
    const asInterface: ICodeGenerator = generator;

    // Verify all required methods exist
    expect(asInterface).toBeDefined();
    expect(typeof asInterface.generate).toBe('function');
    expect(typeof asInterface.generateMultiple).toBe('function');
    expect(typeof asInterface.attachComments).toBe('function');
    expect(typeof asInterface.extractComments).toBe('function');
    expect(typeof asInterface.removeComments).toBe('function');
    expect(typeof asInterface.transferComments).toBe('function');
    expect(typeof asInterface.detectIndentation).toBe('function');
    expect(typeof asInterface.adjustIndentation).toBe('function');
    expect(typeof asInterface.adjustNodeIndentation).toBe('function');
    expect(typeof asInterface.updateOptions).toBe('function');
    expect(typeof asInterface.getOptions).toBe('function');
  });

  it('IC-23: CodeGenerator.generate has correct signature', () => {
    // Create test AST
    const ast = createTestAST();

    // Call generate
    const result = generator.generate(ast);

    // Verify return type is Result
    expect(result).toBeDefined();
    expect('value' in result || 'error' in result).toBe(true);
  });

  it('IC-24: CodeGenerator.generateMultiple has correct signature', () => {
    // Create test ASTs
    const ast1 = createTestAST();
    const ast2 = createTestAST();
    const asts = new Map<string, t.File>([
      ['file1.tsx', ast1],
      ['file2.tsx', ast2],
    ]);

    // Call generateMultiple
    const result = generator.generateMultiple(asts);

    // Verify return type is Result
    expect(result).toBeDefined();
    expect('value' in result || 'error' in result).toBe(true);
  });

  it('IC-25: CodeGenerator.attachComments has correct signature', () => {
    // Create test node
    const node = t.identifier('test');
    const comment: t.Comment = {
      type: 'CommentLine',
      value: 'test',
      start: 0,
      end: 0,
      loc: {
        start: { line: 1, column: 0, index: 0 },
        end: { line: 1, column: 0, index: 0 },
        filename: 'test.tsx',
        identifierName: 'test',
      },
    };
    const comments = {
      leadingComments: [comment],
      trailingComments: [],
    };

    // Call attachComments (should return void)
    const result = generator.attachComments(node, comments);

    // Verify return type is void
    expect(result).toBeUndefined();
  });

  it('IC-26: CodeGenerator.extractComments has correct signature', () => {
    // Create test node with comments
    const node = t.identifier('test');

    // Call extractComments
    const result = generator.extractComments(node);

    // Verify return type is CommentAttachment
    expect(result).toBeDefined();
    // leadingComments and trailingComments are optional
    if (result.leadingComments) {
      expect(Array.isArray(result.leadingComments)).toBe(true);
    }
    if (result.trailingComments) {
      expect(Array.isArray(result.trailingComments)).toBe(true);
    }
  });

  it('IC-27: CodeGenerator.removeComments has correct signature', () => {
    // Create test node
    const node = t.identifier('test');

    // Call removeComments (should return void)
    const result = generator.removeComments(node);

    // Verify return type is void
    expect(result).toBeUndefined();
  });

  it('IC-28: CodeGenerator.transferComments has correct signature', () => {
    // Create test nodes
    const source = t.identifier('source');
    const target = t.identifier('target');

    // Call transferComments (should return void)
    const result = generator.transferComments(source, target);

    // Verify return type is void
    expect(result).toBeUndefined();
  });

  it('IC-29: CodeGenerator.detectIndentation has correct signature', () => {
    // Create test code
    const code = '  const x = 1;';

    // Call detectIndentation
    const result = generator.detectIndentation(code, 1);

    // Verify return type is IndentationInfo
    expect(result).toBeDefined();
    expect(typeof result.char).toBe('string');
    expect(typeof result.size).toBe('number');
  });

  it('IC-30: CodeGenerator.adjustIndentation has correct signature', () => {
    // Create test code
    const code = '  const x = 1;';
    const targetIndent = { char: '  ', size: 2, useTabs: false, level: 2 };

    // Call adjustIndentation
    const result = generator.adjustIndentation(code, targetIndent);

    // Verify return type is string
    expect(typeof result).toBe('string');
  });

  it('IC-31: CodeGenerator.adjustNodeIndentation has correct signature', () => {
    // Create test code
    const nodeCode = '  const x = 1;';
    const targetCode = 'function test() {\n    const y = 2;\n  }';
    const targetLine = 2;

    // Call adjustNodeIndentation
    const result = generator.adjustNodeIndentation(nodeCode, targetCode, targetLine);

    // Verify return type is string
    expect(typeof result).toBe('string');
  });

  it('IC-32: CodeGenerator.updateOptions has correct signature', () => {
    // Call updateOptions (should return void)
    const result = generator.updateOptions({ preserveComments: true });

    // Verify return type is void
    expect(result).toBeUndefined();
  });

  it('IC-33: CodeGenerator.getOptions has correct signature', () => {
    // Call getOptions
    const result = generator.getOptions();

    // Verify return type is Required<GeneratorOptions>
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('IC-34: CodeGenerator.generate returns Result pattern', () => {
    // Create test AST
    const ast = createTestAST();

    // Call generate
    const result = generator.generate(ast);

    // Verify Result pattern
    const hasError = isErr(result);
    const hasValue = isOk(result);

    expect(hasError || hasValue).toBe(true);

    if (isOk(result)) {
      expect(result.value).toBeDefined();
      expect(typeof result.value.code).toBe('string');
    }

    if (isErr(result)) {
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
    }
  });

  it('IC-35: CodeGenerator.generateMultiple returns Result pattern', () => {
    // Create test ASTs
    const ast1 = createTestAST();
    const ast2 = createTestAST();
    const asts = new Map<string, t.File>([
      ['file1.tsx', ast1],
      ['file2.tsx', ast2],
    ]);

    // Call generateMultiple
    const result = generator.generateMultiple(asts);

    // Verify Result pattern
    const hasError = isErr(result);
    const hasValue = isOk(result);

    expect(hasError || hasValue).toBe(true);

    if (isOk(result)) {
      expect(result.value).toBeDefined();
      expect(result.value instanceof Map).toBe(true);
    }

    if (isErr(result)) {
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
    }
  });

  it('IC-38: Interface assignability (ICodeGenerator)', () => {
    // Create instance and assign to interface type
    const asInterface: ICodeGenerator = generator;

    // Call methods through interface reference
    const ast = createTestAST();
    const generateResult = asInterface.generate(ast);
    expect(generateResult).toBeDefined();

    const options = asInterface.getOptions();
    expect(options).toBeDefined();

    asInterface.updateOptions({ preserveComments: false });

    const node = t.identifier('test');
    const comments = asInterface.extractComments(node);
    expect(comments).toBeDefined();

    // No TypeScript errors should occur
    expect(asInterface).toBe(generator);
  });
});
