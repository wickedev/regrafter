/**
 * Unit tests for New File Handler Module
 */

import { describe, it, expect } from 'vitest';

import {
  isNewFile,
  detectFileType,
  generateEmptyComponentFile,
  generateEmptyFile,
  generateSharedModuleFile,
  isComponentFile,
  validateNewFilePath,
  generateUniqueFilePath,
} from '../new-file-handler.js';

// ═══════════════════════════════════════════════════════════════════════════════
// isNewFile Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('isNewFile', () => {
  it('should return true for file not in Map', () => {
    const files = new Map<string, unknown>([['src/A.ts', {}]]);

    expect(isNewFile('src/B.ts', files)).toBe(true);
  });

  it('should return false for file in Map', () => {
    const files = new Map<string, unknown>([['src/A.ts', {}]]);

    expect(isNewFile('src/A.ts', files)).toBe(false);
  });

  it('should return true for file not in Set', () => {
    const files = new Set(['src/A.ts']);

    expect(isNewFile('src/B.ts', files)).toBe(true);
  });

  it('should return false for file in Set', () => {
    const files = new Set(['src/A.ts']);

    expect(isNewFile('src/A.ts', files)).toBe(false);
  });

  it('should return true for file not in Array', () => {
    const files = ['src/A.ts'];

    expect(isNewFile('src/B.ts', files)).toBe(true);
  });

  it('should return false for file in Array', () => {
    const files = ['src/A.ts'];

    expect(isNewFile('src/A.ts', files)).toBe(false);
  });

  it('should normalize paths when comparing', () => {
    const files = new Set(['src/A.ts']);

    expect(isNewFile('./src/A.ts', files)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// detectFileType Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectFileType', () => {
  it('should detect TypeScript file', () => {
    const info = detectFileType('src/components/Button.ts');

    expect(info.isTypeScript).toBe(true);
    expect(info.isJsx).toBe(false);
    expect(info.extension).toBe('ts');
  });

  it('should detect TSX file', () => {
    const info = detectFileType('src/components/Button.tsx');

    expect(info.isTypeScript).toBe(true);
    expect(info.isJsx).toBe(true);
    expect(info.extension).toBe('tsx');
  });

  it('should detect JavaScript file', () => {
    const info = detectFileType('src/utils/helpers.js');

    expect(info.isTypeScript).toBe(false);
    expect(info.isJsx).toBe(false);
    expect(info.extension).toBe('js');
  });

  it('should detect JSX file', () => {
    const info = detectFileType('src/components/Button.jsx');

    expect(info.isTypeScript).toBe(false);
    expect(info.isJsx).toBe(true);
    expect(info.extension).toBe('jsx');
  });

  it('should generate suggested component name', () => {
    const info = detectFileType('src/components/my-button.tsx');

    expect(info.suggestedComponentName).toBe('MyButton');
  });

  it('should handle PascalCase file names', () => {
    const info = detectFileType('src/components/LoginForm.tsx');

    expect(info.suggestedComponentName).toBe('Loginform');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateEmptyComponentFile Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateEmptyComponentFile', () => {
  it('should generate valid component file', () => {
    const result = generateEmptyComponentFile('src/components/Button.tsx');

    expect(result.ast).toBeDefined();
    expect(result.code).toContain('import React');
    expect(result.code).toContain('export default');
    expect(result.filePath).toBe('src/components/Button.tsx');
  });

  it('should generate TypeScript props interface', () => {
    const result = generateEmptyComponentFile('src/components/Button.tsx');

    expect(result.code).toContain('ButtonProps');
    expect(result.code).toContain('interface');
  });

  it('should add use client directive when configured', () => {
    const result = generateEmptyComponentFile('src/components/Button.tsx', {
      useClient: true,
    });

    expect(result.code).toContain('use client');
  });

  it('should add use server directive when configured', () => {
    const result = generateEmptyComponentFile('src/components/Button.tsx', {
      useServer: true,
    });

    expect(result.code).toContain('use server');
  });

  it('should use custom component name', () => {
    const result = generateEmptyComponentFile('src/components/Button.tsx', {
      componentName: 'CustomButton',
    });

    expect(result.code).toContain('CustomButton');
    expect(result.code).toContain('CustomButtonProps');
  });

  it('should create valid Code result', () => {
    const result = generateEmptyComponentFile('src/components/Button.tsx');

    expect(result.codeResult.file).toBe('src/components/Button.tsx');
    expect(result.codeResult.changed).toBe(true);
    expect(result.codeResult.isNew).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateEmptyFile Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateEmptyFile', () => {
  it('should generate empty file with no imports', () => {
    const result = generateEmptyFile('src/utils/helpers.ts');

    expect(result.ast).toBeDefined();
    expect(result.filePath).toBe('src/utils/helpers.ts');
    expect(result.codeResult.isNew).toBe(true);
  });

  it('should include provided imports', () => {
    const result = generateEmptyFile('src/utils/helpers.ts', [
      {
        importSource: 'lodash',
        targetFile: 'src/utils/helpers.ts',
        specifiers: [
          { type: 'named', imported: 'debounce', local: 'debounce' },
        ],
      },
    ]);

    expect(result.code).toContain("from 'lodash'");
    expect(result.code).toContain('debounce');
  });

  it('should handle default imports', () => {
    const result = generateEmptyFile('src/utils/helpers.ts', [
      {
        importSource: 'axios',
        targetFile: 'src/utils/helpers.ts',
        specifiers: [{ type: 'default', imported: 'axios', local: 'axios' }],
      },
    ]);

    expect(result.code).toContain("from 'axios'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateSharedModuleFile Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateSharedModuleFile', () => {
  it('should generate shared module with exports', () => {
    const result = generateSharedModuleFile('src/shared/utils.ts', [
      {
        name: 'helper',
        node: {
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: 'helper' },
              init: { type: 'NumericLiteral', value: 1 },
            },
          ],
        } as any,
      },
    ]);

    expect(result.ast).toBeDefined();
    expect(result.code).toContain('export');
    expect(result.filePath).toBe('src/shared/utils.ts');
  });

  it('should create valid Code result', () => {
    const result = generateSharedModuleFile('src/shared/utils.ts', []);

    expect(result.codeResult.file).toBe('src/shared/utils.ts');
    expect(result.codeResult.isNew).toBe(true);
    expect(result.codeResult.changed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isComponentFile Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('isComponentFile', () => {
  it('should return true for PascalCase file names', () => {
    expect(isComponentFile('src/Button.tsx')).toBe(true);
    expect(isComponentFile('src/LoginForm.tsx')).toBe(true);
  });

  it('should return true for files in component directories', () => {
    expect(isComponentFile('src/components/button.tsx')).toBe(true);
    expect(isComponentFile('src/pages/home.tsx')).toBe(true);
    expect(isComponentFile('src/views/dashboard.tsx')).toBe(true);
    expect(isComponentFile('src/screens/login.tsx')).toBe(true);
    expect(isComponentFile('src/containers/app.tsx')).toBe(true);
  });

  it('should return false for utility files', () => {
    expect(isComponentFile('src/utils/helpers.ts')).toBe(false);
    expect(isComponentFile('src/lib/api.ts')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateNewFilePath Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateNewFilePath', () => {
  it('should validate correct file paths', () => {
    expect(validateNewFilePath('src/components/Button.tsx')).toEqual({
      valid: true,
    });
    expect(validateNewFilePath('src/utils/helpers.ts')).toEqual({ valid: true });
    expect(validateNewFilePath('src/index.js')).toEqual({ valid: true });
  });

  it('should reject invalid characters', () => {
    const result = validateNewFilePath('src/com<ponent.tsx');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });

  it('should reject invalid extensions', () => {
    const result = validateNewFilePath('src/component.txt');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('extension');
  });

  it('should accept valid extensions', () => {
    expect(validateNewFilePath('src/file.ts').valid).toBe(true);
    expect(validateNewFilePath('src/file.tsx').valid).toBe(true);
    expect(validateNewFilePath('src/file.js').valid).toBe(true);
    expect(validateNewFilePath('src/file.jsx').valid).toBe(true);
    expect(validateNewFilePath('src/file.mjs').valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateUniqueFilePath Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateUniqueFilePath', () => {
  it('should return original path if not exists', () => {
    const existingFiles = new Set<string>();
    const result = generateUniqueFilePath('src/Button.tsx', existingFiles);

    expect(result).toBe('src/Button.tsx');
  });

  it('should add suffix if file exists', () => {
    const existingFiles = new Set(['src/Button.tsx']);
    const result = generateUniqueFilePath('src/Button.tsx', existingFiles);

    expect(result).toBe('src/Button.1.tsx');
  });

  it('should increment suffix if multiple exist', () => {
    const existingFiles = new Set([
      'src/Button.tsx',
      'src/Button.1.tsx',
      'src/Button.2.tsx',
    ]);
    const result = generateUniqueFilePath('src/Button.tsx', existingFiles);

    expect(result).toBe('src/Button.3.tsx');
  });
});
