# Advanced Usage

Advanced patterns and customization techniques for Regrafter.

## Custom Dependency Analysis

### Manual Dependency Analysis

Analyze dependencies without performing transformations:

```typescript
import {
  DependencyAnalyzer,
  createDependencyAnalyzer,
  createScopeManager
} from 'regrafter';

// Create scope manager
const scopeManager = createScopeManager();
scopeManager.buildScopeTree(ast, filePath);

// Create analyzer
const analyzer = createDependencyAnalyzer(scopeManager);

// Analyze element dependencies
const dependencies = analyzer.analyzeElement(
  elementPath,
  targetScope
);

console.log('Dependencies:', dependencies);

// Filter by type
const hooks = dependencies.filter(d => d.type === 'Hook');
const variables = dependencies.filter(d => d.type === 'Variable');
const imports = dependencies.filter(d => d.type === 'Import');

console.log('Hooks:', hooks.map(h => h.symbol));
console.log('Variables:', variables.map(v => v.symbol));
console.log('Imports:', imports.map(i => i.symbol));
```

---

### MoveAnalysisBuilder

Build custom move analysis:

```typescript
import {
  MoveAnalysisBuilder,
  createMoveAnalysisBuilder
} from 'regrafter';

const builder = createMoveAnalysisBuilder();

// Build analysis incrementally
builder
  .setCanMove(true)
  .addDependency({
    type: 'Hook',
    symbol: 'useState',
    scope: 'App',
    locations: [/* locations */]
  })
  .addHoistedDep({
    type: 'Variable',
    symbol: 'count',
    scope: 'Inner',
    locations: [/* locations */]
  })
  .setStats({
    totalDeps: 2,
    hoistedCount: 1,
    crossFileMove: false,
    sharedModulesCreated: 0
  });

const analysis = builder.build();
```

---

## Hoisting Strategy Control

### Custom Hoisting Planner

Configure hoisting strategies:

```typescript
import {
  createConfiguredHoistPlanner,
  createHookHoister,
  createVariableHoister,
  createPropThreader,
  createImportManager,
  createContextHandler,
  createSuspenseHandler
} from 'regrafter';

// Create planner with specific strategies
const planner = createConfiguredHoistPlanner({
  hookHoister: createHookHoister(),
  variableHoister: createVariableHoister(),
  propThreader: createPropThreader(),
  importManager: createImportManager(),
  contextHandler: createContextHandler(),
  suspenseHandler: createSuspenseHandler()
});

// Create hoist plan
const plan = planner.plan(dependencies, context);

console.log('Hoist plan:', plan);
```

---

### Individual Strategy Usage

Use individual hoisting strategies:

```typescript
import {
  HookHoister,
  createHookHoister,
  VariableHoister,
  createVariableHoister,
  PropThreader,
  createPropThreader
} from 'regrafter';

// Hook hoisting
const hookHoister = createHookHoister();
const hookPlan = hookHoister.plan(hookDependencies, context);

// Variable hoisting
const variableHoister = createVariableHoister();
const varPlan = variableHoister.plan(variableDependencies, context);

// Prop threading
const propThreader = createPropThreader();
const propPlan = propThreader.plan(propDependencies, context);
```

---

### Hook Classification

Classify and handle different hook types:

```typescript
import { isHookName, classifyHook, HookCategory } from 'regrafter';

// Check if identifier is a hook
if (isHookName('useState')) {
  console.log('useState is a hook');
}

// Classify hook
const category = classifyHook('useEffect');

switch (category) {
  case HookCategory.State:
    console.log('State hook');
    break;
  case HookCategory.Effect:
    console.log('Effect hook');
    break;
  case HookCategory.Ref:
    console.log('Ref hook');
    break;
  case HookCategory.Context:
    console.log('Context hook');
    break;
  case HookCategory.Memo:
    console.log('Memoization hook');
    break;
  case HookCategory.Other:
    console.log('Other hook');
    break;
}
```

---

### Execute Hoisting Plan

Execute a custom hoisting plan:

