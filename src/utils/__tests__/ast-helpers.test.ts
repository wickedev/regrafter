/**
 * Tests for AST Helper Utilities
 *
 * Tests cover function name extraction, React hook name detection,
 * and component name validation.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import {
  extractFunctionName,
  isReactHookName,
  isComponentName,
} from '../ast-helpers.js';

/**
 * Helper to parse code and get AST
 */
function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

/**
 * Helper to find first function path
 */
function findFunction(ast: t.File): NodePath | null {
  let found: NodePath | null = null;
  traverse(ast, {
    Function(path) {
      if (!found) {
        found = path;
      }
    },
  });
  return found;
}

describe('ast-helpers utilities', () => {
  describe('extractFunctionName', () => {
    it('extracts name from function declaration', () => {
      const code = 'function myFunction() {}';
      const ast = parseCode(code);
      const funcPath = findFunction(ast);

      expect(funcPath).not.toBeNull();
      expect(extractFunctionName(funcPath!)).toBe('myFunction');
    });

    it('extracts name from const arrow function', () => {
      const code = 'const MyComponent = () => {};';
      const ast = parseCode(code);
      const funcPath = findFunction(ast);

      expect(funcPath).not.toBeNull();
      expect(extractFunctionName(funcPath!)).toBe('MyComponent');
    });

    it('extracts name from const function expression', () => {
      const code = 'const myFunc = function() {};';
      const ast = parseCode(code);
      const funcPath = findFunction(ast);

      expect(funcPath).not.toBeNull();
      expect(extractFunctionName(funcPath!)).toBe('myFunc');
    });

    it('extracts name from named function expression', () => {
      const code = 'const x = function namedFunc() {};';
      const ast = parseCode(code);
      const funcPath = findFunction(ast);

      expect(funcPath).not.toBeNull();
      expect(extractFunctionName(funcPath!)).toBe('namedFunc');
    });

    it('extracts name from object property', () => {
      const code = 'const obj = { myMethod: () => {} };';
      const ast = parseCode(code);
      const funcPath = findFunction(ast);

      expect(funcPath).not.toBeNull();
      expect(extractFunctionName(funcPath!)).toBe('myMethod');
    });

    it('returns null for anonymous function without context', () => {
      const code = '() => {}';
      const ast = parseCode(code);
      const funcPath = findFunction(ast);

      expect(funcPath).not.toBeNull();
      expect(extractFunctionName(funcPath!)).toBeNull();
    });

    it('handles class methods', () => {
      const code = 'class MyClass { myMethod() {} }';
      const ast = parseCode(code);
      const funcPath = findFunction(ast);

      expect(funcPath).not.toBeNull();
      // Class methods are ObjectMethod nodes, check if it works
      expect(extractFunctionName(funcPath!)).toBeTruthy();
    });
  });

  describe('isReactHookName', () => {
    it('returns true for built-in React hooks', () => {
      expect(isReactHookName('useState')).toBe(true);
      expect(isReactHookName('useEffect')).toBe(true);
      expect(isReactHookName('useContext')).toBe(true);
      expect(isReactHookName('useReducer')).toBe(true);
      expect(isReactHookName('useCallback')).toBe(true);
      expect(isReactHookName('useMemo')).toBe(true);
      expect(isReactHookName('useRef')).toBe(true);
      expect(isReactHookName('useImperativeHandle')).toBe(true);
      expect(isReactHookName('useLayoutEffect')).toBe(true);
      expect(isReactHookName('useDebugValue')).toBe(true);
      expect(isReactHookName('useDeferredValue')).toBe(true);
      expect(isReactHookName('useTransition')).toBe(true);
      expect(isReactHookName('useId')).toBe(true);
      expect(isReactHookName('useSyncExternalStore')).toBe(true);
      expect(isReactHookName('useInsertionEffect')).toBe(true);
      expect(isReactHookName('useActionState')).toBe(true);
      expect(isReactHookName('useFormStatus')).toBe(true);
      expect(isReactHookName('useOptimistic')).toBe(true);
      expect(isReactHookName('use')).toBe(true);
    });

    it('returns true for custom hooks (useXxx)', () => {
      expect(isReactHookName('useCustomHook')).toBe(true);
      expect(isReactHookName('useMyState')).toBe(true);
      expect(isReactHookName('useFormData')).toBe(true);
      expect(isReactHookName('useAuth')).toBe(true);
      expect(isReactHookName('useFetch')).toBe(true);
    });

    it('returns false for non-hooks', () => {
      expect(isReactHookName('normalFunction')).toBe(false);
      expect(isReactHookName('helper')).toBe(false);
      expect(isReactHookName('use')).toBe(true); // 'use' is a React 19 hook
      expect(isReactHookName('useless')).toBe(false); // lowercase after 'use'
      expect(isReactHookName('user')).toBe(false);
      expect(isReactHookName('username')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isReactHookName('')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(isReactHookName('UseState')).toBe(false); // uppercase U
      expect(isReactHookName('useState')).toBe(true);
      expect(isReactHookName('USESTATE')).toBe(false);
    });
  });

  describe('isComponentName', () => {
    it('returns true for PascalCase names', () => {
      expect(isComponentName('MyComponent')).toBe(true);
      expect(isComponentName('Button')).toBe(true);
      expect(isComponentName('UserProfile')).toBe(true);
      expect(isComponentName('A')).toBe(true); // single uppercase letter
    });

    it('returns false for camelCase names', () => {
      expect(isComponentName('myComponent')).toBe(false);
      expect(isComponentName('button')).toBe(false);
      expect(isComponentName('userProfile')).toBe(false);
    });

    it('returns false for all lowercase', () => {
      expect(isComponentName('component')).toBe(false);
      expect(isComponentName('a')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isComponentName('')).toBe(false);
    });

    it('returns false for strings starting with numbers', () => {
      expect(isComponentName('1Component')).toBe(false);
    });

    it('returns false for strings starting with underscore', () => {
      expect(isComponentName('_Component')).toBe(false);
    });

    it('handles names with numbers after first character', () => {
      expect(isComponentName('Button2')).toBe(true);
      expect(isComponentName('MyComponent123')).toBe(true);
    });

    it('handles acronyms', () => {
      expect(isComponentName('HTMLButton')).toBe(true);
      expect(isComponentName('XMLParser')).toBe(true);
      expect(isComponentName('APIClient')).toBe(true);
    });
  });
});
