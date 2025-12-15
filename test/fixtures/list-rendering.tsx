/**
 * List Rendering Fixture
 *
 * Purpose: Test atomic unit detection for map expressions
 * Scenarios:
 * - Basic array.map() rendering
 * - Filtered lists (filter + map)
 * - Nested list rendering
 * - Lists with complex item components
 * - Lists with state dependencies
 */
import React, { useState, useMemo, useCallback } from 'react';

// Basic map rendering
export function BasicListComponent({ items }: { items: string[] }) {
  return (
    <ul className="basic-list">
      {items.map((item, index) => (
        <li key={index} className="list-item">{item}</li>
      ))}
    </ul>
  );
}

// Map with object items
export function ObjectListComponent({
  users
}: {
  users: Array<{ id: string; name: string; email: string }>;
}) {
  return (
    <div className="user-list">
      {users.map((user) => (
        <div key={user.id} className="user-card">
          <h3 className="user-name">{user.name}</h3>
          <span className="user-email">{user.email}</span>
        </div>
      ))}
    </div>
  );
}

// Filter + Map
export function FilteredListComponent({
  items,
  minLength
}: {
  items: string[];
  minLength: number;
}) {
  return (
    <ul className="filtered-list">
      {items
        .filter((item) => item.length >= minLength)
        .map((item, index) => (
          <li key={index} className="filtered-item">{item}</li>
        ))
      }
    </ul>
  );
}

// Nested lists
export function NestedListComponent({
  categories
}: {
  categories: Array<{ name: string; items: string[] }>;
}) {
  return (
    <div className="nested-list">
      {categories.map((category) => (
        <div key={category.name} className="category">
          <h4 className="category-name">{category.name}</h4>
          <ul className="category-items">
            {category.items.map((item, index) => (
              <li key={index} className="nested-item">{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// List with state
export function StatefulListComponent() {
  const [items, setItems] = useState(['Apple', 'Banana', 'Cherry']);
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (newItem.trim()) {
      setItems([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="stateful-list">
      <div className="add-item">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="New item"
        />
        <button onClick={addItem}>Add</button>
      </div>
      <ul className="item-list">
        {items.map((item, index) => (
          <li key={index} className="list-item">
            <span>{item}</span>
            <button onClick={() => removeItem(index)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// List with useMemo
export function MemoizedListComponent({
  items,
  searchTerm
}: {
  items: string[];
  searchTerm: string;
}) {
  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  return (
    <ul className="memoized-list">
      {filteredItems.map((item, index) => (
        <li key={index} className="memo-item">{item}</li>
      ))}
    </ul>
  );
}

// List with selection state
export function SelectableListComponent({
  items
}: {
  items: Array<{ id: string; label: string }>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="selectable-list">
      {items.map((item) => (
        <div
          key={item.id}
          className={`selectable-item ${selectedIds.has(item.id) ? 'selected' : ''}`}
          onClick={() => toggleSelection(item.id)}
        >
          <input
            type="checkbox"
            checked={selectedIds.has(item.id)}
            onChange={() => toggleSelection(item.id)}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// List with conditional rendering
export function ConditionalListComponent({
  items,
  showEvenOnly
}: {
  items: number[];
  showEvenOnly: boolean;
}) {
  return (
    <ul className="conditional-list">
      {items.map((item, index) => (
        showEvenOnly && item % 2 !== 0 ? null : (
          <li key={index} className="conditional-item">
            {item}
          </li>
        )
      ))}
    </ul>
  );
}

// List with complex item component
interface Product {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
}

export function ProductListComponent({
  products,
  onAddToCart
}: {
  products: Product[];
  onAddToCart: (id: string) => void;
}) {
  return (
    <div className="product-list">
      {products.map((product) => (
        <div key={product.id} className="product-card">
          <h3 className="product-name">{product.name}</h3>
          <span className="product-price">${product.price.toFixed(2)}</span>
          {product.inStock ? (
            <button
              className="add-to-cart"
              onClick={() => onAddToCart(product.id)}
            >
              Add to Cart
            </button>
          ) : (
            <span className="out-of-stock">Out of Stock</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Virtualized-like list pattern
export function WindowedListComponent({
  items,
  startIndex,
  endIndex
}: {
  items: string[];
  startIndex: number;
  endIndex: number;
}) {
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div className="windowed-list">
      <div className="spacer-top" style={{ height: startIndex * 30 }} />
      {visibleItems.map((item, index) => (
        <div
          key={startIndex + index}
          className="windowed-item"
          style={{ height: 30 }}
        >
          {item}
        </div>
      ))}
      <div className="spacer-bottom" style={{ height: (items.length - endIndex) * 30 }} />
    </div>
  );
}

// List with index-based styling
export function StyledListComponent({ items }: { items: string[] }) {
  return (
    <ul className="styled-list">
      {items.map((item, index) => (
        <li
          key={index}
          className={`styled-item ${index % 2 === 0 ? 'even' : 'odd'}`}
          style={{
            backgroundColor: index % 2 === 0 ? '#f5f5f5' : '#ffffff'
          }}
        >
          <span className="item-index">{index + 1}.</span>
          <span className="item-content">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Empty state handling
export function ListWithEmptyStateComponent({ items }: { items: string[] }) {
  return (
    <div className="list-with-empty">
      {items.length > 0 ? (
        <ul className="populated-list">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <span>No items to display</span>
          <small>Add some items to get started</small>
        </div>
      )}
    </div>
  );
}
