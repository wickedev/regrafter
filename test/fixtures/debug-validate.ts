import { createParser } from '../../src/parser/index.js';
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

console.log('Code:');
code.split('\n').forEach((line, i) => {
  console.log(`${i}: ${line}`);
});

const ast = parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript'],
});

console.log('\nLooking for nodes at line 5, column 7:');
traverse(ast, {
  enter(path) {
    const loc = path.node.loc;
    if (!loc) return;

    const startLine = loc.start.line;
    const startCol = loc.start.column + 1;
    const endLine = loc.end.line;
    const endCol = loc.end.column + 1;

    if (startLine === 5 && startCol <= 7 && endLine === 5 && endCol >= 7) {
      console.log(`  Found: ${path.node.type} at [${startLine}:${startCol} - ${endLine}:${endCol}]`);
      if (path.node.type === 'JSXIdentifier' && 'name' in path.node) {
        console.log(`    Name: ${path.node.name}`);
      }
    }
  },
});

console.log('\nLooking for nodes at line 6, column 7:');
traverse(ast, {
  enter(path) {
    const loc = path.node.loc;
    if (!loc) return;

    const startLine = loc.start.line;
    const startCol = loc.start.column + 1;
    const endLine = loc.end.line;
    const endCol = loc.end.column + 1;

    if (startLine === 6 && startCol <= 7 && endLine === 6 && endCol >= 7) {
      console.log(`  Found: ${path.node.type} at [${startLine}:${startCol} - ${endLine}:${endCol}]`);
      if (path.node.type === 'JSXIdentifier' && 'name' in path.node) {
        console.log(`    Name: ${path.node.name}`);
      }
    }
  },
});
