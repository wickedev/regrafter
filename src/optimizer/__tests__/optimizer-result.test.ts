/**
 * Result-based error handling tests for Optimizer
 *
 * Task 15: Tests for migrating optimizer to Result-based error handling
 */

import { describe, it, expect } from 'vitest';
import { Optimizer } from '../optimizer.js';
import { isOk } from '../../result/index.js';

describe('Optimizer - Result-based Error Handling', () => {

  describe('optimize() with Result return type', () => {
    it('should return Ok with optimized code for valid file', () => {
      const code = `
        const Component = () => {
          const value = 1;
          return <div>{value}</div>;
        };
      `;
      const optimizer = new Optimizer();

      const result = optimizer.optimize([{ path: 'test.tsx', content: code }]);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.value)).toBe(true);
        expect(result.value.length).toBe(1);
      }
    });

    it('should return Ok for multiple files', () => {
      const optimizer = new Optimizer();
      const result = optimizer.optimize([
        { path: 'a.tsx', content: 'const A = () => <div>A</div>;' },
        { path: 'b.tsx', content: 'const B = () => <span>B</span>;' },
      ]);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });

    it('should return Ok with empty array for empty input', () => {
      const optimizer = new Optimizer();
      const result = optimizer.optimize([]);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(0);
      }
    });

  });

  describe('optimizeWithDetails() with Result return type', () => {
    it('should return Ok with optimization details for valid file', () => {
      const code = `
        const Component = ({ unused, used }) => {
          const value = 1;
          return <div>{used}</div>;
        };
      `;
      const optimizer = new Optimizer();

      const result = optimizer.optimizeWithDetails([{ path: 'test.tsx', content: code }]);

      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.asts).toBeDefined();
        expect(result.value.sunkDependencies).toBeDefined();
        expect(result.value.removedProps).toBeDefined();
        expect(result.value.deadCodeRemoved).toBeDefined();
      }
    });
  });
});
