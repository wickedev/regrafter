# Extract Requirements Document

## Introduction

Extract is the inverse function of inline, designed to group selected JSX elements and extract them into a new React component. Through dependency analysis, it automatically moves or passes related code as props to ensure safe component extraction.

### Core Values

- **Automation**: Automatically analyze and handle dependencies
- **Safety**: Code must always build successfully after extraction
- **Flexibility**: Support both same-file extraction and extraction to different files
- **Accuracy**: Identify and handle only necessary dependencies precisely

---

## Requirements

### 1. Basic Component Extraction

**User Story:** As a developer, I want to extract selected JSX nodes (elements, text, expressions) into a new component so that I can modularize code into reusable units.

#### Acceptance Criteria

1. WHEN `extract(files, selectors, componentName, targetFile?)` function is called THEN the system SHALL extract the selected nodes into a new component.

2. WHEN nodes are extracted THEN the system SHALL insert usage of the new component (JSX element) at the original location.

3. WHEN targetFile is not provided THEN the system SHALL create the component in the same file as the source.

4. WHEN targetFile is provided THEN the system SHALL create the component in that file and add necessary exports/imports.

5. IF componentName already exists THEN the system SHALL return an error.

6. WHEN extraction is complete THEN the system SHALL return an ExtractResult object containing codes(Code[]), componentName(string), componentFile(string), and propsGenerated(string[]) fields.

---

### 2. Node Selection (JSX Element, Text, Expression)

**User Story:** As a developer, I want to flexibly select JSX nodes for extraction so that I can extract various types of nodes including elements, text, and expressions.

#### Acceptance Criteria

1. WHEN selectors array provides existing Selector types (PositionSelector | PathSelector) THEN the system SHALL use those selectors to identify nodes.

2. WHEN selecting a JSX element with PositionSelector(file, line, column) THEN the system SHALL automatically infer the entire element from the opening tag location to the closing tag.

3. WHEN selecting a node with PathSelector THEN the system SHALL directly select the JSX node using the AST path.

4. WHEN selecting a JSX element (JSXElement) THEN the system SHALL extract that element.

5. WHEN selecting JSX text (JSXText) THEN the system SHALL extract that text node.

6. WHEN selecting a JSX expression (JSXExpressionContainer, e.g., `{variable}`, `{count + 1}`) THEN the system SHALL extract that expression.

7. WHEN a single Selector is provided in the selectors array THEN the system SHALL extract only that node.

8. WHEN multiple Selectors are provided in the selectors array THEN the system SHALL wrap all selected nodes in a Fragment and extract them.

9. IF selected nodes are not siblings THEN the system SHALL return an error.

10. IF there are unselected nodes between selected nodes THEN the system SHALL return an error or display a warning.

11. WHEN the selected node is not a valid JSX node (Element, Text, Expression) THEN the system SHALL return a clear error message.

12. WHEN selecting a self-closing tag (e.g., `<div />`) THEN the system SHALL treat it as a single element.

13. WHEN selecting an element with opening and closing tags (e.g., `<div>...</div>`) THEN the system SHALL recognize the entire range from the opening tag position to the closing tag as the element.

14. WHEN selecting a mixed area of text and expressions (e.g., `Hello {name}`) THEN the system SHALL extract all nodes in that area together.

---

### 3. Automatic Dependency Analysis

**User Story:** As a developer, I want to automatically analyze all dependencies referenced by the nodes to extract so that I can safely extract components without manually tracking dependencies.

#### Acceptance Criteria

1. WHEN extracting JSX nodes THEN the system SHALL identify Variable dependencies (const, let, var declarations).

2. WHEN extracting JSX nodes THEN the system SHALL identify Hook dependencies (useState, useEffect, useContext, useRef, etc.).

3. WHEN extracting JSX nodes THEN the system SHALL identify Import dependencies (external module references).

4. WHEN extracting JSX nodes THEN the system SHALL identify Function dependencies (function declarations and expressions).

5. WHEN extracting JSX nodes THEN the system SHALL identify Prop dependencies (values passed from parent component).

6. WHEN extracting JSX nodes THEN the system SHALL identify Context dependencies (values accessed via useContext).

7. WHEN extracting JSX expressions (`{variable}`) THEN the system SHALL analyze dependencies of all identifiers referenced within the expression.

