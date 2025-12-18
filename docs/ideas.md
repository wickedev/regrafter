Based on my analysis of the regrafter codebase, here are practical improvement ideas organized by category:

## 1. NEW FEATURE IDEAS

**🎯 High-Impact Features**

- **Visual Diff Preview**: Generate before/after code diffs for `canMove()` operations ✅ **Accepted**
  - Benefit: Users can preview transformations before executing
  - Integration: Return diff in `MoveAnalysis` result object
  - **Implementation**: Return diff as a string (e.g., unified diff format), not a UI component. Users can display it however they want.

- **Batch Move Operations**: Support moving multiple elements atomically ✅ **Accepted**
  - Benefit: Refactor entire component hierarchies in one transaction
  - Use case: Restructure feature modules, migrate patterns

- **Template-Based Transformations**: Define reusable move patterns ❌ **Out of Scope**
  - Example: "Extract to custom hook", "Lift state to parent"
  - Benefit: Codify common refactoring recipes
  - **Reason**: High-level refactoring patterns beyond the low-level primitive operations that regrafter provides.

- **React Server Components Support**: Handle RSC-specific transformations ❌ **Out of Scope**
  - 'use client'/'use server' directive management
  - Async component boundary detection
  - Benefit: Stay current with React 19+ patterns
  - **Reason**: Beyond the core focus of element movement and hoisting within React components.

- **Partial Move Safety**: Support "try move with fallback" ✅ **Already Implemented**
  - If dependencies can't hoist, suggest prop threading alternatives
  - Benefit: More resilient transformations
  - **Note**: Already implemented via proactive strategy selection in `HoistPlanner`. Instead of trying and failing, the planner analyzes dependency types upfront and automatically chooses safe strategies (`PassAsProp` for impure vars, `ExtractContext` for context deps). See `src/strategies/hoist-planner.ts:256-333`.

**🔧 Developer Workflow Features**

- **Interactive CLI Tool**: `npx regrafter` with TUI ❌ **Out of Scope**
  - Point-and-click element selection
  - Visual dependency graph display
  - Benefit: Non-programmatic usage for quick refactors
  - **Reason**: Regrafter is a programmatic library, not a CLI tool. User-facing tools should be built on top of the library.

- **VS Code Extension**: Visual move UI in editor ❌ **Out of Scope** (Separate Project)
  - Right-click → "Move to..." with autocomplete
  - Inline dependency preview
  - Benefit: Zero-context-switch workflow
  - **Reason**: Will be implemented as a separate project that consumes the regrafter library.

- **Transformation Recording**: Record and replay move sequences ❌ **Out of Scope**
  - Save as migration scripts
  - Benefit: Reproducible large-scale refactors
  - **Reason**: Beyond the core library functionality. Can be built as a separate tool on top of regrafter.

## 2. PERFORMANCE OPTIMIZATIONS

**⚡ Processing Speed**

- **Incremental Parsing**: Only reparse changed portions of AST ⏸️ **Not Considering Now**
  - Current: Full file reparse on each operation
  - Target: 60-80% reduction for sequential operations
  - Implementation: AST diffing + selective invalidation

- **Parallel File Analysis**: Process multi-file operations concurrently ⏸️ **Not Considering Now**
  - Use worker threads for independent file analysis
  - Target: 3-5x speedup for projects with 50+ files

- **Dependency Graph Caching**: Persist dependency graphs between runs ⏸️ **Not Considering Now**
  - Cache invalidation on file changes only
  - Benefit: Near-instant `canMove()` checks in CI/CD

- **Lazy Scope Analysis**: Defer scope building until needed ⏸️ **Not Considering Now**
  - Build scopes only for affected component trees
  - Target: 40% reduction in small move operations

**💾 Memory Efficiency**

- **Streaming AST Generation**: Generate code incrementally ❌ **Out of Scope**
  - Don't hold entire AST in memory for large files
  - Benefit: Handle 10,000+ line files without OOM
  - **Reason**: Beyond the current scope. AST transformation requires full tree access for accurate dependency analysis.

- **Weak Reference AST Cache**: Auto-GC unused cached ASTs ⛔ **Won't Do**
  - Replace Map with WeakMap where appropriate
  - Benefit: Prevent memory leaks in long-running processes
  - **Reason**: Violates referential transparency. Caching should be explicit and deterministic, not subject to unpredictable garbage collection.

## 3. DEVELOPER EXPERIENCE IMPROVEMENTS

