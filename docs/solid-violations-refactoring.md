# SOLID Violations and Refactoring Plan

## Overview

This document analyzes SOLID principle violations in the `src/extract` module and provides a systematic refactoring plan following Kent Beck's "Tidy First" approach.

**Analysis Date:** 2025-12-19
**Module:** src/extract
**Total Lines:** ~3,641 lines across 17 TypeScript files
**Severity:** High - Multiple SRP and DIP violations affecting testability and maintainability

---

## Executive Summary

### Critical Issues Found

| Violation Type | Count | Severity | Impact |
|---------------|-------|----------|--------|
| Single Responsibility (SRP) | 4 | High | Hard to test, maintain, reuse |
| Dependency Inversion (DIP) | 3 | High | Cannot mock; tight coupling |
| Code Duplication | 4 | Medium | Maintenance burden |
| Interface Segregation (ISP) | 2 | Medium | Poor abstraction |
| Open/Closed (OCP) | 2 | Low | Requires modification for extension |

### Key Metrics
- **Classes without interfaces:** 6 (ComponentBuilder, CodeReplacer, ImportManager, etc.)
- **Hard-coded dependencies:** 10 instances across 3 classes
- **Duplicated code blocks:** 4 major instances
- **Oversized classes:** 2 (ExtractDependencyAnalyzer: 527 lines, CodeFormatter: 300 lines)

---

## Detailed Violations

### 1. Single Responsibility Principle (SRP)

#### 1.1 ExtractDependencyAnalyzer (527 lines) - **CRITICAL**

**Location:** `src/extract/extract-dependency-analyzer.ts`

**Problem:** Single class handles 8+ distinct concerns

**Responsibilities Identified:**
1. **Identifier Collection** (lines 108-139)
   - Traverses AST to collect all identifiers used in selected nodes

2. **Import Collection** (lines 144-173)
   - Collects imports from source file

3. **Type Extraction** (lines 244-278)
   - Extracts types from variable/function declarations

4. **Type Alias Resolution** (lines 284-326)
   - Resolves type aliases and interfaces

5. **Scope Checking** (lines 331-340)
   - Determines if identifiers are in local scope

6. **Function Binding Detection** (lines 345-377)
   - Detects if functions use `this` binding or hooks

7. **useState Pattern Detection** (lines 382-424)
   - Identifies React state patterns

8. **Circular Dependency Detection** (lines 430-527)
   - Detects circular dependencies between components

**Code Example:**
```typescript
// Current: All concerns in one class
class ExtractDependencyAnalyzer {
  analyze() { /* 527 lines mixing all concerns */ }
  private collectIdentifiers() { /* ... */ }
  private collectImports() { /* ... */ }
  private extractTypes() { /* ... */ }
  private resolveTypeAliases() { /* ... */ }
  private checkScope() { /* ... */ }
  private detectBindings() { /* ... */ }
  private detectStatePatterns() { /* ... */ }
  private detectCircularDeps() { /* ... */ }
}
```

**Proposed Refactoring:**
```typescript
// Split into focused classes
class IdentifierCollector {
  collect(nodes: NodePath[]): Set<string>
}

class ImportCollector {
  collect(ast: t.File): ImportDeclaration[]
}

class TypeExtractor {
  extract(declaration: Declaration): TypeInfo
}

class BindingAnalyzer {
  analyze(func: Function): BindingInfo
}

class StatePatternDetector {
  detect(nodes: NodePath[]): StatePattern[]
}

class CircularDependencyDetector {
  detect(dependencies: Dependency[]): CircularDep[]
}

// Coordinator (much smaller)
class DependencyAnalyzer {
  constructor(
    private identifierCollector: IdentifierCollector,
    private importCollector: ImportCollector,
    // ... other analyzers
  ) {}

  analyze(nodes: NodePath[], ast: t.File): DependencyInfo {
    // Orchestrate the specialized analyzers
  }
}
```

**Benefits:**
- Each class has single, clear responsibility
- Easy to test each analyzer independently
- Easy to reuse analyzers in different contexts
- Easier to understand and maintain

---

#### 1.2 ExtractOrchestrator (388 lines) - **HIGH**

**Location:** `src/extract/extract-orchestrator.ts`

**Problem:** Orchestration mixed with type conversion logic

**Responsibilities:**
1. **Orchestration** - Coordinating the extract workflow (legitimate)
2. **Type Conversion** - Converting TypeScript AST types to strings (lines 301-386)

