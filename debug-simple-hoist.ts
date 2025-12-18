import { regraft, Move } from './src/index.js';

// Simpler test case with just one hook and one variable
const files = [
  {
    path: "App.tsx",
    content: `function Parent() {
  return <div><Form /></div>;
}

function Form() {
  const [name, setName] = useState('');
  return <input value={name} />;
}`,
  },
];

const from = { file: "App.tsx", line: 7, column: 10 }; // input element
const to = { file: "App.tsx", line: 2, column: 10 }; // inside Parent div

const result = regraft(files, from, to, Move.Inside);

console.log('Result ok:', result.ok);
if (!result.ok) {
  console.log('Error:', result.error.message);
  console.log('Full error:', result.error);
} else {
  console.log('Success!');
  console.log('Generated code:');
  console.log(result.value.codes[0].content);
  console.log('\n--- Expected code ---');
  console.log(`function Parent() {
  const [name, setName] = useState('');
  return <div><input value={name} /><Form /></div>;
}
function Form() {
  return;
}`);
}
