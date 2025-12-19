/**
 * ExtractDependencyAnalyzer Tests
 *
 * Task 4.1: 변수 의존성 테스트
 * Task 4.3: 함수 의존성 테스트
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import { ScopeManager } from '../../scope/scope-manager.js';
import { ExtractDependencyAnalyzer } from '../extract-dependency-analyzer.js';
import { createSelectorResolver } from '../../selector/selector-resolver.js';

function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

describe('ExtractDependencyAnalyzer', () => {
  describe('Task 4.1: 변수 의존성 분석', () => {
    it('외부 변수 참조를 식별해야 한다', () => {
      const code = `
const Component = () => {
  const externalVar = 'hello';
  return (
    <div>{externalVar}</div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.variables).toHaveLength(1);
      expect(dependencies.variables[0].name).toBe('externalVar');
    });

    it('로컬 변수는 의존성에서 제외해야 한다', () => {
      const code = `
const Component = () => {
  const externalVar = 'hello';
  return (
    <div>
      {(() => {
        const localVar = 'local';
        return localVar;
      })()}
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      // localVar는 포함되지 않아야 함
      const variableNames = dependencies.variables.map(v => v.name);
      expect(variableNames).not.toContain('localVar');
    });

    it('여러 변수 의존성을 식별해야 한다', () => {
      const code = `
const Component = () => {
  const name = 'John';
  const age = 30;
  const city = 'Seoul';
  return (
    <div>
      <p>{name}</p>
      <p>{age}</p>
      <p>{city}</p>
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.variables).toHaveLength(3);

      const variableNames = dependencies.variables.map(v => v.name).sort();
      expect(variableNames).toEqual(['age', 'city', 'name']);
    });
  });

  describe('Task 4.3: 함수 의존성 분석', () => {
    it('외부 함수 호출을 식별해야 한다', () => {
      const code = `
const Component = () => {
  const handleClick = () => console.log('clicked');
  return (
    <button onClick={handleClick}>Click me</button>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // button 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('button 노드를 찾을 수 없습니다');
      const buttonPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([buttonPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.functions).toHaveLength(1);
      expect(dependencies.functions[0].name).toBe('handleClick');
    });

    it('여러 함수 의존성을 식별해야 한다', () => {
      const code = `
const Component = () => {
  const handleClick = () => console.log('clicked');
  const handleHover = () => console.log('hovered');
  const formatText = (text: string) => text.toUpperCase();
  return (
    <div>
      <button onClick={handleClick} onMouseOver={handleHover}>
        {formatText('hello')}
      </button>
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.functions).toHaveLength(3);

      const functionNames = dependencies.functions.map(f => f.name).sort();
      expect(functionNames).toEqual(['formatText', 'handleClick', 'handleHover']);
    });
  });

  describe('Task 15.1: useState 의존성 분석', () => {
    it('useState 호출을 식별해야 한다', () => {
      const code = `
const Component = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.states).toHaveLength(1);
      expect(dependencies.states[0].stateName).toBe('count');
      expect(dependencies.states[0].setterName).toBe('setCount');
    });

    it('상태 변수와 setter를 모두 식별해야 한다', () => {
      const code = `
const Component = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      {isOpen && <p>Open!</p>}
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.states).toHaveLength(1);

      const state = dependencies.states[0];
      expect(state.stateName).toBe('isOpen');
      expect(state.setterName).toBe('setIsOpen');

      // 상태 변수와 setter 모두 참조되어야 함
      expect(state.stateName).toBeDefined();
      expect(state.setterName).toBeDefined();
    });

    it('여러 useState 호출을 식별해야 한다', () => {
      const code = `
const Component = () => {
  const [name, setName] = useState('');
  const [age, setAge] = useState(0);
  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={age} onChange={(e) => setAge(Number(e.target.value))} />
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 6, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.states).toHaveLength(2);

      const stateNames = dependencies.states.map(s => s.stateName).sort();
      expect(stateNames).toEqual(['age', 'name']);

      const setterNames = dependencies.states.map(s => s.setterName).sort();
      expect(setterNames).toEqual(['setAge', 'setName']);
    });
  });

  describe('Task 17.1: Import 의존성 분석', () => {
    it('외부 라이브러리 import를 식별해야 한다', () => {
      const code = `
import { Button } from 'antd';
import moment from 'moment';

const Component = () => {
  return (
    <div>
      <Button>Click me</Button>
      <p>{moment().format('YYYY-MM-DD')}</p>
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.imports).toHaveLength(2);

      const importNames = dependencies.imports.map(i => i.name).sort();
      expect(importNames).toEqual(['Button', 'moment']);

      // moment는 default import
      const momentImport = dependencies.imports.find(i => i.name === 'moment');
      expect(momentImport?.isDefault).toBe(true);
      expect(momentImport?.source).toBe('moment');

      // Button은 named import
      const buttonImport = dependencies.imports.find(i => i.name === 'Button');
      expect(buttonImport?.isDefault).toBe(false);
      expect(buttonImport?.source).toBe('antd');
    });

    it('로컬 모듈 import를 식별해야 한다', () => {
      const code = `
import { CustomButton } from './components/CustomButton';
import UserProfile from '../UserProfile';

const Component = () => {
  return (
    <div>
      <CustomButton>Click me</CustomButton>
      <UserProfile />
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.imports).toHaveLength(2);

      const importNames = dependencies.imports.map(i => i.name).sort();
      expect(importNames).toEqual(['CustomButton', 'UserProfile']);

      // CustomButton은 named import
      const customButtonImport = dependencies.imports.find(i => i.name === 'CustomButton');
      expect(customButtonImport?.isDefault).toBe(false);
      expect(customButtonImport?.source).toBe('./components/CustomButton');

      // UserProfile은 default import
      const userProfileImport = dependencies.imports.find(i => i.name === 'UserProfile');
      expect(userProfileImport?.isDefault).toBe(true);
      expect(userProfileImport?.source).toBe('../UserProfile');
    });

    it('import된 변수를 변수 의존성이 아닌 import 의존성으로 분류해야 한다', () => {
      const code = `
import { formatDate } from './utils';

const Component = () => {
  const localVar = 'test';
  return (
    <div>
      <p>{formatDate(new Date())}</p>
      <p>{localVar}</p>
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // div 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('div 노드를 찾을 수 없습니다');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;

      // formatDate는 import 의존성으로 분류
      expect(dependencies.imports).toHaveLength(1);
      expect(dependencies.imports[0].name).toBe('formatDate');

      // localVar는 변수 의존성으로 분류
      expect(dependencies.variables).toHaveLength(1);
      expect(dependencies.variables[0].name).toBe('localVar');

      // formatDate는 functions에 포함되지 않아야 함
      const functionNames = dependencies.functions.map(f => f.name);
      expect(functionNames).not.toContain('formatDate');
    });

    it('JSX 컴포넌트와 일반 함수 import를 모두 식별해야 한다', () => {
      const code = `
import React from 'react';
import { Card, Avatar } from 'antd';
import { formatName, calculateAge } from './utils';

const Component = () => {
  const name = 'John Doe';
  const birthDate = new Date('1990-01-01');
  return (
    <Card>
      <Avatar />
      <div>
        <p>{formatName(name)}</p>
        <p>{calculateAge(birthDate)}</p>
      </div>
    </Card>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // Card 엘리먼트를 선택
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 10, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Card 노드를 찾을 수 없습니다');
      const cardPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([cardPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;

      // Card, Avatar, formatName, calculateAge import 의존성
      expect(dependencies.imports.length).toBeGreaterThanOrEqual(4);

      const importNames = dependencies.imports.map(i => i.name).sort();
      expect(importNames).toContain('Card');
      expect(importNames).toContain('Avatar');
      expect(importNames).toContain('formatName');
      expect(importNames).toContain('calculateAge');

      // name과 birthDate는 변수 의존성
      const variableNames = dependencies.variables.map(v => v.name).sort();
      expect(variableNames).toEqual(['birthDate', 'name']);
    });
  });

  describe('Task 19.1: 순환 의존성 감지', () => {
    it('함수가 추출 영역 내 변수를 참조하는 경우 순환 의존성을 감지해야 한다', () => {
      const code = `
const Component = () => {
  const handleClick = () => {
    console.log(localValue);
  };

  return (
    <div>
      <button onClick={handleClick}>
        {(() => {
          const localValue = 'test';
          return localValue;
        })()}
      </button>
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // button 엘리먼트를 선택 (추출할 영역)
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 9, column: 7 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('button 노드를 찾을 수 없습니다');
      const buttonPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([buttonPath], scopeTreeResult.value.root);

      // 순환 의존성 에러를 반환해야 함
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('순환 의존성이 감지되어야 합니다');

      expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
      expect(result.error.message).toContain('순환 의존성');
    });

    it('적절한 에러 메시지를 반환해야 한다', () => {
      const code = `
const Component = () => {
  const handleClick = () => {
    console.log(localValue);
  };

  return (
    <div>
      <button onClick={handleClick}>
        {(() => {
          const localValue = 'test';
          return localValue;
        })()}
      </button>
    </div>
  );
};
      `;

      const ast = parseCode(code);

      const scopeManager = new ScopeManager();
      const scopeTreeResult = scopeManager.buildScopeTree(ast);
      if (!scopeTreeResult.ok) throw scopeTreeResult.error;

      // button 엘리먼트를 선택 (추출할 영역)
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 9, column: 7 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('button 노드를 찾을 수 없습니다');
      const buttonPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([buttonPath], scopeTreeResult.value.root);

      // 순환 의존성 에러를 반환해야 함
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('순환 의존성이 감지되어야 합니다');

      expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
      // 에러 메시지가 정의되어 있어야 함
      expect(result.error.message).toContain('순환 의존성');
      expect(result.error.message).toBeDefined();
      expect(result.error.message.length).toBeGreaterThan(0);
    });
  });
});
