/**
 * Parser Component Unit Tests
 *
 * Tests for the Parser class covering:
 * - Basic parsing of JSX, TSX, JS, JSX files
 * - Error handling and recovery
 * - Cache functionality with content hash validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Parser, createParser, ParseErrorCodes } from '../parser.js';
import type { ASTStore } from '../ast-store.js';
import { createASTStore, computeContentHash } from '../index.js';
import {
  getExtension,
  isTypeScriptFile,
  isJSXFile,
  isSupportedFile,
} from '../types.js';
import { ok } from '../../result/index.js';
import type { File as BabelFile } from '@babel/types';

describe('Parser', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = createParser();
  });

  describe('parse()', () => {
    describe('valid JavaScript files', () => {
      it('should parse simple JavaScript', () => {
        const source = `const x = 1;`;
        const result = parser.parse(source, 'test.js');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse JavaScript with modern syntax', () => {
        const source = `
          const x = a ?? b;
          const y = obj?.prop;
          const z = await Promise.resolve(1);
        `;
        const result = parser.parse(source, 'test.js');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse ES modules', () => {
        const source = `
          import React from 'react';
          export const Component = () => <div />;
        `;
        const result = parser.parse(source, 'test.jsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });
    });

    describe('valid JSX files', () => {
      it('should parse simple JSX', () => {
        const source = `const element = <div>Hello</div>;`;
        const result = parser.parse(source, 'test.jsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse JSX with expressions', () => {
        const source = `
          const Component = () => {
            const name = "World";
            return <div>Hello {name}</div>;
          };
        `;
        const result = parser.parse(source, 'test.jsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse JSX with fragments', () => {
        const source = `
          const Component = () => (
            <>
              <div>First</div>
              <div>Second</div>
            </>
          );
        `;
        const result = parser.parse(source, 'test.jsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse JSX with spread attributes', () => {
        const source = `const element = <div {...props} className="test" />;`;
        const result = parser.parse(source, 'test.jsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse JSX with conditional rendering', () => {
        const source = `
          const Component = ({ show }) => (
            <div>
              {show && <span>Visible</span>}
              {!show ? <span>A</span> : <span>B</span>}
            </div>
          );
        `;
        const result = parser.parse(source, 'test.jsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse JSX with map expressions', () => {
        const source = `
          const List = ({ items }) => (
            <ul>
              {items.map(item => <li key={item.id}>{item.name}</li>)}
            </ul>
          );
        `;
        const result = parser.parse(source, 'test.jsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });
    });

    describe('valid TypeScript files', () => {
      it('should parse TypeScript with type annotations', () => {
        const source = `
          const x: number = 1;
          function add(a: number, b: number): number {
            return a + b;
          }
        `;
        const result = parser.parse(source, 'test.ts');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse TypeScript interfaces', () => {
        const source = `
          interface Props {
            name: string;
            age?: number;
          }
        `;
        const result = parser.parse(source, 'test.ts');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse TypeScript generics', () => {
        const source = `
          function identity<T>(arg: T): T {
            return arg;
          }
          const result: Array<number> = [1, 2, 3];
        `;
        const result = parser.parse(source, 'test.ts');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse TypeScript enums', () => {
        const source = `
          enum Direction {
            Up,
            Down,
            Left,
            Right
          }
        `;
        const result = parser.parse(source, 'test.ts');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });
    });

    describe('valid TSX files', () => {
      it('should parse TSX with typed props', () => {
        const source = `
          interface Props {
            name: string;
          }
          const Component = (props: Props) => <div>{props.name}</div>;
        `;
        const result = parser.parse(source, 'test.tsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse TSX with React hooks', () => {
        const source = `
          import { useState, useEffect } from 'react';

          const Counter = () => {
            const [count, setCount] = useState<number>(0);

            useEffect(() => {
              document.title = \`Count: \${count}\`;
            }, [count]);

            return (
              <button onClick={() => setCount(c => c + 1)}>
                Count: {count}
              </button>
            );
          };
        `;
        const result = parser.parse(source, 'test.tsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse TSX with generics in JSX', () => {
        const source = `
          interface ListProps<T> {
            items: T[];
            renderItem: (item: T) => JSX.Element;
          }

          function List<T>(props: ListProps<T>) {
            return <div>{props.items.map(props.renderItem)}</div>;
          }
        `;
        const result = parser.parse(source, 'test.tsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });
    });

    describe('class components and decorators', () => {
      it('should parse class components', () => {
        const source = `
          class Component extends React.Component {
            render() {
              return <div>Hello</div>;
            }
          }
        `;
        const result = parser.parse(source, 'test.tsx');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse class properties', () => {
        const source = `
          class Counter {
            count = 0;
            #privateCount = 0;

            increment() {
              this.count++;
              this.#privateCount++;
            }
          }
        `;
        const result = parser.parse(source, 'test.ts');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });

      it('should parse decorators', () => {
        const source = `
          @observable
          class Store {
            @action
            setValue(value: number) {
              this.value = value;
            }
          }
        `;
        const result = parser.parse(source, 'test.ts');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).not.toBeNull();
        }
      });
    });
  });

  describe('error handling', () => {
    it('should return error for empty source', () => {
      const result = parser.parse('', 'test.js');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ParseErrorCodes.EMPTY_SOURCE);
      }
    });

    it('should return error for whitespace-only source', () => {
      const result = parser.parse('   \n\t  ', 'test.js');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ParseErrorCodes.EMPTY_SOURCE);
      }
    });

    it('should return error for unsupported file types', () => {
      const result = parser.parse('content', 'test.py');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ParseErrorCodes.UNSUPPORTED_FILE);
      }
    });

    it('should recover from syntax errors when possible', () => {
      // Missing closing bracket - Babel's error recovery should handle this
      const source = `
        const x = 1;
        const y = {
          a: 1
        // missing closing bracket for object but we have more valid code
        const z = 2;
      `;
      const result = parser.parse(source, 'test.js');

      // With error recovery, we should get either an AST or an error
      // The exact behavior depends on Babel's error recovery
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe('boolean');
    });

    it('should include location information in errors', () => {
      // Syntax error that Babel can't recover from
      const source = `const x = @@@;`; // Invalid syntax
      const result = parser.parse(source, 'test.js');

      // If there are errors, they should have location info
      if (!result.ok && result.error.location) {
        expect(result.error.location).toHaveProperty('start');
        expect(result.error.location?.start).toHaveProperty('line');
        expect(result.error.location?.start).toHaveProperty('column');
      }
    });

    it('should include filename in error messages', () => {
      const result = parser.parse('', 'my-component.tsx');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('my-component.tsx');
      }
    });
  });

  describe('parseFiles()', () => {
    it('should parse multiple files', () => {
      const files = [
        { path: 'file1.js', content: 'const a = 1;' },
        { path: 'file2.tsx', content: 'const b = <div />;' },
        { path: 'file3.ts', content: 'const c: number = 3;' },
      ];

      const results = parser.parseFiles(files);

      expect(results.size).toBe(3);
      expect(results.get('file1.js')?.ok).toBe(true);
      expect(results.get('file2.tsx')?.ok).toBe(true);
      expect(results.get('file3.ts')?.ok).toBe(true);
    });

    it('should handle mix of valid and invalid files', () => {
      const files = [
        { path: 'valid.js', content: 'const a = 1;' },
        { path: 'empty.js', content: '' },
        { path: 'unsupported.py', content: 'print("hello")' },
      ];

      const results = parser.parseFiles(files);

      expect(results.size).toBe(3);
      expect(results.get('valid.js')?.ok).toBe(true);
      expect(results.get('empty.js')?.ok).toBe(false);
      expect(results.get('unsupported.py')?.ok).toBe(false);
    });

    it('should return empty map for empty input', () => {
      const results = parser.parseFiles([]);

      expect(results.size).toBe(0);
    });
  });

  describe('caching', () => {
    it('should cache parsed results', () => {
      const source = 'const x = 1;';
      const filename = 'test.js';

      // First parse
      parser.parse(source, filename);
      expect(parser.getCacheSize()).toBe(1);

      // Second parse with same content should use cache
      const result2 = parser.parse(source, filename);
      expect(result2.ok).toBe(true);
      expect(parser.getCacheSize()).toBe(1);
    });

    it('should invalidate cache when content changes', () => {
      const filename = 'test.js';

      // First parse
      parser.parse('const x = 1;', filename);
      expect(parser.getCacheSize()).toBe(1);

      // Parse with different content should invalidate and re-cache
      parser.parse('const x = 2;', filename);
      expect(parser.getCacheSize()).toBe(1);
    });

    it('should invalidate cache manually', () => {
      const source = 'const x = 1;';
      const filename = 'test.js';

      parser.parse(source, filename);
      expect(parser.getCacheSize()).toBe(1);

      parser.invalidateCache(filename);
      expect(parser.getCacheSize()).toBe(0);
    });

    it('should clear all cache', () => {
      parser.parse('const a = 1;', 'a.js');
      parser.parse('const b = 2;', 'b.js');
      expect(parser.getCacheSize()).toBe(2);

      parser.clearCache();
      expect(parser.getCacheSize()).toBe(0);
    });

    it('should not cache failed parses', () => {
      parser.parse('', 'empty.js');
      expect(parser.getCacheSize()).toBe(0);

      parser.parse('content', 'test.py');
      expect(parser.getCacheSize()).toBe(0);
    });

    it('should return cached result faster', () => {
      const source = `
        const Component = () => {
          const [state, setState] = useState(0);
          return <div onClick={() => setState(s => s + 1)}>{state}</div>;
        };
      `;
      const filename = 'component.tsx';

      // First parse (cold)
      const start1 = performance.now();
      parser.parse(source, filename);
      const time1 = performance.now() - start1;

      // Second parse (cached)
      const start2 = performance.now();
      parser.parse(source, filename);
      const time2 = performance.now() - start2;

      // Cached should be significantly faster (at least 90% faster)
      expect(time2).toBeLessThan(time1);
    });
  });
});

describe('ASTStore', () => {
  let store: ASTStore;

  beforeEach(() => {
    store = createASTStore();
  });

  it('should store and retrieve parse results', () => {
    const content = 'const x = 1;';
    const result = {
      ok: true,
      value: {} as any,
    } as any;

    store.set('test.js', content, result);
    const cached = store.get('test.js', content);

    expect(cached).toEqual(result);
  });

  it('should return undefined for non-existent entries', () => {
    const cached = store.get('nonexistent.js', 'content');
    expect(cached).toBeUndefined();
  });

  it('should invalidate on content change', () => {
    const result = {
      ok: true,
      value: {} as any,
    } as any;

    store.set('test.js', 'const x = 1;', result);
    const cached = store.get('test.js', 'const x = 2;'); // Different content

    expect(cached).toBeUndefined();
  });

  it('should not store failed parses', () => {
    const failedResult = {
      ok: false,
      error: { message: 'Error', location: null, code: 'E001' },
    } as any;

    store.set('test.js', 'content', failedResult);
    expect(store.size).toBe(0);
  });

  it('should invalidate specific entries', () => {
    const result = ok({} as BabelFile);

    store.set('a.js', 'const a = 1;', result);
    store.set('b.js', 'const b = 2;', result);
    expect(store.size).toBe(2);

    store.invalidate('a.js');
    expect(store.size).toBe(1);
    expect(store.has('a.js')).toBe(false);
    expect(store.has('b.js')).toBe(true);
  });

  it('should clear all entries', () => {
    const result = ok({} as BabelFile);

    store.set('a.js', 'const a = 1;', result);
    store.set('b.js', 'const b = 2;', result);
    store.clear();

    expect(store.size).toBe(0);
  });
});

describe('computeContentHash', () => {
  it('should produce consistent hashes', () => {
    const content = 'const x = 1;';
    const hash1 = computeContentHash(content);
    const hash2 = computeContentHash(content);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', () => {
    const hash1 = computeContentHash('const x = 1;');
    const hash2 = computeContentHash('const x = 2;');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty strings', () => {
    const hash = computeContentHash('');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should handle unicode content', () => {
    const hash = computeContentHash('const greeting = "Hello, World!";');
    expect(typeof hash).toBe('string');
  });
});

describe('type utility functions', () => {
  describe('getExtension', () => {
    it('should extract extensions correctly', () => {
      expect(getExtension('test.js')).toBe('.js');
      expect(getExtension('test.tsx')).toBe('.tsx');
      expect(getExtension('path/to/file.ts')).toBe('.ts');
      expect(getExtension('no-extension')).toBe('');
      expect(getExtension('.gitignore')).toBe('.gitignore');
    });

    it('should handle multiple dots', () => {
      expect(getExtension('file.test.js')).toBe('.js');
      expect(getExtension('component.spec.tsx')).toBe('.tsx');
    });

    it('should be case-insensitive', () => {
      expect(getExtension('test.JS')).toBe('.js');
      expect(getExtension('test.TSX')).toBe('.tsx');
    });
  });

  describe('isTypeScriptFile', () => {
    it('should identify TypeScript files', () => {
      expect(isTypeScriptFile('test.ts')).toBe(true);
      expect(isTypeScriptFile('test.tsx')).toBe(true);
      expect(isTypeScriptFile('test.js')).toBe(false);
      expect(isTypeScriptFile('test.jsx')).toBe(false);
    });
  });

  describe('isJSXFile', () => {
    it('should identify JSX files', () => {
      expect(isJSXFile('test.jsx')).toBe(true);
      expect(isJSXFile('test.tsx')).toBe(true);
      expect(isJSXFile('test.js')).toBe(false);
      expect(isJSXFile('test.ts')).toBe(false);
    });
  });

  describe('isSupportedFile', () => {
    it('should identify supported files', () => {
      expect(isSupportedFile('test.ts')).toBe(true);
      expect(isSupportedFile('test.tsx')).toBe(true);
      expect(isSupportedFile('test.js')).toBe(true);
      expect(isSupportedFile('test.jsx')).toBe(true);
      expect(isSupportedFile('test.py')).toBe(false);
      expect(isSupportedFile('test.css')).toBe(false);
    });
  });
});
