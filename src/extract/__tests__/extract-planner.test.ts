/**
 * ExtractPlanner Tests
 *
 * Task 8.1: ExtractPlanner 테스트 작성 - 간단한 추출 계획
 */

import { describe, it, expect } from 'vitest';
import { parseFile } from '../../parser/index.js';
import type { FileInput, PositionSelector } from '../../types/public.js';
import type * as t from '@babel/types';
import { ExtractPlanner } from '../extract-planner.js';
import type { ExtractOptions } from '../types.js';
import { ScopeManager } from '../../scope/index.js';

/**
 * Helper function to parse files and create AST map
 */
function parseFilesToAsts(files: FileInput[]): Map<string, t.File> {
  const asts = new Map<string, t.File>();
  for (const file of files) {
    const parseResult = parseFile(file.path, file.content);
    if (parseResult.ok) {
      asts.set(file.path, parseResult.value);
    }
  }
  return asts;
}

describe('ExtractPlanner', () => {
  describe('plan() - 단일 노드 선택 및 계획 생성', () => {
    it('should create a plan for simple JSX element extraction', () => {
      // Arrange
      const sourceCode = `
import React from 'react';

function App() {
  const name = 'World';
  return (
    <div>
      <h1>Hello {name}!</h1>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector: PositionSelector = {
        file: 'App.tsx',
        line: 7,
        column: 6,
      };

      const options: ExtractOptions = {};

      const planner = new ExtractPlanner();
      const asts = parseFilesToAsts(files);

      // Act
      const result = planner.plan(files, asts, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value;

        // 선택된 노드가 있어야 함
        expect(plan.selectedNodes).toHaveLength(1);

        // 소스 파일 경로 확인
        expect(plan.sourceFile).toBe('App.tsx');

        // 대상 파일은 같은 파일 (options.targetFile이 없으므로)
        expect(plan.targetFile).toBe('App.tsx');
        expect(plan.isSameFile).toBe(true);

        // 컴포넌트 이름이 생성되어야 함
        expect(plan.componentName).toBeTruthy();
        expect(plan.componentName).toMatch(/^[A-Z][A-Za-z0-9]*$/); // PascalCase

        // Props 인터페이스 이름이 생성되어야 함
        expect(plan.propsInterfaceName).toBe(`${plan.componentName}Props`);
      }
    });

    it('should use provided component name', () => {
      // Arrange
      const sourceCode = `
import React from 'react';

function App() {
  return <div>Hello</div>;
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector: PositionSelector = {
        file: 'App.tsx',
        line: 5,
        column: 9,
      };

      const options: ExtractOptions = {
        componentName: 'Greeting',
      };

      const planner = new ExtractPlanner();
      const asts = parseFilesToAsts(files);

      // Act
      const result = planner.plan(files, asts, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.componentName).toBe('Greeting');
        expect(result.value.propsInterfaceName).toBe('GreetingProps');
      }
    });
  });

  describe('plan() - 변수 의존성 분석', () => {
    it('should identify variable dependencies', () => {
      // Arrange
      const sourceCode = `
import React from 'react';

function App() {
  const name = 'World';
  const greeting = 'Hello';

  return (
    <div>
      <h1>{greeting} {name}!</h1>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector: PositionSelector = {
        file: 'App.tsx',
        line: 10,
        column: 6,
      };

      const options: ExtractOptions = {};

      const planner = new ExtractPlanner();
      const asts = parseFilesToAsts(files);

      // Act
      const result = planner.plan(files, asts, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value;

        // 변수 의존성이 식별되어야 함
        expect(plan.dependencies.variables).toHaveLength(2);

        const variableNames = plan.dependencies.variables.map(v => v.name);
        expect(variableNames).toContain('name');
        expect(variableNames).toContain('greeting');
      }
    });

    it('should generate props for variable dependencies', () => {
      // Arrange
      const sourceCode = `
import React from 'react';

function App() {
  const message = 'Hello World';

  return <div>{message}</div>;
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector: PositionSelector = {
        file: 'App.tsx',
        line: 7,
        column: 9,
      };

      const options: ExtractOptions = {};

      const planner = new ExtractPlanner();
      const asts = parseFilesToAsts(files);

      // Act
      const result = planner.plan(files, asts, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value;

        // Props가 생성되어야 함
        expect(plan.propTypes.length).toBeGreaterThan(0);

        // message prop이 포함되어야 함
        const messageProp = plan.propTypes.find(p => p.name === 'message');
        expect(messageProp).toBeDefined();
      }
    });
  });

  describe('plan() - 에러 처리', () => {
    it('should return error for invalid selector', () => {
      // Arrange
      const sourceCode = `
import React from 'react';

function App() {
  return <div>Hello</div>;
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector: PositionSelector = {
        file: 'App.tsx',
        line: 999, // Invalid line
        column: 1,
      };

      const options: ExtractOptions = {};

      const planner = new ExtractPlanner();
      const asts = parseFilesToAsts(files);

      // Act
      const result = planner.plan(files, asts, selector, options);

      // Assert
      expect(result.ok).toBe(false);
    });

    it('should return error for empty files array', () => {
      // Arrange
      const files: FileInput[] = [];

      const selector: PositionSelector = {
        file: 'App.tsx',
        line: 5,
        column: 9,
      };

      const options: ExtractOptions = {};

      const planner = new ExtractPlanner();
      const asts = new Map<string, t.File>();

      // Act
      const result = planner.plan(files, asts, selector, options);

      // Assert
      expect(result.ok).toBe(false);
    });
  });

  describe('plan() - 대상 파일 처리', () => {
    it('should set targetFile to same file when not provided', () => {
      // Arrange
      const sourceCode = `
import React from 'react';

function App() {
  return <div>Hello</div>;
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector: PositionSelector = {
        file: 'App.tsx',
        line: 5,
        column: 9,
      };

      const options: ExtractOptions = {};

      const planner = new ExtractPlanner();
      const asts = parseFilesToAsts(files);

      // Act
      const result = planner.plan(files, asts, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.targetFile).toBe('App.tsx');
        expect(result.value.isSameFile).toBe(true);
      }
    });

    it('should set targetFile when provided in options', () => {
      // Arrange
      const sourceCode = `
import React from 'react';

function App() {
  return <div>Hello</div>;
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector: PositionSelector = {
        file: 'App.tsx',
        line: 5,
        column: 9,
      };

      const options: ExtractOptions = {
        targetFile: 'components/Greeting.tsx',
      };

      const planner = new ExtractPlanner();
      const asts = parseFilesToAsts(files);

      // Act
      const result = planner.plan(files, asts, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.targetFile).toBe('components/Greeting.tsx');
        expect(result.value.isSameFile).toBe(false);
      }
    });
  });
});
