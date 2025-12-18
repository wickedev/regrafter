/**
 * Dependency Analyzer Result-based Error Handling Tests
 *
 * Tests for the DependencyAnalyzer.analyzeElement method with Result return type.
 * These tests verify that dependency analysis returns Result<DependencyAnalysis, DependencyError>
 * instead of throwing exceptions.
 *
 * Test Purpose:
 * - Validate Result-based error handling for dependency analysis
 * - Verify DependencyError contains proper context (file, location, chain)
 * - Test both success and failure scenarios with Result pattern
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseFn from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

const traverse = traverseFn as any as typeof traverseFn.default;

import { createDependencyAnalyzer } from '../dependency-analyzer.js';
import { createScopeManager } from '../../scope/index.js';
import { isOk, isErr, type Result } from '../../result/index.js';
import {
  isDependencyError,
  type DependencyErrorType,
} from '../../errors/error-category.js';
import type { DependencyAnalysis } from '../../types/index.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Helper to parse JSX code
 */
function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

/**
 * Helper to find first JSX element in AST
 */
function findJSXElement(ast: t.File): NodePath | null {
  let elementPath: NodePath | null = null;

  traverse(ast, {
    JSXElement(path: NodePath) {
      if (elementPath === null) {
        elementPath = path;
        path.stop();
      }
    },
  });

  return elementPath;
}

// ============================================================================
// Test Data
// ============================================================================

const validComponentCode = `
import React, { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
};
`;

const componentWithEval = `
const Dangerous = ({ expression }: { expression: string }) => {
  const result = eval(expression);
  return <span>{result}</span>;
};
`;

const componentWithUnresolvableHook = `
const Problem = () => {
  const [state] = useState(0);
  // This JSX uses a hook that can't be moved to module scope
  return <div>{state}</div>;
};
`;

// ============================================================================
// Task 12.1: Tests for analyzeElement with Result return type
// ============================================================================

