import { regraft, Move } from './src/index.js';

const files = [
  {
    path: "App.tsx",
    content: `function Parent() {
  return <div><Form /></div>;
}

function Form() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const inputRef = useRef(null);

  const validate = () => {
    return name.length > 0 && email.includes('@');
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form>
      <input ref={inputRef} value={name} onChange={e => setName(e.target.value)} />
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <button disabled={!validate()}>Submit</button>
    </form>
  );
}`,
  },
];

const from = { file: "App.tsx", line: 19, column: 5 }; // form element
const to = { file: "App.tsx", line: 2, column: 15 }; // inside Parent div

const result = regraft(files, from, to, Move.Inside);

console.log('Result ok:', result.ok);
if (!result.ok) {
  console.log('Error:', result.error);
} else {
  console.log('Success!');
  console.log(result.value.codes[0].content);
}
