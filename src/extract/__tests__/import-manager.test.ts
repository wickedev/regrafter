/**
 * ImportManager Tests
 *
 * Task 16.1: ImportManager 테스트 작성
 * Tests for import statement management and path resolution
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import generate from '@babel/generator';
import { ImportManager } from '../import-manager.js';

describe('ImportManager', () => {
  describe('addImport - Import 문 추가', () => {
    it('should add default import to empty file', () => {
      // Given: import 문이 없는 빈 파일
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: default import 추가
      const manager = new ImportManager();
      manager.addImport(ast, 'React', 'react', true);

      // Then: import 문이 추가되어야 함
      const output = generate(ast).code;
      expect(output).toMatch(/import React from ['"]react['"]/);

    });

    it('should add named import to empty file', () => {
      // Given: import 문이 없는 빈 파일
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: named import 추가
      const manager = new ImportManager();
      manager.addImport(ast, 'useState', 'react', false);

      // Then: named import 문이 추가되어야 함
      const output = generate(ast).code;
      expect(output).toMatch(/import \{ useState \} from ['"]react['"]/);

    });

    it('should add import at the top of the file', () => {
      // Given: 기존 코드가 있는 파일
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

      // When: import 추가
      const manager = new ImportManager();
      manager.addImport(ast, 'React', 'react', true);

      // Then: import가 파일 최상단에 위치해야 함
      const output = generate(ast).code;
      const lines = output.split('\n').filter(line => line.trim());
      expect(lines[0]).toMatch(/import React from ['"]react['"]/);
    });

    it('should add multiple named imports from same source', () => {
      // Given: 빈 파일
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // When: 같은 소스에서 여러 named import 추가
      const manager = new ImportManager();
      manager.addImport(ast, 'useState', 'react', false);
      manager.addImport(ast, 'useEffect', 'react', false);

      // Then: 두 import가 모두 추가되어야 함
      const output = generate(ast).code;
      expect(output).toContain('useState');
      expect(output).toContain('useEffect');
    });

    it('should not add duplicate import for same name and source', () => {
      // Given: 이미 import가 있는 파일
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

      // When: 동일한 import를 추가 시도
      const manager = new ImportManager();
      manager.addImport(ast, 'React', 'react', true);

      // Then: 중복된 import가 추가되지 않아야 함
      const output = generate(ast).code;
      const importCount = (output.match(/import React from 'react'/g) || []).length;
      expect(importCount).toBe(1);
    });

    it('should add import to existing import statement from same source', () => {
      // Given: 같은 소스의 import가 이미 있는 파일
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

      // When: 같은 소스에서 다른 named import 추가
      const manager = new ImportManager();
      manager.addImport(ast, 'useEffect', 'react', false);

      // Then: 기존 import 문에 새 specifier가 추가되어야 함
      const output = generate(ast).code;
      expect(output).toContain('useState');
      expect(output).toContain('useEffect');
      expect(output).toContain("from 'react'");
    });
  });

  describe('resolveRelativePath - 상대 경로 해석', () => {
    it('should resolve relative path from same directory', () => {
      // Given: 같은 디렉토리의 파일들
      const fromFile = '/project/src/App.tsx';
      const toFile = '/project/src/UserProfile.tsx';

      // When: 상대 경로 계산
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: ./UserProfile 형태여야 함
      expect(result).toBe('./UserProfile');
    });

    it('should resolve relative path from child to parent directory', () => {
      // Given: 하위 디렉토리에서 상위 디렉토리로
      const fromFile = '/project/src/components/App.tsx';
      const toFile = '/project/src/UserProfile.tsx';

      // When: 상대 경로 계산
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: ../UserProfile 형태여야 함
      expect(result).toBe('../UserProfile');
    });

    it('should resolve relative path from parent to child directory', () => {
      // Given: 상위 디렉토리에서 하위 디렉토리로
      const fromFile = '/project/src/App.tsx';
      const toFile = '/project/src/components/UserProfile.tsx';

      // When: 상대 경로 계산
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: ./components/UserProfile 형태여야 함
      expect(result).toBe('./components/UserProfile');
    });

    it('should resolve relative path across different directories', () => {
      // Given: 다른 디렉토리 간의 파일들
      const fromFile = '/project/src/pages/Home.tsx';
      const toFile = '/project/src/components/UserProfile.tsx';

      // When: 상대 경로 계산
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: ../components/UserProfile 형태여야 함
      expect(result).toBe('../components/UserProfile');
    });

    it('should remove file extension from path', () => {
      // Given: 확장자가 포함된 파일 경로
      const fromFile = '/project/src/App.tsx';
      const toFile = '/project/src/UserProfile.tsx';

      // When: 상대 경로 계산
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: 확장자가 제거되어야 함
      expect(result).not.toContain('.tsx');
      expect(result).not.toContain('.ts');
      expect(result).not.toContain('.jsx');
      expect(result).not.toContain('.js');
    });

    it('should handle deeply nested paths', () => {
      // Given: 깊게 중첩된 경로
      const fromFile = '/project/src/features/auth/pages/Login.tsx';
      const toFile = '/project/src/components/common/Button.tsx';

      // When: 상대 경로 계산
      const manager = new ImportManager();
      const result = manager.resolveRelativePath(fromFile, toFile);

      // Then: 올바른 상대 경로여야 함
      expect(result).toBe('../../../components/common/Button');
    });
  });

  describe('removeImport - Import 문 제거', () => {
    it('should remove default import', () => {
      // Given: default import가 있는 파일
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

      // When: default import 제거
      const manager = new ImportManager();
      manager.removeImport(ast, 'React');

      // Then: import 문이 제거되어야 함
      const output = generate(ast).code;
      expect(output).not.toContain('import React');
    });

    it('should remove specific named import from import statement', () => {
      // Given: 여러 named import가 있는 파일
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

      // When: 하나의 named import만 제거
      const manager = new ImportManager();
      manager.removeImport(ast, 'useEffect');

      // Then: 해당 import만 제거되고 나머지는 유지되어야 함
      const output = generate(ast).code;
      expect(output).toContain('useState');
      expect(output).toContain('useCallback');
      expect(output).not.toContain('useEffect');
    });

    it('should remove entire import statement when last specifier is removed', () => {
      // Given: 하나의 named import만 있는 파일
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

      // When: 마지막 남은 import 제거
      const manager = new ImportManager();
      manager.removeImport(ast, 'useState');

      // Then: import 문 전체가 제거되어야 함
      const output = generate(ast).code;
      expect(output).not.toContain('import');
      expect(output).not.toContain('react');
    });

    it('should do nothing when import name does not exist', () => {
      // Given: import가 있는 파일
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

      // When: 존재하지 않는 import 제거 시도
      const manager = new ImportManager();
      manager.removeImport(ast, 'useEffect');

      // Then: 기존 import는 유지되어야 함
      const output = generate(ast).code;
      expect(output).toContain('useState');
    });
  });
});
