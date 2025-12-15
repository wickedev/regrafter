/**
 * Property-Based Tests
 *
 * Tests for idempotency, parse validity, and invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  Move,
  isValidSelector,
  isValidMove,
  isValidOptions,
  mergeOptions,
  DEFAULT_OPTIONS,
} from '../../index.js';
import { validateRegraftInput } from '../../validation/index.js';
import { hashContent, generateId, resetIdCounter } from '../../types/factories.js';

// ============================================================================
// Helper Functions for Property Testing
// ============================================================================

/**
 * Generates random valid selectors for testing.
 */
function generateRandomPositionSelector(file: string) {
  return {
    file,
    line: Math.floor(Math.random() * 100) + 1,
    column: Math.floor(Math.random() * 80) + 1,
  };
}

/**
 * Generates random valid options.
 */
function generateRandomOptions() {
  return {
    optimize: Math.random() > 0.5,
    dryRun: Math.random() > 0.5,
    preserveComments: Math.random() > 0.5,
    formatOutput: Math.random() > 0.5,
  };
}

/**
 * Generates random file input.
 */
function generateRandomFileInput() {
  const paths = ['App.tsx', 'Header.tsx', 'Footer.tsx', 'Main.tsx', 'Sidebar.tsx'];
  const contents = [
    'const x = 1;',
    'function App() { return <div />; }',
    'export default () => <span>Test</span>;',
  ];

  return {
    path: paths[Math.floor(Math.random() * paths.length)]!,
    content: contents[Math.floor(Math.random() * contents.length)]!,
  };
}

// ============================================================================
// Property: Type Guard Consistency
// ============================================================================

describe('Property: Type Guard Consistency', () => {
  it('isValidSelector should be consistent across multiple calls', () => {
    const selectors = [
      { file: 'test.tsx', line: 1, column: 1 },
      { file: 'test.tsx', path: 'Program.body[0]' },
      { file: '', line: 1, column: 1 },
      null,
      undefined,
      {},
    ];

    for (const selector of selectors) {
      const result1 = isValidSelector(selector);
      const result2 = isValidSelector(selector);
      const result3 = isValidSelector(selector);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    }
  });

  it('isValidMove should be consistent for all Move values', () => {
    const moves = [Move.Inside, Move.Before, Move.After, 'inside', 'before', 'after'];

    for (const move of moves) {
      const results = Array(10)
        .fill(0)
        .map(() => isValidMove(move));

      expect(results.every(r => r === results[0])).toBe(true);
    }
  });

  it('isValidOptions should be consistent for random options', () => {
    for (let i = 0; i < 20; i++) {
      const options = generateRandomOptions();
      const result1 = isValidOptions(options);
      const result2 = isValidOptions(options);

      expect(result1).toBe(result2);
    }
  });
});

// ============================================================================
// Property: Option Merging Idempotency
// ============================================================================

describe('Property: Option Merging', () => {
  it('mergeOptions with defaults should be idempotent', () => {
    const result1 = mergeOptions({});
    const result2 = mergeOptions(result1);

    expect(result1).toEqual(result2);
  });

  it('mergeOptions should preserve user options', () => {
    for (let i = 0; i < 20; i++) {
      const userOptions = generateRandomOptions();
      const merged = mergeOptions(userOptions);

      // All user options should be preserved
      expect(merged.optimize).toBe(userOptions.optimize);
      expect(merged.dryRun).toBe(userOptions.dryRun);
      expect(merged.preserveComments).toBe(userOptions.preserveComments);
      expect(merged.formatOutput).toBe(userOptions.formatOutput);
    }
  });

  it('mergeOptions with undefined should return defaults', () => {
    const merged = mergeOptions(undefined);
    expect(merged).toEqual(DEFAULT_OPTIONS);
  });

  it('mergeOptions should be associative', () => {
    const a = { optimize: true };
    const b = { dryRun: true };

    // Merge order shouldn't matter for different keys
    const merged1 = mergeOptions({ ...a, ...b });
    const merged2 = mergeOptions({ ...b, ...a });

    expect(merged1).toEqual(merged2);
  });
});

// ============================================================================
// Property: Hash Function Properties
// ============================================================================

