---
sidebar_position: 1
---

# Dependency Management

Regrafter automatically tracks and manages different types of dependencies when relocating React elements.

## Dependency Types

Regrafter recognizes and handles the following dependency types:

### Hook Dependencies

React hooks must follow the Rules of Hooks. Regrafter automatically hoists hooks to ancestor components when needed.

```typescript
// Before move
function Parent() {
  return <Child />;
}

function Child() {
  const [state, setState] = useState(0);
  return <div>{state}</div>;
}

// After moving element that uses state
function Parent() {
  const [state, setState] = useState(0); // Hoisted
  return <Child state={state} setState={setState} />;
}
```

**Supported hooks:**
- `useState`
- `useEffect`
- `useContext`
- `useRef`
- `useMemo`
- `useCallback`
- Custom hooks

### Variable Dependencies

Local variables and constants are either hoisted or passed as props.

```typescript
const result = regraft(files, from, to, Move.Inside);
// Variables used by the moved element are automatically tracked
```

### Import Dependencies

External imports are automatically added to target files during cross-file moves.

```typescript
// Source file
import { Button } from '@/components';

// After cross-file move, import is added to target file
```

### Prop Dependencies

Component props are threaded through the component tree when necessary.

### Context Dependencies

React context values can be hoisted with their providers or extracted.

### Ref Dependencies

React refs are hoisted or forwarded as needed.

## Resolution Strategies

| Type | Resolution |
|------|------------|
| `Hook` | Hoist to ancestor component |
| `Variable` | Hoist or thread as prop |
| `Import` | Add to target file |
| `Prop` | Thread through tree |
| `Context` | Hoist provider or extract |
| `Ref` | Hoist or forward ref |

## Dependency Analysis

Use the `analyze()` function to preview dependency changes:

```typescript
const analysis = analyze(files, from, to, Move.Inside);

console.log('Dependencies:', analysis.dependencies);
console.log('Would hoist:', analysis.hoistedDeps);
console.log('Can move:', analysis.canMove);
```

## Next Steps

- Learn about [Error Handling](/docs/api/errors)
- See [Examples](/docs/examples/basic) for dependency handling patterns