**Code Example:**
```typescript
class ExtractOrchestrator {
  orchestrate() { /* orchestration logic */ }
  validate() { /* validation logic */ }
  analyze() { /* analysis logic */ }

  // ❌ This doesn't belong here
  private typeToString(type: t.TSType): string {
    // 54 lines of type conversion logic
    if (t.isTSStringKeyword(type)) return 'string';
    if (t.isTSNumberKeyword(type)) return 'number';
    // ... 50+ more lines
  }

  private qualifiedNameToString(name: t.TSQualifiedName): string {
    // 5 lines
  }
}
```

**Proposed Refactoring:**
```typescript
// Extract type conversion to separate class
class TypeStringifier {
  toString(type: t.TSType): string {
    // All type conversion logic here
  }

  private qualifiedNameToString(name: t.TSQualifiedName): string {
    // Helper methods
  }
}

// Orchestrator uses the stringifier
class ExtractOrchestrator {
  constructor(
    private typeStringifier: TypeStringifier,
    // ... other dependencies
  ) {}

  orchestrate() {
    // Use this.typeStringifier.toString(type)
  }
}
```

---

#### 1.3 CodeFormatter (300 lines) - **MEDIUM**

**Location:** `src/extract/CodeFormatter.ts`

**Problem:** Formatting + multiple style analysis concerns

**Responsibilities:**
1. **Format Orchestration** (lines 48-72)
2. **Indentation Analysis** (lines 115-151)
3. **Quote Style Analysis** (lines 206-213)
4. **Semicolon Analysis** (lines 221-254)
5. **Line Indentation Analysis** (lines 159-174)
6. **GCD Calculation** (lines 182-198)

**Code Example:**
```typescript
class CodeFormatter {
  format() { /* orchestration */ }

  // All style analyzers mixed in one class
  private extractFormattingStyle() {
    const indent = this.analyzeIndentation();
    const quotes = this.analyzeQuotePreference();
    const semi = this.analyzeSemicolonUsage();
    // ...
  }

  private analyzeIndentation() { /* 36 lines */ }
  private analyzeQuotePreference() { /* 7 lines */ }
  private analyzeSemicolonUsage() { /* 33 lines */ }
}
```

**Proposed Refactoring:**
```typescript
// Separate analyzers
class IndentationAnalyzer {
  analyze(code: string): IndentInfo
}

class QuoteStyleAnalyzer {
  analyze(code: string): 'single' | 'double'
}

class SemicolonAnalyzer {
  analyze(code: string): boolean
}

// Formatter coordinates analyzers
class CodeFormatter {
  constructor(
    private indentAnalyzer: IndentationAnalyzer,
    private quoteAnalyzer: QuoteStyleAnalyzer,
    private semiAnalyzer: SemicolonAnalyzer
  ) {}

  format(code: string): string {
    const style = {
      indent: this.indentAnalyzer.analyze(code),
      quotes: this.quoteAnalyzer.analyze(code),
      semi: this.semiAnalyzer.analyze(code)
    };
    return this.applyFormatting(code, style);
  }
}
```

---

#### 1.4 ExtractPlanner (182 lines) - **MEDIUM**

**Location:** `src/extract/extract-planner.ts`

**Problem:** Planning mixed with on-the-fly instantiation of analyzers

**Code Example:**
```typescript
class ExtractPlanner {
  plan(...) {
    // ❌ Creates dependencies on-the-fly
    const scopeManager = new ScopeManager();
    const dependencyAnalyzer = new ExtractDependencyAnalyzer(scopeManager);

    // Later...
    const typeInferrer = new TypeInferrer();

    // Planning logic mixed with instantiation
  }
}
```

**Proposed Refactoring:**
```typescript
class ExtractPlanner {
  constructor(
    private scopeManager: IScopeManager,
    private dependencyAnalyzer: IDependencyAnalyzer,
    private typeInferrer: ITypeInferrer
  ) {}

  plan(...) {
    // Pure planning logic - dependencies injected
  }
}
```

---

### 2. Dependency Inversion Principle (DIP)

#### 2.1 ExtractOrchestrator Constructor - **CRITICAL**

**Location:** `src/extract/extract-orchestrator.ts:52-57`

**Problem:** Hard-coded instantiation of all dependencies

**Current Code:**
```typescript
class ExtractOrchestrator {
  private inputValidator: InputValidator;
  private extractPlanner: ExtractPlanner;
  private extractExecutor: ExtractExecutor;
  private codeFormatter: CodeFormatter;

  constructor() {
    this.inputValidator = new InputValidator();     // ❌
    this.extractPlanner = new ExtractPlanner();     // ❌
    this.extractExecutor = new ExtractExecutor();   // ❌
    this.codeFormatter = new CodeFormatter();       // ❌
  }
}
```

