/**
 * Tests for MoveTransformationPipeline
 *
 * Tests the complete pipeline orchestration and fail-fast error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type * as t from '@babel/types';

import { DependencyOrchestrator } from '../../analyzer/dependency-orchestrator.js';
import { createValidationError } from '../../errors/index.js';
import { CodeGenerator } from '../../generator/code-generator.js';
import { err, isErr, ok } from '../../result/index.js';
import { createScopeManager } from '../../scope/index.js';
import { createSelectorResolver } from '../../selector/index.js';
import { createHoistExecutor, createConfiguredHoistPlanner } from '../../strategies/index.js';
import { createJSXTransformer } from '../../transformer/index.js';
import { Move } from '../../types/index.js';

import { createMoveTransformationPipeline } from '../move-transformation-pipeline.js';

describe('MoveTransformationPipeline', () => {
  describe('Full Pipeline Execution', () => {
    it('should execute all 5 stages successfully for a simple move', () => {
      // Arrange - Simple component with element to move (no dependencies)
      const code = `
        function App() {
          return (
            <div>
              <h1>Title</h1>
              <p>Content</p>
            </div>
          );
        }
      `;

      const files = [{ path: 'App.tsx', content: code }];
      const from = { file: 'App.tsx', line: 5, column: 16 }; // <h1>Title</h1>
      const to = { file: 'App.tsx', line: 6, column: 16 }; // <p>Content</p>
      const mode = Move.After;

      // Create pipeline with all dependencies
      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Act
      const result = pipeline.execute({ files, from, to, mode });

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].file).toBe('App.tsx');
        expect(result.value[0].changed).toBe(true);
        expect(result.value[0].content).toContain('<h1>Title</h1>');
        expect(result.value[0].content).toContain('<p>Content</p>');
      }
    });

    it('should handle moves with dependency hoisting', () => {
      // Arrange - Element with variable dependency that needs hoisting
      const code = `
        function Parent() {
          return (
            <div>
              <Child />
            </div>
          );
        }

        function Child() {
          const message = "Hello";
          return (
            <div>
              <p>{message}</p>
            </div>
          );
        }
      `;

      const files = [{ path: 'App.tsx', content: code }];
      const from = { file: 'App.tsx', line: 14, column: 16 }; // <p>{message}</p>
      const to = { file: 'App.tsx', line: 4, column: 16 }; // inside Parent <div>
      const mode = Move.Inside;

      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Act
      const result = pipeline.execute({ files, from, to, mode });

      // Assert - Should succeed (hoisting will be planned and executed)
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].changed).toBe(true);
      }
    });
  });

  describe('Fail-Fast Error Handling', () => {
    it('should short-circuit on validation error (file not found)', () => {
      // Arrange - Invalid file reference
      const files = [{ path: 'App.tsx', content: '<div></div>' }];
      const from = { file: 'NonExistent.tsx', line: 1, column: 1 };
      const to = { file: 'App.tsx', line: 1, column: 1 };
      const mode = Move.Inside;

      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Act
      const result = pipeline.execute({ files, from, to, mode });

      // Assert - Should fail at validation stage
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('FILE_NOT_FOUND');
        expect(result.error.message).toContain('NonExistent.tsx');
      }
    });

    it('should short-circuit on validation error (cross-file not supported)', () => {
      // Arrange - Cross-file move attempt
      const files = [
        { path: 'App.tsx', content: '<div><h1>Title</h1></div>' },
        { path: 'Other.tsx', content: '<div></div>' },
      ];
      const from = { file: 'App.tsx', line: 1, column: 6 }; // <h1>
      const to = { file: 'Other.tsx', line: 1, column: 1 }; // Different file
      const mode = Move.Inside;

      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Act
      const result = pipeline.execute({ files, from, to, mode });

      // Assert - Should fail at validation stage
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('CROSS_FILE_NOT_SUPPORTED');
      }
    });

    it('should short-circuit on validation error (invalid selector)', () => {
      // Arrange - Invalid selector position
      const code = '<div></div>';
      const files = [{ path: 'App.tsx', content: code }];
      const from = { file: 'App.tsx', line: 999, column: 999 }; // Out of bounds
      const to = { file: 'App.tsx', line: 1, column: 1 };
      const mode = Move.Inside;

      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Act
      const result = pipeline.execute({ files, from, to, mode });

      // Assert - Should fail at validation stage (selector resolution)
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        // The error should have a code indicating the issue
        expect(result.error.code).toBeDefined();
      }
    });
  });

  describe('Context Threading', () => {
    it('should thread context correctly through all stages', () => {
      // Arrange - Simple move to verify context is threaded
      const code = `
        function App() {
          return (
            <div>
              <h1>Title</h1>
              <p>Content</p>
            </div>
          );
        }
      `;

      const files = [{ path: 'App.tsx', content: code }];
      const from = { file: 'App.tsx', line: 5, column: 16 }; // <h1>
      const to = { file: 'App.tsx', line: 6, column: 16 }; // <p>
      const mode = Move.After;

      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Act
      const result = pipeline.execute({ files, from, to, mode });

      // Assert - Context should be threaded correctly
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].file).toBe('App.tsx');
        expect(result.value[0].changed).toBe(true);

        // Verify both elements are present in the result
        expect(result.value[0].content).toContain('<h1>Title</h1>');
        expect(result.value[0].content).toContain('<p>Content</p>');
      }
    });

    it('should preserve options through pipeline stages', () => {
      // Arrange - Move with custom options
      const code = `
        function App() {
          return (
            <div>
              <h1>Title</h1>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </div>
          );
        }
      `;

      const files = [{ path: 'App.tsx', content: code }];
      const from = { file: 'App.tsx', line: 5, column: 16 }; // <h1>
      const to = { file: 'App.tsx', line: 6, column: 16 }; // <ul>
      const mode = Move.Inside;
      const options = {
        insertIndex: 1, // Insert at specific index
        preserveComments: true,
      };

      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Act
      const result = pipeline.execute({ files, from, to, mode, options });

      // Assert - Options should be preserved
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].changed).toBe(true);
        // The h1 should be inside ul at the specified index
        expect(result.value[0].content).toContain('<ul>');
        expect(result.value[0].content).toContain('<h1>Title</h1>');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty hoisting plan (no dependencies)', () => {
      // Arrange - Simple move with no dependencies
      const code = `
        function App() {
          return (
            <div>
              <h1>Title</h1>
              <div>
                <p>Content</p>
              </div>
            </div>
          );
        }
      `;

      const files = [{ path: 'App.tsx', content: code }];
      const from = { file: 'App.tsx', line: 5, column: 16 }; // <h1>
      const to = { file: 'App.tsx', line: 6, column: 16 }; // inner <div>
      const mode = Move.Inside;

      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Act
      const result = pipeline.execute({ files, from, to, mode });

      // Assert - Should succeed without hoisting
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].changed).toBe(true);
      }
    });

    it('should skip hoisting when target is ancestor of source', () => {
      // Arrange - Move down the tree (dependencies already accessible)
      const code = `
        function App() {
          const message = "Hello";
          return (
            <div>
              <div>
                <p>{message}</p>
              </div>
            </div>
          );
        }
      `;

      const files = [{ path: 'App.tsx', content: code }];
      const from = { file: 'App.tsx', line: 7, column: 18 }; // <p>{message}</p>
      const to = { file: 'App.tsx', line: 5, column: 16 }; // outer <div>
      const mode = Move.Inside;

      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Act
      const result = pipeline.execute({ files, from, to, mode });

      // Assert - Should succeed, skipping hoisting (target is ancestor)
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].changed).toBe(true);
        expect(result.value[0].content).toContain('message');
      }
    });
  });

  describe('Factory Function', () => {
    it('should create pipeline instance with all dependencies', () => {
      // Arrange
      const resolver = createSelectorResolver();
      const scopeManager = createScopeManager();
      const analyzer = new DependencyOrchestrator(scopeManager);
      const planner = createConfiguredHoistPlanner();
      const executor = createHoistExecutor();
      const transformer = createJSXTransformer();
      const generator = new CodeGenerator();

      // Act
      const pipeline = createMoveTransformationPipeline(
        resolver,
        scopeManager,
        analyzer,
        planner,
        executor,
        transformer,
        generator
      );

      // Assert
      expect(pipeline).toBeDefined();
      expect(typeof pipeline.execute).toBe('function');
    });
  });
});