**📚 Documentation & Learning**

- **Interactive Playground**: Web-based demo at regrafter.dev ❌ **Out of Scope**
  - Try transformations in browser with Monaco editor
  - Example gallery of common patterns
  - Benefit: Lower barrier to adoption
  - **Reason**: Marketing/education tooling beyond the core library. Can be built as a separate project.

- **Migration Guides**: From jscodeshift/codemod patterns ❌ **Out of Scope**
  - Side-by-side comparison examples
  - Benefit: Convert existing codemod users
  - **Reason**: Documentation content creation is separate from library development.

- **Video Tutorials**: "Refactor React in 5 minutes" ❌ **Out of Scope**
  - Common use cases demonstrated
  - Benefit: Visual learners, broader reach
  - **Reason**: Educational content creation is separate from library development.

**🛠️ Debugging & Observability**

- **Debug Mode with Trace**: `{ debug: true }` option ✅ **Accepted**
  - Step-by-step transformation logs
  - Dependency resolution trace
  - Benefit: Understand why moves fail

- **Visualization Tools**: Graph of dependency relationships ❌ **Out of Scope**
  - Export to mermaid/graphviz
  - Highlight hoisting paths
  - Benefit: Mental model building
  - **Reason**: Visualization tooling should be built as a separate project on top of the library.

- **Error Messages with Code Examples**: Show before/after for errors ⏸️ **Not Considering Now**
  - "This failed because... here's what would work:"
  - Benefit: Self-service problem resolution

**🔌 Integrations**

- **ESLint Plugin**: Auto-fix suggestions for move opportunities ❌ **Out of Scope**
  - Rule: `regrafter/suggest-extract-component`
  - Benefit: Proactive code organization
  - **Reason**: Separate integration project that would consume the regrafter library.

- **TypeScript Plugin**: Type-aware move validation ❌ **Out of Scope**
  - Catch type errors before AST transformation
  - Benefit: Type safety guarantee
  - **Reason**: Separate integration project that would consume the regrafter library.

- **GitHub Action**: Automated refactoring in PRs ❌ **Out of Scope**
  - Comment with move suggestions
  - Benefit: Code review assistance
  - **Reason**: Separate integration project that would consume the regrafter library.

## 4. ARCHITECTURE EVOLUTION

**🏗️ Structural Improvements**

- **Plugin Architecture**: Extensible strategy system 🔽 **Low Priority**
  - Third-party hoisting strategies
  - Custom dependency analyzers (Vue, Solid, Svelte)
  - Benefit: Framework flexibility
  - **Note**: Core functionality should be solidified before building plugin system.

- **AST-Agnostic Core**: Abstract away Babel specifics 🔽 **Low Priority**
  - Support SWC, TypeScript Compiler API
  - Benefit: Performance options, broader ecosystem
  - **Note**: Babel works well currently; can be abstracted later if performance becomes critical.

- **Streaming API**: Process massive files chunk-by-chunk ⏸️ **Not Considering Now**
  - `regraft.stream()` returning AsyncIterable
  - Benefit: Enterprise-scale codebases

- **Undo/Redo System**: Transformation history ❌ **Out of Scope**
  - Rollback partial operations
  - Benefit: Safe experimentation
  - **Reason**: Beyond the core library responsibility. Version control (git) provides this functionality.

**🔒 Safety & Validation**

- **Type-Preserving Transformations**: Verify TypeScript types ❌ **Out of Scope**
  - Ensure moved code remains type-safe
  - Benefit: Catch semantic errors
  - **Reason**: TypeScript compiler already provides type checking. Users should run `tsc` after transformations.

- **Runtime Behavior Verification**: Generate test assertions ❌ **Out of Scope**
  - Prove behavioral equivalence
  - Benefit: High-stakes refactoring confidence
  - **Reason**: Beyond the scope of AST transformation. Users should rely on existing test suites.

## 5. INTEGRATION POSSIBILITIES

**🌐 Ecosystem Integrations**

- **Next.js Codemods**: Official Next.js migration tool support ❌ **Out of Scope**
  - App Router migration assistance
  - Benefit: Official endorsement, visibility
  - **Reason**: Framework-specific tooling should be built as separate integration projects.

- **Storybook Integration**: Move stories with components ❌ **Out of Scope**
  - Auto-update story imports
  - Benefit: Synchronized refactoring
  - **Reason**: Tool-specific integration beyond the core library scope.