8. IF a dependency includes eval() or dynamic code execution THEN the system SHALL mark that dependency as unanalyzable and return a warning.

---

### 4. Dependency Handling Strategy

**User Story:** As a developer, I want analyzed dependencies to be handled appropriately so that the extracted component works correctly.

#### Acceptance Criteria

1. WHEN a Variable dependency is only used in the extracted element THEN the system SHALL move that variable inside the new component.

2. WHEN a Variable dependency is used in both the extracted element and the original location THEN the system SHALL pass that variable as props.

3. WHEN a Hook dependency is only used in the extracted element THEN the system SHALL move that Hook inside the new component.

4. WHEN a Hook dependency is used in both the extracted element and the original location THEN the system SHALL pass the Hook's return value as props.

5. WHEN a Function dependency is only used in the extracted element THEN the system SHALL move that function inside the new component.

6. WHEN a Function dependency is used in both the extracted element and the original location THEN the system SHALL pass that function as props.

7. WHEN Import dependencies are needed THEN the system SHALL add the same import statements to the new component file.

8. WHEN Prop dependencies are needed THEN the system SHALL add those props to the new component's props interface.

9. WHEN Context dependencies are needed THEN the system SHALL add useContext calls inside the new component.

---

### 5. Props Interface Generation

**User Story:** As a developer, I want the props interface of the extracted component to be automatically generated so that I can maintain TypeScript type safety.

#### Acceptance Criteria

1. WHEN extracting a component from a TypeScript file THEN the system SHALL generate a props interface.

2. WHEN props are needed THEN the system SHALL infer the type of each prop and add it to the interface.

3. IF type inference is impossible THEN the system SHALL use `any` type and display a warning.

4. WHEN there are no props THEN the system SHALL not generate a props interface.

5. WHEN extracting a component from a JavaScript file THEN the system SHALL only perform destructuring without a props interface.

6. WHEN extraction is complete THEN ExtractResult.propsGenerated SHALL contain a list of generated prop names.

---

### 6. Same-File Extraction

**User Story:** As a developer, I want to extract a component within the same file so that I can break large components into smaller units.

#### Acceptance Criteria

1. WHEN targetFile is not provided or is the same as the source file THEN the system SHALL create the new component in the same file.

2. WHEN creating a new component THEN the system SHALL place it before or after the original component definition.

3. IF options.insertPosition is 'before' THEN the system SHALL place the new component before the original component definition.

4. IF options.insertPosition is 'after' or not specified THEN the system SHALL place the new component after the original component definition.

5. WHEN extracting to the same file THEN the system SHALL not add import statements.

6. WHEN dependencies are at the top level of the source file THEN the system SHALL reference them without moving them.

---

### 7. Extract to Different File

**User Story:** As a developer, I want to extract elements to a different file so that I can separate components into reusable modules.

#### Acceptance Criteria

1. WHEN targetFile is provided and different from the source file THEN the system SHALL create the new component in that file.

2. WHEN extracting to a different file THEN the system SHALL add an import statement for the new component in the source file.

3. WHEN extracting to a different file THEN the system SHALL add an export statement for the new component in the target file.

4. IF the target file does not exist THEN the system SHALL create a new file with necessary imports and component definition.

5. IF the target file already exists THEN the system SHALL append the new component to the end of the existing file.

6. WHEN Import dependencies are needed THEN the system SHALL add the same import statements to the target file.

7. WHEN moved dependencies (variables, functions, hooks) are no longer used in the source file THEN the system SHALL remove that code from the source file.

8. IF moved dependencies are still used elsewhere in the source file THEN the system SHALL keep them in the source file and copy them to the new component.

---

### 8. Hook Handling

**User Story:** As a developer, I want to safely extract elements containing React Hooks so that I can extract components without violating Hook rules.

#### Acceptance Criteria

1. WHEN a Hook is only used in the extracted element THEN the system SHALL move that Hook to the top level of the new component.

2. WHEN a Hook is inside conditional logic THEN the system SHALL move the Hook to the top level and apply conditional logic to the Hook's return value.

3. WHEN a Hook is used in both the original and extracted element THEN the system SHALL keep the Hook in the original and pass its return value as props.

4. WHEN a useState Hook is moved THEN the system SHALL handle both the state and setter function.

