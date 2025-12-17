# Regrafter Codebase Analysis

## Project Overview
`regrafter` is a TypeScript library for programmatically transforming React/JSX ASTs (Abstract Syntax Trees). Its primary goal is to allow safe relocation of JSX elements (moving them within a file or across files) while automatically handling dependencies.

## Key Features
- **Element Relocation:** Move JSX elements `inside`, `before`, or `after` a target element.
- **Dependency Management:** Automatically detects dependencies (hooks, variables, props, imports) and decides how to handle them (hoist, thread as props, import, etc.).
- **Hoisting Strategies:** Has specific strategies for hoisting hooks, variables, and handling context and suspense.
- **Optimization:** Can "sink" over-hoisted dependencies back down to where they are needed to keep the scope clean.
- **Cross-file Support:** Supports moving elements between files, including creating shared modules if necessary.
- **Validation:** Extensive validation for selectors, moves, and inputs.
- **Error Handling:** Structured error handling with error codes and categories.

## Code Structure
- `src/index.ts`: The main entry point exposing `regraft`, `analyze`, `canMove`, `optimize`, etc.
- `src/types/`: Type definitions for the public API (`public.ts`) and internal structures.
- `src/analyzer/`: Logic for analyzing the AST to find dependencies and validate moves.
- `src/transformer/`: The core logic that actually modifies the AST.
- `src/strategies/`: Strategies for hoisting and resolving different types of dependencies.
- `src/scope/`: Manages variable scopes, which is crucial for determining where variables are defined and used.
- `src/selector/`: logic to resolve `Selector` objects (file/line/col or AST path) to actual AST nodes.
- `src/optimizer/`: Logic for optimizing the code after moves (e.g., sinking dependencies).
- `src/generator/`: Generates code from the modified AST, handling comments and formatting.

## Tests
The project has a comprehensive test suite using `vitest`, covering unit tests for individual components (parser, analyzer, transformer) and integration tests for various move scenarios (basic, cross-file, hoisting).
