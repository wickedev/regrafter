// Test to verify if elementScope change is causing the issue
import {regraft, Move} from './src/index.js';

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

const from = {file: 'App.tsx', line: 7, column: 11}; // Child's div
const to = {file: 'App.tsx', line: 2, column: 10}; // inside Parent div

const result = regraft(files, from, to, Move.Inside);
console.log('Result ok:', result.ok);
if (result.ok) {
  console.log(result.value.codes[0].content);
} else {
  console.log('Error:', result.error);
}
