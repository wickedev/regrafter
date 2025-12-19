/**
 * Unit Tests for API Utility Functions
 *
 * Tests for parseAllFiles() and generateCodeForFiles() utilities
 * extracted in Phase 1 refactoring.
 *
 * Test coverage includes:
 * - Success cases: valid files parse and generate correctly
 * - Error cases: invalid syntax returns Err
 * - Empty input handling
 * - Multiple files processing
 * - Result monad pattern verification
 * - Edge cases (empty files, missing files)
 */

import { describe, it, expect } from 'vitest';
import type * as t from '@babel/types';
import { parseAllFiles } from '../parse-utils.js';
import { generateCodeForFiles } from '../generation-utils.js';
import { CodeGenerator } from '../../generator/code-generator.js';
import { isErr, isOk, err } from '../../result/index.js';
import type { FileInput } from '../../types/index.js';

describe('API Utility Functions', () => {
  describe('parseAllFiles()', () => {
    describe('success cases', () => {
      it('should parse a single valid file successfully', () => {
        const files: FileInput[] = [
          { path: 'test.tsx', content: 'const x = 1;' }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBeInstanceOf(Map);
          expect(result.value.size).toBe(1);
          expect(result.value.has('test.tsx')).toBe(true);

          const ast = result.value.get('test.tsx');
          expect(ast).toBeDefined();
          expect(ast?.type).toBe('File');
          expect(ast?.program).toBeDefined();
        }
      });

      it('should parse multiple valid files successfully', () => {
        const files: FileInput[] = [
          { path: 'App.tsx', content: 'const x = 1;' },
          { path: 'Button.tsx', content: 'export function Button() { return <button>Click</button>; }' },
          { path: 'utils.ts', content: 'export const add = (a: number, b: number) => a + b;' }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.size).toBe(3);
          expect(result.value.has('App.tsx')).toBe(true);
          expect(result.value.has('Button.tsx')).toBe(true);
          expect(result.value.has('utils.ts')).toBe(true);

          // Verify all ASTs are valid
          files.forEach(file => {
            const ast = result.value.get(file.path);
            expect(ast).toBeDefined();
            expect(ast?.type).toBe('File');
          });
        }
      });

      it('should parse JSX code correctly', () => {
        const files: FileInput[] = [
          {
            path: 'Component.tsx',
            content: `
              function Component() {
                return <div><span>Hello</span></div>;
              }
            `
          }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          const ast = result.value.get('Component.tsx');
          expect(ast).toBeDefined();
          expect(ast?.program).toBeDefined();
        }
      });

      it('should parse TypeScript code with type annotations', () => {
        const files: FileInput[] = [
          {
            path: 'typed.ts',
            content: `
              interface User {
                name: string;
                age: number;
              }
              const user: User = { name: 'Alice', age: 30 };
            `
          }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          const ast = result.value.get('typed.ts');
          expect(ast).toBeDefined();
        }
      });

      it('should parse files with React hooks', () => {
        const files: FileInput[] = [
          {
            path: 'hooks.tsx',
            content: `
              import { useState, useEffect } from 'react';
              function Component() {
                const [count, setCount] = useState(0);
                useEffect(() => {
                  console.log(count);
                }, [count]);
                return <div>{count}</div>;
              }
            `
          }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
      });

      it('should parse files with imports and exports', () => {
        const files: FileInput[] = [
          {
            path: 'module.ts',
            content: `
              import { helper } from './utils';
              export const value = 42;
              export default function main() {
                return helper(value);
              }
            `
          }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
      });
    });

    describe('error cases', () => {
      it('should return Err for invalid syntax', () => {
        const files: FileInput[] = [
          { path: 'bad.tsx', content: 'const x =' }
        ];

        const result = parseAllFiles(files);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error._tag).toBe('ParseError');
          expect(result.error.message).toBeDefined();
          expect(result.error.code).toBeDefined();
        }
      });

      it('should return Err for invalid JSX syntax', () => {
        const files: FileInput[] = [
          { path: 'invalid-jsx.tsx', content: '<div><span></div>' }
        ];

        const result = parseAllFiles(files);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error._tag).toBe('ParseError');
        }
      });

      it('should return Err for invalid TypeScript syntax', () => {
        const files: FileInput[] = [
          { path: 'bad-ts.ts', content: 'interface User { name string }' }
        ];

        const result = parseAllFiles(files);

        expect(isErr(result)).toBe(true);
      });

      it('should return Err on first parse error when multiple files exist', () => {
        const files: FileInput[] = [
          { path: 'valid.tsx', content: 'const x = 1;' },
          { path: 'invalid.tsx', content: 'const y =' },
          { path: 'also-valid.tsx', content: 'const z = 3;' }
        ];

        const result = parseAllFiles(files);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error._tag).toBe('ParseError');
          // Should fail on the invalid.tsx file
          expect(result.error.message).toContain('invalid.tsx');
        }
      });

      it('should return Err for unexpected tokens', () => {
        const files: FileInput[] = [
          { path: 'tokens.js', content: 'const x = @@@;' }
        ];

        const result = parseAllFiles(files);

        expect(isErr(result)).toBe(true);
      });

      it('should include file path in error message', () => {
        const files: FileInput[] = [
          { path: 'my-component.tsx', content: 'const broken =' }
        ];

        const result = parseAllFiles(files);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('my-component.tsx');
          expect(result.error.file).toBe('my-component.tsx');
        }
      });
    });

    describe('empty input handling', () => {
      it('should handle empty array successfully', () => {
        const files: FileInput[] = [];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.size).toBe(0);
        }
      });

      it('should return Err for empty file content', () => {
        const files: FileInput[] = [
          { path: 'empty.tsx', content: '' }
        ];

        const result = parseAllFiles(files);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error._tag).toBe('ParseError');
          expect(result.error.code).toBe('E004'); // EMPTY_SOURCE error code
        }
      });

      it('should return Err for whitespace-only file content', () => {
        const files: FileInput[] = [
          { path: 'whitespace.tsx', content: '   \n\t  ' }
        ];

        const result = parseAllFiles(files);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('E004');
        }
      });
    });

    describe('edge cases', () => {
      it('should handle files with special characters in paths', () => {
        const files: FileInput[] = [
          { path: 'folder/sub-folder/Component.tsx', content: 'const x = 1;' }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.has('folder/sub-folder/Component.tsx')).toBe(true);
        }
      });

      it('should handle file with many statements', () => {
        // Create a file with many separate const declarations
        const statements = Array.from({ length: 100 }, (_, i) => `const x${i} = ${i};`).join('\n');
        const files: FileInput[] = [
          { path: 'many-statements.tsx', content: statements }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          const ast = result.value.get('many-statements.tsx');
          expect(ast).toBeDefined();
          expect(ast?.program.body.length).toBeGreaterThan(50);
        }
      });

      it('should handle files with unicode content', () => {
        const files: FileInput[] = [
          {
            path: 'unicode.tsx',
            content: 'const message = "Hello 世界 🌍";'
          }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
      });

      it('should handle modern JavaScript features', () => {
        const files: FileInput[] = [
          {
            path: 'modern.ts',
            content: `
              const obj = { a: 1, b: 2 };
              const { a, ...rest } = obj;
              const arr = [1, 2, 3];
              const [first, ...restArr] = arr;
              const optional = obj?.a ?? 0;
            `
          }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
      });
    });

    describe('Result monad pattern', () => {
      it('should return Ok Result with correct structure', () => {
        const files: FileInput[] = [
          { path: 'test.tsx', content: 'const x = 1;' }
        ];

        const result = parseAllFiles(files);

        expect(result).toHaveProperty('ok');
        if (result.ok) {
          expect(result.value).toBeDefined();
        }
      });

      it('should return Err Result with correct structure', () => {
        const files: FileInput[] = [
          { path: 'test.tsx', content: 'const x =' }
        ];

        const result = parseAllFiles(files);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeDefined();
          expect(result.error._tag).toBe('ParseError');
        }
      });

      it('should be chainable with other Result operations', () => {
        const files: FileInput[] = [
          { path: 'test.tsx', content: 'const x = 1;' }
        ];

        const result = parseAllFiles(files);

        expect(isOk(result)).toBe(true);
        expect(isErr(result)).toBe(false);
      });
    });
  });

  describe('generateCodeForFiles()', () => {
    // Helper to create a simple AST map for testing
    const createParsedFiles = (files: FileInput[]): Map<string, t.File> => {
      const result = parseAllFiles(files);
      if (isOk(result)) {
        return result.value;
      }
      throw new Error('Failed to parse files in test helper');
    };

    describe('success cases', () => {
      it('should generate code for a single file successfully', () => {
        const files: FileInput[] = [
          { path: 'test.tsx', content: 'const x = 1;' }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'test.tsx', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toHaveLength(1);
          const firstCode = result.value[0];
          expect(firstCode).toBeDefined();
          if (firstCode) {
            expect(firstCode.file).toBe('test.tsx');
            expect(firstCode.content).toBeDefined();
            expect(firstCode.changed).toBe(true);
            expect(firstCode.original).toBe('const x = 1;');
          }
        }
      });

      it('should generate code for multiple files', () => {
        const files: FileInput[] = [
          { path: 'App.tsx', content: 'const x = 1;' },
          { path: 'Button.tsx', content: 'const y = 2;' },
          { path: 'utils.ts', content: 'const z = 3;' }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'App.tsx', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toHaveLength(3);

          // Verify all files are present
          const paths = result.value.map(code => code.file);
          expect(paths).toContain('App.tsx');
          expect(paths).toContain('Button.tsx');
          expect(paths).toContain('utils.ts');

          // All should have content
          result.value.forEach(code => {
            expect(code.content).toBeDefined();
            expect(code.content.length).toBeGreaterThan(0);
          });
        }
      });

      it('should mark only the source file as changed', () => {
        const files: FileInput[] = [
          { path: 'App.tsx', content: 'const x = 1;' },
          { path: 'Button.tsx', content: 'const y = 2;' }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'App.tsx', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          const appCode = result.value.find(c => c.file === 'App.tsx');
          const buttonCode = result.value.find(c => c.file === 'Button.tsx');

          expect(appCode?.changed).toBe(true);
          expect(buttonCode?.changed).toBe(false);
        }
      });

      it('should include original content only for changed file', () => {
        const files: FileInput[] = [
          { path: 'App.tsx', content: 'const x = 1;' },
          { path: 'Button.tsx', content: 'const y = 2;' }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'App.tsx', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          const appCode = result.value.find(c => c.file === 'App.tsx');
          const buttonCode = result.value.find(c => c.file === 'Button.tsx');

          expect(appCode?.original).toBeDefined();
          expect(appCode?.original).toBe('const x = 1;');
          expect(buttonCode?.original).toBeUndefined();
        }
      });

      it('should preserve JSX structure in generated code', () => {
        const files: FileInput[] = [
          {
            path: 'Component.tsx',
            content: 'function Component() { return <div><span>Hello</span></div>; }'
          }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'Component.tsx', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          const firstCode = result.value[0];
          expect(firstCode).toBeDefined();
          if (firstCode) {
            expect(firstCode.content).toContain('div');
            expect(firstCode.content).toContain('span');
            expect(firstCode.content).toContain('Hello');
          }
        }
      });

      it('should handle files with imports and exports', () => {
        const files: FileInput[] = [
          {
            path: 'module.ts',
            content: 'import { x } from "./utils"; export const y = x + 1;'
          }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'module.ts', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          const firstCode = result.value[0];
          expect(firstCode).toBeDefined();
          if (firstCode) {
            expect(firstCode.content).toContain('import');
            expect(firstCode.content).toContain('export');
          }
        }
      });
    });

    describe('empty input handling', () => {
      it('should handle empty files array', () => {
        const files: FileInput[] = [];
        const parsedFiles = new Map<string, t.File>();
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, '', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toHaveLength(0);
        }
      });

      it('should skip files not in parsedFiles map', () => {
        const files: FileInput[] = [
          { path: 'exists.tsx', content: 'const x = 1;' },
          { path: 'missing.tsx', content: 'const y = 2;' }
        ];
        const parsedFiles = new Map<string, t.File>();

        // Only parse one file
        const firstFile = files[0];
        if (firstFile) {
          const oneFileResult = parseAllFiles([firstFile]);
          if (isOk(oneFileResult)) {
            parsedFiles.set('exists.tsx', oneFileResult.value.get('exists.tsx')!);
          }
        }

        const generator = new CodeGenerator();
        const result = generateCodeForFiles(files, parsedFiles, 'exists.tsx', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          // Should only generate code for the file that exists in parsedFiles
          expect(result.value).toHaveLength(1);
          const firstCode = result.value[0];
          expect(firstCode).toBeDefined();
          if (firstCode) {
            expect(firstCode.file).toBe('exists.tsx');
          }
        }
      });
    });

    describe('edge cases', () => {
      it('should handle files with special characters in paths', () => {
        const files: FileInput[] = [
          { path: 'folder/sub-folder/Component.tsx', content: 'const x = 1;' }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'folder/sub-folder/Component.tsx', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          const firstCode = result.value[0];
          expect(firstCode).toBeDefined();
          if (firstCode) {
            expect(firstCode.file).toBe('folder/sub-folder/Component.tsx');
          }
        }
      });

      it('should handle source file that does not exist in files array', () => {
        const files: FileInput[] = [
          { path: 'App.tsx', content: 'const x = 1;' }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'NonExistent.tsx', generator);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          // All files should be marked as not changed
          const firstCode = result.value[0];
          expect(firstCode).toBeDefined();
          if (firstCode) {
            expect(firstCode.changed).toBe(false);
          }
        }
      });

      it('should maintain code consistency across generate calls', () => {
        const files: FileInput[] = [
          { path: 'test.tsx', content: 'const x = 1;' }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result1 = generateCodeForFiles(files, parsedFiles, 'test.tsx', generator);
        const result2 = generateCodeForFiles(files, parsedFiles, 'test.tsx', generator);

        expect(isOk(result1)).toBe(true);
        expect(isOk(result2)).toBe(true);

        if (isOk(result1) && isOk(result2)) {
          // Generated code should be identical for the same input
          const firstCode1 = result1.value[0];
          const firstCode2 = result2.value[0];
          expect(firstCode1).toBeDefined();
          expect(firstCode2).toBeDefined();
          if (firstCode1 && firstCode2) {
            expect(firstCode1.content).toBe(firstCode2.content);
          }
        }
      });
    });

    describe('Result monad pattern', () => {
      it('should return Ok Result with correct structure', () => {
        const files: FileInput[] = [
          { path: 'test.tsx', content: 'const x = 1;' }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'test.tsx', generator);

        expect(result).toHaveProperty('ok');
        if (result.ok) {
          expect(result.value).toBeDefined();
          expect(Array.isArray(result.value)).toBe(true);
        }
      });

      it('should be chainable with other Result operations', () => {
        const files: FileInput[] = [
          { path: 'test.tsx', content: 'const x = 1;' }
        ];
        const parsedFiles = createParsedFiles(files);
        const generator = new CodeGenerator();

        const result = generateCodeForFiles(files, parsedFiles, 'test.tsx', generator);

        expect(isOk(result)).toBe(true);
        expect(isErr(result)).toBe(false);
      });
    });

    describe('error handling', () => {
      it('should return Err when generator fails', () => {
        const files: FileInput[] = [
          { path: 'test.tsx', content: 'const x = 1;' }
        ];
        const parsedFiles = createParsedFiles(files);

        // Create a mock generator that fails
        const failingGenerator = {
          generate: () => err({
            _tag: 'GeneratorError' as const,
            code: 'GENERATION_FAILED',
            message: 'Generation failed',
            operation: 'generate',
            file: 'test.tsx',
            toFormattedString: () => 'Generation failed'
          })
        };

        const result = generateCodeForFiles(
          files,
          parsedFiles,
          'test.tsx',
          failingGenerator as any
        );

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error._tag).toBe('GeneratorError');
          expect(result.error.message).toBe('Generation failed');
        }
      });
    });

    describe('integration with parseAllFiles', () => {
      it('should work seamlessly with parseAllFiles output', () => {
        const files: FileInput[] = [
          { path: 'App.tsx', content: 'const x = 1;' },
          { path: 'Button.tsx', content: 'const y = 2;' }
        ];

        const parseResult = parseAllFiles(files);
        expect(isOk(parseResult)).toBe(true);

        if (isOk(parseResult)) {
          const generator = new CodeGenerator();
          const genResult = generateCodeForFiles(files, parseResult.value, 'App.tsx', generator);

          expect(isOk(genResult)).toBe(true);
          if (isOk(genResult)) {
            expect(genResult.value).toHaveLength(2);
          }
        }
      });

      it('should handle complete parse-generate pipeline', () => {
        const files: FileInput[] = [
          {
            path: 'Component.tsx',
            content: `
              function Component({ name }: { name: string }) {
                return <div>Hello {name}</div>;
              }
            `
          }
        ];

        // Parse
        const parseResult = parseAllFiles(files);
        expect(isOk(parseResult)).toBe(true);

        // Generate
        if (isOk(parseResult)) {
          const generator = new CodeGenerator();
          const genResult = generateCodeForFiles(files, parseResult.value, 'Component.tsx', generator);

          expect(isOk(genResult)).toBe(true);
          if (isOk(genResult)) {
            // Verify the generated code is valid
            const firstCode = genResult.value[0];
            expect(firstCode).toBeDefined();
            if (firstCode) {
              expect(firstCode.content).toContain('Component');
              expect(firstCode.content).toContain('name');
              expect(firstCode.changed).toBe(true);
            }
          }
        }
      });
    });
  });
});
