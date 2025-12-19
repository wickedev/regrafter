/**
 * ExtractExecutor Tests
 *
 * Task 9.1, 9.3: ExtractExecutor test implementation
 *
 * Requirements:
 * - 3.1: Create component within the same file
 * - 3.2: Place new component before original component definition
 * - 3.3: Replace JSX code at original location with new component call
 * - 2.1: Pass variable dependencies as props
 * - 3.6: Generate props passing code
 */

import { describe, it, expect } from 'vitest';
import generateCodeModule from '@babel/generator';
import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { parseFile } from '../../parser/parse-file.js';
import { loadTraverseFunction, loadGenerateFunction } from '../../utils/index.js';
import { ExtractExecutor } from '../extract-executor.js';
import type { ExtractPlan } from '../types.js';

const traverse = loadTraverseFunction(traverseModule);
const generate = loadGenerateFunction(generateCodeModule);

type JSXElementPath = NodePath<t.JSXElement>;
type VariableDeclaratorPath = NodePath<t.VariableDeclarator>;

describe('ExtractExecutor', () => {
  describe('Task 9.1 - Simple extraction', () => {
    it('should extract component without props in same file', () => {
      // Given: component with simple JSX
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

      // Select h1 node
      let h1NodePath: any = null;
      traverse(ast, {
        JSXElement(path: JSXElementPath) {
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

      // Create ExtractPlan
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

      // When: execute ExtractExecutor
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: success
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAsts = result.value;
      const updatedAst = updatedAsts.get('App.tsx');
      expect(updatedAst).toBeDefined();

      // Generate code
      const generatedCode = generate(updatedAst!).code;

      // Verify new component was created
      expect(generatedCode).toContain('function ExtractedComponent()');
      expect(generatedCode).toContain('<h1>Hello</h1>');

      // Verify original code was replaced with component call
      expect(generatedCode).toContain('<ExtractedComponent />');

      // Verify new component is placed before original component
      const componentIndex = generatedCode.indexOf('function ExtractedComponent');
      const appIndex = generatedCode.indexOf('function App');
      expect(componentIndex).toBeLessThan(appIndex);
    });

    it('should replace original JSX with component call', () => {
      // Given: JSX to extract
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

      // Select span node
      let spanNodePath: any = null;
      traverse(ast, {
        JSXElement(path: JSXElementPath) {
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

      // When: Execute extraction
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Original JSX replaced with component call
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAst = result.value.get('App.tsx');
      const generatedCode = generate(updatedAst!).code;

      // span disappears inside App function and replaced with WorldComponent
      expect(generatedCode).toContain('<WorldComponent />');
      // Verify <span>World</span> is removed inside App function
      const appFunctionMatch = generatedCode.match(/function App\(\) \{[\s\S]*?\n\}/);
      expect(appFunctionMatch).toBeTruthy();
      const appFunction = appFunctionMatch![0];
      expect(appFunction).not.toContain('<span>World</span>');
    });
  });

  describe('Task 9.3 - Props passing', () => {
    it('should extract component with variable dependencies as props', () => {
      // Given: JSX with variable dependencies
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

      // Select p node and find variable declaration
      let pNodePath: any = null;
      let messageDeclaration: any = null;
      traverse(ast, {
        JSXElement(path: JSXElementPath) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'p'
          ) {
            pNodePath = path;
          }
        },
        VariableDeclarator(path: VariableDeclaratorPath) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === 'message') {
            messageDeclaration = path;
          }
        },
      });

      expect(pNodePath).not.toBeNull();
      expect(messageDeclaration).not.toBeNull();

      // Create ExtractPlan (including variable dependencies)
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

      // When: Execute extraction
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Props are passed correctly
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAst = result.value.get('App.tsx');
      const generatedCode = generate(updatedAst!).code;

      // Verify Props interface creation
      expect(generatedCode).toContain('interface MessageComponentProps');
      expect(generatedCode).toContain('message: string');

      // Verify Props destructuring
      expect(generatedCode).toContain('function MessageComponent({');
      expect(generatedCode).toContain('message');

      // Verify Props passing
      expect(generatedCode).toContain('<MessageComponent message={message} />');
    });
  });

  describe('Task 16.3 - Create new file', () => {
    it('should create new file when target file does not exist', () => {
      // Given: JSX to extract
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

      // Select h1 node
      let h1NodePath: any = null;
      traverse(ast, {
        JSXElement(path: JSXElementPath) {
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

      // Create ExtractPlan (extract to different file)
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

      // When: Execute ExtractExecutor
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: New file is created
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAsts = result.value;

      // Verify new file AST was created
      const newFileAst = updatedAsts.get('components/Greeting.tsx');
      expect(newFileAst).toBeDefined();

      // Generate new file code
      const newFileCode = generate(newFileAst!).code;

      // Verify component is exported
      expect(newFileCode).toContain('export function Greeting()');
      expect(newFileCode).toContain('<h1>Hello</h1>');

      // Verify React import
      expect(newFileCode).toMatch(/import React from ['"]react['"]/);
    });

    it('should export component in new file', () => {
      // Given: Simple JSX
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

      // Select button node
      let buttonNodePath: any = null;
      traverse(ast, {
        JSXElement(path: JSXElementPath) {
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

      // When: Execute extraction
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Verify exported component
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const newFileAst = result.value.get('components/Button.tsx');
      const newFileCode = generate(newFileAst!).code;

      // Verify export keyword
      expect(newFileCode).toContain('export function Button()');
    });

    it('should export Props interface when component has props', () => {
      // Given: Component with Props
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

      // Select h2 node and find variable declaration
      let h2NodePath: any = null;
      let titleDeclaration: any = null;
      traverse(ast, {
        JSXElement(path: JSXElementPath) {
          if (
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'h2'
          ) {
            h2NodePath = path;
          }
        },
        VariableDeclarator(path: VariableDeclaratorPath) {
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

      // When: Execute extraction
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Props interface is exported
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const newFileAst = result.value.get('components/Title.tsx');
      const newFileCode = generate(newFileAst!).code;

      // Verify exported Props interface
      expect(newFileCode).toContain('export interface TitleProps');
      expect(newFileCode).toContain('title: string');
    });
  });

  describe('Task 16.5 - Add to existing file', () => {
    it('should add component to existing file', () => {
      // Given: Existing file and JSX to extract
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

      // Select span node
      let spanNodePath: any = null;
      traverse(sourceAst, {
        JSXElement(path: JSXElementPath) {
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

      // When: Execute extraction
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: New component added to existing file
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAst = result.value.get('components/Shared.tsx');
      const updatedCode = generate(updatedAst!).code;

      // Preserve existing component
      expect(updatedCode).toContain('function ExistingComponent()');
      expect(updatedCode).toContain('<div>Existing</div>');

      // Add new component
      expect(updatedCode).toContain('export function NewComponent()');
      expect(updatedCode).toContain('<span>New Component</span>');

      // Only one React import exists (prevent duplicates)
      const reactImportCount = (updatedCode.match(/import React from/g) || []).length;
      expect(reactImportCount).toBe(1);
    });

    it('should preserve existing imports in target file', () => {
      // Given: Existing file with imports
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

      // Select p node
      let pNodePath: any = null;
      traverse(sourceAst, {
        JSXElement(path: JSXElementPath) {
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

      // When: Execute extraction
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Preserve existing imports
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAst = result.value.get('components/Shared.tsx');
      const updatedCode = generate(updatedAst!).code;

      // Preserve existing imports
      expect(updatedCode).toContain("import { useState } from");
      expect(updatedCode).toContain("import styles from");
    });
  });

  describe('Task 16.8 - Extract to different file integration test', () => {
    it('should extract to new file with complete workflow', () => {
      // Given: Component with variable dependencies
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

      // Select user-info div
      let userInfoNodePath: any = null;
      let userNameDeclaration: any = null;
      let userAgeDeclaration: any = null;

      traverse(sourceAst, {
        JSXElement(path: JSXElementPath) {
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
        VariableDeclarator(path: VariableDeclaratorPath) {
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

      // When: Execute extraction
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Success
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updatedAsts = result.value;

      // 1. New file is created
      const newFileAst = updatedAsts.get('src/components/UserInfo.tsx');
      expect(newFileAst).toBeDefined();

      const newFileCode = generate(newFileAst!).code;

      // Verify React import
      expect(newFileCode).toMatch(/import React from ['"]react['"]/);

      // Verify Props interface export
      expect(newFileCode).toContain('export interface UserInfoProps');
      expect(newFileCode).toContain('userName: string');
      expect(newFileCode).toContain('userAge: number');

      // Verify component export
      expect(newFileCode).toContain('export function UserInfo(');
      expect(newFileCode).toContain('{userName}');
      expect(newFileCode).toContain('{userAge}');

      // 2. JSX replaced with component call in original file
      const updatedSourceAst = updatedAsts.get('src/App.tsx');
      expect(updatedSourceAst).toBeDefined();

      const updatedSourceCode = generate(updatedSourceAst!).code;

      // Verify import addition
      expect(updatedSourceCode).toContain('UserInfo');
      expect(updatedSourceCode).toContain('./components/UserInfo');

      // Verify component call
      expect(updatedSourceCode).toContain('<UserInfo');
      expect(updatedSourceCode).toContain('userName={userName}');
      expect(updatedSourceCode).toContain('userAge={userAge}');

      // Verify original JSX was removed
      expect(updatedSourceCode).not.toContain('className="user-info"');
    });

    it('should extract to existing file with import path resolution', () => {
      // Given: Files in different directories
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

      // Select header node
      let headerNodePath: any = null;
      traverse(sourceAst, {
        JSXElement(path: JSXElementPath) {
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

      // When: Execute extraction
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Success
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Verify relative path is calculated correctly
      const updatedSourceAst = result.value.get('src/pages/Dashboard.tsx');
      const updatedSourceCode = generate(updatedSourceAst!).code;

      // Verify relative path import
      expect(updatedSourceCode).toContain('../components/widgets');
      expect(updatedSourceCode).toContain('DashboardHeader');

      // Verify component addition to target file
      const updatedTargetAst = result.value.get('src/components/widgets/index.tsx');
      const updatedTargetCode = generate(updatedTargetAst!).code;

      // Preserve existing component
      expect(updatedTargetCode).toContain('ExistingWidget');

      // Add new component
      expect(updatedTargetCode).toContain('export function DashboardHeader()');
    });

    it('should handle complex scenario with props and state dependencies', () => {
      // Given: Component using useState
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

      // Select display div
      let displayNodePath: any = null;
      let countDeclaration: any = null;
      let incrementDeclaration: any = null;

      traverse(sourceAst, {
        JSXElement(path: JSXElementPath) {
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
        VariableDeclarator(path: VariableDeclaratorPath) {
          // Find useState result value
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
            }
          }
          // Find increment function
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
            typeAnnotation: t.tsAnyKeyword(), // Simply use any
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

      // When: Execute extraction
      const executor = new ExtractExecutor();
      const result = executor.execute(plan, asts);

      // Then: Success
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const newFileAst = result.value.get('src/components/CounterDisplay.tsx');
      expect(newFileAst).toBeDefined();

      const newFileCode = generate(newFileAst!).code;

      // Verify Props interface
      expect(newFileCode).toContain('export interface CounterDisplayProps');
      expect(newFileCode).toContain('count:');
      expect(newFileCode).toContain('setCount:');
      expect(newFileCode).toContain('increment:');

      // Verify component
      expect(newFileCode).toContain('export function CounterDisplay(');
      expect(newFileCode).toContain('{count}');
      expect(newFileCode).toContain('onClick={increment}');

      // Verify original file
      const updatedSourceAst = result.value.get('src/Counter.tsx');
      const updatedSourceCode = generate(updatedSourceAst!).code;

      // Verify import addition
      expect(updatedSourceCode).toContain('CounterDisplay');
      expect(updatedSourceCode).toContain('./components/CounterDisplay');

      // Verify Props passing
      expect(updatedSourceCode).toContain('<CounterDisplay');
      expect(updatedSourceCode).toContain('count={count}');
      expect(updatedSourceCode).toContain('setCount={setCount}');
      expect(updatedSourceCode).toContain('increment={increment}');
    });
  });
});
