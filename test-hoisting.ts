/**
 * Quick test to verify hoisting analysis
 */

import { analyze, Move } from './src/index.js';
import type { PositionSelector } from './src/index.js';

const source = `
import React, { useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Title</h1>
      <div>
        <p>Count: {count}</p>
      </div>
    </div>
  );
}
`;

// Move <p> element to top level (should need to hoist useState)
const files = [{ path: 'test.tsx', content: source }];
const from: PositionSelector = { file: 'test.tsx', line: 11, column: 8 }; // <p>
const to: PositionSelector = { file: 'test.tsx', line: 9, column: 6 }; // before <div>

try {
  const result = analyze(files, from, to, Move.Before);

  console.log('Analysis result:');
  console.log('canMove:', result.canMove);
  console.log('dependencies:', result.dependencies.length);
  console.log('hoistedDeps:', result.hoistedDeps.length);
  console.log('\nFull analysis:');
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error('Error:', e);
}
