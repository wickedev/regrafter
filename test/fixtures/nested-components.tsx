// @ts-nocheck
/**
 * Nested Components Fixture
 *
 * Purpose: Test element movement in deeply nested component hierarchies
 * Scenarios:
 * - Parent-child element movement
 * - Sibling movement at different nesting levels
 * - Prop threading through component tree
 * - LCA (Lowest Common Ancestor) computation
 */
import React, { useState } from 'react';

// Basic nesting
export function Parent() {
  return (
    <div className="parent">
      <Child />
    </div>
  );
}

function Child() {
  return (
    <div className="child">
      <Grandchild />
    </div>
  );
}

function Grandchild() {
  return (
    <span className="grandchild">Grandchild content</span>
  );
}

// Deep nesting with data flow
export function DeepNestingComponent() {
  const [value, setValue] = useState('root');

  return (
    <div className="level-0">
      <Level1 value={value} onChange={setValue}>
        <span className="root-content">Root: {value}</span>
      </Level1>
    </div>
  );
}

interface LevelProps {
  value: string;
  onChange: (v: string) => void;
  children?: React.ReactNode;
}

function Level1({ value, onChange, children }: LevelProps) {
  return (
    <div className="level-1">
      <div className="level-1-header">
        <h2>Level 1</h2>
      </div>
      <Level2 value={value} onChange={onChange}>
        {children}
      </Level2>
    </div>
  );
}

function Level2({ value, onChange, children }: LevelProps) {
  return (
    <div className="level-2">
      <Level3 value={value} onChange={onChange}>
        {children}
      </Level3>
      <div className="level-2-footer">
        <span>Level 2 Footer</span>
      </div>
    </div>
  );
}

function Level3({ value, onChange, children }: LevelProps) {
  return (
    <div className="level-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="deep-input"
      />
      <div className="level-3-content">
        {children}
      </div>
    </div>
  );
}

// Multiple children at each level
export function TreeComponent() {
  return (
    <div className="tree-root">
      <Branch id="a">
        <Leaf id="a1" />
        <Leaf id="a2" />
      </Branch>
      <Branch id="b">
        <Leaf id="b1" />
        <Branch id="b-inner">
          <Leaf id="b-inner-1" />
          <Leaf id="b-inner-2" />
        </Branch>
      </Branch>
      <Branch id="c">
        <Leaf id="c1" />
      </Branch>
    </div>
  );
}

function Branch({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className={`branch branch-${id}`}>
      <span className="branch-label">Branch: {id}</span>
      <div className="branch-children">
        {children}
      </div>
    </div>
  );
}

function Leaf({ id }: { id: string }) {
  return (
    <span className={`leaf leaf-${id}`}>Leaf: {id}</span>
  );
}

// Siblings with shared parent state
export function SiblingInteractionComponent() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="sibling-container">
      <Sibling
        id="first"
        isSelected={selectedId === 'first'}
        onSelect={() => setSelectedId('first')}
      />
      <Sibling
        id="second"
        isSelected={selectedId === 'second'}
        onSelect={() => setSelectedId('second')}
      />
      <Sibling
        id="third"
        isSelected={selectedId === 'third'}
        onSelect={() => setSelectedId('third')}
      />
    </div>
  );
}

function Sibling({ id, isSelected, onSelect }: { id: string; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      className={`sibling sibling-${id} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      {id} {isSelected && '(selected)'}
    </button>
  );
}

// Mixed nesting with fragments
export function MixedNestingComponent() {
  return (
    <div className="mixed-root">
      <header>
        <h1>Header</h1>
        <>
          <nav>
            <a href="#home">Home</a>
            <a href="#about">About</a>
          </nav>
        </>
      </header>
      <main>
        <article>
          <section className="intro">
            <p>Introduction paragraph</p>
          </section>
          <section className="content">
            <>
              <p>Content paragraph 1</p>
              <p>Content paragraph 2</p>
            </>
          </section>
        </article>
      </main>
      <footer>
        <p>Footer content</p>
      </footer>
    </div>
  );
}

// Component that renders children at different levels
export function SlotComponent() {
  return (
    <Container>
      <Container.Header>
        <h1>Title</h1>
      </Container.Header>
      <Container.Body>
        <p>Body content</p>
      </Container.Body>
      <Container.Footer>
        <small>Footer</small>
      </Container.Footer>
    </Container>
  );
}

interface ContainerComponent extends React.FC<{ children: React.ReactNode }> {
  Header: React.FC<{ children: React.ReactNode }>;
  Body: React.FC<{ children: React.ReactNode }>;
  Footer: React.FC<{ children: React.ReactNode }>;
}

const Container: ContainerComponent = ({ children }) => {
  return <div className="slot-container">{children}</div>;
};

Container.Header = ({ children }) => (
  <header className="slot-header">{children}</header>
);

Container.Body = ({ children }) => (
  <main className="slot-body">{children}</main>
);

Container.Footer = ({ children }) => (
  <footer className="slot-footer">{children}</footer>
);