```typescript
import {
  HoistExecutor,
  createHoistExecutor,
  type HoistExecutionContext
} from 'regrafter';

const executor = createHoistExecutor();

const context: HoistExecutionContext = {
  ast,
  scopeManager,
  sourceFile: 'App.tsx',
  targetFile: 'App.tsx'
};

// Execute the plan
executor.execute(plan, context);

console.log('Hoisting complete');
```

---

## Atomic Unit Detection

### Detect Atomic Units

Detect elements that must move together:

```typescript
import {
  detectAtomicUnit,
  detectConditionalExpression,
  detectTernaryExpression,
  detectMapExpression,
  detectCompoundComponent,
  getAtomicUnitType,
  findEnclosingAtomicUnit,
  AtomicUnitType
} from 'regrafter';

// Detect any atomic unit
const atomicUnit = detectAtomicUnit(jsxPath);

if (atomicUnit) {
  console.log('Type:', atomicUnit.type);
  console.log('Root:', atomicUnit.root);
  console.log('Elements:', atomicUnit.elements);

  // Check type
  switch (atomicUnit.type) {
    case AtomicUnitType.Conditional:
      console.log('Conditional expression: {cond && <Element />}');
      break;
    case AtomicUnitType.Ternary:
      console.log('Ternary expression: {cond ? <A /> : <B />}');
      break;
    case AtomicUnitType.Map:
      console.log('Map expression: {items.map(i => <Item />)}');
      break;
    case AtomicUnitType.Compound:
      console.log('Compound component: <Tabs.Panel />');
      break;
  }
}
```

---

### Specific Detection

Detect specific atomic unit types:

```typescript
import {
  detectConditionalExpression,
  detectTernaryExpression,
  detectMapExpression,
  detectCompoundComponent,
  type ConditionalExpressionInfo,
  type TernaryExpressionInfo,
  type MapExpressionInfo,
  type CompoundComponentInfo
} from 'regrafter';

// Detect conditional: {condition && <Element />}
const conditional = detectConditionalExpression(path);
if (conditional) {
  console.log('Condition:', conditional.condition);
  console.log('Element:', conditional.consequent);
}

// Detect ternary: {condition ? <A /> : <B />}
const ternary = detectTernaryExpression(path);
if (ternary) {
  console.log('Condition:', ternary.test);
  console.log('True branch:', ternary.consequent);
  console.log('False branch:', ternary.alternate);
}

// Detect map: {items.map(item => <Item />)}
const map = detectMapExpression(path);
if (map) {
  console.log('Array:', map.array);
  console.log('Iterator:', map.iterator);
  console.log('Element:', map.element);
}

// Detect compound: <Tabs.Panel />
const compound = detectCompoundComponent(path);
if (compound) {
  console.log('Parent:', compound.parent);
  console.log('Child:', compound.child);
  console.log('Full name:', compound.fullName);
}
```

---

### Find Enclosing Atomic Unit

Find the atomic unit that contains an element:

```typescript
import { findEnclosingAtomicUnit } from 'regrafter';

const enclosing = findEnclosingAtomicUnit(elementPath);

if (enclosing) {
  console.log('Element is inside atomic unit:', enclosing.type);
  console.log('Must move entire unit');
} else {
  console.log('Element can be moved independently');
}
```

---

### JSX Node Detection

Detect JSX nodes and elements:

```typescript
import { isJSXNode, containsJSXElement } from 'regrafter';

// Check if node is JSX
if (isJSXNode(node)) {
  console.log('Node is JSX');
}

// Check if node contains JSX
if (containsJSXElement(node)) {
  console.log('Node contains JSX element');
}
```

---

## Move Validation

### Validate Move Operations

Validate moves before execution:

```typescript
import {
  validateMoveOperation,
  canMoveElement,
  MoveValidationError,
  type MoveValidationResult
} from 'regrafter';

// Detailed validation
const validation: MoveValidationResult = validateMoveOperation(
  fromNode,
  toNode,
  mode,
  scopeManager
);

if (!validation.valid) {
  console.error('Validation failed:', validation.errors);

  for (const error of validation.errors) {
    console.error(`- ${error.message}`);
    console.error(`  Code: ${error.code}`);
  }

  if (validation.warnings) {
    for (const warning of validation.warnings) {
      console.warn(`- ${warning}`);
    }
  }
}

// Simple boolean check
if (canMoveElement(fromNode, toNode, mode)) {
  console.log('Move is valid');
}
```