**Issues:**
- Cannot inject mock objects for testing
- Cannot swap implementations
- Tight coupling to concrete classes
- Violates Dependency Inversion Principle

**Proposed Refactoring:**
```typescript
// 1. Define interfaces
interface IInputValidator {
  validate(files: FileInput[], selector: NodeSelector, options?: ExtractOptions): Result<void, RegraffError>;
}

interface IExtractPlanner {
  plan(files: FileInput[], astMap: Map<string, t.File>, selector: NodeSelector, options?: ExtractOptions): Result<ExtractPlan, RegraffError>;
}

interface IExtractExecutor {
  execute(plan: ExtractPlan, astMap: Map<string, t.File>): Result<ExtractResult, RegraffError>;
}

interface ICodeFormatter {
  format(code: string, targetFile: string): string;
}

// 2. Use dependency injection
class ExtractOrchestrator {
  constructor(
    private inputValidator: IInputValidator,
    private extractPlanner: IExtractPlanner,
    private extractExecutor: IExtractExecutor,
    private codeFormatter: ICodeFormatter
  ) {}
}

// 3. Create factory for production use
class ExtractOrchestratorFactory {
  static create(): ExtractOrchestrator {
    return new ExtractOrchestrator(
      new InputValidator(),
      new ExtractPlanner(...),
      new ExtractExecutor(...),
      new CodeFormatter()
    );
  }
}
```

**Benefits:**
- Easy to create mocks for unit testing
- Can swap implementations without changing orchestrator
- Follows SOLID principles
- Explicit dependencies visible in constructor

---

#### 2.2 ExtractExecutor Constructor - **CRITICAL**

**Location:** `src/extract/extract-executor.ts:34-36`

**Current Code:**
```typescript
class ExtractExecutor {
  constructor() {
    this.componentBuilder = new ComponentBuilder();   // ❌
    this.codeReplacer = new CodeReplacer();          // ❌
    this.importManager = new ImportManager();        // ❌
  }
}
```

**Proposed Refactoring:**
```typescript
interface IComponentBuilder {
  build(plan: ExtractPlan): t.File;
}

interface ICodeReplacer {
  replace(ast: t.File, nodes: NodePath[], replacement: t.JSXElement): void;
}

interface IImportManager {
  addImport(ast: t.File, importSpec: ImportSpec): void;
}

class ExtractExecutor {
  constructor(
    private componentBuilder: IComponentBuilder,
    private codeReplacer: ICodeReplacer,
    private importManager: IImportManager
  ) {}
}
```

---

#### 2.3 ExtractPlanner Instantiates Analyzers - **HIGH**

**Location:** `src/extract/extract-planner.ts:96-97, 110`

**Current Code:**
```typescript
class ExtractPlanner {
  plan(...) {
    const scopeManager = new ScopeManager();              // ❌
    const dependencyAnalyzer = new ExtractDependencyAnalyzer(scopeManager); // ❌
    // ...
    const typeInferrer = new TypeInferrer();              // ❌
  }
}
```

**Proposed Refactoring:**
```typescript
class ExtractPlanner {
  constructor(
    private scopeManager: IScopeManager,
    private dependencyAnalyzer: IDependencyAnalyzer,
    private typeInferrer: ITypeInferrer
  ) {}

  plan(...) {
    // Use injected dependencies
  }
}
```

---

### 3. Code Duplication

#### 3.1 File Parsing Logic (3 instances) - **HIGH**

**Locations:**
- `extract-orchestrator.ts:92-104` (orchestrate method)
- `extract-orchestrator.ts:195-202` (validate method)
- `extract-orchestrator.ts:244-256` (analyze method)

**Duplicated Code:**
```typescript
// Appears 3 times with identical logic
const astMap = new Map<string, t.File>();
for (const file of files) {
  const parseResult = parseFile(file.path, file.content);
  if (!parseResult.ok) {
    return err(
      createExtractError(
        ExtractErrorCode.FILE_READ_FAILED,
        `Failed to parse file: ${file.path}`,
        { originalError: parseResult.error }
      )
    );
  }
  astMap.set(file.path, parseResult.value);
}
```

