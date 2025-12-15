import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse: typeof traverseModule =
  (traverseModule as any).default || traverseModule;

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

const ast = parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript'],
});

console.log('All JSX elements:');
traverse(ast, {
  JSXElement(path) {
    const loc = path.node.loc;
    if (loc) {
      const opening = path.node.openingElement;
      const name = opening.name.type === 'JSXIdentifier' ? opening.name.name : 'unknown';
      console.log(`<${name}> at line ${loc.start.line}:${loc.start.column+1} - ${loc.end.line}:${loc.end.column+1}`);
    }
  },
  JSXIdentifier(path) {
    const loc = path.node.loc;
    if (loc) {
      console.log(`  JSXIdentifier "${path.node.name}" at line ${loc.start.line}:${loc.start.column+1} - ${loc.end.line}:${loc.end.column+1}`);
    }
  },
});
