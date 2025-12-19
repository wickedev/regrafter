/**
 * ExtractExecutor Tests
 *
 * Task 9.1, 9.3: ExtractExecutor 테스트 작성
 *
 * Requirements:
 * - 3.1: 같은 파일 내 컴포넌트 생성
 * - 3.2: 원본 컴포넌트 정의 앞에 새 컴포넌트 배치
 * - 3.3: 원본 위치의 JSX 코드를 새 컴포넌트 호출로 교체
 * - 2.1: 변수 의존성을 props로 전달
 * - 3.6: Props 전달 코드 생성
 */

import { describe, it, expect } from 'vitest';
import { parseFile } from '../../parser/parse-file.js';
import { ExtractExecutor } from '../extract-executor.js';
import type { ExtractPlan } from '../types.js';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import generate from '@babel/generator';

describe('ExtractExecutor', () => {
  describe('Task 9.1 - 간단한 추출', () => {
    it('should extract component without props in same file', () => {
      // Given: 간단한 JSX가 있는 컴포넌트
      const sourceCode = `
function App() {
  return (
    <div>
      <h1>Hello</h1>
    </div>
  );
}
`.trim();

      const parseResult = parseFile('App.tsx', sourceCode);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;
      const ast = parseResult.value;

      // h1 노드 선택
      let h1NodePath: any = null;
      traverse(ast, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'h1'
          ) {
            h1NodePath = path;
            path.stop();
          }
        },
      });

      expect(h1NodePath).not.toBeNull();

      // ExtractPlan 생성
      const plan: ExtractPlan = {
        selectedNodes: [h1NodePath],
        sourceFile: 'App.tsx',
        targetFile: 'App.tsx',
        componentName: 'ExtractedComponent',
        propsInterfaceName: 'ExtractedComponentProps',
        dependencies: {
          variables: [],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [],
        hooksToMove: [],
        isSameFile: true,
      };

      const asts = new Map([['App.tsx', ast]]);

      // When: ExtractExecutor 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: 성공
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAsts = result.value;
      const updatedAst = updatedAsts.get('App.tsx');
      expect(updatedAst).toBeDefined();

      // 코드 생성
      const generatedCode = generate(updatedAst!).code;

      // 새 컴포넌트가 생성되었는지 확인
      expect(generatedCode).toContain('function ExtractedComponent()');
      expect(generatedCode).toContain('<h1>Hello</h1>');

      // 원본 코드가 컴포넌트 호출로 교체되었는지 확인
      expect(generatedCode).toContain('<ExtractedComponent />');

      // 새 컴포넌트가 원본 컴포넌트 앞에 있는지 확인
      const componentIndex = generatedCode.indexOf('function ExtractedComponent');
      const appIndex = generatedCode.indexOf('function App');
      expect(componentIndex).toBeLessThan(appIndex);
    });

    it('should replace original JSX with component call', () => {
      // Given: 추출 대상 JSX
      const sourceCode = `
function App() {
  return (
    <div>
      <span>World</span>
    </div>
  );
}
`.trim();

      const parseResult = parseFile('App.tsx', sourceCode);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;
      const ast = parseResult.value;

      // span 노드 선택
      let spanNodePath: any = null;
      traverse(ast, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'span'
          ) {
            spanNodePath = path;
            path.stop();
          }
        },
      });

      const plan: ExtractPlan = {
        selectedNodes: [spanNodePath],
        sourceFile: 'App.tsx',
        targetFile: 'App.tsx',
        componentName: 'WorldComponent',
        propsInterfaceName: 'WorldComponentProps',
        dependencies: {
          variables: [],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [],
        hooksToMove: [],
        isSameFile: true,
      };

      const asts = new Map([['App.tsx', ast]]);

      // When: 추출 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: 원본 JSX가 컴포넌트 호출로 교체됨
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAst = result.value.get('App.tsx');
      const generatedCode = generate(updatedAst!).code;

      // App 함수 내부에서 span이 사라지고 WorldComponent로 교체됨
      expect(generatedCode).toContain('<WorldComponent />');
      // App 함수 내부에서 <span>World</span>가 사라짐 확인
      const appFunctionMatch = generatedCode.match(/function App\(\) \{[\s\S]*?\n\}/);
      expect(appFunctionMatch).toBeTruthy();
      const appFunction = appFunctionMatch![0];
      expect(appFunction).not.toContain('<span>World</span>');
    });
  });

  describe('Task 9.3 - Props 전달', () => {
    it('should extract component with variable dependencies as props', () => {
      // Given: 변수 의존성이 있는 JSX
      const sourceCode = `
function App() {
  const message = "Hello";
  return (
    <div>
      <p>{message}</p>
    </div>
  );
}
`.trim();

      const parseResult = parseFile('App.tsx', sourceCode);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;
      const ast = parseResult.value;

      // p 노드 선택 및 변수 선언 찾기
      let pNodePath: any = null;
      let messageDeclaration: any = null;
      traverse(ast, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'p'
          ) {
            pNodePath = path;
          }
        },
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === 'message') {
            messageDeclaration = path;
          }
        },
      });

      expect(pNodePath).not.toBeNull();
      expect(messageDeclaration).not.toBeNull();

      // ExtractPlan 생성 (변수 의존성 포함)
      const plan: ExtractPlan = {
        selectedNodes: [pNodePath],
        sourceFile: 'App.tsx',
        targetFile: 'App.tsx',
        componentName: 'MessageComponent',
        propsInterfaceName: 'MessageComponentProps',
        dependencies: {
          variables: [
            {
              name: 'message',
              declaration: messageDeclaration,
            },
          ],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [
          {
            name: 'message',
            typeAnnotation: t.tsStringKeyword(),
            optional: false,
          },
        ],
        hooksToMove: [],
        isSameFile: true,
      };

      const asts = new Map([['App.tsx', ast]]);

      // When: 추출 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Props가 올바르게 전달됨
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAst = result.value.get('App.tsx');
      const generatedCode = generate(updatedAst!).code;

      // Props 인터페이스 생성 확인
      expect(generatedCode).toContain('interface MessageComponentProps');
      expect(generatedCode).toContain('message: string');

      // Props destructuring 확인
      expect(generatedCode).toContain('function MessageComponent({');
      expect(generatedCode).toContain('message');

      // Props 전달 확인
      expect(generatedCode).toContain('<MessageComponent message={message} />');
    });
  });

  describe('Task 16.3 - 새 파일 생성', () => {
    it('should create new file when target file does not exist', () => {
      // Given: 추출 대상 JSX
      const sourceCode = `
function App() {
  return (
    <div>
      <h1>Hello</h1>
    </div>
  );
}
`.trim();

      const parseResult = parseFile('App.tsx', sourceCode);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;
      const ast = parseResult.value;

      // h1 노드 선택
      let h1NodePath: any = null;
      traverse(ast, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'h1'
          ) {
            h1NodePath = path;
            path.stop();
          }
        },
      });

      expect(h1NodePath).not.toBeNull();

      // ExtractPlan 생성 (다른 파일로 추출)
      const plan: ExtractPlan = {
        selectedNodes: [h1NodePath],
        sourceFile: 'App.tsx',
        targetFile: 'components/Greeting.tsx',
        componentName: 'Greeting',
        propsInterfaceName: 'GreetingProps',
        dependencies: {
          variables: [],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [],
        hooksToMove: [],
        isSameFile: false,
      };

      const asts = new Map([['App.tsx', ast]]);

      // When: ExtractExecutor 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: 새 파일이 생성됨
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAsts = result.value;

      // 새 파일 AST가 생성되었는지 확인
      const newFileAst = updatedAsts.get('components/Greeting.tsx');
      expect(newFileAst).toBeDefined();

      // 새 파일 코드 생성
      const newFileCode = generate(newFileAst!).code;

      // 컴포넌트가 export되는지 확인
      expect(newFileCode).toContain('export function Greeting()');
      expect(newFileCode).toContain('<h1>Hello</h1>');

      // React import 확인
      expect(newFileCode).toMatch(/import React from ['"]react['"]/);
    });

    it('should export component in new file', () => {
      // Given: 간단한 JSX
      const sourceCode = `
function App() {
  return (
    <div>
      <button>Click me</button>
    </div>
  );
}
`.trim();

      const parseResult = parseFile('App.tsx', sourceCode);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;
      const ast = parseResult.value;

      // button 노드 선택
      let buttonNodePath: any = null;
      traverse(ast, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'button'
          ) {
            buttonNodePath = path;
            path.stop();
          }
        },
      });

      const plan: ExtractPlan = {
        selectedNodes: [buttonNodePath],
        sourceFile: 'App.tsx',
        targetFile: 'components/Button.tsx',
        componentName: 'Button',
        propsInterfaceName: 'ButtonProps',
        dependencies: {
          variables: [],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [],
        hooksToMove: [],
        isSameFile: false,
      };

      const asts = new Map([['App.tsx', ast]]);

      // When: 추출 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: export된 컴포넌트 확인
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const newFileAst = result.value.get('components/Button.tsx');
      const newFileCode = generate(newFileAst!).code;

      // export 키워드 확인
      expect(newFileCode).toContain('export function Button()');
    });

    it('should export Props interface when component has props', () => {
      // Given: Props가 있는 컴포넌트
      const sourceCode = `
function App() {
  const title = "Welcome";
  return (
    <div>
      <h2>{title}</h2>
    </div>
  );
}
`.trim();

      const parseResult = parseFile('App.tsx', sourceCode);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;
      const ast = parseResult.value;

      // h2 노드 선택 및 변수 선언 찾기
      let h2NodePath: any = null;
      let titleDeclaration: any = null;
      traverse(ast, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'h2'
          ) {
            h2NodePath = path;
          }
        },
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === 'title') {
            titleDeclaration = path;
          }
        },
      });

      const plan: ExtractPlan = {
        selectedNodes: [h2NodePath],
        sourceFile: 'App.tsx',
        targetFile: 'components/Title.tsx',
        componentName: 'Title',
        propsInterfaceName: 'TitleProps',
        dependencies: {
          variables: [
            {
              name: 'title',
              declaration: titleDeclaration,
            },
          ],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [
          {
            name: 'title',
            typeAnnotation: t.tsStringKeyword(),
            optional: false,
          },
        ],
        hooksToMove: [],
        isSameFile: false,
      };

      const asts = new Map([['App.tsx', ast]]);

      // When: 추출 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Props 인터페이스가 export됨
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const newFileAst = result.value.get('components/Title.tsx');
      const newFileCode = generate(newFileAst!).code;

      // export된 Props 인터페이스 확인
      expect(newFileCode).toContain('export interface TitleProps');
      expect(newFileCode).toContain('title: string');
    });
  });

  describe('Task 16.5 - 기존 파일에 추가', () => {
    it('should add component to existing file', () => {
      // Given: 기존 파일과 추출 대상 JSX
      const existingFileCode = `
import React from 'react';

export function ExistingComponent() {
  return <div>Existing</div>;
}
`.trim();

      const sourceCode = `
function App() {
  return (
    <div>
      <span>New Component</span>
    </div>
  );
}
`.trim();

      const existingParseResult = parseFile('components/Shared.tsx', existingFileCode);
      expect(existingParseResult.ok).toBe(true);
      if (!existingParseResult.ok) return;
      const existingAst = existingParseResult.value;

      const sourceParseResult = parseFile('App.tsx', sourceCode);
      expect(sourceParseResult.ok).toBe(true);
      if (!sourceParseResult.ok) return;
      const sourceAst = sourceParseResult.value;

      // span 노드 선택
      let spanNodePath: any = null;
      traverse(sourceAst, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'span'
          ) {
            spanNodePath = path;
            path.stop();
          }
        },
      });

      const plan: ExtractPlan = {
        selectedNodes: [spanNodePath],
        sourceFile: 'App.tsx',
        targetFile: 'components/Shared.tsx',
        componentName: 'NewComponent',
        propsInterfaceName: 'NewComponentProps',
        dependencies: {
          variables: [],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [],
        hooksToMove: [],
        isSameFile: false,
      };

      const asts = new Map([
        ['App.tsx', sourceAst],
        ['components/Shared.tsx', existingAst],
      ]);

      // When: 추출 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: 기존 파일에 새 컴포넌트가 추가됨
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAst = result.value.get('components/Shared.tsx');
      const updatedCode = generate(updatedAst!).code;

      // 기존 컴포넌트 유지
      expect(updatedCode).toContain('function ExistingComponent()');
      expect(updatedCode).toContain('<div>Existing</div>');

      // 새 컴포넌트 추가
      expect(updatedCode).toContain('export function NewComponent()');
      expect(updatedCode).toContain('<span>New Component</span>');

      // React import 하나만 존재 (중복 방지)
      const reactImportCount = (updatedCode.match(/import React from/g) || []).length;
      expect(reactImportCount).toBe(1);
    });

    it('should preserve existing imports in target file', () => {
      // Given: import가 있는 기존 파일
      const existingFileCode = `
import React from 'react';
import { useState } from 'react';
import styles from './styles.css';

export function ExistingComponent() {
  return <div>Existing</div>;
}
`.trim();

      const sourceCode = `
function App() {
  return (
    <div>
      <p>Test</p>
    </div>
  );
}
`.trim();

      const existingParseResult = parseFile('components/Shared.tsx', existingFileCode);
      expect(existingParseResult.ok).toBe(true);
      if (!existingParseResult.ok) return;
      const existingAst = existingParseResult.value;

      const sourceParseResult = parseFile('App.tsx', sourceCode);
      expect(sourceParseResult.ok).toBe(true);
      if (!sourceParseResult.ok) return;
      const sourceAst = sourceParseResult.value;

      // p 노드 선택
      let pNodePath: any = null;
      traverse(sourceAst, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'p'
          ) {
            pNodePath = path;
            path.stop();
          }
        },
      });

      const plan: ExtractPlan = {
        selectedNodes: [pNodePath],
        sourceFile: 'App.tsx',
        targetFile: 'components/Shared.tsx',
        componentName: 'TestComponent',
        propsInterfaceName: 'TestComponentProps',
        dependencies: {
          variables: [],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [],
        hooksToMove: [],
        isSameFile: false,
      };

      const asts = new Map([
        ['App.tsx', sourceAst],
        ['components/Shared.tsx', existingAst],
      ]);

      // When: 추출 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: 기존 import 유지
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAst = result.value.get('components/Shared.tsx');
      const updatedCode = generate(updatedAst!).code;

      // 기존 imports 유지
      expect(updatedCode).toContain("import { useState } from");
      expect(updatedCode).toContain("import styles from");
    });
  });

  describe('Task 16.8 - 다른 파일로 추출 통합 테스트', () => {
    it('should extract to new file with complete workflow', () => {
      // Given: 변수 의존성이 있는 컴포넌트
      const sourceCode = `
function App() {
  const userName = "John";
  const userAge = 30;

  return (
    <div className="app">
      <div className="user-info">
        <h1>{userName}</h1>
        <p>Age: {userAge}</p>
      </div>
    </div>
  );
}
`.trim();

      const parseResult = parseFile('src/App.tsx', sourceCode);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;
      const sourceAst = parseResult.value;

      // user-info div 선택
      let userInfoNodePath: any = null;
      let userNameDeclaration: any = null;
      let userAgeDeclaration: any = null;

      traverse(sourceAst, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'div'
          ) {
            const classNameAttr = path.node.openingElement.attributes.find(
              (attr): attr is t.JSXAttribute =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name) &&
                attr.name.name === 'className' &&
                t.isStringLiteral(attr.value) &&
                attr.value.value === 'user-info'
            );

            if (classNameAttr) {
              userInfoNodePath = path;
            }
          }
        },
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id)) {
            if (path.node.id.name === 'userName') {
              userNameDeclaration = path;
            } else if (path.node.id.name === 'userAge') {
              userAgeDeclaration = path;
            }
          }
        },
      });

      expect(userInfoNodePath).not.toBeNull();

      const plan: ExtractPlan = {
        selectedNodes: [userInfoNodePath],
        sourceFile: 'src/App.tsx',
        targetFile: 'src/components/UserInfo.tsx',
        componentName: 'UserInfo',
        propsInterfaceName: 'UserInfoProps',
        dependencies: {
          variables: [
            {
              name: 'userName',
              declaration: userNameDeclaration,
            },
            {
              name: 'userAge',
              declaration: userAgeDeclaration,
            },
          ],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [
          {
            name: 'userName',
            typeAnnotation: t.tsStringKeyword(),
            optional: false,
          },
          {
            name: 'userAge',
            typeAnnotation: t.tsNumberKeyword(),
            optional: false,
          },
        ],
        hooksToMove: [],
        isSameFile: false,
      };

      const asts = new Map([['src/App.tsx', sourceAst]]);

      // When: 추출 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: 성공
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAsts = result.value;

      // 1. 새 파일이 생성됨
      const newFileAst = updatedAsts.get('src/components/UserInfo.tsx');
      expect(newFileAst).toBeDefined();

      const newFileCode = generate(newFileAst!).code;

      // React import 확인
      expect(newFileCode).toMatch(/import React from ['"]react['"]/);

      // Props 인터페이스 export 확인
      expect(newFileCode).toContain('export interface UserInfoProps');
      expect(newFileCode).toContain('userName: string');
      expect(newFileCode).toContain('userAge: number');

      // 컴포넌트 export 확인
      expect(newFileCode).toContain('export function UserInfo(');
      expect(newFileCode).toContain('{userName}');
      expect(newFileCode).toContain('{userAge}');

      // 2. 원본 파일에서 JSX가 컴포넌트 호출로 교체됨
      const updatedSourceAst = updatedAsts.get('src/App.tsx');
      expect(updatedSourceAst).toBeDefined();

      const updatedSourceCode = generate(updatedSourceAst!).code;

      // import 추가 확인
      expect(updatedSourceCode).toContain('UserInfo');
      expect(updatedSourceCode).toContain('./components/UserInfo');

      // 컴포넌트 호출 확인
      expect(updatedSourceCode).toContain('<UserInfo');
      expect(updatedSourceCode).toContain('userName={userName}');
      expect(updatedSourceCode).toContain('userAge={userAge}');

      // 원본 JSX는 제거되었는지 확인
      expect(updatedSourceCode).not.toContain('className="user-info"');
    });

    it('should extract to existing file with import path resolution', () => {
      // Given: 다른 디렉토리에 있는 파일들
      const sourceCode = `
function Dashboard() {
  return (
    <div>
      <header>Dashboard</header>
    </div>
  );
}
`.trim();

      const existingFileCode = `
import React from 'react';

export function ExistingWidget() {
  return <div>Widget</div>;
}
`.trim();

      const sourceParseResult = parseFile('src/pages/Dashboard.tsx', sourceCode);
      expect(sourceParseResult.ok).toBe(true);
      if (!sourceParseResult.ok) return;
      const sourceAst = sourceParseResult.value;

      const existingParseResult = parseFile(
        'src/components/widgets/index.tsx',
        existingFileCode
      );
      expect(existingParseResult.ok).toBe(true);
      if (!existingParseResult.ok) return;
      const existingAst = existingParseResult.value;

      // header 노드 선택
      let headerNodePath: any = null;
      traverse(sourceAst, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'header'
          ) {
            headerNodePath = path;
            path.stop();
          }
        },
      });

      const plan: ExtractPlan = {
        selectedNodes: [headerNodePath],
        sourceFile: 'src/pages/Dashboard.tsx',
        targetFile: 'src/components/widgets/index.tsx',
        componentName: 'DashboardHeader',
        propsInterfaceName: 'DashboardHeaderProps',
        dependencies: {
          variables: [],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [],
        hooksToMove: [],
        isSameFile: false,
      };

      const asts = new Map([
        ['src/pages/Dashboard.tsx', sourceAst],
        ['src/components/widgets/index.tsx', existingAst],
      ]);

      // When: 추출 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: 성공
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // 상대 경로가 올바르게 계산되는지 확인
      const updatedSourceAst = result.value.get('src/pages/Dashboard.tsx');
      const updatedSourceCode = generate(updatedSourceAst!).code;

      // 상대 경로 import 확인
      expect(updatedSourceCode).toContain('../components/widgets');
      expect(updatedSourceCode).toContain('DashboardHeader');

      // 대상 파일에 컴포넌트 추가 확인
      const updatedTargetAst = result.value.get('src/components/widgets/index.tsx');
      const updatedTargetCode = generate(updatedTargetAst!).code;

      // 기존 컴포넌트 유지
      expect(updatedTargetCode).toContain('ExistingWidget');

      // 새 컴포넌트 추가
      expect(updatedTargetCode).toContain('export function DashboardHeader()');
    });

    it('should handle complex scenario with props and state dependencies', () => {
      // Given: useState를 사용하는 컴포넌트
      const sourceCode = `
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  const increment = () => setCount(count + 1);

  return (
    <div>
      <div className="display">
        <p>Count: {count}</p>
        <button onClick={increment}>Increment</button>
      </div>
    </div>
  );
}
`.trim();

      const parseResult = parseFile('src/Counter.tsx', sourceCode);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;
      const sourceAst = parseResult.value;

      // display div 선택
      let displayNodePath: any = null;
      let countDeclaration: any = null;
      let setCountDeclaration: any = null;
      let incrementDeclaration: any = null;

      traverse(sourceAst, {
        JSXElement(path) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'div'
          ) {
            const classNameAttr = path.node.openingElement.attributes.find(
              (attr): attr is t.JSXAttribute =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name) &&
                attr.name.name === 'className' &&
                t.isStringLiteral(attr.value) &&
                attr.value.value === 'display'
            );

            if (classNameAttr) {
              displayNodePath = path;
            }
          }
        },
        VariableDeclarator(path) {
          // useState 결과값 찾기
          if (
            t.isArrayPattern(path.node.id) &&
            t.isCallExpression(path.node.init) &&
            t.isIdentifier(path.node.init.callee) &&
            path.node.init.callee.name === 'useState'
          ) {
            const elements = path.node.id.elements;
            if (
              elements.length === 2 &&
              t.isIdentifier(elements[0]) &&
              elements[0].name === 'count'
            ) {
              countDeclaration = path;
              setCountDeclaration = path; // 동일한 선언
            }
          }
          // increment 함수 찾기
          if (
            t.isIdentifier(path.node.id) &&
            path.node.id.name === 'increment'
          ) {
            incrementDeclaration = path;
          }
        },
      });

      const plan: ExtractPlan = {
        selectedNodes: [displayNodePath],
        sourceFile: 'src/Counter.tsx',
        targetFile: 'src/components/CounterDisplay.tsx',
        componentName: 'CounterDisplay',
        propsInterfaceName: 'CounterDisplayProps',
        dependencies: {
          variables: [],
          functions: [
            {
              name: 'increment',
              declaration: incrementDeclaration,
            },
          ],
          states: [
            {
              stateName: 'count',
              setterName: 'setCount',
              declaration: countDeclaration,
            },
          ],
          hooks: [],
          imports: [],
        },
        propTypes: [
          {
            name: 'count',
            typeAnnotation: t.tsNumberKeyword(),
            optional: false,
          },
          {
            name: 'setCount',
            typeAnnotation: t.tsAnyKeyword(), // 간단히 any로
            optional: false,
          },
          {
            name: 'increment',
            typeAnnotation: t.tsAnyKeyword(),
            optional: false,
          },
        ],
        hooksToMove: [],
        isSameFile: false,
      };

      const asts = new Map([['src/Counter.tsx', sourceAst]]);

      // When: 추출 실행
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: 성공
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const newFileAst = result.value.get('src/components/CounterDisplay.tsx');
      expect(newFileAst).toBeDefined();

      const newFileCode = generate(newFileAst!).code;

      // Props 인터페이스 확인
      expect(newFileCode).toContain('export interface CounterDisplayProps');
      expect(newFileCode).toContain('count:');
      expect(newFileCode).toContain('setCount:');
      expect(newFileCode).toContain('increment:');

      // 컴포넌트 확인
      expect(newFileCode).toContain('export function CounterDisplay(');
      expect(newFileCode).toContain('{count}');
      expect(newFileCode).toContain('onClick={increment}');

      // 원본 파일 확인
      const updatedSourceAst = result.value.get('src/Counter.tsx');
      const updatedSourceCode = generate(updatedSourceAst!).code;

      // import 추가 확인
      expect(updatedSourceCode).toContain('CounterDisplay');
      expect(updatedSourceCode).toContain('./components/CounterDisplay');

      // Props 전달 확인
      expect(updatedSourceCode).toContain('<CounterDisplay');
      expect(updatedSourceCode).toContain('count={count}');
      expect(updatedSourceCode).toContain('setCount={setCount}');
      expect(updatedSourceCode).toContain('increment={increment}');
    });
  });
});
