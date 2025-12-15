# Product Steering

## Purpose

Regrafter is a programmatic AST transformation library for relocating React/JSX elements with automatic dependency management. It enables safe movement of components within and across files.

## Core Value Proposition

- **Safety**: Transformed code always compiles and maintains semantic correctness
- **Automation**: Dependencies are analyzed and resolved automatically (hooks, variables, imports, props)
- **Predictability**: Invalid moves are detectable before execution via `canMove()` API

## Key Features

1. **Element Movement**: Move JSX elements as children (Inside), before, or after target elements
2. **Dependency Analysis**: Automatically identify Hook, Variable, Import, Prop, Context, and Ref dependencies
3. **Automatic Hoisting**: Hoist dependencies to valid scopes following React Hook rules
4. **Cross-File Movement**: Move elements between files with automatic import/export management
5. **Dependency Sinking**: Optimize over-hoisted dependencies back to minimal scopes

## Business Logic Rules

- Treat conditional expressions (`{cond && <E />}`) as atomic units
- Treat map expressions (`{items.map(...)}`) as atomic units
- Treat compound components (`<Tabs.Panel>`) as atomic units
- Hook hoisting must respect React Rules of Hooks (no conditionals, no loops)
- Cross-file moves may create shared modules to avoid circular dependencies
- Only `eval()` and dynamic code execution are truly unanalyzable/unmovable

## API Design Principle

Provide both unified API (`regraft()`) for simple use and individual APIs (`canMove`, `move`, `analyze`, `optimize`) for fine-grained control.