5. WHEN a useEffect Hook is moved THEN the system SHALL also analyze and handle dependencies in the dependency array.

6. WHEN a useRef Hook is moved THEN the system SHALL either move the ref object to the new component or pass it as props.

7. WHEN a Custom Hook is moved THEN the system SHALL also handle the import for that Hook.

---

### 9. Component Structure Generation

**User Story:** As a developer, I want the extracted component to have proper React component structure so that it can be used immediately without additional modifications.

#### Acceptance Criteria

1. WHEN creating a component THEN the system SHALL generate it in Function Declaration or Arrow Function format.

2. IF options.componentStyle is 'function' THEN the system SHALL generate it in Function Declaration format.

3. IF options.componentStyle is 'arrow' or not specified THEN the system SHALL generate it in Arrow Function format.

4. WHEN props are needed THEN the system SHALL add the props parameter in destructuring format.

5. WHEN Hooks are included THEN the system SHALL place Hooks at the top level of the component.

6. WHEN extracted JSX contains multiple elements THEN the system SHALL wrap them with React.Fragment or <></>.

7. WHEN extracted JSX is a single element THEN the system SHALL return it without Fragment.

8. WHEN using TypeScript THEN the system SHALL add appropriate type annotations.

---

### 10. Name Generation and Conflict Prevention

**User Story:** As a developer, I want component names to be automatically suggested or conflicts prevented so that I can safely extract components without name collisions.

#### Acceptance Criteria

1. WHEN componentName is not provided THEN the system SHALL suggest a meaningful name.

2. WHEN suggesting a name THEN the system SHALL generate it based on the content of the extracted element.

3. IF the suggested name already exists THEN the system SHALL add a numeric suffix to make it unique.

4. WHEN the user-provided componentName already exists THEN the system SHALL return an error.

5. IF options.allowNameConflict is true THEN the system SHALL allow name conflicts and only display a warning.

6. WHEN validating names THEN the system SHALL also check other component and function names in the same file.

---

### 11. Extraction Feasibility Validation

**User Story:** As a developer, I want to validate extraction feasibility before actually extracting so that I can avoid unnecessary computation and provide immediate feedback to users.

#### Acceptance Criteria

1. WHEN `canExtract(files, selectors, componentName)` function is called THEN the system SHALL return extraction feasibility as a boolean.

2. IF the selected node is invalid THEN the system SHALL return false.

3. IF componentName already exists THEN the system SHALL return false.

4. IF dependencies include unanalyzable dynamic code THEN the system SHALL return false.

5. IF extraction is not possible THEN ExtractAnalysis.reason SHALL clearly explain why it's not possible.

6. WHEN `analyzeExtract(files, selectors)` function is called THEN the system SHALL return only dependency analysis results without actual extraction.

---

### 12. Options Configuration

**User Story:** As a developer, I want to control extraction behavior in detail so that I can extract according to project coding style and requirements.

#### Acceptance Criteria

1. WHEN options.componentStyle is provided THEN the system SHALL create the component in that style.

2. WHEN options.insertPosition is provided THEN the system SHALL place the component at that position.

3. WHEN options.exportType is 'named' THEN the system SHALL use named export.

4. WHEN options.exportType is 'default' THEN the system SHALL use default export.

5. IF options.exportType is not specified THEN the system SHALL use default value 'named'.

6. WHEN options.includeTypes is true THEN the system SHALL generate TypeScript type definitions.

7. IF options.includeTypes is false or it's a JavaScript file THEN the system SHALL generate without type definitions.

8. WHEN options.preserveComments is true THEN the system SHALL preserve comments from extracted elements and dependencies.

9. WHEN options.dryRun is true THEN the system SHALL return only analysis results without actual code transformation.

---

### 13. Result Return

**User Story:** As a developer, I want to receive detailed information about extraction results so that I can understand exactly what changes occurred.

#### Acceptance Criteria

1. WHEN extraction succeeds THEN the system SHALL return a Result<ExtractResult, RegraffError> object.

2. WHEN returning results THEN ExtractResult.codes SHALL contain contents of all modified files.

3. WHEN returning results THEN ExtractResult.componentName SHALL contain the created component name.

4. WHEN returning results THEN ExtractResult.componentFile SHALL contain the file path where the component was created.

5. WHEN returning results THEN ExtractResult.propsGenerated SHALL contain the list of generated props.

