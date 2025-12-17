import { describe, it } from 'vitest';
import { parse } from '@babel/parser';
import generateFn from '@babel/generator';

const generate = generateFn as any as typeof generateFn.default;

describe('Parser Output Test', () => {
  it('should show actual output', () => {
    const source = `const element = <div>Hello</div>;`;

    const ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const regenerated = generate(ast).code;

    console.log('Regenerated code:');
    console.log(regenerated);
    console.log('\nJSON:');
    console.log(JSON.stringify(regenerated));
  });
});
