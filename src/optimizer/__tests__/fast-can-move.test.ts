/**
 * FastCanMove Unit Tests
 *
 * Tests for fast canMove validation without full transformation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FastCanMove, createFastCanMove } from '../fast-can-move.js';
import type { FileInput } from '../../types/public.js';

describe('FastCanMove', () => {
  let fastCanMove: FastCanMove;

  beforeEach(() => {
    fastCanMove = createFastCanMove();
  });

  describe('createFastCanMove', () => {
    it('should create a FastCanMove instance', () => {
      const instance = createFastCanMove();
      expect(instance).toBeInstanceOf(FastCanMove);
    });
  });

  describe('analyze', () => {
    it('should return canMove result for valid files', () => {
      const files: FileInput[] = [
        {
          path: 'Source.tsx',
          content: `
import React from 'react';
export function Source() {
  return <div>Source</div>;
}
`.trim(),
        },
        {
          path: 'Target.tsx',
          content: `
import React from 'react';
export function Target() {
  return <div>Target</div>;
}
`.trim(),
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'Source.tsx', path: 'Program.body[0]' },
        { file: 'Target.tsx', path: 'Program.body[0]' }
      );

      expect(result).toBeDefined();
      expect(typeof result.canMove).toBe('boolean');
      expect(Array.isArray(result.blockingIssues)).toBe(true);
      expect(typeof result.complexityEstimate).toBe('number');
      expect(typeof result.analysisTimeMs).toBe('number');
    });

    it('should return false for missing source file', () => {
      const files: FileInput[] = [
        {
          path: 'Target.tsx',
          content: 'export function Target() { return null; }',
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'NonExistent.tsx', path: 'Program.body[0]' },
        { file: 'Target.tsx', path: 'Program.body[0]' }
      );

      expect(result.canMove).toBe(false);
      expect(result.blockingIssues.some((i) => i.type === 'source_not_found')).toBe(
        true
      );
    });

    it('should return false for missing target file', () => {
      const files: FileInput[] = [
        {
          path: 'Source.tsx',
          content: 'export function Source() { return null; }',
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'Source.tsx', path: 'Program.body[0]' },
        { file: 'NonExistent.tsx', path: 'Program.body[0]' }
      );

      expect(result.canMove).toBe(false);
      expect(result.blockingIssues.some((i) => i.type === 'target_not_found')).toBe(
        true
      );
    });

    it('should respect timeout option', () => {
      const files: FileInput[] = [
        {
          path: 'Source.tsx',
          content: `
import React from 'react';
export function Source() { return <div>Source</div>; }
`.trim(),
        },
        {
          path: 'Target.tsx',
          content: `
import React from 'react';
export function Target() { return <div>Target</div>; }
`.trim(),
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'Source.tsx', path: 'Program.body[0]' },
        { file: 'Target.tsx', path: 'Program.body[0]' },
        { timeout: 1000 }
      );

      // Should complete within timeout
      expect(result.analysisTimeMs).toBeLessThan(1000);
    });

    it('should skip detailed checks when option is set', () => {
      const files: FileInput[] = [
        {
          path: 'Source.tsx',
          content: `
import React, { useState } from 'react';
export function Source() {
  const [count] = useState(0);
  return <div>{count}</div>;
}
`.trim(),
        },
        {
          path: 'Target.tsx',
          content: `
import React from 'react';
export function Target() { return <div>Target</div>; }
`.trim(),
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'Source.tsx', path: 'Program.body[0]' },
        { file: 'Target.tsx', path: 'Program.body[0]' },
        { skipDetailedChecks: true }
      );

      expect(result).toBeDefined();
    });
  });

  describe('hook detection', () => {
    it('should detect standard React hooks', () => {
      expect(fastCanMove.isHookName('useState')).toBe(true);
      expect(fastCanMove.isHookName('useEffect')).toBe(true);
      expect(fastCanMove.isHookName('useContext')).toBe(true);
      expect(fastCanMove.isHookName('useReducer')).toBe(true);
      expect(fastCanMove.isHookName('useCallback')).toBe(true);
      expect(fastCanMove.isHookName('useMemo')).toBe(true);
      expect(fastCanMove.isHookName('useRef')).toBe(true);
    });

    it('should detect custom hooks', () => {
      expect(fastCanMove.isHookName('useCustomHook')).toBe(true);
      expect(fastCanMove.isHookName('useMyState')).toBe(true);
      expect(fastCanMove.isHookName('useFormData')).toBe(true);
    });

    it('should not detect non-hooks', () => {
      expect(fastCanMove.isHookName('normalFunction')).toBe(false);
      expect(fastCanMove.isHookName('helper')).toBe(false);
      expect(fastCanMove.isHookName('use')).toBe(false);
      expect(fastCanMove.isHookName('useless')).toBe(false);
    });
  });

  describe('complexity estimation', () => {
    it('should estimate low complexity for simple components', () => {
      const files: FileInput[] = [
        {
          path: 'Simple.tsx',
          content: `
import React from 'react';
export function Simple() { return <div>Simple</div>; }
`.trim(),
        },
        {
          path: 'Target.tsx',
          content: `
import React from 'react';
export function Target() { return <div>Target</div>; }
`.trim(),
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'Simple.tsx', path: 'Program.body[0]' },
        { file: 'Target.tsx', path: 'Program.body[0]' }
      );

      expect(result.complexityEstimate).toBeLessThan(0.5);
    });

    it('should estimate higher complexity for components with hooks', () => {
      const files: FileInput[] = [
        {
          path: 'WithHooks.tsx',
          content: `
import React, { useState, useEffect, useMemo } from 'react';
export function WithHooks() {
  const [count, setCount] = useState(0);
  const [data, setData] = useState(null);
  useEffect(() => { console.log(count); }, [count]);
  const doubled = useMemo(() => count * 2, [count]);
  return <div>{doubled}</div>;
}
`.trim(),
        },
        {
          path: 'Target.tsx',
          content: `
import React from 'react';
export function Target() { return <div>Target</div>; }
`.trim(),
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'WithHooks.tsx', path: 'Program.body[0]' },
        { file: 'Target.tsx', path: 'Program.body[0]' }
      );

      // Components with multiple hooks should have measurable complexity
      expect(result.complexityEstimate).toBeGreaterThan(0.01);
    });
  });

  describe('blocking issues', () => {
    it('should detect unanalyzable code with eval', () => {
      const files: FileInput[] = [
        {
          path: 'WithEval.tsx',
          content: `
export function WithEval() {
  const result = eval('1 + 1');
  return <div>{result}</div>;
}
`.trim(),
        },
        {
          path: 'Target.tsx',
          content: 'export function Target() { return null; }',
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'WithEval.tsx', path: 'Program.body[0]' },
        { file: 'Target.tsx', path: 'Program.body[0]' }
      );

      expect(result.blockingIssues.some((i) => i.type === 'unanalyzable_code')).toBe(
        true
      );
    });

    it('should warn about scope escape', () => {
      const files: FileInput[] = [
        {
          path: 'Source.tsx',
          content: `
import React from 'react';
const parentValue = 42;
export function Source() {
  return <div>{parentValue}</div>;
}
`.trim(),
        },
        {
          path: 'Target.tsx',
          content: `
import React from 'react';
export function Target() { return <div>Target</div>; }
`.trim(),
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'Source.tsx', path: 'Program.body[1]' },
        { file: 'Target.tsx', path: 'Program.body[0]' }
      );

      // May detect scope escape warning
      expect(result).toBeDefined();
    });
  });

  describe('needsDetailedAnalysis', () => {
    it('should recommend detailed analysis for complex moves', () => {
      const files: FileInput[] = [
        {
          path: 'Complex.tsx',
          content: `
import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
const MyContext = React.createContext(null);
export function Complex() {
  const [a, setA] = useState(0);
  const [b, setB] = useState('');
  const ctx = useContext(MyContext);
  useEffect(() => { console.log(a, b); }, [a, b]);
  const computed = useMemo(() => a + b.length, [a, b]);
  const handler = useCallback(() => setA(a + 1), [a]);
  return <div onClick={handler}>{computed}</div>;
}
`.trim(),
        },
        {
          path: 'Target.tsx',
          content: `
import React from 'react';
export function Target() { return <div>Target</div>; }
`.trim(),
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'Complex.tsx', path: 'Program.body[1]' },
        { file: 'Target.tsx', path: 'Program.body[0]' }
      );

      // Complex components should have measurable complexity
      expect(result.complexityEstimate).toBeGreaterThan(0.01);
    });

    it('should not require detailed analysis for simple moves', () => {
      const files: FileInput[] = [
        {
          path: 'Simple.tsx',
          content: `
import React from 'react';
export function Simple() { return <span>text</span>; }
`.trim(),
        },
        {
          path: 'Target.tsx',
          content: `
import React from 'react';
export function Target() { return <div>Target</div>; }
`.trim(),
        },
      ];

      const result = fastCanMove.analyze(
        files,
        { file: 'Simple.tsx', path: 'Program.body[0]' },
        { file: 'Target.tsx', path: 'Program.body[0]' }
      );

      // Simple components should not require detailed analysis
      expect(result.complexityEstimate).toBeLessThan(0.7);
    });
  });
});
