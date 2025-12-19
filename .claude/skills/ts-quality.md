---
name: ts-quality
description: Enforce TypeScript quality standards immediately after writing or modifying .ts/.tsx files. Run type checking and linting on each changed file for instant feedback. Use after creating/editing TypeScript files, or when quality checks, typecheck, lint, or validate are mentioned.
---

# TypeScript Quality Enforcement

This skill helps maintain TypeScript code quality by running instant checks on each file after it's written or modified.

## What This Skill Does

When activated, this skill ensures TypeScript code meets quality standards by:

1. **Type Checking** - Runs `yarn tsc --noEmit <file>` to ensure zero TypeScript type errors
2. **Linting** - Runs `yarn lint <file>` to enforce code style consistency

Checks run on the SPECIFIC FILE that was just written/modified, not the entire project.

## When to Use This Skill

Activate this skill:

- **Immediately after writing or modifying any .ts or .tsx file**
- After creating new TypeScript files
- After editing existing TypeScript files
- When user mentions: "quality checks", "typecheck", "lint", "validate code"
- Before creating git commits
- During code review processes

## Quality Standards

**ZERO TOLERANCE POLICY**: No lint errors or type errors are acceptable.

### Required Checks (in sequence):

1. **Type Checking** - File-scoped typecheck
   - Must pass with zero errors
   - Validates TypeScript type safety for the specific file

2. **Linting** - File-scoped lint
   - Must pass with zero errors
   - Enforces consistent code formatting and style

## Instructions

When this skill is active, follow these steps:

### 1. Announce Activation

Immediately inform the user that quality checks are running:

```
🔍 Checking {filename}...
```

Replace `{filename}` with the actual file path (e.g., `src/analyzer/dependency-analyzer.ts`).

### 2. Identify the File to Check

Determine which TypeScript file was just written or modified. This is the file to check.

### 3. Run File-Scoped Quality Checks

Execute checks sequentially on the SPECIFIC FILE ONLY:

```bash
# Type check the specific file
yarn tsc --noEmit path/to/file.ts

# Lint the specific file
yarn lint path/to/file.ts
```

**Important**:
- Only check the file that was written/modified
- Do NOT run project-wide checks
- Each command must succeed before the next runs

### 4. Report Results

**If all checks pass:**
Report success clearly:
```
✓ {filename}: typecheck and lint passed
```

**If any check fails:**
- Report the specific errors with line numbers
- Format: `✗ {filename}: found N errors`
- Show the actual error messages
- DO NOT proceed to subsequent checks
- DO NOT allow commits with failing checks
- Fix the errors before continuing

## Type Safety Guidelines

### DO:

- Use explicit types for function parameters and return values
- Leverage TypeScript's type inference for simple variable assignments
- Use `unknown` instead of `any` when the type is truly unknown
- Define interfaces for object shapes
- Use type guards for runtime validation of external data
- Document complex types with JSDoc comments
- Follow the Result monad pattern used in this codebase for error handling

### DO NOT:

- Use `any` without explicit justification in comments
- Ignore TypeScript errors (no `@ts-ignore` without explanation)
- Skip typecheck before committing
- Commit code with lint errors
- Use `@ts-expect-error` to suppress valid errors
- Bypass quality checks "just this once"

## Examples

### Example 1: Creating New TypeScript File

**User**: "Create a new analyzer for detecting circular dependencies"

**Actions**:
1. Create the file with proper types (explicit parameter and return types)
2. Use Result<T, RegraffError> for error handling
3. After file creation, immediately run quality checks:
   - Announce: `🔍 Checking src/analyzer/circular-dependency-detector.ts...`
   - Run: `yarn tsc --noEmit src/analyzer/circular-dependency-detector.ts`
   - Run: `yarn lint src/analyzer/circular-dependency-detector.ts`
   - Report: `✓ src/analyzer/circular-dependency-detector.ts: typecheck and lint passed`
4. Only consider the task complete when checks pass

### Example 2: Modifying Existing Code

**User**: "Update the dependency analyzer to handle hook dependencies"

**Actions**:
1. Make changes to the file maintaining type safety
2. After saving the file, immediately run quality checks:
   - Announce: `🔍 Checking src/analyzer/dependency-analyzer.ts...`
   - Run: `yarn tsc --noEmit src/analyzer/dependency-analyzer.ts`
   - Run: `yarn lint src/analyzer/dependency-analyzer.ts`
   - Report results:
     - If passed: `✓ src/analyzer/dependency-analyzer.ts: typecheck and lint passed`
     - If failed: `✗ src/analyzer/dependency-analyzer.ts: found 2 errors` (then show errors)

### Example 3: File with Errors

**User**: Writes a file with type errors

**Actions**:
1. Announce: `🔍 Checking src/strategies/hook-hoister.ts...`
2. Run typecheck: `yarn tsc --noEmit src/strategies/hook-hoister.ts`
3. Detect errors and report:
   ```
   ✗ src/strategies/hook-hoister.ts: found 3 errors

   src/strategies/hook-hoister.ts:15:5 - error TS2322: Type 'string' is not assignable to type 'number'.
   src/strategies/hook-hoister.ts:22:10 - error TS2339: Property 'foo' does not exist on type 'DependencyInfo'.
   src/strategies/hook-hoister.ts:35:3 - error TS2345: Argument of type 'null' is not assignable to parameter of type 'string'.
   ```
4. Do NOT proceed to lint
5. Wait for user to fix errors

## Integration with Regrafter Codebase

This skill works with the Regrafter project structure:

- **Result Monad**: Always use `Result<T, RegraffError>` for error handling
- **Test Files**: Also check `__tests__` files when modified
- **Config Directory**: TypeScript config is in `config/tsconfig.json`
- **ESLint Config**: ESLint config is in `config/eslint.config.cjs`

File-scoped checks work across the entire src/ directory structure.

## Quick Reference Commands

```bash
# File-scoped typecheck (fast, targeted)
yarn tsc --noEmit path/to/file.ts

# File-scoped lint
yarn lint path/to/file.ts

# Both checks in sequence
yarn tsc --noEmit path/to/file.ts && yarn lint path/to/file.ts
```

## Error Handling

When errors occur:

1. **Type Errors**: Show the file, line number, and error message
2. **Lint Errors**: Show the file, line number, rule violated, and how to fix

Always provide actionable information to help fix the errors.

## Best Practices

- **Check after every file write** - Instant feedback prevents accumulating errors
- **Fix errors immediately** - Don't accumulate technical debt
- **Type errors first** - Must be resolved before linting
- **Never commit failing code** - No exceptions
- **File-scoped only** - Don't run project-wide checks
- **Pragmatic quality** - Focus on correctness, not perfection
- **Follow TDD** - Write failing test first, implement minimum code to pass, refactor

## Requirements

This skill requires:

- **yarn** installed
- **TypeScript** installed and configured
- **ESLint** configured with `config/eslint.config.cjs`

The skill uses:
- `yarn tsc --noEmit <file>` for type checking
- `yarn lint <file>` for linting

## Integration with TDD Workflow

When using this skill with TDD:

1. **Red Phase**: Write failing test
2. **Green Phase**: Implement minimum code
3. **Quality Check**: Run this skill on modified files
4. **Refactor Phase**: Only if quality checks pass

This ensures code quality is maintained throughout the TDD cycle without interfering with the rapid feedback loop of test-driven development.