---

## Scope Management

### Manual Scope Management

Create and manage scope trees:

```typescript
import { ScopeManager, createScopeManager, ScopeType } from 'regrafter';

const scopeManager = createScopeManager();

// Build scope tree
scopeManager.buildScopeTree(ast, filePath);

// Get scope information
const scope = scopeManager.getScope(nodePath);

if (scope) {
  console.log('Scope type:', scope.type);
  console.log('Scope name:', scope.name);
  console.log('Parent scope:', scope.parent?.name);
  console.log('Variables:', scope.variables);

  // Check scope type
  switch (scope.type) {
    case ScopeType.Module:
      console.log('Module scope');
      break;
    case ScopeType.Function:
      console.log('Function scope');
      break;
    case ScopeType.Component:
      console.log('Component scope');
      break;
    case ScopeType.Block:
      console.log('Block scope');
      break;
  }
}

// Find common ancestor scope
const commonScope = scopeManager.findCommonAncestorScope(
  scope1,
  scope2
);

console.log('Common scope:', commonScope?.name);

// Check if scope can contain hooks
if (scopeManager.canContainHooks(scope)) {
  console.log('Scope can contain hooks');
}
```

---

### Component Scope

Work with component scopes:

```typescript
import { type ComponentScope } from 'regrafter';

const componentScope: ComponentScope = scopeManager.getComponentScope(node);

if (componentScope) {
  console.log('Component name:', componentScope.name);
  console.log('Is component:', componentScope.isComponent);
  console.log('Props:', componentScope.props);
  console.log('Hooks:', componentScope.hooks);
  console.log('State:', componentScope.state);
}
```

---

## Selector Utilities

### Selector Resolution

Resolve selectors to AST nodes:

```typescript
import { SelectorResolver, createSelectorResolver } from 'regrafter';

const resolver = createSelectorResolver();

// Resolve position selector
const node1 = resolver.resolve(
  ast,
  { file: 'App.tsx', line: 10, column: 5 }
);

// Resolve path selector
const node2 = resolver.resolve(
  ast,
  { file: 'App.tsx', path: 'Program.body[0].declaration' }
);

if (node1) {
  console.log('Found node at position');
}

if (node2) {
  console.log('Found node at path');
}
```

---

### AST Path Selectors

Use AST paths for precise programmatic control:

```typescript
import { move, Move } from 'regrafter';

// Construct AST path
const fromPath = 'Program.body[0].declaration.body.body[2].argument.children[1]';
const toPath = 'Program.body[0].declaration.body.body[2].argument.children[0]';

// Use path selectors
const result = move(
  files,
  { file: 'App.tsx', path: fromPath },
  { file: 'App.tsx', path: toPath },
  Move.Inside
);
```

---

## Custom Transformations

### AST Traversal

Traverse and inspect ASTs:

```typescript
import traverse from '@babel/traverse';
import * as t from '@babel/types';

traverse(ast, {
  JSXElement(path) {
    // Process JSX elements
    const opening = path.node.openingElement;
    console.log('Element:', opening.name);
  },

  CallExpression(path) {
    // Process function calls
    if (t.isIdentifier(path.node.callee)) {
      console.log('Call:', path.node.callee.name);
    }
  },

  VariableDeclarator(path) {
    // Process variable declarations
    if (t.isIdentifier(path.node.id)) {
      console.log('Variable:', path.node.id.name);
    }
  }
});
```

---

### AST Manipulation

Manipulate ASTs directly:

```typescript
import * as t from '@babel/types';
import generate from '@babel/generator';

// Create new JSX element
const element = t.jsxElement(
  t.jsxOpeningElement(
    t.jsxIdentifier('div'),
    []
  ),
  t.jsxClosingElement(
    t.jsxIdentifier('div')
  ),
  [t.jsxText('Hello World')],
  false
);

// Generate code
const { code } = generate(element);
console.log(code);  // <div>Hello World</div>
```