6. WHEN returning results THEN ExtractResult.dependenciesMoved SHALL contain the list of moved dependencies.

7. WHEN returning results THEN ExtractResult.analysis SHALL contain detailed dependency analysis information.

8. IF extraction fails THEN the system SHALL return a RegraffError object with clear error message and suggestions.

---

### 14. Code Generation Quality

**User Story:** As a developer, I want generated code to be readable and follow the project's coding style so that it can be used immediately without additional formatting.

#### Acceptance Criteria

1. WHEN generating code THEN the system SHALL use appropriate indentation and line breaks.

2. WHEN generating props destructuring THEN the system SHALL sort alphabetically.

3. WHEN generating import statements THEN the system SHALL sort by groups (React imports, library imports, local imports).

4. WHEN creating a component THEN the system SHALL add JSDoc comments.

5. IF the original code has comments and options.preserveComments is true THEN the system SHALL preserve those comments.

6. WHEN generating TypeScript code THEN the system SHALL ensure type safety.

---

### 15. Error Handling and Validation

**User Story:** As a developer, I want to clearly understand errors that occur during extraction so that I can quickly resolve issues.

#### Acceptance Criteria

1. IF no node is selected THEN the system SHALL return 'EMPTY_SELECTION' error.

2. IF componentName is invalid THEN the system SHALL return 'INVALID_COMPONENT_NAME' error.

3. IF selected nodes are not siblings THEN the system SHALL return 'NON_SIBLING_NODES' error.

4. IF the selected node is not a valid JSX node (Element, Text, Expression) THEN the system SHALL return 'INVALID_NODE_TYPE' error.

5. IF there are unanalyzable dependencies THEN the system SHALL return 'UNANALYZABLE_DEPENDENCY' error and include that dependency information.

6. IF file creation fails THEN the system SHALL return 'FILE_CREATION_FAILED' error.

7. WHEN an error occurs THEN RegraffError.suggestions SHALL propose solutions.

8. WHEN warnings occur THEN ExtractResult.warnings SHALL contain a list of warning messages.

---

## API Design

### Function Signatures

```typescript
/**
 * Extract selected JSX nodes (elements, text, expressions) into a new component
 *
 * @param files - Array of file inputs with path and content
 * @param selectors - Array of Selector (PositionSelector | PathSelector) for nodes to extract
 * @param componentName - Name for the new component
 * @param targetFile - Optional target file path (defaults to source file)
 * @param options - Optional extraction options
 * @returns Result containing transformed codes and extraction info, or error
 *
 * @example
 * // Extract single element using position selector
 * const result = extract(
 *   files,
 *   [{ file: 'App.tsx', line: 10, column: 5 }],
 *   'UserProfile'
 * );
 *
 * @example
 * // Extract multiple nodes (elements + text + expressions) using position selectors
 * const result = extract(
 *   files,
 *   [
 *     { file: 'App.tsx', line: 10, column: 7 },  // Text: "Hello"
 *     { file: 'App.tsx', line: 10, column: 13 }, // Expression: {name}
 *     { file: 'App.tsx', line: 15, column: 5 }   // Element: <button>
 *   ],
 *   'Greeting'
 * );
 *
 * @example
 * // Extract to different file
 * const result = extract(
 *   files,
 *   [{ file: 'App.tsx', line: 10, column: 5 }],
 *   'UserProfile',
 *   'components/UserProfile.tsx'
 * );
 *
 * @example
 * // Extract JSX expression
 * const result = extract(
 *   files,
 *   [{ file: 'App.tsx', line: 8, column: 10 }], // {count > 0 && <Badge />}
 *   'ConditionalBadge'
 * );
 */
export function extract(
  files: FileInput[],
  selectors: Selector[],
  componentName: string,
  targetFile?: string,
  options?: ExtractOptions
): Result<ExtractResult, RegraffError>;

/**
 * Check if nodes can be extracted
 */
export function canExtract(
  files: FileInput[],
  selectors: Selector[],
  componentName: string,
  targetFile?: string
): boolean;

/**
 * Analyze what would happen if nodes were extracted
 */
export function analyzeExtract(
  files: FileInput[],
  selectors: Selector[],
  targetFile?: string
): Result<ExtractAnalysis, RegraffError>;
```

