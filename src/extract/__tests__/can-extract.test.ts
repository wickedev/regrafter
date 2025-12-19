/**
 * canExtract() 함수 테스트
 *
 * Task 21.1: canExtract() 함수 테스트 작성
 * Requirements:
 * - 10.7: 추출 가능 여부를 빠르게 확인
 */

import { describe, it, expect } from 'vitest';
import { canExtract } from '../extract.js';
import type { FileInput, Selector } from '../../types/public.js';

describe('canExtract', () => {
  describe('추출 가능 여부 확인', () => {
    it('유효한 JSX 노드를 선택하면 true를 반환해야 한다', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              const name = "World";
              return <div>Hello {name}</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 4,
        column: 21,
      };

      const result = canExtract(files, selector);

      expect(result).toBe(true);
    });

    it('유효하지 않은 selector를 제공하면 false를 반환해야 한다', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              return <div>Hello</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 999,
        column: 999,
      };

      const result = canExtract(files, selector);

      expect(result).toBe(false);
    });

    it('JSX가 아닌 노드를 선택하면 false를 반환해야 한다', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              const name = "World";
              return <div>Hello</div>;
            }
          `,
        },
      ];

      // 변수 선언을 가리키는 selector
      const selector: Selector = {
        file: 'App.tsx',
        line: 3,
        column: 14,
      };

      const result = canExtract(files, selector);

      expect(result).toBe(false);
    });

    it('빈 파일 목록이 제공되면 false를 반환해야 한다', () => {
      const files: FileInput[] = [];

      const selector: Selector = {
        file: 'App.tsx',
        line: 1,
        column: 1,
      };

      const result = canExtract(files, selector);

      expect(result).toBe(false);
    });
  });

  describe('dry-run 모드', () => {
    it('실제 변환을 수행하지 않고 검증만 수행해야 한다', () => {
      const originalContent = `
        function App() {
          const name = "World";
          return <div>Hello {name}</div>;
        }
      `;

      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: originalContent,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 4,
        column: 18,
      };

      // canExtract 호출
      canExtract(files, selector);

      // 파일 내용이 변경되지 않았는지 확인
      // (실제로는 파일 시스템을 변경하지 않지만, 이 테스트는 개념적 확인)
      expect(files[0].content).toBe(originalContent);
    });

    it('여러 번 호출해도 동일한 결과를 반환해야 한다 (멱등성)', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              return <div>Hello</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 3,
        column: 21,
      };

      const result1 = canExtract(files, selector);
      const result2 = canExtract(files, selector);
      const result3 = canExtract(files, selector);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
});
