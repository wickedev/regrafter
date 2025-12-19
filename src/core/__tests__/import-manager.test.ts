/**
 * ImportManager tests
 *
 * Tests the unified import manager that consolidates logic from
 * src/strategies/import-manager.ts and src/extract/import-manager.ts
 */

import { describe, test, expect } from 'vitest';
import { parse } from '@babel/parser';
import generateCodeModule from '@babel/generator';
import * as t from '@babel/types';

import { loadGenerateFunction } from '../../utils/index.js';
import { ImportManager } from '../import-manager.js';

const generateCode = loadGenerateFunction(generateCodeModule);

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
 * Helper to generate code from AST
 */
function generate(ast: t.File): string {
  const result = generateCode(ast);
  return typeof result === 'object' && 'code' in result ? result.code : '';
}

describe('ImportManager', () => {
  describe('addImport()', () => {
    test('shouldAddNewNamedImport', () => {
      const code = `const foo = 'bar';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.addImport(ast, 'useState', 'react', false);

      const output = generate(ast);
      expect(output).toContain('import { useState } from "react"');
    });

    test('shouldAddNewDefaultImport', () => {
      const code = `const foo = 'bar';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.addImport(ast, 'React', 'react', true);

      const output = generate(ast);
      expect(output).toContain('import React from "react"');
    });

    test('shouldMergeWithExistingImport', () => {
      const code = `import { useState } from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.addImport(ast, 'useEffect', 'react', false);

      const output = generate(ast);
      expect(output).toMatch(/import \{ useState, useEffect \} from ['"]react['"]/);
    });

    test('shouldNotDuplicateExistingImport', () => {
      const code = `import { useState } from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.addImport(ast, 'useState', 'react', false);

      const output = generate(ast);
      // Should not have duplicate useState
      const matches = output.match(/useState/g);
      expect(matches?.length).toBe(1);
    });

    test('shouldAddDefaultToExistingNamedImports', () => {
      const code = `import { useState } from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.addImport(ast, 'React', 'react', true);

      const output = generate(ast);
      expect(output).toMatch(/import React, \{ useState \} from ['"]react['"]/);

    });
  });

  describe('removeImport()', () => {
    test('shouldRemoveNamedImport', () => {
      const code = `import { useState, useEffect } from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.removeImport(ast, 'useState');

      const output = generate(ast);
      expect(output).toMatch(/import \{ useEffect \} from ['"]react['"]/);
      expect(output).not.toContain('useState');
    });

    test('shouldRemoveEntireImportIfLastSpecifier', () => {
      const code = `import { useState } from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.removeImport(ast, 'useState');

      const output = generate(ast);
      expect(output).not.toContain('import');
      expect(output).not.toContain('react');
    });

    test('shouldRemoveDefaultImport', () => {
      const code = `import React, { useState } from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.removeImport(ast, 'React');

      const output = generate(ast);
      expect(output).toMatch(/import \{ useState \} from ['"]react['"]/);
      expect(output).not.toContain('React');
    });
  });

  describe('hasImport()', () => {
    test('shouldDetectExistingNamedImport', () => {
      const code = `import { useState } from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      const result = manager.hasImport(ast, 'react', 'useState');

      expect(result).toBe(true);
    });

    test('shouldDetectExistingDefaultImport', () => {
      const code = `import React from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      const result = manager.hasImport(ast, 'react', 'React');

      expect(result).toBe(true);
    });

    test('shouldReturnFalseForNonExistentImport', () => {
      const code = `import { useState } from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      const result = manager.hasImport(ast, 'react', 'useEffect');

      expect(result).toBe(false);
    });

    test('shouldReturnFalseForDifferentSource', () => {
      const code = `import { useState } from 'react';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      const result = manager.hasImport(ast, 'vue', 'useState');

      expect(result).toBe(false);
    });
  });

  describe('resolveRelativePath()', () => {
    test('shouldCalculateRelativePathInSameDirectory', () => {
      const manager = new ImportManager();

      const result = manager.resolveRelativePath(
        '/src/components/Button.tsx',
        '/src/components/utils.ts'
      );

      expect(result).toBe('./utils');
    });

    test('shouldCalculateRelativePathToParentDirectory', () => {
      const manager = new ImportManager();

      const result = manager.resolveRelativePath(
        '/src/components/Button/Button.tsx',
        '/src/utils/helpers.ts'
      );

      expect(result).toBe('../../utils/helpers');
    });

    test('shouldCalculateRelativePathToSubdirectory', () => {
      const manager = new ImportManager();

      const result = manager.resolveRelativePath(
        '/src/index.ts',
        '/src/components/Button.tsx'
      );

      expect(result).toBe('./components/Button');
    });

    test('shouldRemoveFileExtensions', () => {
      const manager = new ImportManager();

      const result = manager.resolveRelativePath(
        '/src/index.tsx',
        '/src/utils/helpers.ts'
      );

      expect(result).not.toContain('.ts');
      expect(result).not.toContain('.tsx');
    });
  });

  describe('ensureReactImport()', () => {
    test('shouldAddReactImportIfMissing', () => {
      const code = `const Component = () => <div />;`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.ensureReactImport(ast);

      const output = generate(ast);
      expect(output).toContain('import React from "react"');
    });

    test('shouldNotAddReactImportIfExists', () => {
      const code = `import React from 'react';\nconst Component = () => <div />;`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      manager.ensureReactImport(ast);

      const output = generate(ast);
      // Should only have one React import
      const matches = output.match(/import React from ['"]react['"]/g);
      expect(matches?.length).toBe(1);
    });
  });

  describe('addDependencyImports()', () => {
    test('shouldAddMultipleImports', () => {
      const code = `const foo = 'bar';`;
      const ast = parseCode(code);
      const manager = new ImportManager();

      const dependencies = [
        { name: 'useState', source: 'react', isDefault: false },
        { name: 'useEffect', source: 'react', isDefault: false },
        { name: 'axios', source: 'axios', isDefault: true },
      ];

      manager.addDependencyImports(ast, dependencies);

      const output = generate(ast);
      expect(output).toContain('import { useState, useEffect } from "react"');
      expect(output).toContain('import axios from "axios"');
    });
  });

  describe('getAllImportSources()', () => {
    test('shouldReturnAllImportSources', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
        import axios from 'axios';
        import './styles.css';
      `;
      const ast = parseCode(code);
      const manager = new ImportManager();

      const sources = manager.getAllImportSources(ast);

      expect(sources.size).toBe(3);
      expect(sources.has('react')).toBe(true);
      expect(sources.has('axios')).toBe(true);
      expect(sources.has('./styles.css')).toBe(true);
    });
  });
});
