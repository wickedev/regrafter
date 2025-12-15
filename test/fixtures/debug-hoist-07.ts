import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse: typeof traverseModule = (traverseModule as any).default || traverseModule;

const code = `
import React, { useState, useEffect, useMemo } from 'react';

function Component() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  const processed = useMemo(() => data.map(d => d * 2), [data]);

  return (
    <div>
      {loading ? <span>Loading...</span> : <span>{processed.length}</span>}
    </div>
  );
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