describe('DependencyAnalyzer.analyzeElement - Result-based Error Handling', () => {
  /**
   * Test: analyzeElement returns Ok<DependencyAnalysis> for valid elements
   *
   * Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 6.1, 6.3, 6.4, 8.3, 8.4
   *
   * Expected:
   * - analyzeElement returns Ok result
   * - Ok contains DependencyAnalysis with dependencies
   * - No errors are thrown
   */
  it('should return Ok<DependencyAnalysis> for valid JSX elements', () => {
    // Arrange
    const ast = parseCode(validComponentCode);
    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);
    const analyzer = createDependencyAnalyzer(scopeManager);
    analyzer.setCurrentFile('test.tsx');

    const elementPath = findJSXElement(ast);
    expect(elementPath).not.toBeNull();

    // Get the component scope as the target (moving within same component is valid)
    const componentScope = scopeManager.findEnclosingComponent(elementPath!);

    // Act - analyze with target scope being the same component (valid move)
    const result: Result<DependencyAnalysis, DependencyErrorType> =
      analyzer.analyzeElement(elementPath!, componentScope);

    // Assert
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value).toBeDefined();
      expect(result.value.dependencies).toBeDefined();
      expect(Array.isArray(result.value.dependencies)).toBe(true);
      expect(result.value.canResolve).toBeDefined();
    }
  });

  /**
   * Test: analyzeElement returns Err<DependencyError> for eval() usage
   *
   * Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 6.1, 6.3, 6.4, 8.3, 8.4
   *
   * Expected:
   * - analyzeElement returns Err result
   * - Error is DependencyError
   * - Error message indicates eval() usage
   * - No exceptions are thrown
   */
  it('should return Err<DependencyError> when eval() is detected', () => {
    // Arrange
    const ast = parseCode(componentWithEval);
    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);
    const analyzer = createDependencyAnalyzer(scopeManager);
    analyzer.setCurrentFile('dangerous.tsx');

    const elementPath = findJSXElement(ast);
    expect(elementPath).not.toBeNull();

    // Act
    const result: Result<DependencyAnalysis, DependencyErrorType> =
      analyzer.analyzeElement(elementPath!, null);

    // Assert
    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(isDependencyError(result.error)).toBe(true);
      expect(result.error.message).toContain('eval');
      expect(result.error.unresolvableReason).toBeDefined();
    }
  });

  /**
   * Test: analyzeElement returns Err<DependencyError> for unresolvable references
   *
   * Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 6.1, 6.3, 6.4, 8.3, 8.4
   *
   * Expected:
   * - analyzeElement returns Err result when hooks can't be moved to module scope
   * - Error is DependencyError
   * - Error message indicates hook dependency cannot be resolved
   * - No exceptions are thrown
   */
  it('should return Err<DependencyError> for unresolvable references', () => {
    // Arrange
    const ast = parseCode(componentWithUnresolvableHook);
    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);
    const analyzer = createDependencyAnalyzer(scopeManager);
    analyzer.setCurrentFile('problem.tsx');

    const elementPath = findJSXElement(ast);
    expect(elementPath).not.toBeNull();

    // Act - try to move to module scope (null target scope means module scope)
    const result: Result<DependencyAnalysis, DependencyErrorType> =
      analyzer.analyzeElement(elementPath!, null);

    // Assert
    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(isDependencyError(result.error)).toBe(true);
      expect(result.error.unresolvableReason).toBeDefined();
      expect(result.error.unresolvableReason.length).toBeGreaterThan(0);
      expect(result.error.message).toContain('Hook');
    }
  });

  /**
   * Test: DependencyError contains dependency chain information
   *
   * Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 6.1, 6.3, 6.4, 8.3, 8.4
   *
   * Expected:
   * - Error includes dependency information if available
   * - Error has unresolvableReason explaining the issue
   */
  it('should include dependency chain information in error', () => {
    // Arrange
    const ast = parseCode(componentWithEval);
    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);
    const analyzer = createDependencyAnalyzer(scopeManager);
    analyzer.setCurrentFile('test.tsx');

    const elementPath = findJSXElement(ast);
    expect(elementPath).not.toBeNull();

    // Act
    const result: Result<DependencyAnalysis, DependencyErrorType> =
      analyzer.analyzeElement(elementPath!, null);

    // Assert
    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.unresolvableReason).toBeDefined();
      expect(typeof result.error.unresolvableReason).toBe('string');
      expect(result.error.unresolvableReason.length).toBeGreaterThan(0);
    }
  });

  /**
   * Test: DependencyError includes file path and location
   *
   * Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 6.1, 6.3, 6.4, 8.3, 8.4
   *
   * Expected:
   * - Error includes file path
   * - Error may include source location
   */
  it('should include file path and location in error', () => {
    // Arrange
    const filename = 'error-test.tsx';
    const ast = parseCode(componentWithEval);
    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);
    const analyzer = createDependencyAnalyzer(scopeManager);
    analyzer.setCurrentFile(filename);

    const elementPath = findJSXElement(ast);
    expect(elementPath).not.toBeNull();

    // Act
    const result: Result<DependencyAnalysis, DependencyErrorType> =
      analyzer.analyzeElement(elementPath!, null);

    // Assert
    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.file).toBeDefined();
      expect(result.error.file).toBe(filename);
      // Location may or may not be present depending on error type
      if (result.error.location) {
        expect(result.error.location.start).toBeDefined();
        expect(result.error.location.end).toBeDefined();
      }
    }
  });

  /**
   * Test: Result pattern allows safe error handling without try-catch
   *
   * Requirements: 4.1, 4.2, 4.6
   *
   * Expected:
   * - No try-catch blocks needed
   * - Errors are handled via Result pattern
   * - Function never throws
   */
  it('should never throw exceptions (Result pattern)', () => {
    // Arrange
    const ast = parseCode(componentWithEval);
    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);
    const analyzer = createDependencyAnalyzer(scopeManager);
    analyzer.setCurrentFile('test.tsx');

    const elementPath = findJSXElement(ast);
    expect(elementPath).not.toBeNull();

    // Act & Assert - should not throw
    expect(() => {
      const result = analyzer.analyzeElement(elementPath!, null);
      // Can safely check result without try-catch
      if (isErr(result)) {
        expect(result.error._tag).toBe('DependencyError');
      }
    }).not.toThrow();
  });

  /**
   * Test: Error code is included in DependencyError
   *
   * Requirements: 6.1, 6.3, 6.4, 8.3, 8.4
   *
   * Expected:
   * - Error has a code field
   * - Code is a non-empty string
   */
  it('should include error code in DependencyError', () => {
    // Arrange
    const ast = parseCode(componentWithEval);
    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);
    const analyzer = createDependencyAnalyzer(scopeManager);
    analyzer.setCurrentFile('test.tsx');

    const elementPath = findJSXElement(ast);
    expect(elementPath).not.toBeNull();

    // Act
    const result: Result<DependencyAnalysis, DependencyErrorType> =
      analyzer.analyzeElement(elementPath!, null);

    // Assert
    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.code).toBeDefined();
      expect(typeof result.error.code).toBe('string');
      expect(result.error.code.length).toBeGreaterThan(0);
    }
  });

  /**
   * Test: Error includes suggestions array
   *
   * Requirements: 6.1, 6.3, 6.4, 8.3, 8.4
   *
   * Expected:
   * - Error has suggestions array
   * - Array is defined (may be empty)
   */
  it('should include suggestions array in error', () => {
    // Arrange
    const ast = parseCode(componentWithEval);
    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);
    const analyzer = createDependencyAnalyzer(scopeManager);
    analyzer.setCurrentFile('test.tsx');

    const elementPath = findJSXElement(ast);
    expect(elementPath).not.toBeNull();

    // Act
    const result: Result<DependencyAnalysis, DependencyErrorType> =
      analyzer.analyzeElement(elementPath!, null);

    // Assert
    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.suggestions).toBeDefined();
      expect(Array.isArray(result.error.suggestions)).toBe(true);
    }
  });
});
