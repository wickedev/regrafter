/**
 * Integration Tests for Cross-File Strategy
 *
 * Tests complex scenarios including circular dependencies, transitive dependencies,
 * multi-file moves, and shared module creation.
 *
 * Target: Achieve ≥95% coverage for cross-file module
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';

import {
  executeCrossFileTransform,
  createCrossFileContext,
  buildImportGraph,
  detectCircularDependencies,
  resolveCircularDependencies,
  analyzeDependencyExports,
  generateSharedModule,
  updateSourceFileReferences,
  generateTargetImports,
  addImportsToAst,
} from '../index.js';
import {
  createInternalDependency,
  createDependencyOrigin,
  createScopeInfo,
} from '../../../types/factories.js';
import { DependencyType } from '../../../types/public.js';
import { ScopeType } from '../../../types/internal.js';
import { isOk, isErr } from '../../../result/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Utilities
// ═══════════════════════════════════════════════════════════════════════════════

function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

function createMockPath(): any {
  return {
    node: {},
    scope: {},
    parent: null,
    parentPath: null,
  };
}

function createMockDependency(
  symbol: string,
  file: string,
  type: DependencyType = DependencyType.Variable
) {
  const mockPath = createMockPath();
  return createInternalDependency({
    symbol,
    type,
    origin: createDependencyOrigin({
      node: { type: 'Identifier', name: symbol } as any,
      file,
    }),
    scope: createScopeInfo({
      type: ScopeType.Function,
      path: mockPath,
      parent: null,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INT-01: Circular dependency A→B→A resolution
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-01: Circular dependency A→B→A resolution', () => {
  it('should detect and resolve simple circular dependency', () => {
    const fileA = parseCode(`
      import { funcB } from './B';
      export const funcA = () => funcB();
    `);

    const fileB = parseCode(`
      import { funcA } from './A';
      export const funcB = () => funcA();
    `);

    const asts = new Map<string, t.File>([
      ['src/A.ts', fileA],
      ['src/B.ts', fileB],
    ]);

    const graph = buildImportGraph(asts);
    const detection = detectCircularDependencies(graph);

    expect(detection.hasCircular).toBe(true);
    expect(detection.cycles.length).toBeGreaterThan(0);
    expect(detection.shortestCycle).toBeDefined();

    // Resolve the circular dependency
    const resolution = resolveCircularDependencies(graph, asts);

    expect(resolution.success).toBe(true);
    expect(resolution.resolutions.length).toBeGreaterThan(0);

    // Verify shared module was created
    const hasSharedModule = resolution.resolutions.some(
      (r) => r.type === 'extract_shared' && r.sharedModulePath
    );
    expect(hasSharedModule).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INT-02: Circular dependency A→B→C→A resolution
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-02: Three-way circular dependency', () => {
  it('should detect and resolve A→B→C→A cycle', () => {
    const fileA = parseCode(`
      import { funcB } from './B';
      export const funcA = () => funcB();
    `);

    const fileB = parseCode(`
      import { funcC } from './C';
      export const funcB = () => funcC();
    `);

    const fileC = parseCode(`
      import { funcA } from './A';
      export const funcC = () => funcA();
    `);

    const asts = new Map<string, t.File>([
      ['src/A.ts', fileA],
      ['src/B.ts', fileB],
      ['src/C.ts', fileC],
    ]);

    const graph = buildImportGraph(asts);
    const detection = detectCircularDependencies(graph);

    expect(detection.hasCircular).toBe(true);
    expect(detection.shortestCycle).toBeDefined();
    expect(detection.shortestCycle!.length).toBeGreaterThanOrEqual(3);

    const resolution = resolveCircularDependencies(graph, asts);

    expect(resolution.success).toBe(true);
    expect(resolution.resolutions.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INT-03: Transitive dependency A depends on B, B depends on C
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-03: Transitive dependencies', () => {
  it('should handle transitive dependency chain', () => {
    const fileC = parseCode(`
      export const BASE = 10;
    `);

    const fileB = parseCode(`
      import { BASE } from './C';
      export const multiply = (x) => x * BASE;
    `);

    const fileA = parseCode(`
      import { multiply } from './B';
      const result = multiply(5);
    `);

    const asts = new Map<string, t.File>([
      ['src/A.ts', fileA],
      ['src/B.ts', fileB],
      ['src/C.ts', fileC],
    ]);

    const contents = new Map<string, string>([
      ['src/A.ts', 'import { multiply } from \'./B\';\nconst result = multiply(5);'],
      ['src/B.ts', 'import { BASE } from \'./C\';\nexport const multiply = (x) => x * BASE;'],
      ['src/C.ts', 'export const BASE = 10;'],
    ]);

    const deps = [createMockDependency('multiply', 'src/B.ts')];

    const context = createCrossFileContext(
      asts,
      contents,
      'src/A.ts',
      'src/NewFile.ts',
      deps
    );

    const result = executeCrossFileTransform(context);

    expect(result.success).toBe(true);
    // The transform should generate codes even if no import operations
    expect(result.codes.length).toBeGreaterThan(0);

    // Verify no circular dependencies created
    const allAsts = new Map([...asts, ...result.newFiles]);
    const graph = buildImportGraph(allAsts);
    const detection = detectCircularDependencies(graph);

    expect(detection.hasCircular).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INT-04: Multi-file move affecting 3+ files
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-04: Multi-file move', () => {
  it('should handle move affecting multiple files', () => {
    const fileA = parseCode(`
      export const utilA = () => 'A';
    `);

    const fileB = parseCode(`
      export const utilB = () => 'B';
    `);

    const fileC = parseCode(`
      export const utilC = () => 'C';
    `);

    const sourceFile = parseCode(`
      import { utilA } from './utils/A';
      import { utilB } from './utils/B';
      import { utilC } from './utils/C';

      const combined = utilA() + utilB() + utilC();
    `);

    const asts = new Map<string, t.File>([
      ['src/utils/A.ts', fileA],
      ['src/utils/B.ts', fileB],
      ['src/utils/C.ts', fileC],
      ['src/source.ts', sourceFile],
    ]);

    const contents = new Map<string, string>([
      ['src/utils/A.ts', 'export const utilA = () => \'A\';'],
      ['src/utils/B.ts', 'export const utilB = () => \'B\';'],
      ['src/utils/C.ts', 'export const utilC = () => \'C\';'],
      ['src/source.ts', 'import { utilA } from \'./utils/A\';\nimport { utilB } from \'./utils/B\';\nimport { utilC } from \'./utils/C\';\n\nconst combined = utilA() + utilB() + utilC();'],
    ]);

    const deps = [
      createMockDependency('utilA', 'src/utils/A.ts'),
      createMockDependency('utilB', 'src/utils/B.ts'),
      createMockDependency('utilC', 'src/utils/C.ts'),
    ];

    const context = createCrossFileContext(
      asts,
      contents,
      'src/source.ts',
      'src/components/NewComponent.tsx',
      deps
    );

    const result = executeCrossFileTransform(context);

    expect(result.success).toBe(true);

    // Verify all files are accounted for
    const totalFiles = result.codes.length;
    expect(totalFiles).toBeGreaterThanOrEqual(4); // A, B, C, source, + new file
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INT-05: Shared module with multiple dependencies
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-05: Shared module creation', () => {
  it('should create shared module for multiple dependencies', () => {
    const sourceCode = `
      const sharedA = 1;
      const sharedB = 2;
      const sharedC = () => sharedA + sharedB;

      // Used in source
      const sourceResult = sharedC();

      // Also used by element being moved
      const movedResult = sharedA + sharedB;
    `;

    const sourceAst = parseCode(sourceCode);
    const deps = [
      createMockDependency('sharedA', 'src/source.ts'),
      createMockDependency('sharedB', 'src/source.ts'),
      createMockDependency('sharedC', 'src/source.ts'),
    ];

    const result = generateSharedModule(deps, sourceAst, 'src/source.ts');

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      const sharedModule = result.value;

      expect(sharedModule.operation.exports.length).toBe(3);
      expect(sharedModule.operation.newFilePath).toContain('shared');

      // Verify all symbols are in the generated code
      expect(sharedModule.code).toContain('sharedA');
      expect(sharedModule.code).toContain('sharedB');
      expect(sharedModule.code).toContain('sharedC');

      // Verify exports are present
      expect(sharedModule.code).toContain('export');
    }
  });

  it('should update source file with import from shared module', () => {
    const sourceCode = `
      const sharedVar = 42;
      const localVar = 100;
      const result = sharedVar + localVar;
    `;

    const sourceAst = parseCode(sourceCode);
    const deps = [createMockDependency('sharedVar', 'src/source.ts')];

    const updateResult = updateSourceFileReferences(
      sourceAst,
      'src/source.ts',
      'src/source.shared.ts',
      deps
    );

    expect(updateResult.movedSymbols).toEqual(['sharedVar']);
    expect(updateResult.imports.length).toBe(1);
    expect(updateResult.imports[0]!.importSource).toBe('./source.shared');

    // Verify sharedVar declaration is removed from AST
    const hasSharedVar = updateResult.ast.program.body.some((node) => {
      if (node.type === 'VariableDeclaration') {
        return node.declarations.some(
          (decl) =>
            decl.id.type === 'Identifier' && decl.id.name === 'sharedVar'
        );
      }
      return false;
    });

    expect(hasSharedVar).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INT-06: New file creation in cross-file move
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-06: New file creation', () => {
  it('should create new target file with imports', () => {
    const sourceCode = `
      export const utilFunc = () => 'util';
      const element = utilFunc();
    `;

    const sourceAst = parseCode(sourceCode);
    const asts = new Map<string, t.File>([['src/source.ts', sourceAst]]);
    const contents = new Map<string, string>([
      ['src/source.ts', sourceCode],
    ]);

    const deps = [createMockDependency('utilFunc', 'src/source.ts')];

    const context = createCrossFileContext(
      asts,
      contents,
      'src/source.ts',
      'src/components/NewComponent.tsx',
      deps
    );

    const result = executeCrossFileTransform(context, {
      newFileConfig: {
        componentName: 'NewComponent',
        typescript: true,
      },
    });

    expect(result.success).toBe(true);
    expect(result.newFiles.size).toBeGreaterThan(0);

    // Verify new file has correct structure
    const newFile = result.newFiles.get('src/components/NewComponent.tsx');
    expect(newFile).toBeDefined();

    // Verify imports were added to new file
    const hasImports = result.importOperations.some(
      (op) => op.file === 'src/components/NewComponent.tsx'
    );
    expect(hasImports).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INT-07: Complex import scenarios
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-07: Complex import handling', () => {
  it('should handle mix of default and named imports', () => {
    const sourceCode = `
      import React, { useState, useEffect } from 'react';
      import styles from './styles.css';

      const Component = () => {
        const [state, setState] = useState(0);
        return React.createElement('div', null, state);
      };
    `;

    const sourceAst = parseCode(sourceCode);
    const deps = [createMockDependency('Component', 'src/source.tsx')];

    const result = generateSharedModule(deps, sourceAst, 'src/source.tsx');

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      // Should include React and hooks in imports
      expect(result.value.code).toContain('React');
    }
  });

  it('should merge imports correctly', () => {
    const targetCode = `
      import { existing } from './source';
      const foo = existing + 1;
    `;

    const targetAst = parseCode(targetCode);

    const sourceCode = `
      export const existing = 1;
      export const newSymbol = 2;
    `;

    const sourceAst = parseCode(sourceCode);
    const deps = [
      createMockDependency('existing', 'src/source.ts'),
      createMockDependency('newSymbol', 'src/source.ts'),
    ];

    const analysis = analyzeDependencyExports(
      sourceAst,
      deps,
      'src/source.ts'
    );

    const targetImports = generateTargetImports(
      'src/target.ts',
      'src/source.ts',
      null,
      deps,
      analysis
    );

    const updatedAst = addImportsToAst(targetAst, targetImports.imports);

    // Should have merged new symbols into existing import
    const importDecl = updatedAst.program.body.find(
      (node) => node.type === 'ImportDeclaration'
    ) as t.ImportDeclaration;

    expect(importDecl).toBeDefined();
    expect(importDecl.specifiers.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INT-08: Error handling integration
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-08: Error scenarios', () => {
  it('should fail gracefully with missing source file', () => {
    const asts = new Map<string, t.File>();
    const contents = new Map<string, string>();
    const deps = [createMockDependency('foo', 'src/missing.ts')];

    const context = createCrossFileContext(
      asts,
      contents,
      'src/missing.ts',
      'src/target.ts',
      deps
    );

    const result = executeCrossFileTransform(context);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Source file not found');
  });

  it('should handle circular dependency resolution failure', () => {
    // Create a complex cyclic graph that might be harder to resolve
    const fileA = parseCode(`
      import { b1, b2 } from './B';
      export const a1 = () => b1();
      export const a2 = () => b2();
    `);

    const fileB = parseCode(`
      import { a1, a2 } from './A';
      export const b1 = () => a1();
      export const b2 = () => a2();
    `);

    const asts = new Map<string, t.File>([
      ['src/A.ts', fileA],
      ['src/B.ts', fileB],
    ]);

    const graph = buildImportGraph(asts);
    const resolution = resolveCircularDependencies(graph, asts);

    // Should still succeed but may need shared module
    expect(resolution.resolutions.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INT-09: Import graph updates
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-09: Import graph integrity', () => {
  it('should maintain valid import graph after transformation', () => {
    const fileA = parseCode(`
      export const funcA = () => 1;
    `);

    const fileB = parseCode(`
      import { funcA } from './A';
      const result = funcA();
    `);

    const asts = new Map<string, t.File>([
      ['src/A.ts', fileA],
      ['src/B.ts', fileB],
    ]);

    const contents = new Map<string, string>([
      ['src/A.ts', 'export const funcA = () => 1;'],
      ['src/B.ts', 'import { funcA } from \'./A\';\nconst result = funcA();'],
    ]);

    const deps = [createMockDependency('funcA', 'src/A.ts')];

    const context = createCrossFileContext(
      asts,
      contents,
      'src/B.ts',
      'src/C.ts',
      deps
    );

    const result = executeCrossFileTransform(context);

    expect(result.success).toBe(true);

    // Build import graph from result
    const allAsts = new Map([...asts, ...result.modifiedAsts, ...result.newFiles]);
    const graph = buildImportGraph(allAsts);

    // Should have no circular dependencies
    const detection = detectCircularDependencies(graph);
    expect(detection.hasCircular).toBe(false);

    // Verify all files are in the graph
    expect(graph.files.size).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INT-10: Shared module edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('INT-10: Shared module edge cases', () => {
  it('should handle function declarations in shared module', () => {
    const sourceCode = `
      function sharedFunc() {
        return 42;
      }

      class SharedClass {
        method() {
          return sharedFunc();
        }
      }

      const result = new SharedClass().method();
    `;

    const sourceAst = parseCode(sourceCode);
    const deps = [
      createMockDependency('sharedFunc', 'src/source.ts'),
      createMockDependency('SharedClass', 'src/source.ts'),
    ];

    const result = generateSharedModule(deps, sourceAst, 'src/source.ts');

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.code).toContain('function sharedFunc');
      expect(result.value.code).toContain('class SharedClass');
      expect(result.value.operation.exports.length).toBe(2);
    }
  });

  it('should handle dependencies with no declaration found', () => {
    const sourceCode = `
      const onlyThis = 1;
    `;

    const sourceAst = parseCode(sourceCode);
    const deps = [
      createMockDependency('nonExistent', 'src/source.ts'),
      createMockDependency('alsoMissing', 'src/source.ts'),
    ];

    const result = generateSharedModule(deps, sourceAst, 'src/source.ts');

    // Should still succeed but with limited exports
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      // May have fewer exports than dependencies if declarations not found
      expect(result.value.operation.exports.length).toBeLessThanOrEqual(2);
    }
  });

  it('should handle TypeScript type annotations', () => {
    const sourceCode = `
      interface UserType {
        name: string;
        age: number;
      }

      const createUser = (name: string, age: number): UserType => {
        return { name, age };
      };

      type UserCreator = typeof createUser;
    `;

    const sourceAst = parseCode(sourceCode);
    const deps = [createMockDependency('createUser', 'src/source.ts')];

    const result = generateSharedModule(deps, sourceAst, 'src/source.ts');

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      // TypeScript types should be preserved
      expect(result.value.code).toContain('createUser');
    }
  });
});
