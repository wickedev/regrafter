---
sidebar_position: 1
---

# API Overview

Regrafter provides a simple yet powerful API for programmatic AST transformations. This page provides an overview of the main functions and types.

## Main Functions

### `regraft()`

The main entry point for element relocation.

```typescript
function regraft(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `files` | `FileInput[]` | Array of files to transform |
| `from` | `Selector` | Source element location |
| `to` | `Selector` | Target location |
| `mode` | `Move` | Positioning relative to target |
| `options` | `Options` | Optional configuration |

**Returns:** `Result` object with transformed code and analysis.

### `analyze()`

Analyze a proposed move without executing it.

```typescript
function analyze(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): MoveAnalysis
```

### `canMove()`

Quick check if a move is possible.

```typescript
function canMove(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): boolean
```

### `optimize()`

Optimize files by sinking over-hoisted dependencies.

```typescript
function optimize(files: FileInput[]): Code[]
```

## Core Types

### `Selector`

Position-based or AST path-based element selection.

```typescript
// Position selector (IDE integration)
const posSelector: PositionSelector = {
  file: 'src/App.tsx',
  line: 10,
  column: 5
};

// Path selector (programmatic)
const pathSelector: PathSelector = {
  file: 'src/App.tsx',
  path: 'Program.body[0].declaration.body.body[2]'
};
```

### `Move`

Element positioning mode.

```typescript
enum Move {
  Inside = 'inside',   // As child of target
  Before = 'before',   // As sibling before target
  After = 'after'      // As sibling after target
}
```

### `Options`

Configuration options.

```typescript
interface Options {
  optimize?: boolean;       // Run sinking optimization (default: true)
  dryRun?: boolean;         // Preview only (default: false)
  preserveComments?: boolean; // Keep comments (default: true)
  formatOutput?: boolean;   // Format with Prettier (default: false)
}
```

## Next Steps

- [Error Handling](/docs/api/errors) - Learn about structured error handling
