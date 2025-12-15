---
sidebar_position: 1
---

# Basic Examples

This page demonstrates basic usage patterns for Regrafter.

## Move Element Within Same Component

Move a JSX element to a different position within the same component:

```typescript
import { regraft, Move } from 'regrafter';

const files = [{
  path: 'App.tsx',
  content: `
    function App() {
      return (
        <div>
          <Header />
          <Main>
            <Sidebar />
            <Content />
          </Main>
          <Footer />
        </div>
      );
    }
  `
}];

// Move Sidebar after Content
const result = regraft(
  files,
  { file: 'App.tsx', line: 6, column: 13 },  // Sidebar
  { file: 'App.tsx', line: 7, column: 13 },  // Content
  Move.After
);

console.log(result.codes[0].content);
```

## Move Element Between Components

Move an element from one component to another:

```typescript
const files = [{
  path: 'App.tsx',
  content: `
    function Dashboard() {
      const [user, setUser] = useState(null);
      return (
        <div>
          <Profile user={user} />
          <Settings />
        </div>
      );
    }

    function Settings() {
      return <div>Settings</div>;
    }
  `
}];

// Move Profile inside Settings
const result = regraft(
  files,
  { file: 'App.tsx', line: 5, column: 11 },  // Profile
  { file: 'App.tsx', line: 11, column: 16 }, // Settings div
  Move.Inside
);

// Profile is now inside Settings with user prop threaded
```

## Move Element to Different File

Move an element to a different file:

```typescript
const files = [
  {
    path: 'Dashboard.tsx',
    content: `
      function Dashboard() {
        const data = useDashboardData();
        return (
          <div>
            <Chart data={data} />
            <Stats data={data} />
          </div>
        );
      }
    `
  },
  {
    path: 'Sidebar.tsx',
    content: `
      function Sidebar() {
        return <nav>Menu</nav>;
      }
    `
  }
];

// Move Chart to Sidebar
const result = regraft(
  files,
  { file: 'Dashboard.tsx', line: 5, column: 13 }, // Chart
  { file: 'Sidebar.tsx', line: 2, column: 16 },   // nav
  Move.Inside
);

// Chart is moved to Sidebar.tsx with necessary imports
```

## Dry Run Preview

Preview changes without applying them:

```typescript
const result = regraft(
  files,
  from,
  to,
  Move.Inside,
  { dryRun: true }
);

console.log('Would modify:', result.codes.filter(c => c.changed));
console.log('Dependencies:', result.analysis.dependencies);
console.log('Can move:', result.success);
```

## Next Steps

- Learn about [Dependency Management](/docs/concepts/dependencies) for handling complex dependencies
- Explore the [API Reference](/docs/api/overview) for more details