**Proposed Refactoring:**
```typescript
class ExtractOrchestrator {
  private parseFiles(files: FileInput[]): Result<Map<string, t.File>, RegraffError> {
    const astMap = new Map<string, t.File>();

    for (const file of files) {
      const parseResult = parseFile(file.path, file.content);
      if (!parseResult.ok) {
        return err(
          createExtractError(
            ExtractErrorCode.FILE_READ_FAILED,
            `Failed to parse file: ${file.path}`,
            { originalError: parseResult.error }
          )
        );
      }
      astMap.set(file.path, parseResult.value);
    }

    return ok(astMap);
  }

  orchestrate(...) {
    const astMapResult = this.parseFiles(files);
    if (!astMapResult.ok) return astMapResult;
    const astMap = astMapResult.value;
    // ...
  }

  validate(...) {
    const astMapResult = this.parseFiles(files);
    // ...
  }

  analyze(...) {
    const astMapResult = this.parseFiles(files);
    // ...
  }
}
```

---

#### 3.2 Initialization Logic (3 instances) - **MEDIUM**

**Problem:** All three public methods duplicate the same initialization sequence

**Duplicated Pattern:**
```typescript
// Step 1: Validate inputs
const validationResult = this.inputValidator.validate(files, selector, options);
if (!validationResult.ok) return validationResult;

// Step 2: Parse files (see 3.1)
const astMap = ...;

// Step 3: Create plan
const planResult = this.extractPlanner.plan(files, astMap, selector, options);
if (!planResult.ok) return planResult;
```

**Proposed Refactoring:**
```typescript
class ExtractOrchestrator {
  private initialize(
    files: FileInput[],
    selector: NodeSelector,
    options?: ExtractOptions
  ): Result<{ astMap: Map<string, t.File>, plan: ExtractPlan }, RegraffError> {
    // Step 1: Validate
    const validationResult = this.inputValidator.validate(files, selector, options);
    if (!validationResult.ok) return validationResult;

    // Step 2: Parse
    const astMapResult = this.parseFiles(files);
    if (!astMapResult.ok) return astMapResult;

    // Step 3: Plan
    const planResult = this.extractPlanner.plan(files, astMapResult.value, selector, options);
    if (!planResult.ok) return planResult;

    return ok({ astMap: astMapResult.value, plan: planResult.value });
  }

  orchestrate(...) {
    const initResult = this.initialize(files, selector, options);
    if (!initResult.ok) return initResult;

    const { astMap, plan } = initResult.value;
    // Continue with execution...
  }

  validate(...) {
    const initResult = this.initialize(files, selector, options);
    if (!initResult.ok) return initResult;
    // Just return success - validation complete
    return ok(undefined);
  }

  analyze(...) {
    const initResult = this.initialize(files, selector, options);
    if (!initResult.ok) return initResult;

    const { plan } = initResult.value;
    // Return analysis from plan
    return ok(this.planToAnalysis(plan));
  }
}
```

---

#### 3.3 Import Search Logic (2 instances) - **LOW**

**Locations:**
- `import-manager.ts:26-46` (addImport method)
- `import-manager.ts:152-160` (ensureReactImport method)

**Duplicated Pattern:**
```typescript
// In addImport()
let existingImport: t.ImportDeclaration | null = null;
for (const statement of program.body) {
  if (t.isImportDeclaration(statement) && statement.source.value === sourcePath) {
    existingImport = statement;
    break;
  }
}

// In ensureReactImport()
const hasReactImport = program.body.some(
  statement =>
    t.isImportDeclaration(statement) &&
    statement.source.value === 'react' &&
    statement.specifiers.some(...)
);
```

**Proposed Refactoring:**
```typescript
class ImportManager {
  private findImportDeclaration(
    program: t.Program,
    source: string
  ): t.ImportDeclaration | null {
    for (const statement of program.body) {
      if (t.isImportDeclaration(statement) && statement.source.value === source) {
        return statement;
      }
    }
    return null;
  }

  addImport(...) {
    const existingImport = this.findImportDeclaration(program, sourcePath);
    // ...
  }

  ensureReactImport(...) {
    const reactImport = this.findImportDeclaration(program, 'react');
    const hasReactImport = reactImport &&
      reactImport.specifiers.some(...);
    // ...
  }
}
```

---

### 4. Interface Segregation Principle (ISP)

#### 4.1 INodeSelector Interface - **MEDIUM**

**Location:** `src/extract/node-selector.ts:25-44`

**Problem:** Minimal interface but massive implementation mixing 3 concerns

**Current Interface:**
```typescript
interface INodeSelector {
  selectNodes(
    ast: t.File,
    selector: NodeSelector
  ): Result<NodePath<t.JSXElement>[], RegraffError>;

  selectByRange(
    ast: t.File,
    selector: RangeSelector
  ): Result<NodePath<t.JSXElement>[], RegraffError>;
}
```

**Implementation Concerns (324 lines):**
1. Node selection (lines 83-124)
2. Range selection (lines 227-316)
3. Validation (lines 135-218)