- **Testing Library Utilities**: Update test selectors automatically ❌ **Out of Scope**
  - Move component → update `getByRole` queries
  - Benefit: Reduce test maintenance
  - **Reason**: Test tooling integration should be a separate project.

- **Monorepo Tools (Nx/Turborepo)**: Workspace-aware moves ❌ **Out of Scope**
  - Cross-package refactoring
  - Benefit: Enterprise adoption
  - **Reason**: Monorepo-specific tooling beyond the core library scope.

**🤖 AI/LLM Integrations**

- **LLM Code Assistant Plugin**: Claude/GPT can call regrafter ❌ **Out of Scope**
  - Natural language → transformation execution
  - Benefit: AI-powered refactoring
  - **Reason**: AI integration tooling should be built as separate projects that consume the library.

- **Automated Refactoring Suggestions**: ML model recommends moves ❌ **Out of Scope**
  - "These 3 elements should be a component"
  - Benefit: Proactive code quality
  - **Reason**: ML-based suggestion systems are beyond the core transformation library scope.

## 6. USER EXPERIENCE ENHANCEMENTS

**✨ Quality of Life**

- **Smart Defaults**: Zero-config for common cases ⏸️ **Not Considering Now**
  - Auto-detect format (prettier config)
  - Benefit: Reduce boilerplate

- **Undo Capability**: Built-in rollback ⏸️ **Not Considering Now**
  - `regraft.undo()` reverts last operation
  - Benefit: Safe exploration

- **Progress Callbacks**: For long operations ⏸️ **Not Considering Now**
  - `onProgress: (percent) => {}`
  - Benefit: User feedback in UIs

- **Dry-Run Mode**: Execute with `dryRun: true` ✅ **Already Implemented**
  - Returns what *would* change
  - Benefit: Risk-free validation
  - **Note**: Implemented in `regraft()` function. When `options.dryRun` is true, returns full dependency analysis without performing transformation. See `src/index.ts:272-275` and `createDryRunResult()` at `src/index.ts:813-836`.

**📊 Reporting & Analytics**

- **Refactoring Metrics**: Report complexity reduced ❌ **Out of Scope**
  - "Reduced nesting depth by 2 levels"
  - Benefit: Quantify improvement
  - **Reason**: Beyond the core transformation library. Can be built on top if needed.

- **Impact Analysis**: Show affected test files ❌ **Out of Scope**
  - "These 12 tests may need updates"
  - Benefit: Change management
  - **Reason**: Test impact analysis is the responsibility of test tooling, not the transformation library.

## 7. TECHNICAL DEBT REDUCTION

**🧹 Code Quality**

- **Reduce Cognitive Complexity**: Refactor dense analyzer functions ✅ **Accepted**
  - Current: Some functions >30 complexity
  - Target: Max 15 per function
  - Benefit: Maintainability

- **Extract Magic Numbers**: Configuration system for thresholds ✅ **Accepted**
  - `100ms`, `500ms` limits externalized
  - Benefit: Tunability

- **Consolidate Error Handling**: DRY error creation 🔥 **HIGHEST PRIORITY**
  - Many repeated error patterns
  - Benefit: Consistency, less code
  - **Goal**: Eliminate try-catch blocks. Use Result/Either pattern for error handling (e.g., `Result<T, E>` type that returns `Ok(value)` or `Err(error)`). All functions should return explicit success/failure types instead of throwing exceptions.

**🏛️ Architecture Cleanup**

- **Implement Strategy Pattern Properly**: Remove duplicate logic via delegation ✅ **Accepted**
  - Current: HoistPlanner reimplements strategy logic instead of delegating to strategy classes
  - Solution: Inject StrategyRegistry into HoistPlanner/HoistExecutor and delegate to `strategy.plan()` and `strategy.execute()`
  - Benefit: Eliminates duplicate logic, improves maintainability, enables extensibility
  - Note: No circular dependencies exist (already well-decoupled). Problem is unused strategy interfaces.

- **Simplify Type Hierarchy**: Reduce `internal.ts` complexity ✅ **Accepted**
  - 50+ internal types, some overlapping
  - Benefit: Type comprehension

- **Extract Core Primitives**: Micro-library for AST utilities 🔽 **Low Priority**
  - `@regrafter/ast-utils` package
  - Benefit: Reusable across projects
  - **Note**: Can be extracted later if there's demand from other projects.

**📦 Build & Distribution**

