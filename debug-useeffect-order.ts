import { regraft, Move } from './src/index.js';

const files = [
  {
    path: "App.tsx",
    content: `function Parent() {
  return <div><Child /></div>;
}

function Child() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}`,
  },
];

const from = { file: "App.tsx", line: 12, column: 10 }; // button with effect
const to = { file: "App.tsx", line: 2, column: 10 }; // inside Parent div

console.log('Testing useEffect hoisting order...\n');

const result = regraft(files, from, to, Move.Inside);

console.log('Result ok:', result.ok);
if (!result.ok) {
  console.log('Error:', result.error.message);
} else {
  console.log('Generated code:');
  console.log(result.value.codes[0].content);
  console.log('\n--- Expected code ---');
  console.log(`function Parent() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);
  return <div><button onClick={() => setCount(count + 1)}>{count}</button><Child /></div>;
}
function Child() {
  return;
}`);
}