describe('Property: Hash Function', () => {
  it('hashContent should be deterministic', () => {
    const content = 'const x = 1; function foo() { return x; }';

    const hash1 = hashContent(content);
    const hash2 = hashContent(content);
    const hash3 = hashContent(content);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('hashContent should differ for different content', () => {
    const contents = [
      'const x = 1;',
      'const x = 2;',
      'const y = 1;',
      'let x = 1;',
      '',
    ];

    const hashes = contents.map(c => hashContent(c));
    const uniqueHashes = new Set(hashes);

    // All hashes should be unique (extremely unlikely to collide)
    expect(uniqueHashes.size).toBe(contents.length);
  });

  it('hashContent should handle unicode correctly', () => {
    const content1 = 'const emoji = "test"';
    const content2 = 'const emoji = "test"';

    const hash1 = hashContent(content1);
    const hash2 = hashContent(content2);

    expect(hash1).toBe(hash2);
  });

  it('hashContent should handle empty string', () => {
    const hash = hashContent('');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Property: ID Generation
// ============================================================================

describe('Property: ID Generation', () => {
  it('generateId should produce unique IDs', () => {
    resetIdCounter();
    const ids = Array(1000)
      .fill(0)
      .map(() => generateId());
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('generateId with prefix should include prefix', () => {
    const prefixes = ['scope', 'dep', 'node', 'plan', 'move'];

    for (const prefix of prefixes) {
      const id = generateId(prefix);
      expect(id.startsWith(prefix + '_')).toBe(true);
    }
  });

  it('generateId should be monotonically unique after reset', () => {
    resetIdCounter();
    const ids1 = Array(10)
      .fill(0)
      .map(() => generateId('test'));

    resetIdCounter();
    const ids2 = Array(10)
      .fill(0)
      .map(() => generateId('test'));

    // After reset, pattern should repeat but with different timestamp
    // Both sets should be internally unique
    expect(new Set(ids1).size).toBe(10);
    expect(new Set(ids2).size).toBe(10);
  });
});

// ============================================================================
// Property: Validation Invariants
// ============================================================================

describe('Property: Validation Invariants', () => {
  it('valid input should always pass validation', () => {
    for (let i = 0; i < 50; i++) {
      const file = generateRandomFileInput();
      const files = [file];
      const from = generateRandomPositionSelector(file.path);
      const to = generateRandomPositionSelector(file.path);
      const mode = [Move.Inside, Move.Before, Move.After][Math.floor(Math.random() * 3)]!;

      const result = validateRegraftInput(files, from, to, mode);
      expect(result.valid).toBe(true);
    }
  });

  it('empty files should always fail validation', () => {
    const from = generateRandomPositionSelector('test.tsx');
    const to = generateRandomPositionSelector('test.tsx');

    const result = validateRegraftInput([], from, to, Move.Inside);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some(e => e.includes('at least one file'))).toBe(true);
  });

  it('missing file reference should always fail', () => {
    for (let i = 0; i < 20; i++) {
      const files = [generateRandomFileInput()];
      const from = { file: 'nonexistent.tsx', line: 1, column: 1 };
      const to = generateRandomPositionSelector(files[0]!.path);

      const result = validateRegraftInput(files, from, to, Move.Inside);
      expect(result.valid).toBe(false);
    }
  });
});

// ============================================================================
// Property: Move Enum Completeness
// ============================================================================

describe('Property: Move Enum Completeness', () => {
  it('all Move values should be valid', () => {
    const allMoves = Object.values(Move);

    for (const move of allMoves) {
      expect(isValidMove(move)).toBe(true);
    }
  });

  it('Move should have exactly 3 values', () => {
    expect(Object.values(Move).length).toBe(3);
  });

  it('Move values should be lowercase strings', () => {
    const allMoves = Object.values(Move);

    for (const move of allMoves) {
      expect(typeof move).toBe('string');
      expect(move).toBe(move.toLowerCase());
    }
  });
});

// ============================================================================
// Property: Selector Validation
// ============================================================================

describe('Property: Selector Validation', () => {
  it('position selector with valid values should always be valid', () => {
    for (let i = 0; i < 100; i++) {
      const selector = {
        file: `file${i}.tsx`,
        line: Math.floor(Math.random() * 1000) + 1,
        column: Math.floor(Math.random() * 200) + 1,
      };

      expect(isValidSelector(selector)).toBe(true);
    }
  });

  it('position selector with line 0 should always be invalid', () => {
    for (let i = 0; i < 20; i++) {
      const selector = {
        file: `file${i}.tsx`,
        line: 0,
        column: Math.floor(Math.random() * 200) + 1,
      };

      expect(isValidSelector(selector)).toBe(false);
    }
  });

  it('path selector with non-empty path should be valid', () => {
    const paths = [
      'Program.body[0]',
      'Program.body[0].declaration',
      'Program.body[0].declaration.body.body[2]',
      'root',
    ];

    for (const path of paths) {
      const selector = { file: 'test.tsx', path };
      expect(isValidSelector(selector)).toBe(true);
    }
  });
});

// ============================================================================
// Property: Default Options
// ============================================================================

describe('Property: Default Options', () => {
  it('DEFAULT_OPTIONS should have all required fields', () => {
    expect(typeof DEFAULT_OPTIONS.optimize).toBe('boolean');
    expect(typeof DEFAULT_OPTIONS.dryRun).toBe('boolean');
    expect(typeof DEFAULT_OPTIONS.preserveComments).toBe('boolean');
    expect(typeof DEFAULT_OPTIONS.formatOutput).toBe('boolean');
  });

  it('DEFAULT_OPTIONS should be frozen or consistent', () => {
    const copy1 = { ...DEFAULT_OPTIONS };
    const copy2 = { ...DEFAULT_OPTIONS };

    expect(copy1).toEqual(copy2);
  });
});
