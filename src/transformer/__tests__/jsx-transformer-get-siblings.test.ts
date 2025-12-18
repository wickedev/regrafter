/**
 * Tests for getSiblings edge cases
 */

import { describe, it, expect } from 'vitest';
import { regraft, canMove, Move } from '../../index.js';
import type { FileInput } from '../../types/index.js';

describe('JSXTransformer getSiblings', () => {
  it('should handle JSX children with keys correctly', () => {
    const code = `function A() {
  return (
    <div>
        <span key={0}>Child {0}</span>
        <span key={1}>Child {1}</span>
    </div>
  );
}`;

    const files: FileInput[] = [{
      path: 'Component.tsx',
      content: code,
    }];

    const from = { file: 'Component.tsx', line: 4, column: 8 };
    const to = { file: 'Component.tsx', line: 5, column: 8 };
    const mode = Move.Before;

    // canMove should return the same result as regraft success
    const canMoveResult = canMove(files, from, to, mode);
    const regraftResult = regraft(files, from, to, mode);

    // If canMove is true, regraft must succeed (invariant)
    if (canMoveResult) {
      expect(regraftResult.ok).toBe(true);
    }
  });
});
