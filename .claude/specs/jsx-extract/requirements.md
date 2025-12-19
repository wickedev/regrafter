# Requirements Document - JSX Extract

## Introduction

The Extract feature is the inverse function of inline, a refactoring tool that groups selected JSX elements and extracts them into a new React component. This feature separates parts of existing JSX code into independent components to improve code reusability and enhance component structure.

Core features:
- JSX node selection and grouping (Element, Text, Expression)
- Automatic dependency analysis and handling
- Support for same-file extraction and extraction to different files
- Automatic TypeScript type generation
- Automatic Hook and state management handling

## Requirements

### Requirement 1: JSX Node Selection and Extraction

**User Story:** As a developer, I want to select single or multiple JSX nodes using PositionSelector or PathSelector and extract them into a new component. This allows me to separate complex components into smaller, manageable units.

#### Acceptance Criteria

1. WHEN developer specifies start and end positions of JSX nodes with PositionSelector THEN system SHALL select all JSX nodes in that range
2. WHEN developer specifies JSX node path with PathSelector THEN system SHALL select the JSX node located at that path
3. WHEN developer selects multiple consecutive JSX nodes THEN system SHALL treat all selected nodes as a single group
4. WHEN selected JSX node is one of JSXElement, JSXText, JSXExpressionContainer types THEN system SHALL recognize that node as extractable
5. IF selected range is invalid or contains unextractable nodes THEN system SHALL return clear error message

### Requirement 2: Automatic Dependency Analysis

**User Story:** As a developer, I want variables, functions, Hooks, etc. that the JSX code to extract depends on to be automatically analyzed and handled. This reduces the hassle of manually identifying dependencies and passing them as props.

#### Acceptance Criteria

1. WHEN selected JSX node references external variables THEN system SHALL identify those variables and add them to the list to pass as props
2. WHEN selected JSX node calls external functions THEN system SHALL identify those functions and add them to the list to pass as props
3. WHEN selected JSX node uses React Hooks THEN system SHALL decide whether to move those Hooks to the new component or pass them as props
4. IF dependency is a state variable THEN system SHALL pass both the state and state setter function as props
5. WHEN dependency analysis is complete THEN system SHALL generate props interface
6. IF circular dependency is detected THEN system SHALL abort extraction and return warning message

### Requirement 3: Same-File Component Extraction

**User Story:** As a developer, I want to extract selected JSX code into a new component within the same file. This allows me to separate components while maintaining the file structure.

#### Acceptance Criteria

1. WHEN developer requests same-file extraction THEN system SHALL create new component in the same file as original component
2. WHEN new component is created THEN system SHALL place it before original component definition
3. WHEN new component is created THEN system SHALL replace JSX code at original location with new component call
4. IF TypeScript is in use in original file THEN system SHALL generate Props type for new component and specify type
5. WHEN component name is not specified THEN system SHALL generate meaningful default name (e.g., ExtractedComponent)
6. WHEN extraction is complete THEN system SHALL pass all necessary props to new component call

### Requirement 4: Extract Component to Different File

**User Story:** As a developer, I want to extract selected JSX code to a new file. This allows me to physically separate components and increase reusability.

#### Acceptance Criteria

1. WHEN developer requests extraction to different file and provides target file path THEN system SHALL create new file at specified path
2. IF target file already exists THEN system SHALL add new component to existing file
3. WHEN new file is created THEN system SHALL add all necessary import statements
4. WHEN new file is created THEN system SHALL export component and Props type
5. WHEN original file is updated THEN system SHALL add import statement for new component
6. IF extracted component depends on React or other libraries THEN system SHALL add those import statements to new file
7. WHEN file path is provided as relative path THEN system SHALL resolve path based on original file

### Requirement 5: TypeScript Type Handling

**User Story:** As a developer, I want TypeScript types of extracted component to be automatically generated and correctly applied. This allows me to maintain type safety while refactoring.

#### Acceptance Criteria

1. WHEN original file uses TypeScript THEN system SHALL generate Props interface
2. WHEN Props interface is generated THEN system SHALL accurately infer types of all props
3. IF prop is basic type (string, number, boolean, etc.) THEN system SHALL use that type directly
4. IF prop is complex or custom type THEN system SHALL import that type or define it inline
5. WHEN component uses generic types THEN system SHALL correctly pass generic parameters
6. IF type inference is impossible THEN system SHALL return message requesting explicit type annotation instead of 'any' type

### Requirement 6: React Hook Handling

**User Story:** As a developer, I want Hooks used by extracted JSX code to be handled correctly. This allows me to extract components while adhering to Hook rules.

#### Acceptance Criteria

