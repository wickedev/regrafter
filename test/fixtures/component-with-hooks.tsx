/**
 * Component With Hooks Fixture
 *
 * Purpose: Test dependency detection and hoisting for React hooks
 * Scenarios:
 * - useState dependency detection
 * - useEffect dependency detection
 * - useCallback/useMemo dependency detection
 * - useRef dependency detection
 * - Custom hook dependency detection
 * - Hook hoisting to valid locations
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Basic useState
export function CounterComponent() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <span className="count-display">Count: {count}</span>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
    </div>
  );
}

// Multiple useState hooks
export function FormComponent() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-field">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-field">
        <label>Email:</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="submit">Submit</button>
        {submitted && <span>Form submitted!</span>}
      </div>
    </form>
  );
}

// useEffect with dependencies
export function DataFetcherComponent({ userId }: { userId: string }) {
  const [data, setData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      });
  }, [userId]);

  return (
    <div className="data-fetcher">
      {loading ? (
        <span className="loading">Loading...</span>
      ) : (
        <div className="data-display">{data}</div>
      )}
    </div>
  );
}

// useCallback and useMemo
export function OptimizedComponent({ items }: { items: string[] }) {
  const [filter, setFilter] = useState('');

  const filteredItems = useMemo(() => {
    return items.filter(item => item.includes(filter));
  }, [items, filter]);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  }, []);

  return (
    <div className="optimized">
      <input
        className="filter-input"
        value={filter}
        onChange={handleFilterChange}
        placeholder="Filter items"
      />
      <ul className="item-list">
        {filteredItems.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// useRef
export function FocusableComponent() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="focusable">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="focusable-input"
      />
      <button onClick={focusInput} className="focus-button">Focus Input</button>
      <span className="current-value">Current: {value}</span>
    </div>
  );
}

// Custom hook
function useCounter(initialValue: number = 0) {
  const [count, setCount] = useState(initialValue);
  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);
  return { count, increment, decrement };
}

export function CustomHookComponent() {
  const { count, increment, decrement } = useCounter(10);

  return (
    <div className="custom-hook-component">
      <span className="count">Count: {count}</span>
      <div className="actions">
        <button onClick={increment}>+</button>
        <button onClick={decrement}>-</button>
      </div>
    </div>
  );
}

// Component with multiple hook types
export function ComplexHooksComponent({ initialData }: { initialData: string }) {
  const [data, setData] = useState(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    // Save logic would go here
  }, []);

  const displayData = useMemo(() => {
    return data.toUpperCase();
  }, [data]);

  return (
    <div className="complex-hooks">
      {isEditing ? (
        <div className="edit-mode">
          <input
            ref={inputRef}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
          <button onClick={handleSave}>Save</button>
        </div>
      ) : (
        <div className="view-mode">
          <span className="display">{displayData}</span>
          <button onClick={() => setIsEditing(true)}>Edit</button>
        </div>
      )}
    </div>
  );
}
