---
sidebar_position: 1
---

# Getting Started

Welcome to **Regrafter**, a programmatic AST transformation library for relocating React/JSX elements with automatic dependency management.

## What is Regrafter?

Regrafter is a powerful tool that allows you to safely move React/JSX elements within and across files while automatically managing all dependencies, hooks, imports, and ensuring React rules compliance.

### Key Features

- **Safe Element Relocation**: Move JSX elements within and across files
- **Automatic Dependency Analysis**: Tracks variable, hook, and prop dependencies
- **Smart Hoisting**: Automatically hoists dependencies to common ancestor scopes
- **React Rules Compliance**: Ensures Hook rules are maintained during transformations
- **Optimization**: Sinks over-hoisted dependencies to optimal locations
- **Cross-file Support**: Move elements between different files with import management

## Installation

Install Regrafter using npm:

```bash
npm install regrafter
```

Or using yarn:

```bash
yarn add regrafter
```

Or using pnpm:

```bash
pnpm add regrafter
```

## Quick Start

Here's a simple example of how to use Regrafter:

```typescript
import { regraft, Move } from 'regrafter';

const files = [{
  path: 'App.tsx',
  content: `
    function App() {
      const [count, setCount] = useState(0);
      return (
        <div>
          <Header />
          <Counter value={count} onChange={setCount} />
          <Footer />
        </div>
      );
    }
  `
}];

// Move <Counter /> inside <Header />
const result = regraft(
  files,
  { file: 'App.tsx', line: 7, column: 11 },  // from: Counter element
  { file: 'App.tsx', line: 6, column: 11 },  // to: Header element
  Move.Inside
);

if (result.success) {
  console.log('Transformed code:', result.codes[0].content);
  console.log('Dependencies hoisted:', result.analysis.hoistedDeps);
}
```

## What's Next?

- Learn about the [API Reference](/docs/api/overview) to explore all available functions and types
- Check out [Examples](/docs/examples/basic) to see more use cases
- Read about [Dependency Management](/docs/concepts/dependencies) to understand how Regrafter handles different types of dependencies
