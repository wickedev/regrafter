# Regrafter Requirements Document

## Introduction

Regrafter is a library that repositions React elements through programmatic AST transformation. It provides dependency analysis, automatic hoisting, cross-file movement, and optimization features to enable developers to safely move JSX elements.

### Core Values

- **Safety**: Code must always build correctly after movement
- **Predictability**: Ability to verify in advance when movement is not possible
- **Automation**: Automatic handling of dependencies
- **Optimization**: Repositioning hoisted dependencies to optimal locations

---

## Requirements

### 1. Integrated API

**User Story:** As a developer, I want to perform validation, analysis, execution, and optimization of element movement in a single API call. This allows me to refactor conveniently without complex step-by-step calls.

#### Acceptance Criteria

1. WHEN the `regraft(files, from, to, mode)` function is called THEN the system SHALL sequentially perform move feasibility verification (canMove), move execution (move), dependency analysis (analyze), and optimization (optimize).

2. WHEN a valid file path array, from selector, to selector, and move mode are provided THEN the system SHALL return a Result object. This object includes success (boolean), codes (Code[]), and analysis (MoveAnalysis) fields.

3. IF options.dryRun is true THEN the system SHALL return analysis results only without actual code transformation.

4. IF options.optimize is false THEN the system SHALL skip the sinking optimization step.

5. IF options.optimize is not specified THEN the system SHALL perform sinking optimization with a default value of true.

6. WHEN the move is successful THEN the system SHALL include the contents of all changed files in the codes array, and mark whether changed with each Code object's changed field.

---

### 2. Move Modes

**User Story:** As a developer, I want to move elements as children, previous siblings, or next siblings of the destination. This allows me to meet various structural change requirements.

#### Acceptance Criteria

1. WHEN moving with Move.Inside mode THEN the system SHALL place the source element as a child of the destination element.

2. WHEN moving with Move.Before mode THEN the system SHALL place the source element as the previous sibling of the destination element.

3. WHEN moving with Move.After mode THEN the system SHALL place the source element as the next sibling of the destination element.

4. WHEN the move is complete THEN the system SHALL remove the source element from the original location.

5. IF the source and destination are the same location THEN the system SHALL return success without any changes.

---

### 3. Selector

**User Story:** As a developer, I want to specify elements by file location and line/column or AST path. This supports both IDE integration and programmatic usage.

#### Acceptance Criteria

1. WHEN the selector is provided in `{ file, line, column }` format THEN the system SHALL select the nearest JSX element at that location.

2. WHEN the selector is provided in `{ file, path }` format THEN the system SHALL select the node at that AST path.

3. IF the selector does not point to a valid JSX element THEN the system SHALL return success: false with a clear error message.

4. IF the selector's file path is not included in the files array THEN the system SHALL return an error.

---

### 4. Dependency Analysis

**User Story:** As a developer, I want to automatically analyze all dependencies referenced by the element to be moved. This allows safe movement without manual dependency tracking.

#### Acceptance Criteria

1. WHEN analyzing element movement THEN the system SHALL identify Hook dependencies (useState, useEffect, useContext, etc.).

2. WHEN analyzing element movement THEN the system SHALL identify Variable dependencies (const, let declarations).

3. WHEN analyzing element movement THEN the system SHALL identify Import dependencies (external module references).

4. WHEN analyzing element movement THEN the system SHALL identify Prop dependencies (values passed from above).

5. WHEN analysis is complete THEN the system SHALL include all dependencies and hoistedDeps lists in the MoveAnalysis object.

6. IF the dependency contains eval() or dynamic code execution THEN the system SHALL mark that dependency as unanalyzable.

---

### 5. Automatic Dependency Hoisting

**User Story:** As a developer, I want dependencies to be automatically hoisted to appropriate locations when moving elements. This makes code work correctly without manual refactoring.

#### Acceptance Criteria

1. WHEN a Hook dependency is inaccessible in the new scope THEN the system SHALL hoist that Hook to the top of the common ancestor component.

2. WHEN a Variable dependency is inaccessible in the new scope THEN the system SHALL hoist that variable or pass it as props.

