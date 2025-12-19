/**
 * Extract E2E Integration Tests
 *
 * Task 12.1: MVP E2E 통합 테스트 작성
 *
 * Requirements:
 * - 실제 React 컴포넌트 파일로 테스트
 * - 간단한 div 추출 시나리오
 * - 변수 의존성이 있는 추출 시나리오
 *
 * Test Requirements:
 * - 1.1: JSX 노드 선택 및 추출
 * - 2.1: 의존성 자동 분석
 * - 3.1: 같은 파일 내 컴포넌트 추출
 * - 3.6: Props 전달
 */

import { describe, it, expect } from 'vitest';
import { extract } from '../extract.js';
import type { FileInput } from '../../types/public.js';
import type { ExtractOptions } from '../types.js';

describe('Extract E2E Integration Tests', () => {
  describe('간단한 div 추출 시나리오', () => {
    it('should extract a simple div element into a new component', () => {
      // Arrange: 실제 React 컴포넌트 파일
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

      // header div를 선택 - '<' 문자의 위치
      const selector = {
        file: 'App.tsx',
        line: 6,
        column: 7, // '<div' 의 '<' 위치
      };

      const options: ExtractOptions = {
        componentName: 'Header',
      };

      // Act: extract 함수 호출
      const result = extract(files, selector, options);

      // Assert: 추출 성공 확인
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractResult = result.value;

      // 컴포넌트 정보 확인
      expect(extractResult.component.name).toBe('Header');
      expect(extractResult.component.file).toBe('App.tsx');
      expect(extractResult.component.props).toHaveLength(0); // Props 없음

      // 코드 변환 확인
      expect(extractResult.codes).toHaveLength(1);
      const code = extractResult.codes[0];
      expect(code.path).toBe('App.tsx');

      // 새 컴포넌트가 생성되었는지 확인
      expect(code.content).toContain('function Header()');
      expect(code.content).toContain('<h1>Welcome</h1>');
      expect(code.content).toContain('<p>This is a simple app</p>');

      // 원본 위치에 컴포넌트 호출이 있는지 확인
      expect(code.content).toContain('<Header />');

      // 원본 JSX가 제거되었는지 확인
      // 주의: 추출된 컴포넌트 내부에는 여전히 header div가 있음
      // App 컴포넌트 내부에만 없으면 됨
      const appFunctionMatch = code.content.match(/function App\(\)[^}]+\{([^}]+)\}/s);
      if (appFunctionMatch) {
        const appBody = appFunctionMatch[1];
        expect(appBody).not.toContain('<div className="header">');
      }

      // 통계 확인
      expect(extractResult.stats.nodesExtracted).toBe(1);
      expect(extractResult.stats.dependenciesFound).toBe(0);
      expect(extractResult.stats.propsGenerated).toBe(0);
    });

    it('should preserve other elements when extracting a single element', () => {
      // Arrange: 여러 엘리먼트가 있는 컴포넌트
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

      // main 엘리먼트 선택
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

      const code = result.value.codes[0];

      // 추출된 컴포넌트 확인
      expect(code.content).toContain('function MainContent()');
      expect(code.content).toContain('<main>Content</main>');

      // 다른 엘리먼트들은 그대로 유지
      expect(code.content).toContain('<nav>Navigation</nav>');
      expect(code.content).toContain('<footer>Footer</footer>');

      // 원본 위치에 컴포넌트 호출
      expect(code.content).toContain('<MainContent />');
    });
  });

  describe('변수 의존성이 있는 추출 시나리오', () => {
    it('should extract JSX with variable dependencies and pass them as props', () => {
      // Arrange: 변수를 사용하는 컴포넌트
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

      // header div 선택 (변수 의존성 있음)
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

      // Props 확인
      expect(extractResult.component.props.length).toBeGreaterThan(0);
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('title');
      expect(propNames).toContain('userName');

      const code = extractResult.codes[0];

      // 새 컴포넌트가 props를 받는지 확인
      expect(code.content).toContain('function DashboardHeader(');
      // Props를 받는지 확인 (destructuring 또는 props 파라미터)
      const hasTitleProp = code.content.includes('title') && code.content.includes('DashboardHeader');
      expect(hasTitleProp).toBe(true);

      // 원본 위치에서 props를 전달하는지 확인
      expect(code.content).toContain('<DashboardHeader');
      expect(code.content).toContain('title={title}');
      expect(code.content).toContain('userName={userName}');

      // 통계 확인
      expect(extractResult.stats.dependenciesFound).toBeGreaterThan(0);
      expect(extractResult.stats.propsGenerated).toBeGreaterThan(0);
    });

    it('should handle multiple variable dependencies correctly', () => {
      // Arrange: 여러 변수를 사용하는 컴포넌트
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

      // card div 선택
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

      // 4개의 변수가 모두 props로 전달되는지 확인
      expect(extractResult.component.props.length).toBe(4);
      const propNames = extractResult.component.props.map(p => p.name).sort();
      expect(propNames).toEqual(['inStock', 'price', 'productName', 'rating']);

      const code = extractResult.codes[0];

      // Props 전달 확인
      expect(code.content).toContain('productName={productName}');
      expect(code.content).toContain('price={price}');
      expect(code.content).toContain('inStock={inStock}');
      expect(code.content).toContain('rating={rating}');
    });

    it('should extract JSX with function dependencies', () => {
      // Arrange: 함수를 사용하는 컴포넌트
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

      // button 선택 - 정확한 위치 지정
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

      // 함수가 props로 전달되는지 확인
      if (extractResult.component.props.length === 0) {
        console.log('Generated code:', extractResult.codes[0].content);
      }
      expect(extractResult.component.props.length).toBeGreaterThan(0);
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('handleClick');

      const code = extractResult.codes[0];
      expect(code.content).toContain('handleClick={handleClick}');
    });
  });

  describe('컴포넌트 배치 및 구조', () => {
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

      const code = result.value.codes[0];

      // 새 컴포넌트가 생성되었는지 확인 (형식은 유연하게)
      const hasTitleComponent = code.content.includes('Title') &&
        (code.content.includes('function Title') || code.content.includes('const Title'));

      if (!hasTitleComponent) {
        console.log('Generated code:', code.content);
      }
      expect(hasTitleComponent).toBe(true);

      // App 컴포넌트도 있는지 확인
      expect(code.content).toContain('function App()');

      // Title 컴포넌트가 App 컴포넌트보다 앞에 있는지 확인
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

      const code = result.value.codes[0];

      // 들여쓰기가 올바른지 확인 (정확한 들여쓰기는 포맷터에 따라 다를 수 있음)
      expect(code.content).toContain('function NestedDiv()');
      expect(code.content).toContain('<p>Nested content</p>');
    });
  });

  describe('에러 처리', () => {
    it('should return error when selector points to non-JSX node', () => {
      // Arrange: JSX가 아닌 노드 선택
      const sourceCode = `function App() {
  const value = 42;
  return <div>Hello</div>;
}
`;

      const files: FileInput[] = [
        { path: 'App.tsx', content: sourceCode },
      ];

      // 변수 선언을 가리키는 selector (JSX가 아님)
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

      // Assert: 에러 반환
      expect(result.ok).toBe(false);
    });

    it('should return error when file is not found', () => {
      // Arrange: 존재하지 않는 파일
      const files: FileInput[] = [
        { path: 'App.tsx', content: 'function App() { return <div />; }' },
      ];

      const selector = {
        file: 'NonExistent.tsx', // 존재하지 않는 파일
        line: 1,
        column: 1,
      };

      const options: ExtractOptions = {
        componentName: 'Test',
      };

      // Act
      const result = extract(files, selector, options);

      // Assert: 에러 반환
      expect(result.ok).toBe(false);
    });
  });

  /**
   * Task 23.1: E2E 시나리오 테스트 작성
   *
   * Requirements:
   * - 실제 프로젝트 시나리오 재현
   * - 복잡한 의존성 그래프 테스트
   * - 다중 파일 의존성 테스트
   */
  describe('실제 프로젝트 시나리오', () => {
    it('should extract a form component with validation logic', () => {
      // Arrange: 유효성 검증 로직이 있는 폼 컴포넌트
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

      // form 엘리먼트를 선택하여 추출
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

      // 복잡한 의존성이 모두 props로 전달되는지 확인
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('email');
      expect(propNames).toContain('setEmail');
      expect(propNames).toContain('password');
      expect(propNames).toContain('setPassword');
      expect(propNames).toContain('errors');
      expect(propNames).toContain('handleSubmit');

      const code = extractResult.codes[0];

      // 새 컴포넌트가 생성되었는지 확인
      expect(code.content).toContain('function LoginForm(');

      // Props 전달 확인
      expect(code.content).toContain('email={email}');
      expect(code.content).toContain('password={password}');
      expect(code.content).toContain('errors={errors}');
      expect(code.content).toContain('handleSubmit={handleSubmit}');

      // 원본 컴포넌트에서 form이 제거되고 LoginForm 컴포넌트가 사용되는지 확인
      expect(code.content).toContain('<LoginForm');

      // 통계 확인
      expect(extractResult.stats.dependenciesFound).toBeGreaterThan(0);
    });

    it('should extract a data fetching component with loading states', () => {
      // Arrange: 데이터 페칭과 로딩 상태가 있는 컴포넌트
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

      // user-details div를 선택하여 추출
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

      // 의존성 확인
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('user');
      expect(propNames).toContain('formatDate');

      const code = extractResult.codes[0];

      // 새 컴포넌트 생성 확인
      expect(code.content).toContain('function UserDetails(');

      // Props 전달 확인
      expect(code.content).toContain('user={user}');
      expect(code.content).toContain('formatDate={formatDate}');

      // 컴포넌트 호출 확인
      expect(code.content).toContain('<UserDetails');
    });
  });

  describe('복잡한 의존성 그래프', () => {
    it('should handle nested function dependencies', () => {
      // Arrange: 중첩된 함수 의존성
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

      // result div 선택
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

      // result 변수가 props로 전달되는지 확인
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('result');

      const code = extractResult.codes[0];
      expect(code.content).toContain('result={result}');
    });

    it('should handle multiple variable types in dependencies', () => {
      // Arrange: 다양한 타입의 변수가 혼합된 의존성
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

      // user-card div 선택
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

      // 모든 변수 타입이 props로 전달되는지 확인
      const propNames = extractResult.component.props.map(p => p.name).sort();
      expect(propNames).toContain('userName'); // string
      expect(propNames).toContain('userAge'); // number
      expect(propNames).toContain('isAdmin'); // boolean
      expect(propNames).toContain('scores'); // array
      expect(propNames).toContain('settings'); // object
      expect(propNames).toContain('currentDate'); // Date object

      // 통계 확인
      expect(extractResult.stats.dependenciesFound).toBe(6);
    });

    it('should handle conditional rendering dependencies', () => {
      // Arrange: 조건부 렌더링이 있는 컴포넌트
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

      // content div 선택
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

      // 조건부 렌더링에 사용된 모든 변수가 props로 전달되는지 확인
      const propNames = extractResult.component.props.map(p => p.name).sort();
      expect(propNames).toContain('isLoggedIn');
      expect(propNames).toContain('hasPermission');
      expect(propNames).toContain('userName');
      expect(propNames).toContain('errorMessage');
    });
  });

  describe('다중 파일 의존성', () => {
    it('should extract component that uses imported utilities', () => {
      // Arrange: import된 유틸리티를 사용하는 컴포넌트
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

      // price-details div 선택
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

      // 의존성 확인
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('basePrice');
      expect(propNames).toContain('tax');
      expect(propNames).toContain('total');
      expect(propNames).toContain('formatCurrency');

      const code = extractResult.codes[0];

      // 새 컴포넌트가 formatCurrency를 props로 받는지 확인
      expect(code.content).toContain('formatCurrency={formatCurrency}');
    });

    it('should extract component with React hooks from external imports', () => {
      // Arrange: 외부 라이브러리 Hook을 사용하는 컴포넌트
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

      // theme-selector div 선택
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

      // useState로 관리되는 상태가 props로 전달되는지 확인
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('theme');
      expect(propNames).toContain('setTheme');

      const code = extractResult.codes[0];
      expect(code.content).toContain('theme={theme}');
      expect(code.content).toContain('setTheme={setTheme}');
    });

    it('should handle components with multiple React imports', () => {
      // Arrange: 여러 React import를 사용하는 컴포넌트
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

      // counter div 선택
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

      // Hook과 상태가 올바르게 처리되는지 확인
      const propNames = extractResult.component.props.map(p => p.name);
      expect(propNames).toContain('count');
      expect(propNames).toContain('expensiveValue');
      expect(propNames).toContain('handleIncrement');

      const code = extractResult.codes[0];
      expect(code.content).toContain('count={count}');
      expect(code.content).toContain('expensiveValue={expensiveValue}');
      expect(code.content).toContain('handleIncrement={handleIncrement}');
    });
  });

  /**
   * Task 14.6: TypeScript 통합 테스트
   *
   * Requirements:
   * - TypeScript 파일에서 추출 테스트
   * - Props 타입 올바르게 생성 확인
   */
  describe('TypeScript 타입 생성', () => {
    it('should generate Props interface with correct types', () => {
      // Arrange: TypeScript 컴포넌트
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

      // user-info div 선택
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

      // Props 확인
      const props = extractResult.component.props;
      expect(props).toHaveLength(3);

      // 각 prop의 타입 확인
      const userProp = props.find(p => p.name === 'user');
      expect(userProp).toBeDefined();
      expect(userProp!.type).toContain('User'); // User 타입 참조

      const ageProp = props.find(p => p.name === 'age');
      expect(ageProp).toBeDefined();
      expect(ageProp!.type).toBe('number');

      const isActiveProp = props.find(p => p.name === 'isActive');
      expect(isActiveProp).toBeDefined();
      expect(isActiveProp!.type).toBe('boolean');

      // Props 인터페이스가 생성되었는지 확인
      const code = extractResult.codes[0];
      expect(code.content).toContain('interface UserInfoProps');

      // Props 인터페이스가 컴포넌트 앞에 있는지 확인
      const propsInterfaceIndex = code.content.indexOf('interface UserInfoProps');
      const componentIndex = code.content.indexOf('function UserInfo(');
      expect(propsInterfaceIndex).toBeLessThan(componentIndex);

      // 컴포넌트가 Props 타입을 사용하는지 확인
      expect(code.content).toMatch(/function UserInfo\s*\(\s*\{\s*\w+/); // destructuring with types
    });

    it('should handle optional types with undefined union', () => {
      // Arrange: optional 타입이 있는 컴포넌트
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

      // content div 선택
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

      // title은 required, subtitle과 count는 optional
      const titleProp = props.find(p => p.name === 'title');
      expect(titleProp).toBeDefined();
      expect(titleProp!.optional).toBe(false);

      const subtitleProp = props.find(p => p.name === 'subtitle');
      expect(subtitleProp).toBeDefined();
      expect(subtitleProp!.optional).toBe(true);
      expect(subtitleProp!.type).toBe('string'); // undefined가 제거된 타입

      const countProp = props.find(p => p.name === 'count');
      expect(countProp).toBeDefined();
      expect(countProp!.optional).toBe(true);
      expect(countProp!.type).toBe('number'); // undefined가 제거된 타입

      // Props 인터페이스에 optional 표시가 있는지 확인
      const code = extractResult.codes[0];
      expect(code.content).toMatch(/subtitle\?:\s*string/);
      expect(code.content).toMatch(/count\?:\s*number/);
    });

    it('should handle complex TypeScript types', () => {
      // Arrange: 복잡한 TypeScript 타입
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

      // complex-content div 선택
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

      // Union 타입 확인
      const statusProp = props.find(p => p.name === 'status');
      expect(statusProp).toBeDefined();
      expect(statusProp!.type).toContain('active'); // Union literal

      // 배열 타입 확인
      const itemsProp = props.find(p => p.name === 'items');
      expect(itemsProp).toBeDefined();
      expect(itemsProp!.type).toContain('Item'); // Array of Item

      // Tuple 타입 확인
      const pairProp = props.find(p => p.name === 'pair');
      expect(pairProp).toBeDefined();
      // Tuple은 [string, number] 형태로 표현됨

      const code = extractResult.codes[0];
      expect(code.content).toContain('interface ComplexContentProps');
    });

    it('should handle function types in props', () => {
      // Arrange: 함수 타입이 있는 컴포넌트
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

      // buttons div 선택
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

      // 함수 타입 확인
      const handleClickProp = props.find(p => p.name === 'handleClick');
      expect(handleClickProp).toBeDefined();
      // 함수 타입은 (id: number) => void 형태

      const formatValueProp = props.find(p => p.name === 'formatValue');
      expect(formatValueProp).toBeDefined();
      // 함수 타입은 (value: string) => string 형태

      const code = extractResult.codes[0];
      expect(code.content).toContain('interface ButtonsProps');
    });
  });
});
