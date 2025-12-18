import { parseFile } from './src/parser/parse-file.js';
import { createScopeManager } from './src/scope/scope-manager.js';
import { createDependencyAnalyzer } from './src/analyzer/dependency-analyzer.js';
import { createHoistPlanner } from './src/strategies/hoist-planner.js';
import { createHoistExecutor } from './src/strategies/hoist-executor.js';
import { createCodeGenerator } from './src/generator/code-generator.js';
import * as t from '@babel/types';
import traverseModule from '@babel/traverse';
import { loadTraverseFunction } from './src/utils/index.js';
const traverse = loadTraverseFunction(traverseModule);

const source = `function Parent() {
  return <div><Form /></div>;
}

function Form() {
  const [name, setName] = useState('');
  return <input value={name} />;
}`;

const parseResult = parseFile('App.tsx', source);
if (!parseResult.ok) {
  console.log('Parse error:', parseResult.error);
  process.exit(1);
}

const ast = parseResult.value;

// Find the Form function body
let formBody: any = null;
traverse(ast, {
  FunctionDeclaration(path: any) {
    if (path.node.id && path.node.id.name === 'Form') {
      const body = path.get('body');
      if (body.isBlockStatement()) {
        formBody = body.node.body;
        console.log('Form function body BEFORE hoisting:');
        formBody.forEach((stmt: any, i: number) => {
          console.log(`  Statement ${i}: ${stmt.type}`);
        });
        console.log(`  Total statements: ${formBody.length}`);
      }
    }
  }
});

console.log('\nNow perform hoisting and check again...\n');

// The issue is: after hoisting, how many statements are left?
