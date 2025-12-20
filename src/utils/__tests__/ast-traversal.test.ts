/**
 * Tests for AST Traversal Utilities
 *
 * Tests cover traverseIdentifierReferences and helper functions for
 * determining identifier context (declaration, property key, JSX, type annotation).
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import {
  traverseIdentifierReferences,
  isDeclarationIdentifier,
  isPropertyKey,
  isJSXAttribute,
  isTypeAnnotation,
} from '../ast-traversal.js';

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
 * Helper to find first identifier path by name
 */
function findIdentifier(ast: t.File, name: string): NodePath<t.Identifier> | null {
  let found: NodePath<t.Identifier> | null = null;
  traverse(ast, {
    Identifier(path) {
      if (path.node.name === name && !found) {
        found = path;
      }
    },
  });
  return found;
}

describe('ast-traversal utilities', () => {
  describe('isDeclarationIdentifier', () => {
    it('returns true for variable declarator id', () => {
      const code = 'const foo = 123;';
      const ast = parseCode(code);
      const fooPath = findIdentifier(ast, 'foo');

      expect(fooPath).not.toBeNull();
      expect(isDeclarationIdentifier(fooPath!)).toBe(true);
    });

    it('returns true for function declaration id', () => {
      const code = 'function myFunc() {}';
      const ast = parseCode(code);
      const funcPath = findIdentifier(ast, 'myFunc');

      expect(funcPath).not.toBeNull();
      expect(isDeclarationIdentifier(funcPath!)).toBe(true);
    });

    it('returns true for class declaration id', () => {
      const code = 'class MyClass {}';
      const ast = parseCode(code);
      const classPath = findIdentifier(ast, 'MyClass');

      expect(classPath).not.toBeNull();
      expect(isDeclarationIdentifier(classPath!)).toBe(true);
    });

    it('returns true for import specifier', () => {
      const code = 'import { foo } from "bar";';
      const ast = parseCode(code);
      const importPath = findIdentifier(ast, 'foo');

      expect(importPath).not.toBeNull();
      expect(isDeclarationIdentifier(importPath!)).toBe(true);
    });

    it('returns true for import default specifier', () => {
      const code = 'import React from "react";';
      const ast = parseCode(code);
      const reactPath = findIdentifier(ast, 'React');

      expect(reactPath).not.toBeNull();
      expect(isDeclarationIdentifier(reactPath!)).toBe(true);
    });

    it('returns true for import namespace specifier', () => {
      const code = 'import * as utils from "utils";';
      const ast = parseCode(code);
      const utilsPath = findIdentifier(ast, 'utils');

      expect(utilsPath).not.toBeNull();
      expect(isDeclarationIdentifier(utilsPath!)).toBe(true);
    });

    it('returns false for identifier reference', () => {
      const code = 'console.log(foo);';
      const ast = parseCode(code);
      const fooPath = findIdentifier(ast, 'foo');

      expect(fooPath).not.toBeNull();
      expect(isDeclarationIdentifier(fooPath!)).toBe(false);
    });
  });

  describe('isPropertyKey', () => {
    it('returns true for non-computed object property key', () => {
      const code = 'const obj = { foo: 123 };';
      const ast = parseCode(code);
      // Find 'foo' as property key
      let keyPath: NodePath<t.Identifier> | null = null;
      traverse(ast, {
        ObjectProperty(path) {
          if (t.isIdentifier(path.node.key) && !path.node.computed) {
            keyPath = path.get('key') as NodePath<t.Identifier>;
          }
        },
      });

      expect(keyPath).not.toBeNull();
      expect(isPropertyKey(keyPath!)).toBe(true);
    });

    it('returns false for computed object property key', () => {
      const code = 'const obj = { [foo]: 123 };';
      const ast = parseCode(code);
      const fooPath = findIdentifier(ast, 'foo');

      expect(fooPath).not.toBeNull();
      expect(isPropertyKey(fooPath!)).toBe(false);
    });

    it('returns true for non-computed member expression property', () => {
      const code = 'obj.foo';
      const ast = parseCode(code);
      // Find 'foo' in member expression
      let propPath: NodePath<t.Identifier> | null = null;
      traverse(ast, {
        MemberExpression(path) {
          if (t.isIdentifier(path.node.property) && !path.node.computed) {
            propPath = path.get('property') as NodePath<t.Identifier>;
          }
        },
      });

      expect(propPath).not.toBeNull();
      expect(isPropertyKey(propPath!)).toBe(true);
    });

    it('returns false for computed member expression property', () => {
      const code = 'obj[foo]';
      const ast = parseCode(code);
      const fooPath = findIdentifier(ast, 'foo');

      expect(fooPath).not.toBeNull();
      expect(isPropertyKey(fooPath!)).toBe(false);
    });

    it('returns false for property value', () => {
      const code = 'const obj = { key: foo };';
      const ast = parseCode(code);
      // Find 'foo' as value
      let valuePath: NodePath<t.Identifier> | null = null;
      traverse(ast, {
        ObjectProperty(path) {
          if (t.isIdentifier(path.node.value) && path.node.value.name === 'foo') {
            valuePath = path.get('value') as NodePath<t.Identifier>;
          }
        },
      });

      expect(valuePath).not.toBeNull();
      expect(isPropertyKey(valuePath!)).toBe(false);
    });
  });

  describe('isJSXAttribute', () => {
    it('returns true for identifier used in JSX attribute value', () => {
      const code = '<div className={foo} />';
      const ast = parseCode(code);
      const fooPath = findIdentifier(ast, 'foo');

      expect(fooPath).not.toBeNull();
      // Identifier is used inside a JSX attribute expression container
      expect(isJSXAttribute(fooPath!)).toBe(true);
    });

    it('returns false for identifier in JSX children', () => {
      const code = '<div>{foo}</div>';
      const ast = parseCode(code);
      const fooPath = findIdentifier(ast, 'foo');

      expect(fooPath).not.toBeNull();
      expect(isJSXAttribute(fooPath!)).toBe(false);
    });

    it('returns false for non-JSX identifier', () => {
      const code = 'const foo = 123;';
      const ast = parseCode(code);
      const fooPath = findIdentifier(ast, 'foo');

      expect(fooPath).not.toBeNull();
      expect(isJSXAttribute(fooPath!)).toBe(false);
    });
  });

  describe('isTypeAnnotation', () => {
    it('returns false for value identifiers', () => {
      const code = 'const foo = bar;';
      const ast = parseCode(code);
      const barPath = findIdentifier(ast, 'bar');

      expect(barPath).not.toBeNull();
      expect(isTypeAnnotation(barPath!)).toBe(false);
    });

    it('returns false for JSX identifiers', () => {
      const code = '<div>{foo}</div>';
      const ast = parseCode(code);
      const fooPath = findIdentifier(ast, 'foo');

      expect(fooPath).not.toBeNull();
      expect(isTypeAnnotation(fooPath!)).toBe(false);
    });

    it('works correctly in traversal context to filter type annotations', () => {
      // Note: TypeScript type annotations don't create regular Identifier nodes
      // when traversing, so this function primarily helps filter out identifiers
      // that happen to be in type positions (like type assertions).
      const code = 'const x = (foo as any);';
      const ast = parseCode(code);
      const identifiers: string[] = [];

      traverse(ast, {
        Identifier(path) {
          if (!isTypeAnnotation(path) && !isDeclarationIdentifier(path)) {
            identifiers.push(path.node.name);
          }
        },
      });

      expect(identifiers).toContain('foo');
    });
  });

  describe('traverseIdentifierReferences', () => {
    it('collects all identifier references', () => {
      const code = `
        const x = 1;
        const y = x + 2;
        function foo() {
          return x + y;
        }
      `;
      const ast = parseCode(code);
      const references: Array<{ name: string; line: number | null }> = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(path, (idPath) => {
            references.push({
              name: idPath.node.name,
              line: idPath.node.loc?.start.line ?? null,
            });
          });
        },
      });

      // Should find references to 'x' and 'y', but not declarations
      const names = references.map((r) => r.name);
      expect(names).toContain('x');
      expect(names).toContain('y');
      expect(names.filter((n) => n === 'x').length).toBeGreaterThan(0);
    });

    it('skips declarations when skipDeclarations is true', () => {
      const code = 'const foo = 123;';
      const ast = parseCode(code);
      const references: string[] = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(
            path,
            (idPath) => {
              references.push(idPath.node.name);
            },
            { skipDeclarations: true }
          );
        },
      });

      expect(references).not.toContain('foo');
    });

    it('includes declarations when skipDeclarations is false', () => {
      const code = 'const foo = 123;';
      const ast = parseCode(code);
      const references: string[] = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(
            path,
            (idPath) => {
              references.push(idPath.node.name);
            },
            { skipDeclarations: false }
          );
        },
      });

      expect(references).toContain('foo');
    });

    it('skips property keys when skipPropertyKeys is true', () => {
      const code = 'const obj = { foo: 123 };';
      const ast = parseCode(code);
      const references: string[] = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(
            path,
            (idPath) => {
              references.push(idPath.node.name);
            },
            { skipPropertyKeys: true }
          );
        },
      });

      expect(references).not.toContain('foo');
    });

    it('includes property keys when skipPropertyKeys is false', () => {
      const code = 'const obj = { foo: 123 };';
      const ast = parseCode(code);
      const references: string[] = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(
            path,
            (idPath) => {
              references.push(idPath.node.name);
            },
            { skipPropertyKeys: false }
          );
        },
      });

      expect(references).toContain('foo');
    });

    it('skips JSX attributes when skipJSXAttributes is true', () => {
      const code = '<div className="foo" />';
      const ast = parseCode(code);
      const references: string[] = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(
            path,
            (idPath) => {
              references.push(idPath.node.name);
            },
            { skipJSXAttributes: true }
          );
        },
      });

      expect(references).not.toContain('className');
    });

    it('includes JSX attributes when skipJSXAttributes is false', () => {
      const code = '<div className={foo} />';
      const ast = parseCode(code);
      const references: string[] = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(
            path,
            (idPath) => {
              references.push(idPath.node.name);
            },
            { skipJSXAttributes: false, skipDeclarations: true }
          );
        },
      });

      expect(references).toContain('foo');
    });

    it('skips type annotations when skipTypeAnnotations is true', () => {
      const code = 'const foo: string = "bar";';
      const ast = parseCode(code);
      const references: string[] = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(
            path,
            (idPath) => {
              references.push(idPath.node.name);
            },
            { skipTypeAnnotations: true }
          );
        },
      });

      expect(references).not.toContain('string');
    });

    it('includes type annotations when skipTypeAnnotations is false', () => {
      const code = 'type MyType = string; const foo: MyType = "bar";';
      const ast = parseCode(code);
      const references: string[] = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(
            path,
            (idPath) => {
              references.push(idPath.node.name);
            },
            { skipTypeAnnotations: false, skipDeclarations: true }
          );
        },
      });

      expect(references).toContain('MyType');
    });

    it('handles complex AST structures', () => {
      const code = `
        import React from 'react';

        function Component({ prop }: { prop: string }) {
          const [state, setState] = React.useState(0);
          const computed = state + 1;

          return (
            <div className="container">
              <span>{computed}</span>
            </div>
          );
        }
      `;
      const ast = parseCode(code);
      const references: string[] = [];

      traverse(ast, {
        Program(path) {
          traverseIdentifierReferences(
            path,
            (idPath) => {
              references.push(idPath.node.name);
            },
            {
              skipDeclarations: true,
              skipPropertyKeys: true,
              skipJSXAttributes: true,
              skipTypeAnnotations: true,
            }
          );
        },
      });

      // Should include references but not declarations, keys, or type annotations
      expect(references).toContain('React'); // React.useState
      expect(references).toContain('state'); // in computed expression
      expect(references).toContain('computed'); // in JSX
      expect(references).not.toContain('Component'); // declaration
      expect(references).not.toContain('className'); // JSX attribute
      expect(references).not.toContain('string'); // type annotation
    });
  });
});
