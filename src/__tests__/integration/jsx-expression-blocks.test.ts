/**
 * Integration tests for JSX Expression Block Movement
 *
 * Tests that JSX expression containers are moved as atomic units:
 * - Conditional rendering: {isActive && <Component/>}
 * - Map expressions: {items.map(i => <Item/>)}
 * - Ternary expressions: {condition ? <A/> : <B/>}
 */

import { describe, it, expect } from 'vitest';
import { regraft, Move } from '../../index.js';

describe('JSX Expression Block Movement', () => {
  describe('Conditional Rendering (&&)', () => {
    it('should move conditional expression as atomic unit', () => {
      const files = [
        {
          path: 'Component.tsx',
          content: `
function Parent() {
  const isActive = true;
  return (
    <div>
      <h1>Title</h1>
      {isActive && <ActiveStatus />}
      <Footer />
    </div>
  );
}

function ActiveStatus() {
  return <span>Active</span>;
}

function Footer() {
  return <div>Footer</div>;
}
          `.trim(),
        },
      ];

      const result = regraft(
        files,
        { file: 'Component.tsx', line: 6, column: 6 }, // {isActive && <ActiveStatus />}
        { file: 'Component.tsx', line: 7, column: 6 }, // <Footer />
        Move.After
      );

      expect(result.success).toBe(true);
      if (result.codes[0] !== undefined) {
        expect(result.codes[0].content).toBe("function Parent() {\n  const isActive = true;\n  return <div><h1>Title</h1><Footer />{isActive && <ActiveStatus />}</div>;\n}\nfunction ActiveStatus() {\n  return <span>Active</span>;\n}\nfunction Footer() {\n  return <div>Footer</div>;\n}");
      }
    });

    it('should move complex conditional expression', () => {
      const files = [
        {
          path: 'Component.tsx',
          content: `
function Parent() {
  const user = { name: 'John' };
  return (
    <div>
      <Header />
      {user && user.name && <UserProfile name={user.name} />}
      <Footer />
    </div>
  );
}

function Header() {
  return <h1>Header</h1>;
}

function UserProfile({ name }: { name: string }) {
  return <div>{name}</div>;
}

function Footer() {
  return <div>Footer</div>;
}
          `.trim(),
        },
      ];

      const result = regraft(
        files,
        { file: 'Component.tsx', line: 6, column: 6 }, // {user && user.name && <UserProfile />}
        { file: 'Component.tsx', line: 5, column: 6 }, // <Header />
        Move.Before
      );

      expect(result.success).toBe(true);

      // Verify the conditional moved before Header
      if (result.codes[0] !== undefined) {
        const headerIndex = result.codes[0].content.indexOf('<Header />');
        const conditionalIndex = result.codes[0].content.indexOf('{user && user.name && <UserProfile');
        expect(conditionalIndex).toBeLessThan(headerIndex);
      }
    });
  });

  describe('Map Expressions', () => {
    it('should move map expression as atomic unit', () => {
      const files = [
        {
          path: 'List.tsx',
          content: `
function TodoList() {
  const items = [1, 2, 3];
  return (
    <div>
      <h1>Todo List</h1>
      {items.map(item => <TodoItem key={item} item={item} />)}
      <Footer />
    </div>
  );
}

function TodoItem({ item }: { item: number }) {
  return <li>{item}</li>;
}

function Footer() {
  return <div>Footer</div>;
}
          `.trim(),
        },
      ];

      const result = regraft(
        files,
        { file: 'List.tsx', line: 6, column: 6 }, // {items.map(...)}
        { file: 'List.tsx', line: 7, column: 6 }, // <Footer />
        Move.After
      );

      expect(result.success).toBe(true);
      if (result.codes[0] !== undefined) {
        expect(result.codes[0].content).toContain('items.map');
        expect(result.codes[0].content).toContain('<Footer />');

        // Verify the map expression moved after Footer
        const footerIndex = result.codes[0].content.indexOf('<Footer />');
        const mapIndex = result.codes[0].content.indexOf('items.map');
        expect(mapIndex).toBeGreaterThan(footerIndex);
      }
    });

    it('should move chained map expression', () => {
      const files = [
        {
          path: 'List.tsx',
          content: `
function FilteredList() {
  const data = [1, 2, 3, 4, 5];
  return (
    <div>
      <h1>List</h1>
      {data.filter(x => x > 2).map(x => <Item key={x} value={x} />)}
      <Footer />
    </div>
  );
}

function Item({ value }: { value: number }) {
  return <div>{value}</div>;
}

function Footer() {
  return <div>Footer</div>;
}
          `.trim(),
        },
      ];

      const result = regraft(
        files,
        { file: 'List.tsx', line: 6, column: 6 }, // {data.filter(...).map(...)}
        { file: 'List.tsx', line: 5, column: 6 }, // <h1>List</h1>
        Move.Before
      );

      expect(result.success).toBe(true);
      if (result.codes[0] !== undefined) {
        expect(result.codes[0].content).toContain('data.filter');

        // Verify the chained expression moved before h1
        const h1Index = result.codes[0].content.indexOf('<h1>List</h1>');
        const filterIndex = result.codes[0].content.indexOf('data.filter');
        expect(filterIndex).toBeLessThan(h1Index);
      }
    });
  });

  describe('Ternary Expressions', () => {
    it('should move ternary expression as atomic unit', () => {
      const files = [
        {
          path: 'Toggle.tsx',
          content: `
function Toggle() {
  const isLoading = false;
  return (
    <div>
      <h1>Title</h1>
      {isLoading ? <Spinner /> : <Content />}
      <Footer />
    </div>
  );
}

function Spinner() {
  return <div>Loading...</div>;
}

function Content() {
  return <div>Content</div>;
}

function Footer() {
  return <div>Footer</div>;
}
          `.trim(),
        },
      ];

      const result = regraft(
        files,
        { file: 'Toggle.tsx', line: 6, column: 6 }, // {isLoading ? ... : ...}
        { file: 'Toggle.tsx', line: 7, column: 6 }, // <Footer />
        Move.After
      );

      expect(result.success).toBe(true);
      if (result.codes[0] !== undefined) {
        expect(result.codes[0].content).toContain('isLoading ?');
        expect(result.codes[0].content).toContain('<Footer />');

        // Verify the ternary expression moved after Footer
        const footerIndex = result.codes[0].content.indexOf('<Footer />');
        const ternaryIndex = result.codes[0].content.indexOf('isLoading ?');
        expect(ternaryIndex).toBeGreaterThan(footerIndex);
      }
    });

    it('should move ternary with null alternative', () => {
      const files = [
        {
          path: 'Toggle.tsx',
          content: `
function Toggle() {
  const isOpen = true;
  return (
    <div>
      <Header />
      {isOpen ? <Modal /> : null}
      <Footer />
    </div>
  );
}

function Header() {
  return <h1>Header</h1>;
}

function Modal() {
  return <div>Modal</div>;
}

function Footer() {
  return <div>Footer</div>;
}
          `.trim(),
        },
      ];

      const result = regraft(
        files,
        { file: 'Toggle.tsx', line: 6, column: 6 }, // {isOpen ? <Modal /> : null}
        { file: 'Toggle.tsx', line: 5, column: 6 }, // <Header />
        Move.Before
      );

      expect(result.success).toBe(true);
      if (result.codes[0] !== undefined) {
        expect(result.codes[0].content).toContain('isOpen ?');

        // Verify the ternary moved before Header
        const headerIndex = result.codes[0].content.indexOf('<Header />');
        const ternaryIndex = result.codes[0].content.indexOf('isOpen ?');
        expect(ternaryIndex).toBeLessThan(headerIndex);
      }
    });
  });

  describe('Mixed Expression Types', () => {
    it('should move conditional expression with dependencies', () => {
      const files = [
        {
          path: 'Component.tsx',
          content: `
function Parent() {
  const [isVisible, setIsVisible] = React.useState(true);
  return (
    <div>
      <Header />
      {isVisible && <Content onHide={() => setIsVisible(false)} />}
      <Footer />
    </div>
  );
}

function Header() {
  return <h1>Header</h1>;
}

function Content({ onHide }: { onHide: () => void }) {
  return <div onClick={onHide}>Content</div>;
}

function Footer() {
  return <div>Footer</div>;
}
          `.trim(),
        },
      ];

      const result = regraft(
        files,
        { file: 'Component.tsx', line: 6, column: 6 }, // {isVisible && <Content />}
        { file: 'Component.tsx', line: 7, column: 6 }, // <Footer />
        Move.After
      );

      // This should work - the conditional expression and its dependencies
      // (isVisible, setIsVisible) should be handled as an atomic unit
      expect(result.success).toBe(true);
      if (result.codes[0] !== undefined) {
        expect(result.codes[0].content).toContain('isVisible &&');
        expect(result.codes[0].content).toContain('setIsVisible');
      }
    });
  });
});
