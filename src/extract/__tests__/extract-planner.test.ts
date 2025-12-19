/**
 * ExtractPlanner Tests
 *
 * Task 8.1: ExtractPlanner test implementation - Simple extraction plan
 */

import { describe, it, expect } from 'vitest';
import type * as t from '@babel/types';

import { parseFile } from '../../parser/index.js';
import type { FileInput, PositionSelector } from '../../types/public.js';

import { ExtractPlanner } from '../extract-planner.js';
import type { ExtractOptions } from '../types.js';

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
  describe('plan() - Single node selection and plan generation', () => {
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

        // Should have selected nodes
        expect(plan.selectedNodes).toHaveLength(1);

        // Verify source file path
        expect(plan.sourceFile).toBe('App.tsx');

        // Target file is the same file (since options.targetFile is not provided)
        expect(plan.targetFile).toBe('App.tsx');
        expect(plan.isSameFile).toBe(true);

        // Component name should be generated
        expect(plan.componentName).toBeTruthy();
        expect(plan.componentName).toMatch(/^[A-Z][A-Za-z0-9]*$/); // PascalCase

        // Props interface name should be generated
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

  describe('plan() - Variable dependency analysis', () => {
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

        // Variable dependencies should be identified
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

        // Props should be generated
        expect(plan.propTypes.length).toBeGreaterThan(0);

        // message prop should be included
        const messageProp = plan.propTypes.find(p => p.name === 'message');
        expect(messageProp).toBeDefined();
      }
    });
  });

  describe('plan() - Error handling', () => {
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

  describe('plan() - Target file handling', () => {
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
