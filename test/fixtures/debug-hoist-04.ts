import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse: typeof traverseModule = (traverseModule as any).default || traverseModule;

const code = `
import React, { useEffect, useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <span>{count}</span>;
}
`;

console.log('Code lines:');
code.split('\n').forEach((line, i) => {
  console.log(`${i}: ${line}`);
});

const ast = parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript'],
});

console.log('\nJSX elements:');
traverse(ast, {
  JSXElement(path) {
    const loc = path.node.loc;
    if (loc) {
      const opening = path.node.openingElement;
      const name = opening.name.type === 'JSXIdentifier' ? opening.name.name : 'unknown';
      console.log(`<${name}> at line ${loc.start.line}:${loc.start.column+1}`);
    }
  },
});