3. WHEN an Import dependency is missing in the target file THEN the system SHALL automatically add the import statement to the target file.

4. WHEN a Prop dependency is inaccessible in the new scope THEN the system SHALL thread props through ancestor components.

5. IF the Hook hoisting target location is inside a conditional or loop THEN the system SHALL hoist to a valid upper location that complies with Hook rules.

6. WHEN dependencies are hoisted and the original location still uses that dependency THEN the system SHALL inject it to the original location through props.

---

### 6. Move Impossibility Condition Verification (canMove API)

**User Story:** As a developer, I want to verify move feasibility before the actual move. This avoids unnecessary operations and provides immediate feedback to users.

#### Acceptance Criteria

1. WHEN the `regraft.canMove(files, from, to, mode)` function is called THEN the system SHALL return move feasibility as a boolean.

2. IF the dependency contains eval() or dynamically unanalyzable code THEN the system SHALL return false.

3. IF the move is not possible THEN MoveAnalysis.reason SHALL clearly explain why it is not possible.

4. WHEN moving conditional rendering expressions (condition && element) THEN the system SHALL treat the entire conditional expression as an atomic unit and determine it as movable.

5. WHEN moving dynamic lists (map/filter/reduce) THEN the system SHALL treat the entire expression as an atomic unit and determine it as movable.

6. WHEN moving an element with Context dependencies outside the Provider THEN the system SHALL determine it as movable through Provider hoisting or props conversion.

7. WHEN moving a Lazy component within a Suspense boundary THEN the system SHALL determine it as movable through automatic Suspense boundary creation.

8. WHEN moving Compound Components (e.g., Tabs.Tab) outside their parent THEN the system SHALL treat the whole as an atomic unit and determine it as movable.

9. WHEN moving elements using ref THEN the system SHALL determine it as movable through ref hoisting and props injection.

---

### 7. Cross-File Movement

**User Story:** As a developer, I want to move elements to different files. This allows me to restructure components and modularize code.

#### Acceptance Criteria

1. WHEN from and to files are different THEN the system SHALL perform cross-file movement.

2. IF a dependency is defined only in the original file and not exported THEN the system SHALL create a shared module and move the dependency.

3. WHEN a shared module is created THEN the system SHALL add necessary import statements to both the original and target files.

4. IF the dependency is also used in other code in the original file THEN the system SHALL replace the reference in the original file with an import.

5. WHEN cross-file movement is complete THEN the codes array SHALL include the contents of all changed files (original, target, shared module).

6. IF the target file is not in the files array THEN the system SHALL reflect whether to create a new file in codes.

---

### 8. Dependency Sinking Optimization

**User Story:** As a developer, I want to optimize dependencies accumulated at the top through multiple moves to their actual usage locations. This reduces unnecessary props passing and improves code quality.

#### Acceptance Criteria

1. WHEN the `regraft.optimize(files)` function is called THEN the system SHALL analyze all hoisted dependencies.

2. IF a dependency is used only in a single subtree THEN the system SHALL move (sink) that dependency to the lowest common ancestor of the usage location.

3. IF sibling components share a dependency THEN the system SHALL maintain the dependency in the parent.

4. IF parent-child share a dependency THEN the system SHALL maintain the dependency in the parent.

5. WHEN a dependency is sunk THEN the system SHALL remove unnecessary props passing.

6. IF the Hook sinking target location is inside a conditional or loop THEN the system SHALL not sink that Hook.

7. WHEN optimize is true in the integrated API THEN the system SHALL automatically perform sinking optimization after move completion.

---

### 9. Individual APIs

**User Story:** As a developer, I want to call individual functions separately when detailed control is needed. This allows me to compose custom workflows.

#### Acceptance Criteria

1. WHEN the `regraft.canMove(files, from, to, mode)` function is called THEN the system SHALL return only move feasibility as a boolean.

2. WHEN the `regraft.move(files, from, to, mode)` function is called THEN the system SHALL perform only the move without validation and optimization and return a Code[] array.

3. WHEN the `regraft.analyze(files, from, to, mode)` function is called THEN the system SHALL return only a MoveAnalysis object without code transformation.

4. WHEN the `regraft.optimize(files)` function is called THEN the system SHALL perform sinking optimization on all dependencies in the file and return a Code[] array.

