import { regraft, Move, analyze } from './src/index.js';

const files = [{
  path: 'App.tsx',
  content: `function Parent() {
  return <div><Child /></div>;
}

function Child() {
  const message = 'Hello';
  return <div><span>{message}</span></div>;
}`
}];

const from = { file: 'App.tsx', line: 7, column: 11 }; // Child's div
const to = { file: 'App.tsx', line: 2, column: 10 }; // inside Parent div

// First check what analyze() returns
const analysis = analyze(files, from, to, Move.Inside);
console.log('=== ANALYZE OUTPUT ===');
console.log('Can move:', analysis.canMove);
console.log('Dependencies:', JSON.stringify(analysis.dependencies, null, 2));
console.log('\nNeeds hoisting:', JSON.stringify(analysis.hoistedDeps, null, 2));

// Now run regraft
const result = regraft(files, from, to, Move.Inside);

if (result.ok) {
  console.log('\n=== REGRAFT OUTPUT ===');
  console.log(result.value.codes[0].content);
  console.log('\n=== REGRAFT ANALYSIS ===');
  console.log('Dependencies:', result.value.analysis.dependencies.map(d => ({ symbol: d.symbol, type: d.type })));
  console.log('Hoisted deps:', result.value.analysis.hoistedDeps.map(d => ({ symbol: d.symbol, type: d.type })));
} else {
  console.error('Error:', result.error);
}
