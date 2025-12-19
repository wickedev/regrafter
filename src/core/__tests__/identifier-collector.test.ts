/**
 * IdentifierCollector tests
 *
 * Tests the shared identifier collection utility used across
 * DependencyAnalyzer, ExtractDependencyAnalyzer, SinkExecutor,
 * and SharedModuleCreator.
 */

import { describe, test, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

import { loadTraverseFunction } from '../../utils/index.js';
import { IdentifierCollector } from '../identifier-collector.js';

const traverse = loadTraverseFunction(traverseModule);

/**
 * Helper to parse code and get NodePath for testing
 */
function parseAndGetPath(code: string): any {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let targetPath: any = null;
  traverse(ast, {
    Program(path: any) {
      targetPath = path;
      path.stop();
    },
  });

  return targetPath;
}

describe('IdentifierCollector', () => {
  describe('collectNames()', () => {
    test('shouldCollectSimpleIdentifier', () => {
      const code = `const value = someVariable;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectNames(path);

      expect(result.has('someVariable')).toBe(true);
      expect(result.has('value')).toBe(false); // Declarations excluded by default
    });

    test('shouldCollectMultipleIdentifiers', () => {
      const code = `const result = foo + bar + baz;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectNames(path);

      expect(result.has('foo')).toBe(true);
      expect(result.has('bar')).toBe(true);
      expect(result.has('baz')).toBe(true);
      expect(result.size).toBe(3);
    });

    test('shouldExcludePropertyKeys', () => {
      const code = `const obj = { key: value };`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectNames(path);

      expect(result.has('value')).toBe(true);
      expect(result.has('key')).toBe(false); // Property key excluded
      expect(result.size).toBe(1);
    });

    test('shouldExcludeJSXElementNames', () => {
      const code = `const element = <Button onClick={handler} />;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectNames(path);

      expect(result.has('handler')).toBe(true);
      expect(result.has('Button')).toBe(false); // JSX element name excluded
      expect(result.size).toBe(1);
    });

    test('shouldExcludeJSXAttributeNames', () => {
      const code = `const element = <div className={styles} />;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectNames(path);

      expect(result.has('styles')).toBe(true);
      expect(result.has('className')).toBe(false); // JSX attribute name excluded
      expect(result.size).toBe(1);
    });

    test('shouldIncludeJSXElementNamesWithOption', () => {
      const code = `const element = <CustomComponent />;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector({ includeJSXElements: true });

      const result = collector.collectNames(path);

      expect(result.has('CustomComponent')).toBe(true);
      expect(result.size).toBe(1);
    });
  });

  describe('collectDetailed()', () => {
    test('shouldCollectIdentifierWithMetadata', () => {
      const code = `const value = someVariable;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectDetailed(path);

      expect(result.identifiers.length).toBe(1);
      const firstIdentifier = result.identifiers[0];
      if (firstIdentifier) {
        expect(firstIdentifier.name).toBe('someVariable');
        expect(firstIdentifier.path).toBeDefined();
        expect(firstIdentifier.usage).toBe('value');
      }
    });

    test('shouldDetectCallUsage', () => {
      const code = `const result = myFunction();`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const detailedResult = collector.collectDetailed(path);

      const identifier = detailedResult.identifiers.find((id) => id.name === 'myFunction');
      expect(identifier).toBeDefined();
      if (identifier) {
        expect(identifier.usage).toBe('call');
      }
    });

    test('shouldCollectJSXElementNames', () => {
      const code = `const element = <Button><Icon /></Button>;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectDetailed(path);

      expect(result.jsxElementNames).toContain('Button');
      expect(result.jsxElementNames).toContain('Icon');
      expect(result.jsxElementNames?.length).toBe(2);
    });

    test('shouldCollectSpreads', () => {
      const code = `const element = <div {...props} />;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectDetailed(path);

      expect(result.spreads?.length).toBe(1);
    });

    test('shouldDeduplicateIdentifiers', () => {
      const code = `const result = value + value + value;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectDetailed(path);

      // Should only have one entry for 'value'
      const valueRefs = result.identifiers.filter((id) => id.name === 'value');
      expect(valueRefs.length).toBe(1);
    });
  });

  describe('collectUsed()', () => {
    test('shouldExcludeBindings', () => {
      const code = `
        const foo = 'value';
        function bar() {}
        const result = foo + bar();
      `;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectUsed(path);

      expect(result.has('foo')).toBe(false); // Binding excluded
      expect(result.has('bar')).toBe(false); // Binding excluded
      expect(result.size).toBe(0);
    });

    test('shouldIncludeExternalIdentifiers', () => {
      const code = `const result = externalVar + anotherExternal;`;
      const path = parseAndGetPath(code);
      const collector = new IdentifierCollector();

      const result = collector.collectUsed(path);

      expect(result.has('externalVar')).toBe(true);
      expect(result.has('anotherExternal')).toBe(true);
      expect(result.has('result')).toBe(false); // Local binding excluded
    });
  });
});