---

### 10. Code Generation

**User Story:** As a developer, I want the transformed code to preserve the original format (comments, whitespace, etc.) as much as possible. This allows me to check only the actual changes during code review.

#### Acceptance Criteria

1. IF options.preserveComments is true THEN the system SHALL preserve comments in the original code.

2. IF options.preserveComments is not specified THEN the system SHALL preserve comments with a default value of true.

3. IF options.formatOutput is true THEN the system SHALL format the output code.

4. IF options.formatOutput is not specified THEN the system SHALL maintain the original format with a default value of false.

5. WHEN generating code THEN the system SHALL adjust the indentation of moved elements to fit the new location.

---

### 11. Error Handling

**User Story:** As a developer, I want to receive clear error information and possible solutions when a move fails. This allows me to quickly diagnose and resolve problems.

#### Acceptance Criteria

1. IF file parsing fails THEN the system SHALL return a Result including the parsing error location and message.

2. IF the selector does not find a valid element THEN the system SHALL return an error with selector information.

3. IF the move is not possible THEN MoveAnalysis.suggestedFixes SHALL suggest possible solutions.

4. WHEN an error occurs THEN Result.success SHALL be false and analysis.reason shall include detailed information.

5. IF circular dependencies occur during cross-file movement THEN the system SHALL return an error including the circular dependency path.

---

### 12. Performance Requirements (non-functional)

**User Story:** As a developer, I want fast responses even in large codebases. This enables real-time feedback when integrated with IDEs.

#### Acceptance Criteria

1. WHEN performing a move in a single file (under 1000 lines) THEN the system SHALL return results within 100ms.

2. WHEN performing a move in multiple files (under 10 files, each under 1000 lines) THEN the system SHALL return results within 500ms.

3. WHEN only canMove is called THEN the system SHALL complete within 20% of the time for a full move operation.

4. WHILE parsing files THEN the system SHALL maintain memory usage within 10 times the file size.

---

### 13. Type Safety (non-functional)

**User Story:** As a developer, I want to receive full type support in TypeScript projects. This allows me to discover errors at compile time.

#### Acceptance Criteria

1. WHEN importing the library THEN the system SHALL provide TypeScript type definitions for all public APIs.

2. WHEN using the Move enum THEN the system SHALL perform type checking for Inside, Before, After values.

3. WHEN using the Selector type THEN the system SHALL support line/column format and path format as union types.

4. WHEN providing Options THEN the system SHALL express that all option fields are optional (optional) as types.

---

## Appendix: Type Definitions

```typescript
import { regraft, canMove, move, analyze, optimize, Move } from 'regrafter';

// Integrated API
regraft(
  files: string[],
  from: Selector,
  to: Selector,
  mode: Move,
  options?: Options
): Result;

// Individual APIs
canMove(files: string[], from: Selector, to: Selector, mode: Move): boolean;
move(files: string[], from: Selector, to: Selector, mode: Move): Code[];
analyze(files: string[], from: Selector, to: Selector, mode: Move): MoveAnalysis;
optimize(files: string[]): Code[];

enum Move {
  Inside = "inside",
  Before = "before",
  After = "after"
}

type Selector =
  | { file: string; line: number; column: number }
  | { file: string; path: string };

interface Options {
  optimize?: boolean;        // default: true
  dryRun?: boolean;          // default: false
  preserveComments?: boolean; // default: true
  formatOutput?: boolean;    // default: false
}

interface Result {
  success: boolean;
  codes: Code[];
  analysis: MoveAnalysis;
}

interface Code {
  file: string;
  content: string;
  changed: boolean;
}

interface MoveAnalysis {
  canMove: boolean;
  reason?: string;
  dependencies: Dependency[];
  hoistedDeps: Dependency[];
  suggestedFixes?: SuggestedFix[];
}

interface Dependency {
  symbol: string;
  origin: string;
  type: 'Hook' | 'Variable' | 'Import' | 'Prop';
  scope: string;
}

interface SuggestedFix {
  description: string;
  action: string;
}
```

---

*Document Version: 2.0*
*Date: 2025-12-15*
