/**
 * Conditional Rendering Fixture
 *
 * Purpose: Test atomic unit detection for conditional expressions
 * Scenarios:
 * - Logical AND (&&) conditional rendering
 * - Ternary conditional rendering
 * - Nested conditionals
 * - Conditionals with dependencies
 */
import React, { useState } from 'react';

// Basic AND conditional
export function BasicConditionalComponent({ isVisible }: { isVisible: boolean }) {
  return (
    <div className="conditional-container">
      {isVisible && <span className="conditional-content">Visible content</span>}
    </div>
  );
}

// Basic ternary
export function TernaryComponent({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="ternary-container">
      {isLoggedIn ? (
        <span className="logged-in">Welcome back!</span>
      ) : (
        <span className="logged-out">Please log in</span>
      )}
    </div>
  );
}

// Multiple conditionals
export function MultipleConditionalsComponent({
  showHeader,
  showContent,
  showFooter
}: {
  showHeader: boolean;
  showContent: boolean;
  showFooter: boolean;
}) {
  return (
    <div className="multi-conditional">
      {showHeader && (
        <header className="cond-header">
          <h1>Header</h1>
        </header>
      )}
      {showContent && (
        <main className="cond-content">
          <p>Main content</p>
        </main>
      )}
      {showFooter && (
        <footer className="cond-footer">
          <small>Footer</small>
        </footer>
      )}
    </div>
  );
}

// Nested ternary
export function NestedTernaryComponent({ status }: { status: 'loading' | 'success' | 'error' }) {
  return (
    <div className="nested-ternary">
      {status === 'loading' ? (
        <span className="status-loading">Loading...</span>
      ) : status === 'success' ? (
        <span className="status-success">Success!</span>
      ) : (
        <span className="status-error">Error occurred</span>
      )}
    </div>
  );
}

// Conditional with state dependency
export function ConditionalWithStateComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <div className="conditional-state">
      <button onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? 'Close' : 'Open'}
      </button>
      {isOpen && (
        <div className="panel">
          <span className="count-display">Count: {count}</span>
          <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
      )}
    </div>
  );
}

// Conditional with complex expression
export function ComplexConditionalComponent({
  user,
  permissions
}: {
  user: { name: string; role: string } | null;
  permissions: string[];
}) {
  return (
    <div className="complex-conditional">
      {user && permissions.includes('admin') && (
        <div className="admin-panel">
          <h2>Admin Panel</h2>
          <span>Welcome, {user.name}</span>
        </div>
      )}
      {user && !permissions.includes('admin') && (
        <div className="user-panel">
          <h2>User Panel</h2>
          <span>Hello, {user.name}</span>
        </div>
      )}
      {!user && (
        <div className="guest-panel">
          <span>Please log in to continue</span>
        </div>
      )}
    </div>
  );
}

// Ternary with element attributes
export function TernaryAttributesComponent({ isActive }: { isActive: boolean }) {
  return (
    <div className="ternary-attrs">
      <button
        className={isActive ? 'active-button' : 'inactive-button'}
        disabled={!isActive}
      >
        {isActive ? 'Active' : 'Inactive'}
      </button>
    </div>
  );
}

// Conditionals in JSX expressions
export function ExpressionConditionalsComponent({
  items,
  showEmpty
}: {
  items: string[];
  showEmpty: boolean;
}) {
  return (
    <div className="expression-conditionals">
      {items.length > 0 ? (
        <ul className="item-list">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : showEmpty ? (
        <div className="empty-state">No items found</div>
      ) : null}
    </div>
  );
}

// Conditional rendering with fragments
export function ConditionalFragmentComponent({ showBoth }: { showBoth: boolean }) {
  return (
    <div className="conditional-fragment">
      {showBoth ? (
        <>
          <span className="first">First element</span>
          <span className="second">Second element</span>
        </>
      ) : (
        <span className="single">Single element</span>
      )}
    </div>
  );
}

// Early return conditional pattern
export function EarlyReturnComponent({ data }: { data: string[] | null }) {
  if (!data) {
    return (
      <div className="loading-state">
        <span>Loading...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <span>No data available</span>
      </div>
    );
  }

  return (
    <div className="data-display">
      <ul>
        {data.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// Inline conditional with function call
export function InlineConditionalComponent({ getValue }: { getValue: () => string | null }) {
  const value = getValue();

  return (
    <div className="inline-conditional">
      {value && <span className="value-display">{value}</span>}
      {!value && <span className="no-value">No value</span>}
    </div>
  );
}

// Conditional with callback
export function ConditionalCallbackComponent({
  onSuccess,
  onError
}: {
  onSuccess?: () => void;
  onError?: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleAction = () => {
    const isSuccess = Math.random() > 0.5;
    if (isSuccess) {
      setStatus('success');
      onSuccess?.();
    } else {
      setStatus('error');
      onError?.();
    }
  };

  return (
    <div className="conditional-callback">
      <button onClick={handleAction}>Perform Action</button>
      {status === 'success' && (
        <div className="success-message">
          <span>Operation successful!</span>
        </div>
      )}
      {status === 'error' && (
        <div className="error-message">
          <span>Operation failed!</span>
        </div>
      )}
    </div>
  );
}
