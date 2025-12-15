import { regraft, Move } from '../../src/index.js';

const simpleJSXCode = `
function App() {
  return (
    <div>
      <header>Header</header>
      <main>Main</main>
      <footer>Footer</footer>
    </div>
  );
}
`;

const files = [{ path: 'test.tsx', content: simpleJSXCode }];
const from = { file: 'test.tsx', line: 7, column: 6 };
const to = { file: 'test.tsx', line: 5, column: 6 };

console.log('Testing regraft with:');
console.log('From:', from);
console.log('To:', to);
console.log('Mode: Before');

const result = regraft(files, from, to, Move.Before);

console.log('\nResult:');
console.log('Success:', result.success);
console.log('Analysis:', JSON.stringify(result.analysis, null, 2));
if (!result.success) {
  console.log('Reason:', result.analysis.reason);
}
