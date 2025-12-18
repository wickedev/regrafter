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

const from = { file: 'App.tsx', line: 7, column: 15 }; // span element
const to = { file: 'App.tsx', line: 2, column: 10 }; // inside Parent div

// First check what analyze() returns
const analysis = analyze(files, from, to, Move.Inside);
console.log('=== ANALYZE OUTPUT ===');
console.log('Can move:', analysis.canMove);
console.log('\n=== DEPENDENCIES ===');
analysis.dependencies.forEach(dep => {
  console.log('Symbol:', dep.symbol);
  console.log('Type:', dep.type);
  console.log('Scope:', JSON.stringify(dep.scope, null, 2));
  console.log('---');
});

console.log('\n=== NEEDS HOISTING ===');
console.log('Count:', analysis.hoistedDeps.length);
analysis.hoistedDeps.forEach(dep => {
  console.log('Symbol:', dep.symbol);
  console.log('Type:', dep.type);
  console.log('Scope:', JSON.stringify(dep.scope, null, 2));
  console.log('---');
});

// Now run regraft
const result = regraft(files, from, to, Move.Inside);

if (result.ok) {
  console.log('\n=== REGRAFT OUTPUT ===');
  console.log(result.value.codes[0].content);
} else {
  console.error('Error:', result.error);
}
