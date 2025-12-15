// @ts-nocheck
/**
 * Simple Component Fixture
 *
 * Purpose: Test basic JSX element movement without dependencies
 * Scenarios:
 * - Move sibling elements (before/after)
 * - Move elements inside containers
 * - Basic selector resolution (position and path)
 */
import React from 'react';

export function SimpleComponent() {
  return (
    <div className="container">
      <header>
        <h1>Title</h1>
      </header>
      <main>
        <p>Content paragraph</p>
        <span>Inline text</span>
      </main>
      <footer>
        <small>Footer text</small>
      </footer>
    </div>
  );
}

export function ComponentWithProps({ title, content }: { title: string; content: string }) {
  return (
    <article>
      <h2>{title}</h2>
      <p>{content}</p>
    </article>
  );
}

export function EmptyContainer() {
  return (
    <div className="empty-container">
      {/* This container has no children */}
    </div>
  );
}

export function FragmentComponent() {
  return (
    <>
      <span>First</span>
      <span>Second</span>
      <span>Third</span>
    </>
  );
}

export function SelfClosingElements() {
  return (
    <div>
      <img src="/image.png" alt="Test" />
      <input type="text" placeholder="Enter text" />
      <br />
      <hr />
    </div>
  );
}