### Type Definitions

```typescript
/**
 * Selector type is reused from existing types
 * - PositionSelector: { file: string, line: number, column: number }
 * - PathSelector: { file: string, path: string }
 */
import type { Selector } from "./types/public.js";

export interface ExtractOptions {
  /** Component style: 'function' | 'arrow' */
  componentStyle?: "function" | "arrow";

  /** Where to insert new component: 'before' | 'after' */
  insertPosition?: "before" | "after";

  /** Export type: 'named' | 'default' */
  exportType?: "named" | "default";

  /** Include TypeScript type definitions */
  includeTypes?: boolean;

  /** Preserve comments from extracted code */
  preserveComments?: boolean;

  /** Dry run mode (analysis only) */
  dryRun?: boolean;

  /** Allow component name conflicts */
  allowNameConflict?: boolean;
}

export interface ExtractResult {
  /** Transformed file contents */
  codes: Code[];

  /** Name of the created component */
  componentName: string;

  /** File containing the created component */
  componentFile: string;

  /** Names of props that were generated */
  propsGenerated: string[];

  /** Dependencies that were moved to the new component */
  dependenciesMoved: DependencyInfo[];

  /** Detailed analysis of the extraction */
  analysis: ExtractAnalysis;

  /** Warning messages (if any) */
  warnings?: string[];
}

export interface ExtractAnalysis {
  /** Whether extraction is possible */
  canExtract: boolean;

  /** Reason if extraction is not possible */
  reason?: string;

  /** All identified dependencies */
  dependencies: Dependency[];

  /** Dependencies to be moved to new component */
  dependenciesToMove: Dependency[];

  /** Dependencies to be passed as props */
  dependenciesToPropsify: Dependency[];

  /** Suggested component name (if not provided) */
  suggestedName?: string;
}

export interface DependencyInfo {
  /** Name of the dependency */
  name: string;

  /** Type of dependency */
  type: DependencyType;

  /** How it was handled: 'moved' | 'propsified' | 'copied' */
  handling: "moved" | "propsified" | "copied";

  /** Original location */
  originalLocation: {
    file: string;
    line: number;
    column: number;
  };

  /** New location (if moved) */
  newLocation?: {
    file: string;
    line: number;
    column: number;
  };
}
```

---

## JSX Node Range Inference Details

### PositionSelector Processing

WHEN PositionSelector(file, line, column) is provided:

1. **Identify Starting Position**: Find the closest JSX node at the given line and column position.

2. **Infer Range by Node Type**:
   - **JSX Element (self-closing)**: For cases like `<div />`, `<Button />`, recognize the entire tag as the range
   - **JSX Element (opening/closing)**: For cases like `<div>...</div>`, recognize the entire range from the opening tag to the closing tag
   - **JSX Text**: For text nodes like `Hello World`, recognize from the start to the end of the text as the range
   - **JSX Expression**: For expressions like `{variable}`, `{count + 1}`, recognize from `{` to `}` as the range
   - **Nested Nodes**: Include all child nodes inside the element in the range

3. **AST Node Mapping**: Return the JSX AST node (JSXElement, JSXText, JSXExpressionContainer) corresponding to the identified range

### Example: JSX Element Extraction

```tsx
// Code example
function App() {
  return (
    <div>
      {" "}
      // line 3, column 5
      <h1>Title</h1>
      <p>Content</p>
    </div> // line 6, column 5
  );
}

// Selector: { file: 'App.tsx', line: 3, column: 5 }
// Inferred range: line 3, column 5 ~ line 6, column 11
// Included content: entire <div> (including children <h1>, <p>)
```

### Example: JSX Text + Expression Extraction

```tsx
// Code example
function App() {
  const name = "John";
  return <div>Hello {name}, welcome! // line 5, column 7</div>;
}

// Selectors: [
//   { file: 'App.tsx', line: 5, column: 7 },   // Text: "Hello "
//   { file: 'App.tsx', line: 5, column: 13 },  // Expression: {name}
//   { file: 'App.tsx', line: 5, column: 19 }   // Text: ", welcome!"
// ]
// Inferred range: "Hello " + {name} + ", welcome!"
// Result: wrap 3 nodes in Fragment and extract
```

### Example: Multiple Node Selection