**Proposed Refactoring:**
```typescript
// Segregate into focused interfaces
interface INodeSelector {
  selectNodes(ast: t.File, selector: NodeSelector): Result<NodePath[], RegraffError>;
}

interface INodeValidator {
  validateExtractable(nodes: NodePath[]): Result<void, RegraffError>;
}

interface IRangeNodeSelector {
  selectNodesInRange(ast: t.File, selector: RangeSelector): Result<NodePath[], RegraffError>;
}

// Implementations can be composed
class NodeSelector implements INodeSelector {
  selectNodes(...) { /* focused on selection only */ }
}

class NodeValidator implements INodeValidator {
  validateExtractable(...) { /* focused on validation only */ }
}

class RangeNodeSelector implements IRangeNodeSelector {
  constructor(
    private nodeSelector: INodeSelector,
    private validator: INodeValidator
  ) {}

  selectNodesInRange(...) {
    // Compose behaviors
  }
}
```

---

### 5. Open/Closed Principle (OCP)

#### 5.1 Error Creation Switch Statement - **LOW**

**Location:** `src/extract/errors.ts:118-205`

**Problem:** Adding new error types requires modifying 83-line switch statement

**Current Code:**
```typescript
export function createExtractError(
  code: ExtractErrorCode,
  message: string,
  details?: ErrorDetails
): RegraffError {
  let category: ErrorCategory;

  switch (code) {
    case ExtractErrorCode.FILE_READ_FAILED:
    case ExtractErrorCode.FILE_WRITE_FAILED:
      category = ErrorCategory.FILE_SYSTEM;
      break;
    case ExtractErrorCode.PARSE_ERROR:
      category = ErrorCategory.SYNTAX;
      break;
    // ... 15+ more cases
    default:
      category = ErrorCategory.INTERNAL;
  }

  return createError(code, message, category, details);
}
```

**Proposed Refactoring:**
```typescript
// Error type registry
const ERROR_TYPE_REGISTRY: Record<ExtractErrorCode, ErrorCategory> = {
  [ExtractErrorCode.FILE_READ_FAILED]: ErrorCategory.FILE_SYSTEM,
  [ExtractErrorCode.FILE_WRITE_FAILED]: ErrorCategory.FILE_SYSTEM,
  [ExtractErrorCode.PARSE_ERROR]: ErrorCategory.SYNTAX,
  // ... all mappings
};

export function createExtractError(
  code: ExtractErrorCode,
  message: string,
  details?: ErrorDetails
): RegraffError {
  const category = ERROR_TYPE_REGISTRY[code] ?? ErrorCategory.INTERNAL;
  return createError(code, message, category, details);
}
```

**Benefits:**
- Adding new error types requires only adding to registry
- No modification of function body
- Open for extension, closed for modification

---

#### 5.2 CodeFormatter Style Analysis - **LOW**

**Location:** `src/extract/CodeFormatter.ts:87-254`

**Problem:** Adding new style preferences requires modifying extractFormattingStyle method

**Proposed Refactoring:**
```typescript
// Strategy pattern for style analyzers
interface IStyleAnalyzer {
  analyze(code: string): unknown;
}

class IndentationAnalyzer implements IStyleAnalyzer {
  analyze(code: string): IndentInfo { /* ... */ }
}

class QuoteStyleAnalyzer implements IStyleAnalyzer {
  analyze(code: string): 'single' | 'double' { /* ... */ }
}

// Registry-based approach
class CodeFormatter {
  private analyzers: Map<string, IStyleAnalyzer> = new Map([
    ['indentation', new IndentationAnalyzer()],
    ['quotes', new QuoteStyleAnalyzer()],
    ['semicolons', new SemicolonAnalyzer()],
    // Easy to add new analyzers
  ]);

  private extractFormattingStyle(code: string): FormattingStyle {
    const style: any = {};
    for (const [name, analyzer] of this.analyzers) {
      style[name] = analyzer.analyze(code);
    }
    return style;
  }
}
```

---

## Refactoring Plan (Tidy First Approach)

Following Kent Beck's principles: separate structural changes from behavioral changes, commit only when tests pass.

### Phase 1: Extract Duplicated Code (Low Risk)

**Goal:** Remove code duplication without changing behavior

#### Step 1.1: Extract File Parsing Logic
- **File:** `src/extract/extract-orchestrator.ts`
- **Change:** Extract `parseFiles()` private method
- **Test:** All existing tests should pass
- **Commit:** "refactor: extract parseFiles method to remove duplication"

#### Step 1.2: Extract Import Search Logic
- **File:** `src/extract/import-manager.ts`
- **Change:** Extract `findImportDeclaration()` private method
- **Test:** All import-manager tests should pass
- **Commit:** "refactor: extract findImportDeclaration to remove duplication"

