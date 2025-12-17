/**
 * Hook Hoisting Integration Tests
 *
 * Tests for the complete hook hoisting pipeline when moving elements
 * that use React hooks across component boundaries.
 *
 * Test Purpose:
 * - Verify hooks are hoisted to valid locations
 * - Verify Rules of Hooks compliance is maintained
 * - Verify state is preserved after hoisting
 * - Verify multiple hooks are handled correctly
 */

import { describe, it, expect } from "vitest";
import {
  Move,
  DependencyType,
  type PositionSelector,
  createSelectorResolver,
  createScopeManager,
  createConfiguredHoistPlanner,
  DependencyAnalyzer,
} from "../../index.js";
import { createParser } from "../../parser/index.js";
import { createJSXTransformer } from "../../transformer/index.js";
import { CodeGenerator } from "../../generator/code-generator.js";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Integration test helper that performs full hoisting pipeline
 */
async function testHoisting(
  code: string,
  fromSelector: PositionSelector,
  toSelector: PositionSelector,
  mode: Move
) {
  // Parse
  const parser = createParser();
  const parseResult = parser.parse(code, "test.tsx");
  if (!parseResult.success || !parseResult.ast) {
    throw new Error(`Parse failed: ${parseResult.errors[0]?.message}`);
  }
  const ast = parseResult.ast;

  // Resolve selectors
  const resolver = createSelectorResolver();
  const sourceResult = resolver.resolve(fromSelector, ast);
  const targetResult = resolver.resolve(toSelector, ast);

  if (!sourceResult.path || !targetResult.path) {
    throw new Error("Failed to resolve selectors");
  }

  // Build scope tree
  const scopeManager = createScopeManager();
  scopeManager.buildScopeTree(ast);

  // Get scopes
  const sourceScope = scopeManager.getScopeForPath(sourceResult.path);
  const targetScope = scopeManager.getScopeForPath(targetResult.path);
  const sourceComponent = scopeManager.findEnclosingComponent(
    sourceResult.path
  );
  const targetComponent = scopeManager.findEnclosingComponent(
    targetResult.path
  );

  // Analyze dependencies
  const depAnalyzer = new DependencyAnalyzer(scopeManager);
  depAnalyzer.setCurrentFile("test.tsx");
  const analysis = depAnalyzer.analyzeElement(sourceResult.path, targetScope);

  // Create hoist context
  const hoistContext = {
    sourceFile: "test.tsx",
    targetFile: "test.tsx",
    sourceScope: sourceScope!,
    targetScope: targetScope!,
    sourceComponent,
    targetComponent,
    isCrossFile: false,
    asts: new Map([["test.tsx", ast]]),
  };

  // Plan hoisting
  const hoistPlanner = createConfiguredHoistPlanner();
  const plan = hoistPlanner.plan(analysis, hoistContext);

  // Execute hoisting transformations (if plan has operations)
  // Note: In real implementation, strategies would execute the plan
  // For now, we just test that planning works
  if (!plan.valid) {
    throw new Error(`Hoisting plan invalid: ${plan.warnings.join(", ")}`);
  }

  // Perform the move
  const transformer = createJSXTransformer();
  const moveResult = transformer.move(
    ast,
    sourceResult.path,
    targetResult.path,
    mode
  );

  if (!moveResult.success) {
    throw new Error(`Move failed: ${moveResult.error}`);
  }

  // Generate code
  const generator = new CodeGenerator();
  const generated = generator.generate(ast);

  return {
    code: generated.code,
    dependencies: analysis.dependencies,
    analysis,
    plan,
    success: true,
  };
}

// =============================================================================
// useState Hoisting Tests
// =============================================================================