```tsx
// Code example
function App() {
  const count = 5;
  return (
    <div>
      <h1>Title</h1> // line 4, column 7 You have {count} messages // line 5,
      column 7 (text + expression)
      <footer>End</footer>
    </div>
  );
}

// Selectors: [
//   { file: 'App.tsx', line: 4, column: 7 },  // <h1> element
//   { file: 'App.tsx', line: 5, column: 7 }   // text node (starting point)
// ]
// Inferred range: entire <h1> + entire "You have {count} messages"
// Result: wrap element and text/expression in Fragment and extract
```

### Example: Extract JSX Expression Only

```tsx
// Code example
function App() {
  const count = 5;
  return <div>{count > 0 && <Badge count={count} />} // line 4, column 7</div>;
}

// Selector: { file: 'App.tsx', line: 4, column: 7 }
// Inferred range: entire {count > 0 && <Badge count={count} />}
// Included content: entire JSXExpressionContainer node
// Result: new component including conditional rendering logic
```

---

## Priority and Phased Implementation

### Phase 1: Basic Extraction (MVP)

- Single node extraction (PositionSelector support)
  - JSXElement extraction
  - JSXText extraction
  - JSXExpressionContainer extraction
- Same-file extraction
- Simple Variable dependency handling (pass as props)
- Basic component structure generation
- Automatic JSX node range inference
  - Element: opening tag → closing tag
  - Text: text start → text end
  - Expression: `{` → `}`

### Phase 2: Enhanced Dependency Handling

- Hook dependency handling
- Function dependency handling
- Import dependency handling
- Dependency move vs props decision logic
- PathSelector support

### Phase 3: Advanced Features

- Extract to different file
- TypeScript type generation
- Multiple node extraction (wrap with Fragment)
- Mixed node extraction (Element + Text + Expression)
- Name conflict detection and suggestion

### Phase 4: Optimization and Validation

- Pre-validation of extraction feasibility (canExtract)
- Analysis API (analyzeExtract)
- Code generation quality improvement
- Enhanced error handling

---

## Constraints and Limitations

1. **Dynamic Code Execution**: Code using `eval()`, `Function()`, etc. cannot be analyzed
2. **Complex Type Inference**: Some complex TypeScript types may not be accurately inferred
3. **Circular Dependencies**: Returns error when extraction may cause circular dependencies
4. **Non-Sibling Nodes**: Non-sibling nodes cannot be extracted together
5. **Higher-Order Components**: Limited when extracting nodes inside components wrapped with HOCs
6. **Position Accuracy**: PositionSelector selects the closest JSX node at line/column position, requiring accurate position specification
7. **Text Node Boundaries**: Cannot select only part of consecutive text nodes (can only select by complete text node units)

---

## Non-Functional Requirements

### Performance

- Single file extraction: <100ms
- Cross-file extraction: <500ms
- Dependency analysis: <50ms
- JSX node range inference: <10ms

### Reliability

- Code after extraction must always be compilable
- Semantic behavior after extraction must not change
- JSX node range inference must always return valid JSX nodes (Element, Text, Expression)

### Usability

- Provide clear error messages
- Suggest reasons and solutions when extraction is not possible
- Display progress (optional)

---

## Testing Strategy

### Unit Tests

- Dependency analysis logic
- Props generation logic
- Component structure generation
- Name conflict detection
- **JSX node range inference logic**
  - JSXElement: self-closing tag recognition
  - JSXElement: opening/closing tag pair recognition
  - JSXText: text node range recognition
  - JSXExpressionContainer: expression range recognition (`{` ~ `}`)
  - Nested node handling
  - Mixed node (Text + Expression) handling

### Integration Tests

- Same-file extraction scenarios
- Different-file extraction scenarios
- Various dependency combinations
- TypeScript vs JavaScript
- **PositionSelector vs PathSelector**
- **Single vs multiple node extraction**
- **Extraction by node type**
  - Extract JSXElement only
  - Extract JSXText only
  - Extract JSXExpression only
  - Extract mixed nodes (Element + Text + Expression)

### E2E Tests

- Extract from actual project code
- Build and run after extraction
- Verify semantic behavior matches
- **Extract various JSX patterns**
  - Conditional rendering (`{condition && <Element />}`)
  - List rendering (`{items.map(...)}`)
  - Mixed text and expressions
  - Complex nested structures
