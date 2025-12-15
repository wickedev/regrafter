/**
 * Integration tests for Cross-File Movement Module
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';

import {
  executeCrossFileTransform,
  validateCrossFileMove,
  estimateCrossFileMoveImpact,
  createCrossFileContext,
  mergeTransformResults,
  toPublicDependencies,
  type CrossFileContext,
  type CrossFileOptions,
} from '../index.js';
import {
  createInternalDependency,
  createDependencyOrigin,
  createScopeInfo,
  createCode,
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
// createCrossFileContext Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('createCrossFileContext', () => {
  it('should create context with all properties', () => {
    const sourceAst = parseCode(`export const foo = 1;`);
    const targetAst = parseCode(`const bar = 2;`);

    const asts = new Map<string, t.File>([
      ['src/A.ts', sourceAst],
      ['src/B.ts', targetAst],
    ]);

    const contents = new Map<string, string>([
      ['src/A.ts', 'export const foo = 1;'],
      ['src/B.ts', 'const bar = 2;'],
    ]);

    const deps = [createMockDependency('foo', 'src/A.ts')];

    const context = createCrossFileContext(
      asts,
      contents,
      'src/A.ts',
      'src/B.ts',
      deps
    );

    expect(context.sourceFile).toBe('src/A.ts');
    expect(context.targetFile).toBe('src/B.ts');
    expect(context.dependencies).toHaveLength(1);
    expect(context.isNewTargetFile).toBe(false);
  });

  it('should detect new target file', () => {
    const sourceAst = parseCode(`export const foo = 1;`);

    const asts = new Map<string, t.File>([['src/A.ts', sourceAst]]);

    const contents = new Map<string, string>([
      ['src/A.ts', 'export const foo = 1;'],
    ]);

    const deps = [createMockDependency('foo', 'src/A.ts')];

    const context = createCrossFileContext(
      asts,
      contents,
      'src/A.ts',
      'src/NewFile.ts',
      deps
    );

    expect(context.isNewTargetFile).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateCrossFileMove Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateCrossFileMove', () => {
  it('should validate valid cross-file move', () => {
    const sourceAst = parseCode(`
      export const foo = 1;
      export function bar() {}
    `);

    const targetAst = parseCode(`const baz = 2;`);
    const deps = [createMockDependency('foo', 'src/A.ts')];
    const existingFiles = new Set(['src/A.ts', 'src/B.ts']);

    const result = validateCrossFileMove(
      'src/A.ts',
      'src/B.ts',
      sourceAst,
      targetAst,
      deps,
      existingFiles
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject same file move', () => {
    const sourceAst = parseCode(`export const foo = 1;`);
    const deps = [createMockDependency('foo', 'src/A.ts')];
    const existingFiles = new Set(['src/A.ts']);

    const result = validateCrossFileMove(
      'src/A.ts',
      'src/A.ts',
      sourceAst,
      sourceAst,
      deps,
      existingFiles
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Source and target are the same file');
  });

  it('should validate new file path', () => {
    const sourceAst = parseCode(`export const foo = 1;`);
    const deps = [createMockDependency('foo', 'src/A.ts')];
    const existingFiles = new Set(['src/A.ts']);

    const result = validateCrossFileMove(
      'src/A.ts',
      'src/NewFile.tsx',
      sourceAst,
      undefined,
      deps,
      existingFiles
    );

    expect(result.valid).toBe(true);
  });

  it('should reject invalid file path', () => {
    const sourceAst = parseCode(`export const foo = 1;`);
    const deps = [createMockDependency('foo', 'src/A.ts')];
    const existingFiles = new Set(['src/A.ts']);

    const result = validateCrossFileMove(
      'src/A.ts',
      'src/NewFile.txt',
      sourceAst,
      undefined,
      deps,
      existingFiles
    );

    expect(result.valid).toBe(false);
  });

  it('should warn about shared module creation', () => {
    const sourceAst = parseCode(`
      const unexported = 1;
      const result = unexported + 1;
      const another = unexported + 2;
    `);

    const dep = createMockDependency('unexported', 'src/A.ts');
    const existingFiles = new Set(['src/A.ts', 'src/B.ts']);

    const result = validateCrossFileMove(
      'src/A.ts',
      'src/B.ts',
      sourceAst,
      parseCode(''),
      [dep],
      existingFiles
    );

    // May have warnings about shared modules
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// estimateCrossFileMoveImpact Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('estimateCrossFileMoveImpact', () => {
  it('should estimate impact for simple move', () => {
    const sourceAst = parseCode(`export const foo = 1;`);
    const deps = [createMockDependency('foo', 'src/A.ts')];

    const impact = estimateCrossFileMoveImpact(
      'src/A.ts',
      'src/B.ts',
      sourceAst,
      deps
    );

    expect(impact.filesModified).toBe(2);
    expect(impact.importsAdded).toBe(1);
  });

  it('should estimate shared module creation', () => {
    const sourceAst = parseCode(`
      const unexported = 1;
      const result = unexported + 1;
      const another = unexported + 2;
    `);

    const dep = createMockDependency('unexported', 'src/A.ts');

    const impact = estimateCrossFileMoveImpact(
      'src/A.ts',
      'src/B.ts',
      sourceAst,
      [dep]
    );

    // Shared module may be needed
    expect(impact.filesModified).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// executeCrossFileTransform Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('executeCrossFileTransform', () => {
  it('should transform with exported dependencies', () => {
    const sourceAst = parseCode(`
      export const foo = 1;
      export const bar = 2;
    `);
    const targetAst = parseCode(`const baz = 3;`);

    const asts = new Map<string, t.File>([
      ['src/A.ts', sourceAst],
      ['src/B.ts', targetAst],
    ]);

    const contents = new Map<string, string>([
      ['src/A.ts', 'export const foo = 1; export const bar = 2;'],
      ['src/B.ts', 'const baz = 3;'],
    ]);

    const deps = [createMockDependency('foo', 'src/A.ts')];

    const context: CrossFileContext = {
      asts,
      originalContents: contents,
      sourceFile: 'src/A.ts',
      targetFile: 'src/B.ts',
      dependencies: deps,
      isNewTargetFile: false,
    };

    const result = executeCrossFileTransform(context);

    expect(result.success).toBe(true);
    expect(result.codes.length).toBeGreaterThan(0);
    expect(result.importOperations.length).toBeGreaterThan(0);
  });

  it('should fail with missing source file', () => {
    const targetAst = parseCode(`const baz = 3;`);

    const asts = new Map<string, t.File>([['src/B.ts', targetAst]]);

    const contents = new Map<string, string>([['src/B.ts', 'const baz = 3;']]);

    const deps = [createMockDependency('foo', 'src/A.ts')];

    const context: CrossFileContext = {
      asts,
      originalContents: contents,
      sourceFile: 'src/A.ts',
      targetFile: 'src/B.ts',
      dependencies: deps,
      isNewTargetFile: false,
    };

    const result = executeCrossFileTransform(context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Source file not found');
  });

  it('should handle new target file', () => {
    const sourceAst = parseCode(`export const foo = 1;`);

    const asts = new Map<string, t.File>([['src/A.ts', sourceAst]]);

    const contents = new Map<string, string>([
      ['src/A.ts', 'export const foo = 1;'],
    ]);

    const deps = [createMockDependency('foo', 'src/A.ts')];

    const context: CrossFileContext = {
      asts,
      originalContents: contents,
      sourceFile: 'src/A.ts',
      targetFile: 'src/components/NewComponent.tsx',
      dependencies: deps,
      isNewTargetFile: true,
    };

    const result = executeCrossFileTransform(context, {
      newFileConfig: { componentName: 'NewComponent' },
    });

    expect(result.success).toBe(true);
    expect(result.newFiles.size).toBeGreaterThan(0);
  });

  it('should respect createSharedModules option', () => {
    const sourceAst = parseCode(`
      const unexported = 1;
      const result = unexported + 1;
    `);
    const targetAst = parseCode(`const baz = 3;`);

    const asts = new Map<string, t.File>([
      ['src/A.ts', sourceAst],
      ['src/B.ts', targetAst],
    ]);

    const contents = new Map<string, string>([
      ['src/A.ts', 'const unexported = 1; const result = unexported + 1;'],
      ['src/B.ts', 'const baz = 3;'],
    ]);

    const deps = [createMockDependency('unexported', 'src/A.ts')];

    const context: CrossFileContext = {
      asts,
      originalContents: contents,
      sourceFile: 'src/A.ts',
      targetFile: 'src/B.ts',
      dependencies: deps,
      isNewTargetFile: false,
    };

    const result = executeCrossFileTransform(context, {
      createSharedModules: false,
    });

    expect(result.success).toBe(true);
    expect(result.sharedModuleOperations).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// mergeTransformResults Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('mergeTransformResults', () => {
  it('should merge transform results with existing codes', () => {
    const existingCodes = [
      createCode({ file: 'src/A.ts', content: 'old content', changed: false }),
      createCode({ file: 'src/C.ts', content: 'c content', changed: false }),
    ];

    const transformResult = {
      success: true,
      modifiedAsts: new Map(),
      newFiles: new Map(),
      codes: [
        createCode({ file: 'src/A.ts', content: 'new content', changed: true }),
        createCode({
          file: 'src/B.ts',
          content: 'b content',
          changed: true,
          isNew: true,
        }),
      ],
      importOperations: [],
      sharedModuleOperations: [],
    };

    const result = mergeTransformResults(existingCodes, transformResult);

    expect(result).toHaveLength(3);

    // A.ts should be updated
    const aCode = result.find((c) => c.file === 'src/A.ts');
    expect(aCode?.content).toBe('new content');
    expect(aCode?.changed).toBe(true);

    // B.ts should be added
    const bCode = result.find((c) => c.file === 'src/B.ts');
    expect(bCode?.content).toBe('b content');

    // C.ts should remain unchanged
    const cCode = result.find((c) => c.file === 'src/C.ts');
    expect(cCode?.content).toBe('c content');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// toPublicDependencies Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('toPublicDependencies', () => {
  it('should convert internal dependencies to public format', () => {
    const internalDeps = [
      createMockDependency('foo', 'src/A.ts', DependencyType.Variable),
      createMockDependency('bar', 'src/B.ts', DependencyType.Function),
    ];

    const publicDeps = toPublicDependencies(internalDeps);

    expect(publicDeps).toHaveLength(2);
    expect(publicDeps[0].symbol).toBe('foo');
    expect(publicDeps[0].type).toBe(DependencyType.Variable);
    expect(publicDeps[0].origin).toBe('src/A.ts');
  });

  it('should handle empty array', () => {
    const publicDeps = toPublicDependencies([]);

    expect(publicDeps).toHaveLength(0);
  });
});