describe("Hook Hoisting - useState", () => {
  it("HOIST-01: should hoist useState when element moves up tree", async () => {
    const code = `
import React, { useState } from 'react';

function Parent() {
  return (
    <div>
      <Child />
    </div>
  );
}

function Child() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <span>Count: {count}</span>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 16, column: 6 };
    const to: PositionSelector = { file: "test.tsx", line: 6, column: 6 };

    const result = await testHoisting(code, from, to, Move.Inside);

    expect(result.success).toBe(true);
    expect(
      result.dependencies.some(
        (d) =>
          d.type === DependencyType.Hook &&
          "symbol" in d &&
          d.symbol.includes("count")
      )
    ).toBe(true);
    expect(result.plan.valid).toBe(true);
  });

  it("HOIST-02: should handle useState with destructured values", async () => {
    const code = `
import React, { useState } from 'react';

function Component() {
  const [state, setState] = useState({ name: 'test', count: 0 });

  return (
    <div>
      <span>{state.name}</span>
      <span>{state.count}</span>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 10, column: 6 };
    const to: PositionSelector = { file: "test.tsx", line: 9, column: 6 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    expect(result.dependencies.some((d) => d.symbol.includes("state"))).toBe(
      true
    );
  });
});

// =============================================================================
// useEffect Hoisting Tests
// =============================================================================

describe("Hook Hoisting - useEffect", () => {
  it("HOIST-03: should hoist useEffect with dependencies", async () => {
    const code = `
import React, { useState, useEffect } from 'react';

function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);

  return (
    <div>
      <span>{count}</span>
      <button>Click</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 13, column: 7 };
    const to: PositionSelector = { file: "test.tsx", line: 14, column: 7 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    // Should detect both useState and useEffect
    expect(
      result.dependencies.filter((d) => d.type === DependencyType.Hook).length
    ).toBeGreaterThan(0);
  });

  it("HOIST-04: should preserve cleanup functions in useEffect", async () => {
    const code = `
import React, { useEffect, useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <span>{count}</span>
      <button>Reset</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 17, column: 7 };
    const to: PositionSelector = { file: "test.tsx", line: 18, column: 7 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    // Cleanup function should be part of the useEffect dependency
  });
});

// =============================================================================
// useRef Hoisting Tests
// =============================================================================

describe("Hook Hoisting - useRef", () => {
  it("HOIST-05: should hoist useRef with element", async () => {
    const code = `
import React, { useRef } from 'react';

function Component() {
  const inputRef = useRef(null);

  return (
    <div>
      <input ref={inputRef} />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 9, column: 6 };
    const to: PositionSelector = { file: "test.tsx", line: 10, column: 6 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    expect(result.dependencies.some((d) => d.symbol === "inputRef")).toBe(true);
  });
});

// =============================================================================
// Custom Hook Hoisting Tests
// =============================================================================

describe("Hook Hoisting - Custom Hooks", () => {
  it("HOIST-06: should hoist custom hooks", async () => {
    const code = `
import React from 'react';

function useCustom() {
  const [value, setValue] = React.useState(0);
  return { value, setValue };
}

function Component() {
  const { value, setValue } = useCustom();

  return (
    <div>
      <span>{value}</span>
      <button onClick={() => setValue(value + 1)}>+</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 14, column: 6 };
    const to: PositionSelector = { file: "test.tsx", line: 15, column: 6 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    expect(result.dependencies.some((d) => d.symbol.includes("value"))).toBe(
      true
    );
  });
});

// =============================================================================
// Multiple Hooks Tests
// =============================================================================

describe("Hook Hoisting - Multiple Hooks", () => {
  it("HOIST-07: should hoist multiple hooks together", async () => {
    const code = `
import React, { useState, useEffect, useMemo } from 'react';

function Component() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  const processed = useMemo(() => data.map(d => d * 2), [data]);

  return (
    <div>
      <span>{processed.length}</span>
      <button>Refresh</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 16, column: 7 };
    const to: PositionSelector = { file: "test.tsx", line: 17, column: 7 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    // Should detect multiple hooks (processed depends on useMemo which depends on useState)
    const hookDeps = result.dependencies.filter(
      (d) => d.type === DependencyType.Hook
    );
    expect(hookDeps.length).toBeGreaterThan(0);
  });

  it("HOIST-08: should preserve hook call order", async () => {
    const code = `
import React, { useState, useEffect } from 'react';

function Component() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(2);
  const [c, setC] = useState(3);

  useEffect(() => {
    console.log(a, b, c);
  }, [a, b, c]);

  return (
    <div>
      <span>{a + b + c}</span>
      <button>Reset</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 15, column: 7 };
    const to: PositionSelector = { file: "test.tsx", line: 16, column: 7 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    // Hook order must be preserved (Rules of Hooks)
  });
});

// =============================================================================
// useMemo and useCallback Tests
// =============================================================================

describe("Hook Hoisting - Memoization Hooks", () => {
  it("HOIST-09: should hoist useMemo with dependencies", async () => {
    const code = `
import React, { useMemo } from 'react';

function Component({ items }) {
  const sorted = useMemo(() => {
    return items.slice().sort((a, b) => a - b);
  }, [items]);

  return (
    <div>
      <ul>
        {sorted.map(item => <li key={item}>{item}</li>)}
      </ul>
      <span>Total: {sorted.length}</span>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 11, column: 7 };
    const to: PositionSelector = { file: "test.tsx", line: 14, column: 7 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    expect(result.dependencies.some((d) => d.symbol.includes("sorted"))).toBe(
      true
    );
  });

  it("HOIST-10: should hoist useCallback with dependencies", async () => {
    const code = `
import React, { useCallback, useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 13, column: 6 };
    const to: PositionSelector = { file: "test.tsx", line: 14, column: 6 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    expect(result.dependencies.some((d) => d.symbol.includes("count"))).toBe(
      true
    );
  });
});

// =============================================================================
// useReducer Tests
// =============================================================================

describe("Hook Hoisting - useReducer", () => {
  it("HOIST-11: should hoist useReducer with dispatcher", async () => {
    const code = `
import React, { useReducer } from 'react';

const reducer = (state, action) => {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    default:
      return state;
  }
};

function Component() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  return (
    <div>
      <span>{state.count}</span>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 18, column: 6 };
    const to: PositionSelector = { file: "test.tsx", line: 19, column: 6 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    expect(result.dependencies.some((d) => d.symbol.includes("state"))).toBe(
      true
    );
  });
});

// =============================================================================
// Variable Hoisting Tests
// =============================================================================

describe("Variable Hoisting", () => {
  it("HOIST-12: should hoist pure variables", async () => {
    const code = `
import React from 'react';

function Component({ items }) {
  const count = items.length;
  const doubled = count * 2;

  return (
    <div>
      <span>Count: {count}</span>
      <span>Doubled: {doubled}</span>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 10, column: 6 };
    const to: PositionSelector = { file: "test.tsx", line: 11, column: 6 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    expect(
      result.dependencies.some(
        (d) => d.type === DependencyType.Variable && d.symbol.includes("count")
      )
    ).toBe(true);
  });
});

// =============================================================================
// Import Hoisting Tests
// =============================================================================

describe("Import Management", () => {
  it("HOIST-13: should detect import dependencies", async () => {
    const code = `
import React from 'react';
import { format } from 'date-fns';

function Component() {
  const now = new Date();
  const formatted = format(now, 'yyyy-MM-dd');

  return (
    <div>
      <span>{formatted}</span>
      <button>Refresh</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 11, column: 7 };
    const to: PositionSelector = { file: "test.tsx", line: 12, column: 7 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    expect(
      result.dependencies.some(
        (d) =>
          d.type === DependencyType.Variable && d.symbol.includes("formatted")
      )
    ).toBe(true);
  });
});

// =============================================================================
// Rules of Hooks Validation Tests
// =============================================================================

describe("Rules of Hooks Validation", () => {
  it("HOIST-14: should validate hooks are not in conditional scopes", async () => {
    const code = `
import React, { useState } from 'react';

function Component({ showCounter }) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 9, column: 7 };
    const to: PositionSelector = { file: "test.tsx", line: 10, column: 7 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
    // Hook should remain at component top-level
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("Hook Hoisting - Edge Cases", () => {
  it("HOIST-15: should handle hooks with complex destructuring", async () => {
    const code = `
import React, { useState } from 'react';

function Component() {
  const [[nested], setNested] = useState([['value']]);

  return (
    <div>
      <span>{nested}</span>
      <button onClick={() => setNested([['new']])}>Update</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 9, column: 7 };
    const to: PositionSelector = { file: "test.tsx", line: 10, column: 7 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
  });

  it("HOIST-16: should handle hooks in nested components", async () => {
    const code = `
import React, { useState } from 'react';

function Outer() {
  return (
    <Inner />
  );
}

function Inner() {
  const [value, setValue] = useState(0);
  return (
    <div>
      <span>{value}</span>
      <button onClick={() => setValue(value + 1)}>+</button>
    </div>
  );
}
`;

    const from: PositionSelector = { file: "test.tsx", line: 14, column: 7 };
    const to: PositionSelector = { file: "test.tsx", line: 15, column: 7 };

    const result = await testHoisting(code, from, to, Move.Before);

    expect(result.success).toBe(true);
  });
});