- **Tree-Shaking Optimization**: Reduce bundle size 🔽 **Low Priority**
  - Current: Full bundle even for `canMove()` only
  - Target: 40% smaller for minimal usage
  - Benefit: Faster installs, smaller apps
  - **Note**: Nice to have but not critical for core functionality.

- **CJS/ESM Dual Publishing**: Ensure compatibility 🔽 **Low Priority**
  - Audit current dual build for correctness
  - Benefit: Broader compatibility
  - **Note**: Current dual build works; optimization can be done later.

---

## PRIORITIZATION RECOMMENDATION

Based on project scope review, features are categorized into clear implementation priorities:

---

### 🔥 HIGHEST PRIORITY (Immediate Focus)

**Consolidate Error Handling**
- **Goal**: Eliminate try-catch blocks, implement Result/Either pattern
- **Impact**: Referential transparency, predictable error handling
- **Effort**: High (requires refactoring throughout codebase)
- **Benefit**: More robust, functional approach to error management

---

### ✅ ACCEPTED (Approved for Implementation)

**Core Library Improvements:**
1. **Debug Mode with Trace** - Step-by-step transformation logs for debugging
2. **Visual Diff Preview** - Return diff strings (unified diff format) for preview
3. **Batch Move Operations** - Move multiple elements atomically
4. **Reduce Cognitive Complexity** - Refactor functions >30 complexity to max 15
5. **Extract Magic Numbers** - Externalize hardcoded thresholds to config
6. **Simplify Type Hierarchy** - Reduce 50+ overlapping types in `internal.ts`
7. **Implement Strategy Pattern Properly** - Remove duplicate logic via delegation to strategy classes

---

### ✓ ALREADY IMPLEMENTED

1. **Partial Move Safety** - Proactive strategy selection (PassAsProp, ExtractContext)
2. **Dry-Run Mode** - Analysis without transformation via `options.dryRun`

---

### ⏸️ NOT CONSIDERING NOW (Deferred)

**Performance Optimizations:**
- Incremental Parsing
- Parallel File Analysis
- Dependency Graph Caching
- Lazy Scope Analysis
- Streaming API

**User Experience:**
- Smart Defaults
- Undo Capability
- Progress Callbacks
- Error Messages with Code Examples

---

### 🔽 LOW PRIORITY (Nice to Have)

**Build & Distribution:**
- Tree-Shaking Optimization
- CJS/ESM Dual Publishing Audit

**Architecture:**
- Extract Core Primitives (separate `@regrafter/ast-utils` package)
- Plugin Architecture (wait until core is stable)
- AST-Agnostic Core (Babel works well currently)

---

### ❌ OUT OF SCOPE (Separate Projects)

**Developer Tooling:**
- Interactive CLI Tool
- VS Code Extension
- ESLint Plugin
- TypeScript Plugin
- GitHub Action

**Ecosystem Integrations:**
- Next.js Codemods
- Storybook Integration
- Testing Library Utilities
- Monorepo Tools (Nx/Turborepo)

**AI/ML Integrations:**
- LLM Code Assistant Plugin
- Automated Refactoring Suggestions

**Documentation & Education:**
- Interactive Playground (regrafter.dev)
- Migration Guides
- Video Tutorials

**Advanced Features:**
- Visualization Tools (mermaid/graphviz export)
- Refactoring Metrics
- Impact Analysis
- Type-Preserving Transformations
- Runtime Behavior Verification
- Undo/Redo System
- Transformation Recording

**Other:**
- Streaming AST Generation

---

### ⛔ WON'T DO (Rejected)

**Weak Reference AST Cache**
- **Reason**: Violates referential transparency
- **Principle**: Caching must be explicit and deterministic

**Template-Based Transformations**
- **Reason**: High-level patterns beyond low-level primitives

**React Server Components Support**
- **Reason**: Beyond core focus of element movement/hoisting

---

## RECOMMENDED IMPLEMENTATION ORDER

**Phase 1: Foundation (Current)**
1. Consolidate Error Handling (Result/Either pattern)
2. Implement Strategy Pattern Properly
3. Simplify Type Hierarchy

**Phase 2: Core Features**
1. Debug Mode with Trace
2. Visual Diff Preview
3. Batch Move Operations

**Phase 3: Code Quality**
1. Reduce Cognitive Complexity
2. Extract Magic Numbers

**Phase 4: Future Consideration**
- Re-evaluate Low Priority items based on user feedback
- Performance optimizations if bottlenecks identified
