# API Utility Functions Test Cases

## Test File

`api-utils.test.ts`

## Test Purpose

Comprehensive unit tests for utility functions extracted in Phase 1 refactoring:
1. `parseAllFiles()` - Parse multiple files and return AST map
2. `generateCodeForFiles()` - Generate code for all files with change tracking

## Test Coverage Summary

### Coverage Results

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `parse-utils.ts` | 100% | 100% | 100% | 100% |
| `generation-utils.ts` | 100% | 100% | 100% | 100% |

**Total Test Cases**: 38
**All Tests**: PASSING ✓

## Detailed Test Cases

### parseAllFiles() Tests (22 test cases)

#### Success Cases (6 tests)
- **PU-01**: Parse single valid file successfully
- **PU-02**: Parse multiple valid files successfully
- **PU-03**: Parse JSX code correctly
- **PU-04**: Parse TypeScript code with type annotations
- **PU-05**: Parse files with React hooks
- **PU-06**: Parse files with imports and exports

#### Error Cases (6 tests)
- **PU-07**: Return Err for invalid syntax
- **PU-08**: Return Err for invalid JSX syntax
- **PU-09**: Return Err for invalid TypeScript syntax
- **PU-10**: Return Err on first parse error when multiple files exist
- **PU-11**: Return Err for unexpected tokens
- **PU-12**: Include file path in error message

#### Empty Input Handling (3 tests)
- **PU-13**: Handle empty array successfully
- **PU-14**: Return Err for empty file content
- **PU-15**: Return Err for whitespace-only file content

#### Edge Cases (4 tests)
- **PU-16**: Handle files with special characters in paths
- **PU-17**: Handle file with many statements (100+ declarations)
- **PU-18**: Handle files with unicode content
- **PU-19**: Handle modern JavaScript features (destructuring, spread, optional chaining)

#### Result Monad Pattern (3 tests)
- **PU-20**: Return Ok Result with correct structure
- **PU-21**: Return Err Result with correct structure
- **PU-22**: Be chainable with other Result operations

### generateCodeForFiles() Tests (16 test cases)

#### Success Cases (6 tests)
- **GC-01**: Generate code for a single file successfully
- **GC-02**: Generate code for multiple files
- **GC-03**: Mark only the source file as changed
- **GC-04**: Include original content only for changed file
- **GC-05**: Preserve JSX structure in generated code
- **GC-06**: Handle files with imports and exports

#### Empty Input Handling (2 tests)
- **GC-07**: Handle empty files array
- **GC-08**: Skip files not in parsedFiles map

#### Edge Cases (3 tests)
- **GC-09**: Handle files with special characters in paths
- **GC-10**: Handle source file that does not exist in files array
- **GC-11**: Maintain code consistency across generate calls

#### Result Monad Pattern (2 tests)
- **GC-12**: Return Ok Result with correct structure
- **GC-13**: Be chainable with other Result operations

#### Error Handling (1 test)
- **GC-14**: Return Err when generator fails

#### Integration Tests (2 tests)
- **GC-15**: Work seamlessly with parseAllFiles output
- **GC-16**: Handle complete parse-generate pipeline

## Edge Cases Discovered

### parseAllFiles()

1. **Empty Source Files**: Parser correctly rejects empty or whitespace-only files with E004 error code
2. **Invalid Syntax**: Fails fast on first parse error in multi-file scenarios
3. **Unicode Content**: Successfully handles emoji and international characters
4. **Special File Paths**: Correctly processes paths with subdirectories and special characters
5. **Large Files**: Can handle files with 100+ statements without performance issues
6. **Modern JavaScript**: Supports latest ECMAScript features (destructuring, optional chaining, nullish coalescing)

### generateCodeForFiles()

1. **Missing AST Entries**: Gracefully skips files not present in parsedFiles map
2. **Changed File Tracking**: Correctly identifies and marks only the modified source file
3. **Original Content**: Stores original content only for changed files to save memory
4. **Empty File List**: Returns empty array for empty input without errors
5. **Generator Failures**: Properly propagates generator errors through Result monad
6. **Idempotency**: Generates identical code for the same input across multiple calls

## Mock Strategy

### parseAllFiles()
- Uses real `parseFile()` function from parser module
- No mocking required - tests with real Babel parser

### generateCodeForFiles()
- Helper function `createParsedFiles()` creates real AST maps
- Error path tested with mock generator that returns Err
- Integration tests use real `CodeGenerator` instance

## Boundary Conditions

1. **Empty Arrays**: Both functions handle empty input gracefully
2. **Missing Files**: `generateCodeForFiles()` skips missing entries without failing
3. **Parse Errors**: `parseAllFiles()` fails fast on first error (fail-fast pattern)
4. **Generator Errors**: Properly propagates errors through Result monad

## Asynchronous Operations

Both functions are synchronous. No async testing required.

## Result Monad Pattern Verification

All tests verify:
- Correct Result structure (ok/error discriminated union)
- Type-safe error handling with isErr/isOk guards
- Chainability with other Result operations
- Error propagation through function boundaries

## Test Execution

```bash
# Run all tests
npm test -- src/api/__tests__/api-utils.test.ts

# Run with coverage
npm run test:coverage -- src/api/__tests__/api-utils.test.ts

# Watch mode
npm run test:watch -- src/api/__tests__/api-utils.test.ts
```

## Notes

- All tests follow AAA pattern (Arrange-Act-Assert)
- Test names use descriptive "should" statements
- Error tests verify both error structure and error messages
- Integration tests validate the complete parse → generate pipeline
- 100% code coverage achieved for both utility functions
