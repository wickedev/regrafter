# Tech Steering

## Tech Stack

- **Language**: TypeScript (strict mode, ES2022 target)
- **AST Parsing**: @babel/parser (JSX, TypeScript, modern JS plugins)
- **AST Traversal**: @babel/traverse
- **AST Types**: @babel/types
- **Code Generation**: @babel/generator
- **Testing**: Vitest

## Project Configuration

- Configure Babel parser with: jsx, typescript, decorators, classProperties, dynamicImport, optionalChaining, nullishCoalescingOperator, topLevelAwait
- Enable TypeScript strict mode
- Use ESLint and Prettier for code quality

## Architecture Layers

1. **Public Interface**: regraft API, type definitions, error types
2. **Orchestration**: Pipeline coordinator, phase manager, result builder
3. **Core Logic**: Dependency analysis, hoist planning, move validation
4. **Transformations**: AST mutations, import updates, prop threading
5. **Infrastructure**: AST parsing, code generation, scope management

## Common Commands

```bash
# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Format
npm run format
```

## Development Principles

Follow TDD methodology strictly:
1. Write failing test first (Red)
2. Implement minimum code to pass (Green)
3. Refactor only when tests pass
4. Separate structural commits from behavioral commits

Use Kent Beck's "Tidy First" approach: make structural changes before behavioral changes, never mix them in the same commit.

## Performance Targets

- Single file (<1000 lines): <100ms
- Multi-file (10 files): <500ms
- `canMove()`: <20% of full operation time
- Memory: <10x file size
