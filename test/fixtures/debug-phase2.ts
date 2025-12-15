import { analyze, Move } from '../../src/index.js';

const code = `
function App() {
  const message = 'Hello';
  return (
    <div>
      <span>{message}</span>
      <section>Target</section>
    </div>
  );
}
`;

console.log('Code with line numbers:');
code.split('\n').forEach((line, i) => {
  console.log(`${i}: ${line}`);
});

const files = [{ path: 'App.tsx', content: code }];

const from = { file: 'App.tsx', line: 5, column: 7 };
const to = { file: 'App.tsx', line: 6, column: 7 };

console.log('\nAnalyzing move from line 5 col 7 to line 6 col 7');
console.log('From:', from);
console.log('To:', to);

const analysis = analyze(files, from, to, Move.Inside);

console.log('\nAnalysis result:');
console.log('canMove:', analysis.canMove);
console.log('reason:', analysis.reason);
