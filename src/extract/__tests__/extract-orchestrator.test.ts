/**
 * ExtractOrchestrator Tests
 *
 * Task 10.1: ExtractOrchestrator test implementation - E2E MVP
 *
 * Requirements:
 * - 1.1: JSX node selection and extraction
 * - 2.1: Automatic dependency analysis
 * - 3.1: Extract component within the same file
 */

import { describe, it, expect } from 'vitest';
import { ExtractOrchestrator } from '../extract-orchestrator.js';
import type { Code, FileInput } from '../../types/public.js';
import { err, ok, unwrapResult, type Result } from '../../result/index.js';
import type { ExtractOptions } from '../types.js';

function getFirstCode(codes: Code[]): Result<Code, string> {
  const [code] = codes;
  return code ? ok(code) : err('Expected at least one code output');
}

describe('ExtractOrchestrator', () => {
  describe('orchestrate - E2E MVP', () => {
    it('should successfully extract a simple JSX element into a new component', () => {
      // Arrange
      const sourceCode = `
function App() {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector = {
        file: 'App.tsx',
        line: 4,
        column: 6,
      };

      const options: ExtractOptions = {
        componentName: 'Greeting',
      };

      const orchestrator = new ExtractOrchestrator();

      // Act
      const result = orchestrator.orchestrate(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Transformed code should be returned
        expect(result.value.codes).toHaveLength(1);
        const code = unwrapResult(getFirstCode(result.value.codes));
        if (!code) return;
        expect(code.file).toBe('App.tsx');

        // Verify generated component information
        expect(result.value.component.name).toBe('Greeting');
        expect(result.value.component.file).toBe('App.tsx');
        expect(result.value.component.props).toEqual([]);

        // Verify statistics
        expect(result.value.stats.nodesExtracted).toBe(1);
        expect(result.value.stats.dependenciesFound).toBe(0);
        expect(result.value.stats.propsGenerated).toBe(0);

        // Verify generated code
        const generatedCode = code.content;
        expect(generatedCode).toContain('function Greeting');
        expect(generatedCode).toContain('<h1>Hello World</h1>');
        expect(generatedCode).toContain('<Greeting />');
      }
    });

    it('should extract JSX with variable dependencies and pass them as props', () => {
      // Arrange
      const sourceCode = `
function App() {
  const message = 'Hello World';
  return (
    <div>
      <h1>{message}</h1>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector = {
        file: 'App.tsx',
        line: 6,
        column: 6,
      };

      const options: ExtractOptions = {
        componentName: 'Greeting',
      };

      const orchestrator = new ExtractOrchestrator();

      // Act
      const result = orchestrator.orchestrate(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Props should be generated
        expect(result.value.component.props).toHaveLength(1);
        expect(result.value.component.props[0]?.name).toBe('message');

        // Verify statistics
        expect(result.value.stats.dependenciesFound).toBe(1);
        expect(result.value.stats.propsGenerated).toBe(1);

        // Verify generated code
        const code = unwrapResult(getFirstCode(result.value.codes));
        if (!code) return;
        const generatedCode = code.content;
        expect(generatedCode).toContain('function Greeting');
        expect(generatedCode).toContain('<Greeting message={message} />');
      }
    });

    it('should return error when files array is empty', () => {
      // Arrange
      const files: FileInput[] = [];
      const selector = { file: 'App.tsx', line: 4, column: 6 };
      const options: ExtractOptions = {};

      const orchestrator = new ExtractOrchestrator();

      // Act
      const result = orchestrator.orchestrate(files, selector, options);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMPTY_INPUT');
      }
    });

    it('should return error when selector is invalid', () => {
      // Arrange
      const files: FileInput[] = [
        { path: 'App.tsx', content: 'function App() {}' },
      ];
      const selector = { file: 'App.tsx' } as any; // Invalid selector
      const options: ExtractOptions = {};

      const orchestrator = new ExtractOrchestrator();

      // Act
      const result = orchestrator.orchestrate(files, selector, options);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_SELECTOR');
      }
    });

    it('should return error when source file is not found', () => {
      // Arrange
      const files: FileInput[] = [
        { path: 'App.tsx', content: 'function App() {}' },
      ];
      const selector = { file: 'NotFound.tsx', line: 1, column: 1 };
      const options: ExtractOptions = {};

      const orchestrator = new ExtractOrchestrator();

      // Act
      const result = orchestrator.orchestrate(files, selector, options);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FILE_NOT_FOUND');
      }
    });
  });

});
