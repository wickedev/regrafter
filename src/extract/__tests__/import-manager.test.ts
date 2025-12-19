/**
 * ImportManager Tests
 *
 * Task 16.1: ImportManager test implementation
 * Tests for import statement management and path resolution
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import generate from '@babel/generator';
import { ImportManager } from '../import-manager.js';

describe('ImportManager', () => {
  describe('addImport - Add import statement', () => {
    it('should add default import to empty file', () => {
      // Given: empty file without import statements
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: add default import
      const manager = new ImportManager();
      manager.addImport(ast, 'React', 'react', true);

      // Then: import statement should be added
      const output = generate(ast).code;
      expect(output).toMatch(/import React from ['"]react['"]/);

    });

    it('should add named import to empty file', () => {
      // Given: empty file without import statements
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: add named import
      const manager = new ImportManager();
      manager.addImport(ast, 'useState', 'react', false);

      // Then: named import statement should be added
      const output = generate(ast).code;
      expect(output).toMatch(/import \{ useState \} from ['"]react['"]/);

    });

    it('should add import at the top of the file', () => {
      // Given: file with existing code
      const code = `
        const value = 42;

        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: add import
      const manager = new ImportManager();
      manager.addImport(ast, 'React', 'react', true);

      // Then: import should be at the top of the file
      const output = generate(ast).code;
      const lines = output.split('\n').filter(line => line.trim());
      expect(lines[0]).toMatch(/import React from ['"]react['"]/);
    });

    it('should add multiple named imports from same source', () => {
      // Given: empty file
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: add multiple named imports from the same source
      const manager = new ImportManager();
      manager.addImport(ast, 'useState', 'react', false);
      manager.addImport(ast, 'useEffect', 'react', false);

      // Then: both imports should be added
      const output = generate(ast).code;
      expect(output).toContain('useState');
      expect(output).toContain('useEffect');
    });

    it('should not add duplicate import for same name and source', () => {
      // Given: file with existing import
      const code = `
        import React from 'react';

        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: attempt to add the same import
      const manager = new ImportManager();
      manager.addImport(ast, 'React', 'react', true);

      // Then: duplicate import should not be added
      const output = generate(ast).code;
      const importCount = (output.match(/import React from 'react'/g) || []).length;
      expect(importCount).toBe(1);
    });

    it('should add import to existing import statement from same source', () => {
      // Given: file with existing import from the same source
      const code = `
        import { useState } from 'react';

        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: add another named import from the same source
      const manager = new ImportManager();
      manager.addImport(ast, 'useEffect', 'react', false);

      // Then: new specifier should be added to existing import statement
      const output = generate(ast).code;
      expect(output).toContain('useState');
      expect(output).toContain('useEffect');
      expect(output).toContain("from 'react'");
    });
  });

  describe('resolveRelativePath - Resolve relative path', () => {
    it('should resolve relative path from same directory', () => {
      // Given: files in the same directory
      const fromFile = '/project/src/App.tsx';
      const toFile = '/project/src/UserProfile.tsx';

      // When: calculate relative path
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: should be in the form ./UserProfile
      expect(result).toBe('./UserProfile');
    });

    it('should resolve relative path from child to parent directory', () => {
      // Given: from child directory to parent directory
      const fromFile = '/project/src/components/App.tsx';
      const toFile = '/project/src/UserProfile.tsx';

      // When: calculate relative path
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: should be in the form ../UserProfile
      expect(result).toBe('../UserProfile');
    });

    it('should resolve relative path from parent to child directory', () => {
      // Given: from parent directory to child directory
      const fromFile = '/project/src/App.tsx';
      const toFile = '/project/src/components/UserProfile.tsx';

      // When: calculate relative path
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: should be in the form ./components/UserProfile
      expect(result).toBe('./components/UserProfile');
    });

    it('should resolve relative path across different directories', () => {
      // Given: files in different directories
      const fromFile = '/project/src/pages/Home.tsx';
      const toFile = '/project/src/components/UserProfile.tsx';

      // When: calculate relative path
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: should be in the form ../components/UserProfile
      expect(result).toBe('../components/UserProfile');
    });

    it('should remove file extension from path', () => {
      // Given: file path with extension
      const fromFile = '/project/src/App.tsx';
      const toFile = '/project/src/UserProfile.tsx';

      // When: calculate relative path
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: extension should be removed
      expect(result).not.toContain('.tsx');
      expect(result).not.toContain('.ts');
      expect(result).not.toContain('.jsx');
      expect(result).not.toContain('.js');
    });

    it('should handle deeply nested paths', () => {
      // Given: deeply nested paths
      const fromFile = '/project/src/features/auth/pages/Login.tsx';
      const toFile = '/project/src/components/common/Button.tsx';

      // When: calculate relative path
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: should be the correct relative path
      expect(result).toBe('../../../components/common/Button');
    });
  });

  describe('removeImport - Remove import statement', () => {
    it('should remove default import', () => {
      // Given: file with default import
      const code = `
        import React from 'react';

        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: remove default import
      const manager = new ImportManager();
      manager.removeImport(ast, 'React');

      // Then: import statement should be removed
      const output = generate(ast).code;
      expect(output).not.toContain('import React');
    });

    it('should remove specific named import from import statement', () => {
      // Given: file with multiple named imports
      const code = `
        import { useState, useEffect, useCallback } from 'react';

        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: remove only one named import
      const manager = new ImportManager();
      manager.removeImport(ast, 'useEffect');

      // Then: that import should be removed and others should remain
      const output = generate(ast).code;
      expect(output).toContain('useState');
      expect(output).toContain('useCallback');
      expect(output).not.toContain('useEffect');
    });

    it('should remove entire import statement when last specifier is removed', () => {
      // Given: file with only one named import
      const code = `
        import { useState } from 'react';

        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: remove the last remaining import
      const manager = new ImportManager();
      manager.removeImport(ast, 'useState');

      // Then: entire import statement should be removed
      const output = generate(ast).code;
      expect(output).not.toContain('import');
      expect(output).not.toContain('react');
    });

    it('should do nothing when import name does not exist', () => {
      // Given: file with import
      const code = `
        import { useState } from 'react';

        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: attempt to remove non-existent import
      const manager = new ImportManager();
      manager.removeImport(ast, 'useEffect');

      // Then: existing import should be maintained
      const output = generate(ast).code;
      expect(output).toContain('useState');
    });
  });
});