#### Step 1.3: Extract Initialization Logic
- **File:** `src/extract/extract-orchestrator.ts`
- **Change:** Extract `initialize()` private method
- **Test:** All orchestrator tests should pass
- **Commit:** "refactor: extract initialize method to consolidate setup logic"

---

### Phase 2: Extract Type Conversion (Medium Risk)

**Goal:** Separate type conversion concern from orchestration

#### Step 2.1: Create TypeStringifier Class
- **File:** `src/extract/type-stringifier.ts` (new)
- **Change:** Extract type conversion logic
- **Test:** Write unit tests for TypeStringifier
- **Commit:** "refactor: extract TypeStringifier class"

#### Step 2.2: Update ExtractOrchestrator
- **File:** `src/extract/extract-orchestrator.ts`
- **Change:** Use TypeStringifier instead of internal methods
- **Test:** All orchestrator tests should pass
- **Commit:** "refactor: use TypeStringifier in ExtractOrchestrator"

---

### Phase 3: Create Interfaces (Low Risk)

**Goal:** Define contracts for dependency injection

#### Step 3.1: Create Core Interfaces
- **Files:** `src/extract/interfaces/*.ts` (new directory)
- **Interfaces:**
  - IInputValidator
  - IExtractPlanner
  - IExtractExecutor
  - ICodeFormatter
  - IComponentBuilder
  - ICodeReplacer
  - IImportManager
- **Test:** No behavioral change; interfaces only
- **Commit:** "refactor: add interfaces for core extract components"

#### Step 3.2: Implement Interfaces
- **Files:** All implementation classes
- **Change:** Add `implements IXxx` to class declarations
- **Test:** TypeScript compilation + all tests pass
- **Commit:** "refactor: implement interfaces in extract components"

---

### Phase 4: Implement Dependency Injection (Medium Risk)

**Goal:** Enable dependency injection for better testability

#### Step 4.1: Update ExtractOrchestrator Constructor
- **File:** `src/extract/extract-orchestrator.ts`
- **Change:** Accept dependencies via constructor
- **Test:** Update tests to inject dependencies
- **Commit:** "refactor: add dependency injection to ExtractOrchestrator"

#### Step 4.2: Create Factory
- **File:** `src/extract/factory.ts` (new)
- **Change:** Create ExtractOrchestratorFactory
- **Test:** Factory creates working orchestrator
- **Commit:** "refactor: add factory for ExtractOrchestrator"

#### Step 4.3: Update Public API
- **File:** `src/extract/extract.ts`
- **Change:** Use factory to create orchestrator
- **Test:** All public API tests pass
- **Commit:** "refactor: update public API to use factory"

#### Step 4.4: Update ExtractExecutor
- **File:** `src/extract/extract-executor.ts`
- **Change:** Accept dependencies via constructor
- **Test:** Update tests
- **Commit:** "refactor: add dependency injection to ExtractExecutor"

#### Step 4.5: Update ExtractPlanner
- **File:** `src/extract/extract-planner.ts`
- **Change:** Accept dependencies via constructor
- **Test:** Update tests
- **Commit:** "refactor: add dependency injection to ExtractPlanner"

---

### Phase 5: Split ExtractDependencyAnalyzer (High Risk)

**Goal:** Separate 8 concerns into focused classes

#### Step 5.1: Extract IdentifierCollector
- **File:** `src/extract/analyzers/identifier-collector.ts` (new)
- **Change:** Extract identifier collection logic
- **Test:** Write unit tests for IdentifierCollector
- **Commit:** "refactor: extract IdentifierCollector from ExtractDependencyAnalyzer"

#### Step 5.2: Extract ImportCollector
- **File:** `src/extract/analyzers/import-collector.ts` (new)
- **Change:** Extract import collection logic
- **Test:** Write unit tests
- **Commit:** "refactor: extract ImportCollector"

#### Step 5.3: Extract TypeExtractor
- **File:** `src/extract/analyzers/type-extractor.ts` (new)
- **Change:** Extract type extraction logic
- **Test:** Write unit tests
- **Commit:** "refactor: extract TypeExtractor"

#### Step 5.4: Extract BindingAnalyzer
- **File:** `src/extract/analyzers/binding-analyzer.ts` (new)
- **Change:** Extract binding detection logic
- **Test:** Write unit tests
- **Commit:** "refactor: extract BindingAnalyzer"

