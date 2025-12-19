/**
 * ImportManager
 *
 * Manages import statements in AST
 * Task 16.2: ImportManager 구현
 * Task 17.3: 의존성 import 자동 추가
 */

import * as t from '@babel/types';
import path from 'path';
import type { ImportDependency } from './types.js';

export class ImportManager {
  /**
   * Add an import statement to the AST
   */
  addImport(
    ast: t.File,
    importName: string,
    sourcePath: string,
    isDefault: boolean = false,
  ): void {
    const program = ast.program;

    // 기존 import 문에서 동일한 소스를 찾기
    let existingImport: t.ImportDeclaration | null = null;
    for (const statement of program.body) {
      if (t.isImportDeclaration(statement) && statement.source.value === sourcePath) {
        existingImport = statement;
        break;
      }
    }

    // 이미 동일한 import가 존재하는지 확인
    if (existingImport) {
      const hasExisting = existingImport.specifiers.some(spec => {
        if (isDefault && t.isImportDefaultSpecifier(spec)) {
          return spec.local.name === importName;
        } else if (!isDefault && t.isImportSpecifier(spec)) {
          return spec.local.name === importName;
        }
        return false;
      });

      if (hasExisting) {
        return; // 중복 방지
      }

      // 기존 import 문에 specifier 추가
      if (isDefault) {
        // default import는 항상 첫 번째 위치
        existingImport.specifiers.unshift(
          t.importDefaultSpecifier(t.identifier(importName))
        );
      } else {
        // named import 추가
        existingImport.specifiers.push(
          t.importSpecifier(t.identifier(importName), t.identifier(importName))
        );
      }
    } else {
      // 새로운 import 문 생성
      const specifiers: t.ImportSpecifier[] | t.ImportDefaultSpecifier[] = isDefault
        ? [t.importDefaultSpecifier(t.identifier(importName))]
        : [t.importSpecifier(t.identifier(importName), t.identifier(importName))];

      const newImport = t.importDeclaration(
        specifiers,
        t.stringLiteral(sourcePath)
      );

      // 파일 최상단에 import 추가
      program.body.unshift(newImport);
    }
  }

  /**
   * Remove an import statement from the AST
   */
  removeImport(ast: t.File, importName: string): void {
    const program = ast.program;

    for (let i = program.body.length - 1; i >= 0; i--) {
      const statement = program.body[i];
      if (!t.isImportDeclaration(statement)) continue;

      // specifier 찾기
      const specifierIndex = statement.specifiers.findIndex(spec => {
        if (t.isImportDefaultSpecifier(spec) || t.isImportSpecifier(spec)) {
          return spec.local.name === importName;
        }
        return false;
      });

      if (specifierIndex !== -1) {
        // specifier 제거
        statement.specifiers.splice(specifierIndex, 1);

        // 남은 specifier가 없으면 import 문 전체 제거
        if (statement.specifiers.length === 0) {
          program.body.splice(i, 1);
        }

        return;
      }
    }
  }

  /**
   * Resolve relative path between two files
   */
  resolveRelativePath(fromFile: string, toFile: string): string {
    const fromDir = path.dirname(fromFile);
    let relativePath = path.relative(fromDir, toFile);

    // 확장자 제거
    relativePath = relativePath.replace(/\.(tsx?|jsx?)$/, '');

    // 같은 디렉토리면 ./ 추가
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }

    // Windows 경로를 Unix 스타일로 변환
    relativePath = relativePath.replace(/\\/g, '/');

    return relativePath;
  }

  /**
   * Task 17.3: 의존성 import 자동 추가
   *
   * ImportDependency 배열을 받아서 AST에 자동으로 import 추가
   */
  addDependencyImports(
    ast: t.File,
    dependencies: ImportDependency[]
  ): void {
    for (const dep of dependencies) {
      this.addImport(ast, dep.name, dep.source, dep.isDefault);
    }
  }

  /**
   * Task 17.3: React import 자동 추가
   *
   * JSX를 사용하는 파일에 React import 자동 추가
   */
  ensureReactImport(ast: t.File): void {
    // 이미 React import가 있는지 확인
    const program = ast.program;
    const hasReactImport = program.body.some(
      statement =>
        t.isImportDeclaration(statement) &&
        statement.source.value === 'react' &&
        statement.specifiers.some(
          spec =>
            t.isImportDefaultSpecifier(spec) && spec.local.name === 'React'
        )
    );

    // React import가 없으면 추가
    if (!hasReactImport) {
      this.addImport(ast, 'React', 'react', true);
    }
  }
}
