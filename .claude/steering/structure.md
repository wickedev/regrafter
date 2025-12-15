# Structure Steering

## Directory Organization

```
regrafter/
├── src/
│   ├── index.ts              # Public API exports
│   ├── api/                  # Public API layer
│   │   ├── regraft.ts        # Unified regraft() function
│   │   ├── canMove.ts        # canMove() function
│   │   ├── move.ts           # move() function
│   │   ├── analyze.ts        # analyze() function
│   │   └── optimize.ts       # optimize() function
│   ├── core/                 # Core engine components
│   │   ├── parser.ts         # Babel parser wrapper
│   │   ├── selector.ts       # Selector resolution
│   │   ├── analyzer.ts       # Dependency analyzer
│   │   ├── scope.ts          # Scope manager
│   │   ├── transformer.ts    # Transformation engine
│   │   └── generator.ts      # Code generator
│   ├── strategies/           # Hoisting/resolution strategies
│   │   ├── hook-hoister.ts
│   │   ├── variable-hoister.ts
│   │   ├── prop-threader.ts
│   │   ├── import-manager.ts
│   │   ├── context-handler.ts
│   │   └── suspense-handler.ts
│   ├── optimizer/            # Sinking optimization
│   │   └── sinker.ts
│   └── types/                # Type definitions
│       ├── public.ts         # Public API types
│       └── internal.ts       # Internal data structures
├── tests/
│   ├── unit/                 # Unit tests per component
│   ├── integration/          # Integration tests per phase
│   └── fixtures/             # Test fixture files
├── docs/                     # Documentation
└── .claude/
    ├── specs/regrafter/      # Spec documents
    │   ├── requirements.md
    │   ├── design.md
    │   └── tasks.md
    └── steering/             # AI steering documents
```

## File Naming Conventions

- Use kebab-case for filenames: `hook-hoister.ts`, `prop-threader.ts`
- Test files: `*.test.ts` in corresponding tests/ subdirectory
- Type-only files: suffix with nothing special, export types
- Fixture files: descriptive names like `simple-move.tsx`, `cross-file-deps.tsx`

## Key File Locations

- **Public Types**: `src/types/public.ts` (Move, Selector, Options, Result, Code, MoveAnalysis, Dependency)
- **Internal Types**: `src/types/internal.ts` (DependencyGraph, ASTStore, TransformPlan, ScopeInfo)
- **Main Entry**: `src/index.ts` (exports all public API)
- **Requirements**: `.claude/specs/regrafter/requirements.md`
- **Design**: `.claude/specs/regrafter/design.md`
- **Tasks**: `.claude/specs/regrafter/tasks.md`

## Module Architecture

- Each core component implements a clear interface
- Strategy handlers are pluggable for different dependency types
- Parser caches ASTs for reuse within session
- Dependency graph is built lazily and cached
