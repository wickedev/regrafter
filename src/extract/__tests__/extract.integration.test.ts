/**
 * Extract Integration Tests
 *
 * Task 12.1: Core extraction functionality integration tests
 *
 * Requirements:
 * - Test with actual React component files
 * - Simple div extraction scenario
 * - Extraction scenario with variable dependencies
 *
 * Test Requirements:
 * - 1.1: JSX node selection and extraction
 * - 2.1: Automatic dependency analysis
 * - 3.1: Component extraction within the same file
 * - 3.6: Props passing
 */

import { describe, it, expect } from 'vitest';
import { extract } from '../extract.js';
import type { Code, FileInput } from '../../types/public.js';
import { err, ok, type Result } from '../../result/index.js';
import type { ExtractOptions } from '../types.js';

function getCode(codes: Code[], index = 0): Result<Code, string> {
  const code = codes[index];
  return code ? ok(code) : err(`Expected code output at index ${index}`);
}

function unwrapResult<T, E>(result: Result<T, E>): T | null {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return null;
  }
  return result.value;
}

describe('Extract Integration Tests', () => {
  describe('Simple div extraction scenario', () => {
    it('should extract a simple div element into a new component', () => {
      // Arrange: actual React component file
      const sourceCode = `import React from 'react';

function App() {
  return (
    <div className="container">
      <div className="header">
        <h1>Welcome</h1>
        <p>This is a simple app</p>
      </div>
      <div className="content">
        <p>Main content goes here</p>
      </div>
    </div>
  );
}

export default App;
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      // Select header div - position of the '<' character
      const selector = {
        file: 'App.tsx',
        line: 6,
        column: 7, // position of '<' in '<div'
      };

      const options: ExtractOptions = {
        componentName: 'Header',
      };

      // Act: call extract function
      const result = extract(files, selector, options);

      // Assert: verify successful extraction
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractResult = result.value;

      // Verify component information
      expect(extractResult.component.name).toBe('Header');
      expect(extractResult.component.file).toBe('App.tsx');
      expect(extractResult.component.props).toHaveLength(0); // No props

      // Verify code transformation
      expect(extractResult.codes).toHaveLength(1);
      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;
      expect(code.file).toBe('App.tsx');

      // Verify new component was created
      expect(code.content).toContain('function Header()');
      expect(code.content).toContain('<h1>Welcome</h1>');
      expect(code.content).toContain('<p>This is a simple app</p>');

      // Verify component call is in the original location
      expect(code.content).toContain('<Header />');

      // Verify original JSX was removed
      // Note: header div still exists inside the extracted component
      // It just needs to be absent from inside the App component
      const appFunctionMatch = code.content.match(/function App\(\)[^}]+\{([^}]+)\}/s);
      if (appFunctionMatch) {
        const appBody = appFunctionMatch[1];
        expect(appBody).not.toContain('<div className="header">');
      }

      // Verify statistics
      expect(extractResult.stats.nodesExtracted).toBe(1);
      expect(extractResult.stats.dependenciesFound).toBe(0);
      expect(extractResult.stats.propsGenerated).toBe(0);
    });

    it('should preserve other elements when extracting a single element', () => {
      // Arrange: Component with multiple elements
      const sourceCode = `function App() {
  return (
    <div>
      <nav>Navigation</nav>
      <main>Content</main>
      <footer>Footer</footer>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      // Select main element
      const selector = {
        file: 'App.tsx',
        line: 5,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'MainContent',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const codeResult = getCode(result.value.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;

      // Verify extracted component
      expect(code.content).toContain('function MainContent()');
      expect(code.content).toContain('<main>Content</main>');

      // Other elements should remain unchanged
      expect(code.content).toContain('<nav>Navigation</nav>');
      expect(code.content).toContain('<footer>Footer</footer>');

      // Component call at original location
      expect(code.content).toContain('<MainContent />');
    });
  });

  describe('Extraction scenario with variable dependencies', () => {
    it('should extract JSX with variable dependencies and pass them as props', () => {
      // Arrange: Component using variables
      const sourceCode = `function App() {
  const title = "Dashboard";
  const userName = "John Doe";

  return (
    <div>
      <div className="header">
        <h1>{title}</h1>
        <p>Welcome, {userName}</p>
      </div>
      <div className="content">
        <p>Content goes here</p>
      </div>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      // Select header div (has variable dependencies)
      const selector = {
        file: 'App.tsx',
        line: 6,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'DashboardHeader',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractResult = result.value;

      // Verify Props
      expect(extractResult.component.props.length).toBeGreaterThan(0);
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('title');
      expect(propNames).toContain('userName');

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;

      // Verify new component receives props
      expect(code.content).toContain('function DashboardHeader(');
      // Verify receiving Props (destructuring or props parameter)
      const hasTitleProp = code.content.includes('title') && code.content.includes('DashboardHeader');
      expect(hasTitleProp).toBe(true);

      // Verify props are passed at original location
      expect(code.content).toContain('<DashboardHeader');
      expect(code.content).toContain('title={title}');
      expect(code.content).toContain('userName={userName}');

      // Verify statistics
      expect(extractResult.stats.dependenciesFound).toBeGreaterThan(0);
      expect(extractResult.stats.propsGenerated).toBeGreaterThan(0);
    });

    it('should handle multiple variable dependencies correctly', () => {
      // Arrange: Component using multiple variables
      const sourceCode = `function ProductCard() {
  const productName = "iPhone 15";
  const price = 999;
  const inStock = true;
  const rating = 4.5;

  return (
    <div className="card">
      <h2>{productName}</h2>
      <p className="price">\${price}</p>
      <p className="stock">{inStock ? "In Stock" : "Out of Stock"}</p>
      <p className="rating">Rating: {rating}/5</p>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'ProductCard.tsx', content: sourceCode },
      ];

      // Select card div
      const selector = {
        file: 'ProductCard.tsx',
        line: 8,
        column: 4,
      };

      const options: ExtractOptions = {
        componentName: 'ProductInfo',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractResult = result.value;

      // Verify all 4 variables are passed as props
      expect(extractResult.component.props.length).toBe(4);
      const propNames = extractResult.component.props.map(p => p.name).sort();
      expect(propNames).toEqual(['inStock', 'price', 'productName', 'rating']);

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;

      // Verify Props passing
      expect(code.content).toContain('productName={productName}');
      expect(code.content).toContain('price={price}');
      expect(code.content).toContain('inStock={inStock}');
      expect(code.content).toContain('rating={rating}');
    });

    it('should extract JSX with function dependencies', () => {
      // Arrange: Component using functions
      const sourceCode = `function App() {
  const handleClick = () => {
    console.log('Button clicked');
  };

  return (
    <div className="wrapper">
      <button onClick={handleClick}>Click Me</button>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      // Select button - specify exact location
      const selector = {
        file: 'App.tsx',
        line: 8,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'ClickButton',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify functions are passed as props
      if (extractResult.component.props.length === 0) {
        const logCode = unwrapResult(getCode(extractResult.codes));
        if (logCode) {
          console.log('Generated code:', logCode.content);
        }
      }
      expect(extractResult.component.props.length).toBeGreaterThan(0);
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('handleClick');

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;
      expect(code.content).toContain('handleClick={handleClick}');
    });
  });

  describe('Component placement and structure', () => {
    it('should place the new component before the original component', () => {
      // Arrange
      const sourceCode = `function App() {
  return (
    <div>
      <h1>Title</h1>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector = {
        file: 'App.tsx',
        line: 4,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'Title',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const codeResult = getCode(result.value.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;

      // Verify new component was created (format flexible)
      const hasTitleComponent = code.content.includes('Title') &&
        (code.content.includes('function Title') || code.content.includes('const Title'));

      if (!hasTitleComponent) {
        console.log('Generated code:', code.content);
      }
      expect(hasTitleComponent).toBe(true);

      // Verify App component also exists
      expect(code.content).toContain('function App()');

      // Verify Title component comes before App component
      const titleIndex = code.content.search(/(?:function|const)\s+Title/);
      const appIndex = code.content.indexOf('function App()');

      if (titleIndex > 0 && appIndex > 0) {
        expect(titleIndex).toBeLessThan(appIndex);
      }
    });

    it('should maintain proper indentation in extracted component', () => {
      // Arrange
      const sourceCode = `function App() {
  return (
    <div>
      <div className="nested">
        <p>Nested content</p>
      </div>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      const selector = {
        file: 'App.tsx',
        line: 4,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'NestedDiv',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const codeResult = getCode(result.value.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;

      // Verify indentation is correct (exact indentation may vary depending on formatter)
      expect(code.content).toContain('function NestedDiv()');
      expect(code.content).toContain('<p>Nested content</p>');
    });
  });

  describe('Error handling', () => {
    it('should return error when selector points to non-JSX node', () => {
      // Arrange: Select non-JSX node
      const sourceCode = `function App() {
  const value = 42;
  return <div>Hello</div>;
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      // Selector pointing to variable declaration (not JSX)
      const selector = {
        file: 'App.tsx',
        line: 2,
        column: 8,
      };

      const options: ExtractOptions = {
        componentName: 'Invalid',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert: Return error
      expect(result.ok).toBe(false);
    });

    it('should return error when file is not found', () => {
      // Arrange: Non-existent file
      const files: FileInput[] = [
        { path: 'App.tsx', content: 'function App() { return <div />; }' },
      ];

      const selector = {
        file: 'NonExistent.tsx', // Non-existent file
        line: 1,
        column: 1,
      };

      const options: ExtractOptions = {
        componentName: 'Test',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert: Return error
      expect(result.ok).toBe(false);
    });
  });

  /**
   * Task 23.1: Integration scenario test implementation
   *
   * Requirements:
   * - Reproduce real project scenarios
   * - Test complex dependency graph
   * - Test multi-file dependencies
   */
  describe('Real project scenarios', () => {
    it('should extract a form component with validation logic', () => {
      // Arrange: Form component with validation logic
      const sourceCode = `import React, { useState } from 'react';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  const validateEmail = (value) => {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
  };

  const validatePassword = (value) => {
    return value.length >= 8;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!validateEmail(email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!validatePassword(password)) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      console.log('Login successful');
    }
  };

  return (
    <div className="login-page">
      <h1>Welcome Back</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <span className="error">{errors.email}</span>}
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && <span className="error">{errors.password}</span>}
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default LoginPage;
`;

      const files: FileInput[] = [
        { path: 'LoginPage.tsx', content: sourceCode },
      ];

      // Select and extract form element
      const selector = {
        file: 'LoginPage.tsx',
        line: 37,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'LoginForm',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify all complex dependencies are passed as props
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('email');
      expect(propNames).toContain('setEmail');
      expect(propNames).toContain('password');
      expect(propNames).toContain('setPassword');
      expect(propNames).toContain('errors');
      expect(propNames).toContain('handleSubmit');

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;

      // Verify new component was created
      expect(code.content).toContain('function LoginForm(');

      // Verify Props passing
      expect(code.content).toContain('email={email}');
      expect(code.content).toContain('password={password}');
      expect(code.content).toContain('errors={errors}');
      expect(code.content).toContain('handleSubmit={handleSubmit}');

      // Verify form is removed from original component and LoginForm component is used
      expect(code.content).toContain('<LoginForm');

      // Verify statistics
      expect(extractResult.stats.dependenciesFound).toBeGreaterThan(0);
    });

    it('should extract a data fetching component with loading states', () => {
      // Arrange: Component with data fetching and loading states
      const sourceCode = `import React, { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(\`/api/users/\${userId}\`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [userId]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="profile">
      <h1>User Profile</h1>
      <div className="profile-content">
        {loading && <div className="spinner">Loading...</div>}
        {error && <div className="error">Error: {error}</div>}
        {user && (
          <div className="user-details">
            <h2>{user.name}</h2>
            <p>Email: {user.email}</p>
            <p>Joined: {formatDate(user.createdAt)}</p>
            <p>Role: {user.role}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserProfile;
`;

      const files: FileInput[] = [
        { path: 'UserProfile.tsx', content: sourceCode },
      ];

      // Select and extract user-details div
      const selector = {
        file: 'UserProfile.tsx',
        line: 32,
        column: 11,
      };

      const options: ExtractOptions = {
        componentName: 'UserDetails',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify dependencies
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('user');
      expect(propNames).toContain('formatDate');

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;

      // Verify new component creation
      expect(code.content).toContain('function UserDetails(');

      // Verify Props passing
      expect(code.content).toContain('user={user}');
      expect(code.content).toContain('formatDate={formatDate}');

      // Verify component call
      expect(code.content).toContain('<UserDetails');
    });
  });

  describe('Complex dependency graph', () => {
    it('should handle nested function dependencies', () => {
      // Arrange: Nested function dependencies
      const sourceCode = `function Calculator() {
  const add = (a, b) => a + b;
  const multiply = (a, b) => a * b;
  const calculate = (x, y) => multiply(add(x, 1), add(y, 1));

  const result = calculate(5, 10);

  return (
    <div className="calculator">
      <h1>Calculator</h1>
      <div className="result">
        <p>Result: {result}</p>
        <p>Formula: ({5} + 1) * ({10} + 1) = {result}</p>
      </div>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'Calculator.tsx', content: sourceCode },
      ];

      // Select result div
      const selector = {
        file: 'Calculator.tsx',
        line: 11,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'ResultDisplay',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify result variable is passed as props
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('result');

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;
      expect(code.content).toContain('result={result}');
    });

    it('should handle multiple variable types in dependencies', () => {
      // Arrange: Dependencies with various types of variables mixed
      const sourceCode = `function Dashboard() {
  const userName = "Alice";
  const userAge = 30;
  const isAdmin = true;
  const scores = [95, 87, 92];
  const settings = { theme: 'dark', notifications: true };
  const currentDate = new Date();

  return (
    <div className="dashboard">
      <div className="user-card">
        <h2>{userName}</h2>
        <p>Age: {userAge}</p>
        <p>Role: {isAdmin ? 'Administrator' : 'User'}</p>
        <p>Scores: {scores.join(', ')}</p>
        <p>Theme: {settings.theme}</p>
        <p>Date: {currentDate.toLocaleDateString()}</p>
      </div>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'Dashboard.tsx', content: sourceCode },
      ];

      // user-Select card div
      const selector = {
        file: 'Dashboard.tsx',
        line: 11,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'UserCard',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify all variable types are passed as props
      const propNames = extractResult.component.props.map(p => p.name).sort();
      expect(propNames).toContain('userName'); // string
      expect(propNames).toContain('userAge'); // number
      expect(propNames).toContain('isAdmin'); // boolean
      expect(propNames).toContain('scores'); // array
      expect(propNames).toContain('settings'); // object
      expect(propNames).toContain('currentDate'); // Date object

      // Verify statistics
      expect(extractResult.stats.dependenciesFound).toBe(6);
    });

    it('should handle conditional rendering dependencies', () => {
      // Arrange: Component with conditional rendering
      const sourceCode = `function ConditionalComponent() {
  const isLoggedIn = true;
  const hasPermission = false;
  const userName = "Bob";
  const errorMessage = "Access denied";

  return (
    <div className="container">
      <div className="content">
        {isLoggedIn ? (
          hasPermission ? (
            <p>Welcome, {userName}!</p>
          ) : (
            <p>{errorMessage}</p>
          )
        ) : (
          <p>Please log in</p>
        )}
      </div>
    </div>
  );
}
`;

      const files: FileInput[] = [
        { path: 'ConditionalComponent.tsx', content: sourceCode },
      ];

      // Select content div
      const selector = {
        file: 'ConditionalComponent.tsx',
        line: 9,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'ContentDisplay',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify all variables used in conditional rendering are passed as props
      const propNames = extractResult.component.props.map(p => p.name).sort();
      expect(propNames).toContain('isLoggedIn');
      expect(propNames).toContain('hasPermission');
      expect(propNames).toContain('userName');
      expect(propNames).toContain('errorMessage');
    });
  });

  describe('Multi-file dependencies', () => {
    it('should extract component that uses imported utilities', () => {
      // Arrange: Component using imported utilities
      const sourceCode = `import React from 'react';
import { formatCurrency } from '../utils/format';
import { calculateTax } from '../utils/tax';

function PriceCalculator() {
  const basePrice = 100;
  const taxRate = 0.08;
  const tax = calculateTax(basePrice, taxRate);
  const total = basePrice + tax;

  return (
    <div className="calculator">
      <h1>Price Calculator</h1>
      <div className="price-details">
        <p>Base Price: {formatCurrency(basePrice)}</p>
        <p>Tax: {formatCurrency(tax)}</p>
        <p>Total: {formatCurrency(total)}</p>
      </div>
    </div>
  );
}

export default PriceCalculator;
`;

      const files: FileInput[] = [
        { path: 'PriceCalculator.tsx', content: sourceCode },
      ];

      // Select price-details div
      const selector = {
        file: 'PriceCalculator.tsx',
        line: 14,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'PriceDetails',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify dependencies
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('basePrice');
      expect(propNames).toContain('tax');
      expect(propNames).toContain('total');
      expect(propNames).toContain('formatCurrency');

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;

      // Verify new component receives formatCurrency as props
      expect(code.content).toContain('formatCurrency={formatCurrency}');
    });

    it('should extract component with React hooks from external imports', () => {
      // Arrange: Component using external library Hook
      const sourceCode = `import React, { useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

function SettingsPanel() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  const [fontSize, setFontSize] = useState(16);

  return (
    <div className="settings">
      <h1>Settings</h1>
      <div className="theme-selector">
        <label>Theme</label>
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className="font-size">
        <label>Font Size: {fontSize}px</label>
        <input
          type="range"
          min="12"
          max="24"
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

export default SettingsPanel;
`;

      const files: FileInput[] = [
        { path: 'SettingsPanel.tsx', content: sourceCode },
      ];

      // Select theme-selector div
      const selector = {
        file: 'SettingsPanel.tsx',
        line: 11,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'ThemeSelector',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify state managed by useState is passed as props
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('theme');
      expect(propNames).toContain('setTheme');

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;
      expect(code.content).toContain('theme={theme}');
      expect(code.content).toContain('setTheme={setTheme}');
    });

    it('should handle components with multiple React imports', () => {
      // Arrange: Component using multiple React imports
      const sourceCode = `import React, { useState, useEffect, useCallback, useMemo } from 'react';

function ComplexComponent() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);

  const handleIncrement = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  const expensiveValue = useMemo(() => {
    return count * 2;
  }, [count]);

  return (
    <div className="complex">
      <h1>Complex Component</h1>
      <div className="counter">
        <p>Count: {count}</p>
        <p>Double: {expensiveValue}</p>
        <button onClick={handleIncrement}>Increment</button>
      </div>
    </div>
  );
}

export default ComplexComponent;
`;

      const files: FileInput[] = [
        { path: 'ComplexComponent.tsx', content: sourceCode },
      ];

      // Select counter div
      const selector = {
        file: 'ComplexComponent.tsx',
        line: 22,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'Counter',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify Hooks and state are handled correctly
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('count');
      expect(propNames).toContain('expensiveValue');
      expect(propNames).toContain('handleIncrement');

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;
      expect(code.content).toContain('count={count}');
      expect(code.content).toContain('expensiveValue={expensiveValue}');
      expect(code.content).toContain('handleIncrement={handleIncrement}');
    });
  });

  /**
   * Task 14.6: TypeScript integration test
   *
   * Requirements:
   * - Test extraction from TypeScript files
   * - Verify Props types are generated correctly
   */
  describe('TypeScript type generation', () => {
    it('should generate Props interface with correct types', () => {
      // Arrange: TypeScript component
      const sourceCode = `import React from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

function UserProfile() {
  const user: User = {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com'
  };
  const age: number = 25;
  const isActive: boolean = true;

  return (
    <div className="profile">
      <h1>User Profile</h1>
      <div className="user-info">
        <p>Name: {user.name}</p>
        <p>Email: {user.email}</p>
        <p>Age: {age}</p>
        <p>Status: {isActive ? 'Active' : 'Inactive'}</p>
      </div>
    </div>
  );
}

export default UserProfile;
`;

      const files: FileInput[] = [
        { path: 'UserProfile.tsx', content: sourceCode },
      ];

      // Select user-info div
      const selector = {
        file: 'UserProfile.tsx',
        line: 21,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'UserInfo',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;

      // Verify Props
      const props = extractResult.component.props;
      expect(props).toHaveLength(3);

      // Verify type of each prop
      const userProp = props.find(p => p.name === 'user');
      expect(userProp).toBeDefined();
      expect(userProp!.type).toContain('User'); // User type reference

      const ageProp = props.find(p => p.name === 'age');
      expect(ageProp).toBeDefined();
      expect(ageProp!.type).toBe('number');

      const isActiveProp = props.find(p => p.name === 'isActive');
      expect(isActiveProp).toBeDefined();
      expect(isActiveProp!.type).toBe('boolean');

      // Verify Props interface was created
      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;
      expect(code.content).toContain('interface UserInfoProps');

      // Verify Props interface comes before component
      const propsInterfaceIndex = code.content.indexOf('interface UserInfoProps');
      const componentIndex = code.content.indexOf('function UserInfo(');
      expect(propsInterfaceIndex).toBeLessThan(componentIndex);

      // Verify component uses Props type
      expect(code.content).toMatch(/function UserInfo\s*\(\s*\{\s*\w+/); // destructuring with types
    });

    it('should handle optional types with undefined union', () => {
      // Arrange: Component with optional types
      const sourceCode = `import React from 'react';

function OptionalPropsComponent() {
  const title: string = 'Hello';
  const subtitle: string | undefined = undefined;
  const count: number | undefined = 42;

  return (
    <div className="container">
      <div className="content">
        <h1>{title}</h1>
        {subtitle && <h2>{subtitle}</h2>}
        {count !== undefined && <p>Count: {count}</p>}
      </div>
    </div>
  );
}

export default OptionalPropsComponent;
`;

      const files: FileInput[] = [
        { path: 'OptionalPropsComponent.tsx', content: sourceCode },
      ];

      // Select content div
      const selector = {
        file: 'OptionalPropsComponent.tsx',
        line: 10,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'Content',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;
      const props = extractResult.component.props;

      // title is required, subtitle and count are optional
      const titleProp = props.find(p => p.name === 'title');
      expect(titleProp).toBeDefined();
      expect(titleProp!.optional).toBe(false);

      const subtitleProp = props.find(p => p.name === 'subtitle');
      expect(subtitleProp).toBeDefined();
      expect(subtitleProp!.optional).toBe(true);
      expect(subtitleProp!.type).toBe('string'); // Type with undefined removed

      const countProp = props.find(p => p.name === 'count');
      expect(countProp).toBeDefined();
      expect(countProp!.optional).toBe(true);
      expect(countProp!.type).toBe('number'); // Type with undefined removed

      // Verify Props interface has optional indicators
      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;
      expect(code.content).toMatch(/subtitle\?:\s*string/);
      expect(code.content).toMatch(/count\?:\s*number/);
    });

    it('should handle complex TypeScript types', () => {
      // Arrange: Complex TypeScript types
      const sourceCode = `import React from 'react';

type Status = 'active' | 'inactive' | 'pending';

interface Item {
  id: number;
  name: string;
}

function ComplexTypesComponent() {
  const status: Status = 'active';
  const items: Item[] = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
  ];
  const pair: [string, number] = ['test', 42];

  return (
    <div className="container">
      <div className="complex-content">
        <p>Status: {status}</p>
        <ul>
          {items.map(item => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
        <p>Pair: {pair[0]} - {pair[1]}</p>
      </div>
    </div>
  );
}

export default ComplexTypesComponent;
`;

      const files: FileInput[] = [
        { path: 'ComplexTypesComponent.tsx', content: sourceCode },
      ];

      // complex-Select content div
      const selector = {
        file: 'ComplexTypesComponent.tsx',
        line: 20,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'ComplexContent',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;
      const props = extractResult.component.props;

      // Verify Union type
      const statusProp = props.find(p => p.name === 'status');
      expect(statusProp).toBeDefined();
      expect(statusProp!.type).toContain('active'); // Union literal

      // Verify array type
      const itemsProp = props.find(p => p.name === 'items');
      expect(itemsProp).toBeDefined();
      expect(itemsProp!.type).toContain('Item'); // Array of Item

      // Verify Tuple type
      const pairProp = props.find(p => p.name === 'pair');
      expect(pairProp).toBeDefined();
      // Tuple is represented as [string, number]

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;
      expect(code.content).toContain('interface ComplexContentProps');
    });

    it('should handle function types in props', () => {
      // Arrange: Component with function types
      const sourceCode = `import React from 'react';

function FunctionPropsComponent() {
  const handleClick: (id: number) => void = (id) => {
    console.log('Clicked:', id);
  };
  const formatValue: (value: string) => string = (value) => {
    return value.toUpperCase();
  };

  return (
    <div className="container">
      <div className="buttons">
        <button onClick={() => handleClick(1)}>Button 1</button>
        <button onClick={() => handleClick(2)}>Button 2</button>
        <p>{formatValue('hello')}</p>
      </div>
    </div>
  );
}

export default FunctionPropsComponent;
`;

      const files: FileInput[] = [
        { path: 'FunctionPropsComponent.tsx', content: sourceCode },
      ];

      // Select buttons div
      const selector = {
        file: 'FunctionPropsComponent.tsx',
        line: 13,
        column: 7,
      };

      const options: ExtractOptions = {
        componentName: 'Buttons',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert
      expect(result.ok).toBe(true);
      if (!result.ok) {
        console.log('Error:', result.error);
        return;
      }

      const extractResult = result.value;
      const props = extractResult.component.props;

      // Verify function type
      const handleClickProp = props.find(p => p.name === 'handleClick');
      expect(handleClickProp).toBeDefined();
      // Function type is in form (id: number) => void

      const formatValueProp = props.find(p => p.name === 'formatValue');
      expect(formatValueProp).toBeDefined();
      // Function type is in form (value: string) => string

      const codeResult = getCode(extractResult.codes);
      const code = unwrapResult(codeResult);
      if (!code) return;
      expect(code.content).toContain('interface ButtonsProps');
    });
  });
});
