import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse: typeof traverseModule = (traverseModule as any).default || traverseModule;

const code = `
function Parent() {
  const [visible, setVisible] = useState(true);

  function Child() {
    return <span>Child content</span>;
  }

  return (
    <div>
      {visible && <Child />}
      <button onClick={() => setVisible(!visible)}>Toggle</button>
      <section>Target</section>
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
