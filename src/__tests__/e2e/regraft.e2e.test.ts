/**
 * End-to-End Tests for Regrafter
 *
 * Tests complete workflows from input to output.
 */

import { describe, it, expect } from 'vitest';
import {
  Move,
  validateRegraftInput,
  ErrorCategory,
  RegraffError,
  isValidSelector,
  isValidMove,
  isValidOptions,
} from '../../index.js';

describe('E2E: Input Validation', () => {
  describe('Full Input Validation Flow', () => {
    it('should validate complete valid input', () => {
      const files = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              return (
                <div>
                  <Header />
                  <Main />
                </div>
              );
            }
          `,
        },
      ];

      const from = { file: 'App.tsx', line: 5, column: 11 };
      const to = { file: 'App.tsx', line: 6, column: 11 };

      const result = validateRegraftInput(files, from, to, Move.Inside);
      expect(result.valid).toBe(true);
    });

    it('should catch missing file reference', () => {
      const files = [{ path: 'App.tsx', content: 'const x = 1;' }];
      const from = { file: 'Missing.tsx', line: 1, column: 1 };
      const to = { file: 'App.tsx', line: 2, column: 1 };

      const result = validateRegraftInput(files, from, to, Move.Inside);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('Missing.tsx'))).toBe(true);
    });

    it('should validate cross-file references', () => {
      const files = [
        { path: 'App.tsx', content: '<div />' },
        { path: 'Header.tsx', content: '<header />' },
      ];

      const from = { file: 'App.tsx', line: 1, column: 1 };
      const to = { file: 'Header.tsx', line: 1, column: 1 };

      const result = validateRegraftInput(files, from, to, Move.Inside);
      expect(result.valid).toBe(true);
    });
  });

  describe('Selector Type Guards', () => {
    it('should validate position selectors', () => {
      expect(isValidSelector({ file: 'a.tsx', line: 1, column: 1 })).toBe(true);
      expect(isValidSelector({ file: 'a.tsx', line: 0, column: 1 })).toBe(false); // Line 0 is invalid
      expect(isValidSelector({ file: '', line: 1, column: 1 })).toBe(false); // Empty file
    });

    it('should validate path selectors', () => {
      expect(isValidSelector({ file: 'a.tsx', path: 'Program.body[0]' })).toBe(true);
      expect(isValidSelector({ file: 'a.tsx', path: '' })).toBe(false); // Empty path
    });

    it('should reject invalid selectors', () => {
      expect(isValidSelector(null)).toBe(false);
      expect(isValidSelector(undefined)).toBe(false);
      expect(isValidSelector({})).toBe(false);
      expect(isValidSelector({ file: 'a.tsx' })).toBe(false); // Neither position nor path
    });
  });

  describe('Move Mode Type Guards', () => {
    it('should validate all move modes', () => {
      expect(isValidMove(Move.Inside)).toBe(true);
      expect(isValidMove(Move.Before)).toBe(true);
      expect(isValidMove(Move.After)).toBe(true);
      expect(isValidMove('inside')).toBe(true);
      expect(isValidMove('before')).toBe(true);
      expect(isValidMove('after')).toBe(true);
    });

    it('should reject invalid move modes', () => {
      expect(isValidMove('into')).toBe(false);
      expect(isValidMove('above')).toBe(false);
      expect(isValidMove('')).toBe(false);
      expect(isValidMove(null)).toBe(false);
    });
  });

  describe('Options Type Guards', () => {
    it('should validate complete options', () => {
      expect(
        isValidOptions({
          optimize: true,
          dryRun: false,
          preserveComments: true,
          formatOutput: false,
        })
      ).toBe(true);
    });

    it('should validate partial options', () => {
      expect(isValidOptions({ optimize: true })).toBe(true);
      expect(isValidOptions({ dryRun: true })).toBe(true);
      expect(isValidOptions({})).toBe(true);
    });

    it('should validate undefined/null options', () => {
      expect(isValidOptions(undefined)).toBe(true);
      expect(isValidOptions(null)).toBe(true);
    });

    it('should reject invalid option types', () => {
      expect(isValidOptions({ optimize: 'yes' })).toBe(false);
      expect(isValidOptions({ dryRun: 1 })).toBe(false);
    });
  });
});

describe('E2E: Error Handling Flow', () => {
  it('should create and handle parse errors', () => {
    const error = new RegraffError({
      category: ErrorCategory.Parse,
      code: 'E001',
      message: 'Failed to parse test.tsx',
      file: 'test.tsx',
      location: { start: { line: 5, column: 10 }, end: { line: 5, column: 20 } },
    });

    expect(error.category).toBe(ErrorCategory.Parse);
    expect(error.toFormattedString()).toContain('[E001]');
    expect(error.toFormattedString()).toContain('test.tsx:5:10');
  });

  it('should create errors with suggestions', () => {
    const error = new RegraffError({
      category: ErrorCategory.Validation,
      code: 'E030',
      message: 'Cannot hoist hook to conditional',
      suggestions: [
        { description: 'Move hook outside conditional', action: 'move_hook', automatic: true },
        { description: 'Extract to custom hook', action: 'extract_hook', automatic: false },
      ],
    });

    expect(error.suggestions).toHaveLength(2);
    expect(error.suggestions[0]?.automatic).toBe(true);
    expect(error.toFormattedString()).toContain('Suggested fixes');
    expect(error.toFormattedString()).toContain('[auto]');
  });

  it('should serialize errors to JSON', () => {
    const error = new RegraffError({
      category: ErrorCategory.Selector,
      code: 'E010',
      message: 'Element not found',
      file: 'App.tsx',
      recoverable: false,
    });

    const json = error.toJSON();
    expect(json.category).toBe('SELECTOR');
    expect(json.code).toBe('E010');
    expect(json.recoverable).toBe(false);
  });
});

describe('E2E: Type Coercion', () => {
  it('should handle string file paths consistently', () => {
    const files = [
      { path: 'src/components/App.tsx', content: 'code' },
      { path: './src/components/Header.tsx', content: 'code' },
    ];

    const from = { file: 'src/components/App.tsx', line: 1, column: 1 };
    const to = { file: 'src/components/App.tsx', line: 2, column: 1 };

    const result = validateRegraftInput(files, from, to, Move.Inside);
    expect(result.valid).toBe(true);
  });

  it('should handle various line/column formats', () => {
    const files = [{ path: 'test.tsx', content: 'code' }];

    // Integer values
    expect(
      validateRegraftInput(
        files,
        { file: 'test.tsx', line: 1, column: 1 },
        { file: 'test.tsx', line: 2, column: 1 },
        Move.Inside
      ).valid
    ).toBe(true);

    // Float values should fail
    expect(
      validateRegraftInput(
        files,
        { file: 'test.tsx', line: 1.5, column: 1 },
        { file: 'test.tsx', line: 2, column: 1 },
        Move.Inside
      ).valid
    ).toBe(false);
  });
});

describe('E2E: Complex Scenarios', () => {
  describe('Multi-file operations', () => {
    const multiFileSetup = [
      {
        path: 'src/App.tsx',
        content: `
          import Header from './Header';
          import Footer from './Footer';

          function App() {
            return (
              <div>
                <Header />
                <main>Content</main>
                <Footer />
              </div>
            );
          }
        `,
      },
      {
        path: 'src/Header.tsx',
        content: `
          function Header() {
            return <header><h1>Title</h1></header>;
          }
          export default Header;
        `,
      },
      {
        path: 'src/Footer.tsx',
        content: `
          function Footer() {
            return <footer>Footer content</footer>;
          }
          export default Footer;
        `,
      },
    ];

    it('should validate multi-file input', () => {
      const from = { file: 'src/App.tsx', line: 8, column: 17 };
      const to = { file: 'src/Header.tsx', line: 3, column: 20 };

      const result = validateRegraftInput(
        multiFileSetup,
        from,
        to,
        Move.Inside
      );

      expect(result.valid).toBe(true);
    });

    it('should detect missing file in multi-file setup', () => {
      const from = { file: 'src/App.tsx', line: 8, column: 17 };
      const to = { file: 'src/Sidebar.tsx', line: 3, column: 20 }; // Missing file

      const result = validateRegraftInput(
        multiFileSetup,
        from,
        to,
        Move.Inside
      );

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('Sidebar.tsx'))).toBe(true);
    });
  });

  describe('Options combinations', () => {
    it('should accept all valid option combinations', () => {
      const files = [{ path: 'test.tsx', content: 'code' }];
      const from = { file: 'test.tsx', line: 1, column: 1 };
      const to = { file: 'test.tsx', line: 2, column: 1 };

      // All options enabled
      expect(
        validateRegraftInput(files, from, to, Move.Inside, {
          optimize: true,
          dryRun: true,
          preserveComments: true,
          formatOutput: true,
        }).valid
      ).toBe(true);

      // All options disabled
      expect(
        validateRegraftInput(files, from, to, Move.Inside, {
          optimize: false,
          dryRun: false,
          preserveComments: false,
          formatOutput: false,
        }).valid
      ).toBe(true);

      // Mixed options
      expect(
        validateRegraftInput(files, from, to, Move.Inside, {
          optimize: true,
          dryRun: true,
        }).valid
      ).toBe(true);
    });
  });
});
