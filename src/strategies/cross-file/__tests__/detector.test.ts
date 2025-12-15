/**
 * Unit tests for Cross-File Detection Module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';

import {
  detectCrossFileMove,
  analyzeExports,
  analyzeDependencyExports,
  findSharedDependencies,
  needsSharedModule,
  computeImportPath,
} from '../detector.js';
import { createInternalDependency, createDependencyOrigin, createScopeInfo } from '../../../types/factories.js';
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
// detectCrossFileMove Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectCrossFileMove', () => {
  it('should detect cross-file move when files are different', () => {
    const result = detectCrossFileMove('src/A.tsx', 'src/B.tsx');

    expect(result.isCrossFile).toBe(true);
    expect(result.sourceFile).toBe('src/A.tsx');
    expect(result.targetFile).toBe('src/B.tsx');
  });

  it('should detect same-file when files are identical', () => {
    const result = detectCrossFileMove('src/A.tsx', 'src/A.tsx');

    expect(result.isCrossFile).toBe(false);
  });

  it('should normalize paths with leading ./', () => {
    const result = detectCrossFileMove('./src/A.tsx', 'src/A.tsx');

    expect(result.isCrossFile).toBe(false);
  });

  it('should normalize Windows-style paths', () => {
    const result = detectCrossFileMove('src\\A.tsx', 'src/A.tsx');

    expect(result.isCrossFile).toBe(false);
  });

  it('should handle different directory structures', () => {
    const result = detectCrossFileMove(
      'src/components/A.tsx',
      'src/views/B.tsx'
    );

    expect(result.isCrossFile).toBe(true);
    expect(result.sourceFile).toBe('src/components/A.tsx');
    expect(result.targetFile).toBe('src/views/B.tsx');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// analyzeExports Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('analyzeExports', () => {
  it('should detect named exports with declaration', () => {
    const ast = parseCode(`
      export const foo = 1;
      export function bar() {}
      export class Baz {}
    `);

    const exports = analyzeExports(ast);

    expect(exports).toHaveLength(3);
    expect(exports.find((e) => e.name === 'foo')).toBeDefined();
    expect(exports.find((e) => e.name === 'bar')).toBeDefined();
    expect(exports.find((e) => e.name === 'Baz')).toBeDefined();
  });

  it('should detect named exports with specifiers', () => {
    const ast = parseCode(`
      const foo = 1;
      const bar = 2;
      export { foo, bar as qux };
    `);

    const exports = analyzeExports(ast);

    expect(exports).toHaveLength(2);
    expect(exports.find((e) => e.name === 'foo' && e.localName === 'foo')).toBeDefined();
    expect(exports.find((e) => e.name === 'qux' && e.localName === 'bar')).toBeDefined();
  });

  it('should detect default exports', () => {
    const ast = parseCode(`
      const MyComponent = () => <div />;
      export default MyComponent;
    `);

    const exports = analyzeExports(ast);

    expect(exports).toHaveLength(1);
    expect(exports[0].type).toBe('default');
    expect(exports[0].localName).toBe('MyComponent');
  });

  it('should detect re-exports', () => {
    const ast = parseCode(`
      export { foo, bar } from './other';
    `);

    const exports = analyzeExports(ast);

    expect(exports).toHaveLength(2);
    expect(exports[0].isReExport).toBe(true);
    expect(exports[0].reExportSource).toBe('./other');
  });

  it('should detect export all declarations', () => {
    const ast = parseCode(`
      export * from './utils';
    `);

    const exports = analyzeExports(ast);

    expect(exports).toHaveLength(1);
    expect(exports[0].type).toBe('namespace');
    expect(exports[0].isReExport).toBe(true);
    expect(exports[0].reExportSource).toBe('./utils');
  });

  it('should handle destructured exports', () => {
    const ast = parseCode(`
      export const { a, b } = obj;
    `);

    const exports = analyzeExports(ast);

    expect(exports).toHaveLength(2);
    expect(exports.find((e) => e.name === 'a')).toBeDefined();
    expect(exports.find((e) => e.name === 'b')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// analyzeDependencyExports Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('analyzeDependencyExports', () => {
  it('should categorize exported dependencies', () => {
    const ast = parseCode(`
      export const exportedVar = 1;
      const localVar = 2;
    `);

    const exportedDep = createMockDependency('exportedVar', 'test.ts');
    const localDep = createMockDependency('localVar', 'test.ts');

    const analysis = analyzeDependencyExports(
      ast,
      [exportedDep, localDep],
      'test.ts'
    );

    expect(analysis.exportedDeps).toHaveLength(1);
    expect(analysis.exportedDeps[0].symbol).toBe('exportedVar');
    expect(analysis.unexportedDeps).toHaveLength(1);
    expect(analysis.unexportedDeps[0].symbol).toBe('localVar');
  });

  it('should ignore dependencies from other files', () => {
    const ast = parseCode(`
      const localVar = 1;
    `);

    const localDep = createMockDependency('localVar', 'test.ts');
    const otherFileDep = createMockDependency('otherVar', 'other.ts');

    const analysis = analyzeDependencyExports(
      ast,
      [localDep, otherFileDep],
      'test.ts'
    );

    expect(analysis.unexportedDeps).toHaveLength(1);
    expect(analysis.unexportedDeps[0].symbol).toBe('localVar');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findSharedDependencies Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('findSharedDependencies', () => {
  it('should find dependencies used multiple times', () => {
    const ast = parseCode(`
      const shared = 1;
      const result1 = shared + 1;
      const result2 = shared + 2;
    `);

    const sharedDep = createMockDependency('shared', 'test.ts');

    const sharedDeps = findSharedDependencies(ast, [sharedDep], 'test.ts');

    expect(sharedDeps).toHaveLength(1);
    expect(sharedDeps[0].symbol).toBe('shared');
  });

  it('should not include dependencies used only once', () => {
    const ast = parseCode(`
      const single = 1;
      const result = single + 1;
    `);

    const singleDep = createMockDependency('single', 'test.ts');

    const sharedDeps = findSharedDependencies(ast, [singleDep], 'test.ts');

    // One usage as declaration, one as reference - equals one reference
    expect(sharedDeps).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeImportPath Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeImportPath', () => {
  it('should compute relative path in same directory', () => {
    const result = computeImportPath('src/A.tsx', 'src/B.tsx');

    expect(result).toBe('./B');
  });

  it('should compute relative path to parent directory', () => {
    const result = computeImportPath(
      'src/components/A.tsx',
      'src/utils/B.tsx'
    );

    expect(result).toBe('../utils/B');
  });

  it('should compute relative path to child directory', () => {
    const result = computeImportPath('src/A.tsx', 'src/components/B.tsx');

    expect(result).toBe('./components/B');
  });

  it('should handle deeply nested paths', () => {
    const result = computeImportPath(
      'src/features/auth/components/LoginForm.tsx',
      'src/shared/utils/validation.ts'
    );

    expect(result).toBe('../../../shared/utils/validation');
  });

  it('should remove file extension', () => {
    const result = computeImportPath('src/A.tsx', 'src/B.tsx');

    expect(result).not.toContain('.tsx');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// needsSharedModule Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('needsSharedModule', () => {
  it('should return true for unexported shared dependencies', () => {
    const dep = createMockDependency('sharedVar', 'test.ts');

    const analysis = {
      exportedDeps: [],
      unexportedDeps: [dep],
      sharedDeps: [dep],
      existingExports: [],
    };

    expect(needsSharedModule(dep, analysis)).toBe(true);
  });

  it('should return false for exported dependencies', () => {
    const dep = createMockDependency('exportedVar', 'test.ts');

    const analysis = {
      exportedDeps: [dep],
      unexportedDeps: [],
      sharedDeps: [],
      existingExports: [],
    };

    expect(needsSharedModule(dep, analysis)).toBe(false);
  });

  it('should return false for non-shared unexported dependencies', () => {
    const dep = createMockDependency('localVar', 'test.ts');

    const analysis = {
      exportedDeps: [],
      unexportedDeps: [dep],
      sharedDeps: [],
      existingExports: [],
    };

    expect(needsSharedModule(dep, analysis)).toBe(false);
  });
});
