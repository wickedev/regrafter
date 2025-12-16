/**
 * Unit tests for Shared Module Creator
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';

import {
  generateSharedModule,
  updateSourceFileReferences,
  generateTargetImports,
  addImportsToAst,
  addExportsToSourceFile,
} from '../shared-module-creator.js';
import {
  createInternalDependency,
  createDependencyOrigin,
  createScopeInfo,
} from '../../../types/factories.js';
import { DependencyType } from '../../../types/public.js';
import { ScopeType } from '../../../types/internal.js';

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
// generateSharedModule Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateSharedModule', () => {
  it('should generate shared module with dependencies', () => {
    const ast = parseCode(`
      const sharedVar = 1;
      const otherVar = 2;
    `);

    const deps = [createMockDependency('sharedVar', 'src/A.ts')];

    const result = generateSharedModule(deps, ast, 'src/A.ts');

    expect(result.ast).toBeDefined();
    expect(result.code).toContain('export');
    expect(result.operation.newFilePath).toContain('.shared');
  });

  it('should include all dependencies in the shared module', () => {
    const ast = parseCode(`
      const foo = 1;
      const bar = 2;
      function baz() {}
    `);

    const deps = [
      createMockDependency('foo', 'src/A.ts'),
      createMockDependency('bar', 'src/A.ts'),
    ];

    const result = generateSharedModule(deps, ast, 'src/A.ts');

    expect(result.operation.exports.length).toBe(2);
  });

  it('should generate appropriate file path for shared module', () => {
    const ast = parseCode(`const foo = 1;`);
    const deps = [createMockDependency('foo', 'src/components/A.ts')];

    const result = generateSharedModule(deps, ast, 'src/components/A.ts');

    expect(result.operation.newFilePath).toContain('src/components/');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateSourceFileReferences Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateSourceFileReferences', () => {
  it('should add import from shared module', () => {
    const ast = parseCode(`
      const sharedVar = 1;
      console.log(sharedVar);
    `);

    const deps = [createMockDependency('sharedVar', 'src/A.ts')];

    const result = updateSourceFileReferences(
      ast,
      'src/A.ts',
      'src/shared/A.shared.ts',
      deps
    );

    expect(result.ast).toBeDefined();
    expect(result.imports.length).toBeGreaterThan(0);
    expect(result.imports[0].importSource).toContain('shared');
  });

  it('should generate correct relative import path', () => {
    const ast = parseCode(`const foo = 1;`);
    const deps = [createMockDependency('foo', 'src/components/A.ts')];

    const result = updateSourceFileReferences(
      ast,
      'src/components/A.ts',
      'src/shared/utils.ts',
      deps
    );

    expect(result.imports[0].importSource).toBe('../shared/utils');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateTargetImports Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateTargetImports', () => {
  it('should generate imports from source file for exported deps', () => {
    const deps = [createMockDependency('exportedVar', 'src/A.ts')];

    const analysis = {
      exportedDeps: deps,
      unexportedDeps: [],
      sharedDeps: [],
      existingExports: [
        { name: 'exportedVar', localName: 'exportedVar', type: 'named' as const },
      ],
    };

    const result = generateTargetImports(
      'src/B.ts',
      'src/A.ts',
      null,
      deps,
      analysis
    );

    expect(result.imports.length).toBeGreaterThan(0);
    expect(result.imports[0].importSource).toBe('./A');
  });

  it('should generate imports from shared module for shared deps', () => {
    const dep = createMockDependency('sharedVar', 'src/A.ts');

    const analysis = {
      exportedDeps: [],
      unexportedDeps: [dep],
      sharedDeps: [dep],
      existingExports: [],
    };

    const result = generateTargetImports(
      'src/B.ts',
      'src/A.ts',
      'src/shared/A.shared.ts',
      [dep],
      analysis
    );

    expect(result.imports.some((i) => i.importSource.includes('shared'))).toBe(
      true
    );
  });

  it('should handle mix of exported and shared deps', () => {
    const exportedDep = createMockDependency('exported', 'src/A.ts');
    const sharedDep = createMockDependency('shared', 'src/A.ts');

    const analysis = {
      exportedDeps: [exportedDep],
      unexportedDeps: [sharedDep],
      sharedDeps: [sharedDep],
      existingExports: [
        { name: 'exported', localName: 'exported', type: 'named' as const },
      ],
    };

    const result = generateTargetImports(
      'src/B.ts',
      'src/A.ts',
      'src/shared/A.shared.ts',
      [exportedDep, sharedDep],
      analysis
    );

    // Should have imports from both source and shared
    expect(result.imports.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// addImportsToAst Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('addImportsToAst', () => {
  it('should add imports to the beginning of the file', () => {
    const ast = parseCode(`
      const foo = 1;
    `);

    const imports = [
      {
        importSource: './utils',
        targetFile: 'src/A.ts',
        specifiers: [
          { type: 'named' as const, imported: 'bar', local: 'bar' },
        ],
      },
    ];

    const result = addImportsToAst(ast, imports);

    expect(result.program.body[0].type).toBe('ImportDeclaration');
  });

  it('should handle multiple imports', () => {
    const ast = parseCode(`const foo = 1;`);

    const imports = [
      {
        importSource: './utils',
        targetFile: 'src/A.ts',
        specifiers: [
          { type: 'named' as const, imported: 'bar', local: 'bar' },
        ],
      },
      {
        importSource: 'react',
        targetFile: 'src/A.ts',
        specifiers: [
          { type: 'default' as const, imported: 'React', local: 'React' },
        ],
      },
    ];

    const result = addImportsToAst(ast, imports);
    const importDeclarations = result.program.body.filter(
      (node) => node.type === 'ImportDeclaration'
    );

    expect(importDeclarations.length).toBe(2);
  });

  it('should preserve existing imports', () => {
    const ast = parseCode(`
      import { existing } from './existing';
      const foo = 1;
    `);

    const imports = [
      {
        importSource: './new',
        targetFile: 'src/A.ts',
        specifiers: [
          { type: 'named' as const, imported: 'bar', local: 'bar' },
        ],
      },
    ];

    const result = addImportsToAst(ast, imports);
    const importDeclarations = result.program.body.filter(
      (node) => node.type === 'ImportDeclaration'
    );

    expect(importDeclarations.length).toBe(2);
  });

  it('should handle namespace imports', () => {
    const ast = parseCode(`const foo = 1;`);

    const imports = [
      {
        importSource: './utils',
        targetFile: 'src/A.ts',
        specifiers: [
          { type: 'namespace' as const, imported: '*', local: 'utils' },
        ],
      },
    ];

    const result = addImportsToAst(ast, imports);
    const importDecl: t.ImportDeclaration = result.program.body[0];

    expect(importDecl.specifiers[0].type).toBe('ImportNamespaceSpecifier');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// addExportsToSourceFile Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('addExportsToSourceFile', () => {
  it('should add export specifiers for symbols', () => {
    const ast = parseCode(`
      const foo = 1;
      const bar = 2;
    `);

    const result = addExportsToSourceFile(ast, ['foo', 'bar']);

    // Should have export statement (either with specifiers or declaration)
    const hasExport = result.program.body.some(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        (node.specifiers.length > 0 || node.declaration !== null)
    );

    expect(hasExport).toBe(true);
  });

  it('should not duplicate already exported symbols', () => {
    const ast = parseCode(`
      export const foo = 1;
      const bar = 2;
    `);

    const result = addExportsToSourceFile(ast, ['foo', 'bar']);

    // Count export declarations
    const exportDecls = result.program.body.filter(
      (node) => node.type === 'ExportNamedDeclaration'
    );

    // Should not have duplicate for 'foo'
    const allSpecifiers = exportDecls.flatMap((decl: t.ExportNamedDeclaration) =>
      decl.specifiers.map((spec: t.ExportSpecifier) =>
        spec.exported.type === 'Identifier' ? spec.exported.name : ''
      )
    );

    const fooCount = allSpecifiers.filter((name: string) => name === 'foo').length;
    expect(fooCount).toBeLessThanOrEqual(1);
  });

  it('should handle empty symbols array', () => {
    const ast = parseCode(`const foo = 1;`);

    const result = addExportsToSourceFile(ast, []);

    // Should not add any exports
    expect(result.program.body.length).toBe(ast.program.body.length);
  });
});
