/**
 * analyzeExtract() 함수 테스트
 *
 * Task 21.3: analyzeExtract() 함수 테스트 작성
 * Requirements:
 * - 2.5: 의존성 분석만 수행하고 변환 생략
 */

import { describe, it, expect } from 'vitest';
import { analyzeExtract } from '../extract.js';
import type { FileInput, Selector } from '../../types/public.js';

describe('analyzeExtract', () => {
  describe('의존성 분석', () => {
    it('변수 의존성을 분석하여 반환해야 한다', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.variables).toContain('name');
        expect(result.value.selectedNodesCount).toBeGreaterThan(0);
      }
    });

    it('함수 의존성을 분석하여 반환해야 한다', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              const handleClick = () => console.log('clicked');
              return <button onClick={handleClick}>Click</button>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 4,
        column: 21,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.functions).toContain('handleClick');
      }
    });

    it('상태 의존성을 분석하여 반환해야 한다', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            import { useState } from 'react';

            function App() {
              const [count, setCount] = useState(0);
              return <div>{count}</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 6,
        column: 21,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.states).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              stateName: 'count',
              setterName: 'setCount',
            }),
          ])
        );
      }
    });

    it('여러 타입의 의존성을 동시에 분석해야 한다', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            import { useState } from 'react';

            function App() {
              const [count, setCount] = useState(0);
              const name = "World";
              const handleClick = () => setCount(count + 1);

              return (
                <div>
                  <p>Hello {name}</p>
                  <p>Count: {count}</p>
                  <button onClick={handleClick}>Increment</button>
                </div>
              );
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 10,
        column: 17,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const { dependencies } = result.value;

        // 변수 의존성 확인
        expect(dependencies.variables).toContain('name');

        // 상태 의존성 확인
        expect(dependencies.states).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              stateName: 'count',
              setterName: 'setCount',
            }),
          ])
        );

        // 함수 의존성 확인
        expect(dependencies.functions).toContain('handleClick');
      }
    });
  });

  describe('컴포넌트 정보 분석', () => {
    it('생성될 컴포넌트 이름을 포함해야 한다', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.componentName).toBeTruthy();
        expect(result.value.componentName).toMatch(/^[A-Z]/); // PascalCase
      }
    });

    it('같은 파일 내 추출 여부를 포함해야 한다', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isSameFile).toBe(true);
        expect(result.value.targetFile).toBe('App.tsx');
      }
    });

    it('Props 타입 정보를 포함해야 한다', () => {
      const files: FileInput[] = [
        {
          path: 'App.tsx',
          content: `
            function App() {
              const message = "Hello";
              return <div>{message}</div>;
            }
          `,
        },
      ];

      const selector: Selector = {
        file: 'App.tsx',
        line: 4,
        column: 21,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.propTypes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'message',
              optional: false,
            }),
          ])
        );
      }
    });
  });

  describe('에러 처리', () => {
    it('유효하지 않은 selector에 대해 에러를 반환해야 한다', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(false);
    });

    it('빈 파일 목록에 대해 에러를 반환해야 한다', () => {
      const files: FileInput[] = [];

      const selector: Selector = {
        file: 'App.tsx',
        line: 1,
        column: 1,
      };

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(false);
    });

    it('JSX가 아닌 노드에 대해 에러를 반환해야 한다', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(false);
    });
  });

  describe('변환 없이 분석만 수행', () => {
    it('실제 변환을 수행하지 않아야 한다', () => {
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

      const result = analyzeExtract(files, selector);

      expect(result.ok).toBe(true);

      // 파일 내용이 변경되지 않았는지 확인
      expect(files[0].content).toBe(originalContent);
    });

    it('여러 번 호출해도 동일한 결과를 반환해야 한다 (멱등성)', () => {
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

      const result1 = analyzeExtract(files, selector);
      const result2 = analyzeExtract(files, selector);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      if (result1.ok && result2.ok) {
        expect(result1.value).toEqual(result2.value);
      }
    });
  });
});