---

## Performance Optimization

### Caching

Regrafter automatically caches ASTs, but you can manage caching manually:

```typescript
import { ASTStore } from 'regrafter/internal';

const store = new ASTStore();

// Parse and cache
const ast1 = store.getOrParse(filePath1, content1);
const ast2 = store.getOrParse(filePath2, content2);

// Reuse cached ASTs
const cachedAst = store.get(filePath1);

// Clear cache
store.clear();
```

---

### Batch Processing

Process multiple operations efficiently:

```typescript
import { processBatch, move, Move } from 'regrafter';

const operations = [
  { from: selector1, to: target1 },
  { from: selector2, to: target2 },
  { from: selector3, to: target3 }
];

// Process in batch
const result = processBatch(operations, ({ from, to }) =>
  move(files, from, to, Move.Inside)
);

// Check results
console.log(`Success: ${result.successCount}/${operations.length}`);

// Process successful operations
for (const codes of result.successful) {
  // Handle success
}

// Handle failures
for (const { index, error } of result.failed) {
  console.error(`Operation ${index} failed:`, error.message);
}
```

---

## Type Safety

### TypeScript Integration

Leverage TypeScript for type-safe usage:

```typescript
import type {
  FileInput,
  Selector,
  PositionSelector,
  PathSelector,
  Move,
  Options,
  Result,
  Code,
  MoveAnalysis,
  Dependency,
  DependencyType,
  RegraffError,
  ErrorCategory
} from 'regrafter';

// Type-safe file input
const files: FileInput[] = [
  { path: 'App.tsx', content: sourceCode }
];

// Type-safe selector
const fromSelector: PositionSelector = {
  file: 'App.tsx',
  line: 10,
  column: 5
};

const toSelector: PathSelector = {
  file: 'App.tsx',
  path: 'Program.body[0]'
};

// Type-safe options
const options: Options = {
  optimize: true,
  dryRun: false,
  preserveComments: true,
  formatOutput: true
};
```

---

### Type Guards

Use type guards for runtime type checking:

```typescript
import {
  isPositionSelector,
  isPathSelector,
  isValidMove,
  isValidDependencyType,
  isValidSelector,
  isValidOptions
} from 'regrafter';

// Check selector type
if (isPositionSelector(selector)) {
  console.log('Position:', selector.line, selector.column);
}

if (isPathSelector(selector)) {
  console.log('Path:', selector.path);
}

// Validate enums
if (isValidMove(mode)) {
  console.log('Valid move mode');
}

if (isValidDependencyType(type)) {
  console.log('Valid dependency type');
}

// Validate structures
if (isValidSelector(selector)) {
  console.log('Valid selector');
}

if (isValidOptions(options)) {
  console.log('Valid options');
}
```

---

## Debugging

### Debug Mode

Enable detailed logging:

```typescript
import { setDebugMode, getDebugInfo } from 'regrafter/debug';

// Enable debug mode
setDebugMode(true);

// Perform operation
const result = move(files, from, to, Move.Inside);

// Get debug information
const debugInfo = getDebugInfo();

console.log('Parse time:', debugInfo.parseTime);
console.log('Analysis time:', debugInfo.analysisTime);
console.log('Transform time:', debugInfo.transformTime);
console.log('Total time:', debugInfo.totalTime);

// Disable debug mode
setDebugMode(false);
```

---

### Error Stack Traces

Errors include full stack traces:

```typescript
import { isErr } from 'regrafter';

const result = move(files, from, to, Move.Inside);

if (isErr(result)) {
  console.error('Error:', result.error.message);
  console.error('Stack:', result.error.stack);
  console.error('Context:', result.error.context);
}
```

---

## See Also

- [API Reference](./api-reference.md) - Complete API documentation
- [Dependency Types](./dependency-types.md) - Understanding dependencies
- [Examples](./examples.md) - Practical examples
- [Error Handling](./error-handling.md) - Error handling patterns
