/**
 * ExtractDependencyAnalyzer Tests
 *
 * Task 4.1: Variable dependency tests
 * Task 4.3: Function dependency tests
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
  describe('Task 4.1: Variable dependency analysis', () => {
    it('should identify external variable references', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.variables).toHaveLength(1);
      expect(dependencies.variables[0].name).toBe('externalVar');
    });

    it('should exclude local variables from dependencies', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      // localVar should not be included
      const variableNames = dependencies.variables.map(v => v.name);
      expect(variableNames).not.toContain('localVar');
    });

    it('should identify multiple variable dependencies', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
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

  describe('Task 4.3: Function dependency analysis', () => {
    it('should identify external function calls', () => {
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

      // Select button element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find button node');
      const buttonPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([buttonPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.functions).toHaveLength(1);
      expect(dependencies.functions[0].name).toBe('handleClick');
    });

    it('should identify multiple function dependencies', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
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

  describe('Task 15.1: useState dependency analysis', () => {
    it('should identify useState calls', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
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

    it('should identify both state variable and setter', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 5, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
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

      // Both state variable and setter should be referenced
      expect(state.stateName).toBeDefined();
      expect(state.setterName).toBeDefined();
    });

    it('should identify multiple useState calls', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 6, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
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

  describe('Task 17.1: Import dependency analysis', () => {
    it('should identify external library imports', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.imports).toHaveLength(2);

      const importNames = dependencies.imports.map(i => i.name).sort();
      expect(importNames).toEqual(['Button', 'moment']);

      // moment is default import
      const momentImport = dependencies.imports.find(i => i.name === 'moment');
      expect(momentImport?.isDefault).toBe(true);
      expect(momentImport?.source).toBe('moment');

      // Button is named import
      const buttonImport = dependencies.imports.find(i => i.name === 'Button');
      expect(buttonImport?.isDefault).toBe(false);
      expect(buttonImport?.source).toBe('antd');
    });

    it('should identify local module imports', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;
      expect(dependencies.imports).toHaveLength(2);

      const importNames = dependencies.imports.map(i => i.name).sort();
      expect(importNames).toEqual(['CustomButton', 'UserProfile']);

      // CustomButton is named import
      const customButtonImport = dependencies.imports.find(i => i.name === 'CustomButton');
      expect(customButtonImport?.isDefault).toBe(false);
      expect(customButtonImport?.source).toBe('./components/CustomButton');

      // UserProfile is default import
      const userProfileImport = dependencies.imports.find(i => i.name === 'UserProfile');
      expect(userProfileImport?.isDefault).toBe(true);
      expect(userProfileImport?.source).toBe('../UserProfile');
    });

    it('should classify imported variables as import dependencies, not variable dependencies', () => {
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

      // Select div element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 7, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find div node');
      const divPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([divPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;

      // formatDate should be classified as import dependency
      expect(dependencies.imports).toHaveLength(1);
      expect(dependencies.imports[0].name).toBe('formatDate');

      // localVar should be classified as variable dependency
      expect(dependencies.variables).toHaveLength(1);
      expect(dependencies.variables[0].name).toBe('localVar');

      // formatDate should not be included in functions
      const functionNames = dependencies.functions.map(f => f.name);
      expect(functionNames).not.toContain('formatDate');
    });

    it('should identify both JSX component and regular function imports', () => {
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

      // Select Card element
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 10, column: 5 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find Card node');
      const cardPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([cardPath], scopeTreeResult.value.root);

      expect(result.ok).toBe(true);
      if (!result.ok) throw result.error;

      const dependencies = result.value;

      // Card, Avatar, formatName, calculateAge import dependencies
      expect(dependencies.imports.length).toBeGreaterThanOrEqual(4);

      const importNames = dependencies.imports.map(i => i.name).sort();
      expect(importNames).toContain('Card');
      expect(importNames).toContain('Avatar');
      expect(importNames).toContain('formatName');
      expect(importNames).toContain('calculateAge');

      // name and birthDate are variable dependencies
      const variableNames = dependencies.variables.map(v => v.name).sort();
      expect(variableNames).toEqual(['birthDate', 'name']);
    });
  });

  describe('Task 19.1: Circular dependency detection', () => {
    it('should detect circular dependency when function references a variable within the extraction region', () => {
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

      // Select button element (area to extract)
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 9, column: 7 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find button node');
      const buttonPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([buttonPath], scopeTreeResult.value.root);

      // Should return circular dependency error
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Circular dependency should be detected');

      expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
      expect(result.error.message).toContain('Circular dependency');
    });

    it('should return an appropriate error message', () => {
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

      // Select button element (area to extract)
      const resolver = createSelectorResolver();
      const resolveResult = resolver.resolve({ file: 'test.tsx', line: 9, column: 7 }, ast);
      if (resolveResult.error) throw resolveResult.error;
      if (!resolveResult.path) throw new Error('Cannot find button node');
      const buttonPath = resolveResult.path;

      const analyzer = new ExtractDependencyAnalyzer(scopeManager);
      const result = analyzer.analyze([buttonPath], scopeTreeResult.value.root);

      // Should return circular dependency error
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Circular dependency should be detected');

      expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
      // Error message should be defined
      expect(result.error.message).toContain('Circular dependency');
      expect(result.error.message).toBeDefined();
      expect(result.error.message.length).toBeGreaterThan(0);
    });
  });
});
