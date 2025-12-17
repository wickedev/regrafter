/**
 * Dynamic Code Detector Tests
 *
 * Tests for detecting eval(), Function(), and other dynamic code patterns.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { createDynamicCodeDetector } from '../dynamic-code-detector.js';

/**
 * Helper to parse code and get the first JSX element
 */
function parseAndGetElement(code: string): NodePath | null {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let elementPath: NodePath | null = null;

  traverse(ast, {
    JSXElement(path) {
      if (!elementPath) {
        elementPath = path;
      }
    },
  });

  return elementPath;
}

describe('DynamicCodeDetector', () => {
  describe('eval() detection', () => {
    it('should detect eval() calls', () => {
      const code = `
        function Component() {
          const x = eval('1 + 1');
          return <div>{x}</div>;
        }
      `;

      const elementPath = parseAndGetElement(code);
      expect(elementPath).not.toBeNull();

      const detector = createDynamicCodeDetector();
      const result = detector.detect(elementPath!);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'eval',
        code: 'eval(...)',
      });
      expect(result[0]?.location).toBeDefined();
    });

    it('should detect multiple eval() calls', () => {
      const code = `
        function Component() {
          const x = eval('1 + 1');
          const y = eval('2 + 2');
          return <div>{x + y}</div>;
        }
      `;

      const elementPath = parseAndGetElement(code);
      const detector = createDynamicCodeDetector();
      const result = detector.detect(elementPath!);

      expect(result).toHaveLength(2);
      expect(result.every(r => r.type === 'eval')).toBe(true);
    });
  });

  describe('Function constructor detection', () => {
    it('should detect Function() constructor without new', () => {
      const code = `
        function Component() {
          const fn = Function('return 1 + 1');
          return <div>{fn()}</div>;
        }
      `;

      const elementPath = parseAndGetElement(code);
      const detector = createDynamicCodeDetector();
      const result = detector.detect(elementPath!);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'Function',
        code: 'Function(...)',
      });
    });

    it('should detect new Function() constructor', () => {
      const code = `
        function Component() {
          const fn = new Function('a', 'b', 'return a + b');
          return <div>{fn(1, 2)}</div>;
        }
      `;

      const elementPath = parseAndGetElement(code);
      const detector = createDynamicCodeDetector();
      const result = detector.detect(elementPath!);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'Function',
        code: 'new Function(...)',
      });
    });
  });

  describe('dynamic import detection', () => {
    it('should detect non-static dynamic imports', () => {
      const code = `
        function Component({ moduleName }) {
          const [module, setModule] = useState(null);

          useEffect(() => {
            import(moduleName).then(setModule);
          }, [moduleName]);

          return <div>{module ? 'Loaded' : 'Loading'}</div>;
        }
      `;

      const elementPath = parseAndGetElement(code);
      const detector = createDynamicCodeDetector();
      const result = detector.detect(elementPath!);

      expect(result.length).toBeGreaterThan(0);
      const dynamicImport = result.find(r => r.type === 'dynamic_import');
      expect(dynamicImport).toBeDefined();
      expect(dynamicImport?.code).toBe('import(...)');
    });

    it('should NOT flag static imports with string literals', () => {
      const code = `
        function Component() {
          const [module, setModule] = useState(null);

          useEffect(() => {
            import('./static-module').then(setModule);
          }, []);

          return <div>{module ? 'Loaded' : 'Loading'}</div>;
        }
      `;

      const elementPath = parseAndGetElement(code);
      const detector = createDynamicCodeDetector();
      const result = detector.detect(elementPath!);

      const dynamicImport = result.find(r => r.type === 'dynamic_import');
      expect(dynamicImport).toBeUndefined();
    });
  });

  describe('no dynamic code', () => {
    it('should return empty array for clean code', () => {
      const code = `
        function Component() {
          const x = 1 + 1;
          return <div>{x}</div>;
        }
      `;

      const elementPath = parseAndGetElement(code);
      const detector = createDynamicCodeDetector();
      const result = detector.detect(elementPath!);

      expect(result).toHaveLength(0);
    });

    it('should not flag normal function calls', () => {
      const code = `
        function Component() {
          const result = myFunction('arg');
          return <div>{result}</div>;
        }
      `;

      const elementPath = parseAndGetElement(code);
      const detector = createDynamicCodeDetector();
      const result = detector.detect(elementPath!);

      expect(result).toHaveLength(0);
    });
  });
});
