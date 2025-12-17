# Comment Preservation Unit Test Cases

## Test File

`comment-preservation.test.ts`

## Test Purpose

Verify that the CodeGenerator correctly preserves all types of comments during code generation when `preserveComments: true` (default), and correctly strips comments when `preserveComments: false`. This ensures that moved code elements maintain their documentation and inline comments.

## Test Cases Overview

| Case ID | Feature Description                | Test Type     |
| ------- | ---------------------------------- | ------------- |
| CP-01   | Comments above moved element       | Positive Test |
| CP-02   | JSDoc comments                     | Positive Test |
| CP-03   | Inline comments                    | Positive Test |
| CP-04   | Trailing comments                  | Positive Test |
| CP-05   | Comments inside moved elements     | Positive Test |
| CP-06   | preserveComments: false option     | Negative Test |
| CP-07   | Multiple comment types             | Positive Test |
| CP-08   | Comment position preservation      | Positive Test |

## Detailed Test Steps

### CP-01: Comments Above Moved Element

**Test Purpose**: Verify that leading comments (single-line and multi-line) above JSX elements are preserved during code generation.

**Test Data Preparation**:
- Create JSX code with single-line comment above element: `{/* Comment */}`
- Create JSX code with multi-line comment above element
- Parse code to AST

**Test Steps**:
1. Parse JSX code containing element with leading comment
2. Generate code from AST with default options (preserveComments: true)
3. Verify generated code contains the comment
4. Verify comment appears before the element

**Expected Results**:
- Generated code contains `{/* Comment */}`
- Comment appears in correct position above element
- No errors in generation result

### CP-02: JSDoc Comments

**Test Purpose**: Verify that JSDoc-style block comments (/** ... */) are preserved for functions, classes, and other documented elements.

**Test Data Preparation**:
- Create function with JSDoc comment
- Create component with JSDoc comment
- Parse code to AST

**Test Steps**:
1. Parse code containing JSDoc documentation
2. Generate code from AST
3. Verify JSDoc comment is present
4. Verify JSDoc formatting is maintained (/** */)

**Expected Results**:
- Generated code contains complete JSDoc comment
- JSDoc opening `/**` and closing `*/` are preserved
- Multi-line JSDoc structure is maintained
- All JSDoc tags (@param, @returns, etc.) are preserved

### CP-03: Inline Comments

**Test Purpose**: Verify that inline comments (/* ... */ within expressions) are preserved.

**Test Data Preparation**:
- Create JSX with inline comment in attribute: `<Source /* inline */ />`
- Create code with inline comment in expression
- Parse code to AST

**Test Steps**:
1. Parse code containing inline comments
2. Generate code from AST
3. Verify inline comment appears in generated code
4. Verify comment position relative to code is maintained

**Expected Results**:
- Inline comments are present in generated code
- Comment position matches original (within expression/attribute)
- No syntax errors in generated code

### CP-04: Trailing Comments

**Test Purpose**: Verify that trailing comments (after an element on same or next line) are handled correctly.

**Test Data Preparation**:
- Create element with comment after it: `<Source />`  `{/* After */}`
- Create code with end-of-line comment: `const x = 1; // trailing`
- Parse code to AST

**Test Steps**:
1. Parse code with trailing comments
2. Generate code from AST
3. Verify trailing comment is present
4. Verify comment appears after the element

**Expected Results**:
- Trailing comments are preserved
- Comment position is maintained after the element
- Both JSX and JavaScript trailing comments work

### CP-05: Comments Inside Moved Elements

**Test Purpose**: Verify that comments nested within JSX elements (children comments) are preserved.

**Test Data Preparation**:
- Create JSX element with comment as child:
  ```jsx
  <div>
    {/* Inner comment */}
    <span>Content</span>
  </div>
  ```
- Parse code to AST

**Test Steps**:
1. Parse JSX with nested comments
2. Generate code from AST
3. Verify inner comment is preserved
4. Verify nesting structure is maintained

**Expected Results**:
- Inner comments appear in generated code
- Comment remains as child of parent element
- Indentation and structure preserved

### CP-06: preserveComments: false Option

**Test Purpose**: Verify that all comments are stripped when preserveComments is explicitly set to false.

**Test Data Preparation**:
- Create code with multiple comment types (leading, trailing, inline, JSDoc)
- Parse code to AST

**Test Steps**:
1. Parse code containing various comments
2. Generate code with option: `{ preserveComments: false }`
3. Verify no comments appear in generated code
4. Verify code functionality is preserved (syntax still valid)

**Expected Results**:
- Generated code contains no comments
- Generated code is syntactically valid
- No errors in generation result
- Code logic/structure is unchanged (only comments removed)

### CP-07: Multiple Comment Types

**Test Purpose**: Verify that multiple comment types can coexist and all are preserved correctly.

**Test Data Preparation**:
- Create component with:
  - JSDoc comment above component
  - Leading comment above JSX element
  - Inline comment in attribute
  - Trailing comment after element
- Parse code to AST

**Test Steps**:
1. Parse code with multiple comment types
2. Generate code from AST
3. Verify all comment types are present
4. Verify each comment appears in correct position

**Expected Results**:
- All comment types present in generated code
- Each comment type in correct position
- No comment duplication or loss
- Code structure maintained

### CP-08: Comment Position Preservation

**Test Purpose**: Verify that comments maintain their relative position to code elements after generation.

**Test Data Preparation**:
- Create code with comments at various positions:
  - Before first element
  - Between elements
  - After last element
- Parse code to AST

**Test Steps**:
1. Parse code with positioned comments
2. Generate code from AST
3. Compare comment positions in output to input
4. Verify comments didn't move to wrong locations

**Expected Results**:
- Comments appear in same relative positions
- Before/between/after relationships maintained
- No comments attached to wrong elements

## Test Considerations

### Mock Strategy

- Use real `@babel/parser` to parse code (no mocking needed)
- Use real `@babel/generator` via CodeGenerator (integration test)
- No external dependencies to mock

### Boundary Conditions

- Empty comments: `{/* */}` - should be preserved
- Very long comments - should not be truncated
- Comments with special characters - should be escaped properly
- Nested comment markers (edge case) - should handle gracefully
- Comments at start/end of file - should be preserved

### Code Generation Testing

- Test with both JSX and TypeScript syntax
- Test with various indentation levels
- Test that comments don't break syntax
- Test that sourcemap generation works with comments

## Implementation Notes

### Current Implementation

The `CodeGenerator` class already has:
- `preserveComments` option (default: true)
- Comment extraction/attachment methods
- Integration with `@babel/generator`

### Configuration

The generator passes the `comments` option to `@babel/generator`:

```typescript
const babelGeneratorOptions = {
  comments: options.preserveComments,
  // ... other options
};
```

### Expected Behavior

Based on the implementation:
- Comments should be preserved by default
- Setting `preserveComments: false` should strip all comments
- Babel handles comment attachment automatically during generation
- Leading, trailing, and inner comments should all work

## Success Criteria

All tests pass with:
1. Comments preserved when `preserveComments: true` (default)
2. All comment types supported (JSDoc, single-line, multi-line, inline)
3. Comment positions maintained correctly
4. Comments stripped when `preserveComments: false`
5. No syntax errors in generated code
6. No regressions in existing tests