1. WHEN selected JSX code uses useState THEN system SHALL pass state and setter as props
2. WHEN selected JSX code uses useEffect THEN system SHALL move useEffect to new component
3. WHEN selected JSX code uses useCallback or useMemo THEN system SHALL move those Hooks to new component
4. IF Hook references external dependencies THEN system SHALL pass those dependencies as props
5. WHEN Custom Hook is used THEN system SHALL move Custom Hook call to new component
6. IF Hook's dependency array includes external variables THEN system SHALL pass those variables as props and update dependency array

### Requirement 7: Component Naming and Conflict Prevention

**User Story:** As a developer, I want to specify extracted component name and prevent name collisions. This allows me to write clear and maintainable code.

#### Acceptance Criteria

1. WHEN developer provides component name THEN system SHALL use that name
2. IF component name is not provided THEN system SHALL generate meaningful default name
3. WHEN component name is determined THEN system SHALL verify it follows PascalCase format
4. IF component with same name already exists THEN system SHALL add numeric suffix to generate unique name (e.g., MyComponent2)
5. IF component name violates React rules THEN system SHALL return error message
6. WHEN name collision occurs during extraction to different file THEN system SHALL change import name to resolve collision

### Requirement 8: Code Formatting and Style Preservation

**User Story:** As a developer, I want extracted component to follow existing code style and be formatted correctly. This allows me to maintain a consistent codebase.

#### Acceptance Criteria

1. WHEN new component is created THEN system SHALL preserve indentation style of original file
2. WHEN new component is created THEN system SHALL preserve quote style (single/double) of original file
3. WHEN JSX code is extracted THEN system SHALL apply appropriate indentation
4. IF original code contains comments THEN system SHALL move comments to new component together
5. WHEN import statements are added THEN system SHALL follow existing import statement sorting method
6. WHEN code generation is complete THEN system SHALL generate code compatible with formatters like Prettier or ESLint

### Requirement 9: Error Handling and Validation

**User Story:** As a developer, I want extraction to be performed safely and receive clear feedback when problems occur. This prevents code damage and allows me to quickly resolve issues.

#### Acceptance Criteria

1. WHEN selection range is invalid THEN system SHALL return specific error message
2. IF JSX structure may be damaged THEN system SHALL abort extraction and warn
3. WHEN file write fails THEN system SHALL return error and not modify original file
4. IF original component generates invalid JSX after extraction THEN system SHALL rollback changes
5. WHEN dependency analysis fails THEN system SHALL return error message explaining failure reason
6. IF type check error occurs THEN system SHALL report type error location and cause
7. WHEN extraction task is complete THEN system SHALL return generated file path and summary of changes

### Requirement 10: API Interface Design

**User Story:** As a developer, I want to use extract feature through intuitive and flexible API. This allows me to utilize feature for various use cases.

#### Acceptance Criteria

1. WHEN extract function is called THEN system SHALL require source file path as mandatory parameter
2. WHEN extract function is called THEN system SHALL require selector (PositionSelector or PathSelector) as mandatory parameter
3. IF new component name is provided THEN system SHALL use that name
4. IF target file path is provided THEN system SHALL perform extraction to different file
5. IF target file path is not provided THEN system SHALL perform same-file extraction
6. WHEN option parameter is provided THEN system SHALL support type generation enable/disable, formatting options, etc.
7. WHEN function succeeds THEN system SHALL return generated component information and list of modified files
8. IF function fails THEN system SHALL throw specific error object

### Requirement 11: Performance and Scalability

**User Story:** As a developer, I want extract feature to work efficiently even with large-scale components and files. This allows me to use feature regardless of project scale.

#### Acceptance Criteria

1. WHEN extraction is performed on large component (1000+ lines) THEN system SHALL complete within 5 seconds
2. WHEN analyzing complex dependency graph THEN system SHALL use memoization to prevent duplicate analysis
3. IF project has many files THEN system SHALL parse only necessary files
4. WHEN AST transformation is performed THEN system SHALL work in memory-efficient manner
5. IF extraction is performed multiple times on same source file THEN system SHALL reuse AST

### Requirement 12: Testability

**User Story:** As a developer, I want extract feature to be thoroughly tested and reliable. This allows me to use a stable refactoring tool.

#### Acceptance Criteria

1. WHEN unit tests are written THEN system SHALL allow independent testing of each major function (node selection, dependency analysis, code generation)
2. WHEN integration tests are written THEN system SHALL allow testing of interactions with actual file system
3. IF edge cases are discovered THEN system SHALL allow adding tests for those cases
4. WHEN tests are executed THEN system SHALL support snapshot tests that can compare expected and actual output
5. IF regression occurs THEN system SHALL allow writing tests that reproduce the bug