#### Step 5.5: Extract StatePatternDetector
- **File:** `src/extract/analyzers/state-pattern-detector.ts` (new)
- **Change:** Extract state pattern detection
- **Test:** Write unit tests
- **Commit:** "refactor: extract StatePatternDetector"

#### Step 5.6: Extract CircularDependencyDetector
- **File:** `src/extract/analyzers/circular-dependency-detector.ts` (new)
- **Change:** Extract circular dependency detection
- **Test:** Write unit tests
- **Commit:** "refactor: extract CircularDependencyDetector"

#### Step 5.7: Refactor ExtractDependencyAnalyzer as Coordinator
- **File:** `src/extract/extract-dependency-analyzer.ts`
- **Change:** Slim down to coordination only; use injected analyzers
- **Test:** All dependency analyzer tests pass
- **Commit:** "refactor: convert ExtractDependencyAnalyzer to coordinator"

---

### Phase 6: Split CodeFormatter (Medium Risk)

**Goal:** Separate style analysis from formatting

#### Step 6.1: Extract IndentationAnalyzer
- **File:** `src/extract/formatters/indentation-analyzer.ts` (new)
- **Change:** Extract indentation analysis
- **Test:** Write unit tests
- **Commit:** "refactor: extract IndentationAnalyzer"

#### Step 6.2: Extract QuoteStyleAnalyzer
- **File:** `src/extract/formatters/quote-style-analyzer.ts` (new)
- **Change:** Extract quote analysis
- **Test:** Write unit tests
- **Commit:** "refactor: extract QuoteStyleAnalyzer"

#### Step 6.3: Extract SemicolonAnalyzer
- **File:** `src/extract/formatters/semicolon-analyzer.ts` (new)
- **Change:** Extract semicolon analysis
- **Test:** Write unit tests
- **Commit:** "refactor: extract SemicolonAnalyzer"

#### Step 6.4: Refactor CodeFormatter
- **File:** `src/extract/CodeFormatter.ts`
- **Change:** Use injected analyzers
- **Test:** All formatter tests pass
- **Commit:** "refactor: use composition in CodeFormatter"

---

### Phase 7: Segregate Interfaces (Low Risk)

**Goal:** Apply Interface Segregation Principle

#### Step 7.1: Split INodeSelector
- **Files:**
  - `src/extract/interfaces/i-node-selector.ts`
  - `src/extract/interfaces/i-node-validator.ts`
  - `src/extract/interfaces/i-range-node-selector.ts`
- **Change:** Create focused interfaces
- **Test:** TypeScript compilation
- **Commit:** "refactor: segregate INodeSelector interface"

#### Step 7.2: Update NodeSelector Implementation
- **File:** `src/extract/node-selector.ts`
- **Change:** Implement segregated interfaces
- **Test:** All node-selector tests pass
- **Commit:** "refactor: implement segregated interfaces in NodeSelector"

---

### Phase 8: Apply OCP (Low Risk)

**Goal:** Make code open for extension, closed for modification

#### Step 8.1: Replace Error Switch with Registry
- **File:** `src/extract/errors.ts`
- **Change:** Create ERROR_TYPE_REGISTRY
- **Test:** All error tests pass
- **Commit:** "refactor: replace error switch with registry pattern"

#### Step 8.2: Add Strategy Pattern to CodeFormatter
- **File:** `src/extract/CodeFormatter.ts`
- **Change:** Use registry-based analyzer lookup
- **Test:** All formatter tests pass
- **Commit:** "refactor: add strategy pattern to style analyzers"

---

## Testing Strategy

### Unit Test Coverage Requirements
- Each new class must have ≥90% coverage
- Each refactored class must maintain existing coverage
- All tests must pass before commit

### Integration Test Strategy
- Run full e2e test suite after each phase
- Verify extract.e2e.test.ts passes
- Check all example scenarios work

### Regression Prevention
- No test deletion allowed
- All existing tests must pass
- Add tests for edge cases discovered during refactoring

---

## Success Metrics

### Code Quality Metrics
- **Cyclomatic Complexity:** Reduce average from ~15 to <10
- **Class Size:** No class >200 lines (except coordinators)
- **Test Coverage:** Maintain ≥85% overall coverage
- **Dependencies:** All classes use DI; zero hard-coded instantiation

### SOLID Compliance
- **SRP:** Each class has single, clear responsibility
- **OCP:** New features added without modifying existing code
- **LSP:** All implementations substitutable via interfaces
- **ISP:** Interfaces focused and minimal
- **DIP:** All dependencies inverted; no concrete dependencies

### Maintainability Metrics
- **Code Duplication:** <3% duplicate code (currently ~8%)
- **Interface Coverage:** 100% of public classes have interfaces
- **Mock-ability:** 100% of classes can be mocked

---

## Phase Dependencies and Risk Assessment

| Phase | Risk | Dependencies | Notes |
|-------|------|--------------|-------|
| Phase 1: Extract Duplication | Low | None | Safe starting point; pure refactoring |
| Phase 2: Type Conversion | Medium | Phase 1 | Moderate complexity; well-isolated change |
| Phase 3: Create Interfaces | Low | None | Can run parallel to Phase 1-2; no behavior change |
| Phase 4: Dependency Injection | Medium | Phase 3 | Requires interface definitions first |
| Phase 5: Split DependencyAnalyzer | High | Phase 3, 4 | Most complex refactoring; needs DI in place |
| Phase 6: Split CodeFormatter | Medium | Phase 3, 4 | Similar to Phase 5 but smaller scope |
| Phase 7: Segregate Interfaces | Low | Phase 5, 6 | Builds on split classes |
| Phase 8: Apply OCP | Low | Phase 7 | Final polish; minimal risk |

**Recommended Sequence:** Phases 1-2 → Phase 3 (parallel) → Phase 4 → Phases 5-6 (can be parallel) → Phase 7 → Phase 8

---

## Risk Mitigation

### High-Risk Activities
1. **Splitting ExtractDependencyAnalyzer** (Phase 5)
   - **Risk:** Breaking existing functionality
   - **Mitigation:**
     - Write comprehensive unit tests first
     - Extract one analyzer at a time
     - Run full test suite after each extraction
     - Keep original class until all analyzers verified

2. **Implementing Dependency Injection** (Phase 4)
   - **Risk:** Breaking public API
   - **Mitigation:**
     - Use factory pattern to maintain API compatibility
     - Update all tests incrementally
     - Verify e2e tests pass at each step

### Rollback Strategy
- Each commit is independently revertable
- Git tags at end of each phase
- Feature flag for new DI system (if needed)

---

## Appendix: File Manifest

### Current Files (17)
```
src/extract/
├── extract.ts                          (public API)
├── index.ts                            (exports)
├── extract-orchestrator.ts             (388 lines) - NEEDS REFACTORING
├── extract-planner.ts                  (182 lines) - NEEDS REFACTORING
├── extract-executor.ts                 (327 lines) - NEEDS REFACTORING
├── extract-dependency-analyzer.ts      (527 lines) - CRITICAL REFACTORING
├── type-inferrer.ts                    (114 lines)
├── node-selector.ts                    (324 lines) - NEEDS INTERFACE SPLIT
├── component-builder.ts                (133 lines)
├── code-replacer.ts                    (69 lines)
├── import-manager.ts                   (167 lines) - MINOR REFACTORING
├── component-name-generator.ts         (130 lines)
├── CodeFormatter.ts                    (300 lines) - NEEDS REFACTORING
├── input-validator.ts                  (110 lines)
├── type-guards.ts                      (129 lines)
├── errors.ts                           (227 lines) - MINOR REFACTORING
└── types.ts                            (347 lines)
```

### New Files After Refactoring (~28 new files)
```
src/extract/
├── interfaces/                         (NEW DIRECTORY)
│   ├── i-input-validator.ts
│   ├── i-extract-planner.ts
│   ├── i-extract-executor.ts
│   ├── i-code-formatter.ts
│   ├── i-component-builder.ts
│   ├── i-code-replacer.ts
│   ├── i-import-manager.ts
│   ├── i-node-selector.ts
│   ├── i-node-validator.ts
│   └── i-range-node-selector.ts
├── analyzers/                          (NEW DIRECTORY)
│   ├── identifier-collector.ts
│   ├── import-collector.ts
│   ├── type-extractor.ts
│   ├── binding-analyzer.ts
│   ├── state-pattern-detector.ts
│   └── circular-dependency-detector.ts
├── formatters/                         (NEW DIRECTORY)
│   ├── indentation-analyzer.ts
│   ├── quote-style-analyzer.ts
│   └── semicolon-analyzer.ts
├── type-stringifier.ts                 (NEW FILE)
├── factory.ts                          (NEW FILE)
└── [existing files - refactored]
```

---

## References

- Kent Beck - "Test-Driven Development: By Example"
- Kent Beck - "Tidy First?: A Personal Exercise in Empirical Software Design"
- Robert C. Martin - "Clean Architecture"
- SOLID Principles: https://en.wikipedia.org/wiki/SOLID
- Refactoring Catalog: https://refactoring.com/catalog/

---

**Document Status:** Draft
**Next Review:** After Phase 1 completion
**Owner:** Development Team
**Last Updated:** 2025-12-19
