/**
 * Component With Context Fixture
 *
 * Purpose: Test Context dependency detection and handling
 * Scenarios:
 * - useContext dependency detection
 * - Provider boundary detection
 * - Context-to-props extraction
 * - Provider hoisting
 * - Multiple contexts
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

// Simple context
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// Component using context
export function ThemedButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className={`themed-button theme-${theme}`}
      onClick={toggleTheme}
    >
      Current theme: {theme}
    </button>
  );
}

export function ThemedCard({ title, content }: { title: string; content: string }) {
  const { theme } = useTheme();

  return (
    <div className={`themed-card card-${theme}`}>
      <h3 className="card-title">{title}</h3>
      <p className="card-content">{content}</p>
    </div>
  );
}

// Nested context usage
export function ThemeApp() {
  return (
    <ThemeProvider>
      <div className="theme-app">
        <header className="app-header">
          <ThemedButton />
        </header>
        <main className="app-main">
          <ThemedCard title="Welcome" content="This is themed content" />
        </main>
      </div>
    </ThemeProvider>
  );
}

// Multiple contexts
interface UserContextType {
  user: { name: string; email: string } | null;
  login: (name: string, email: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  const login = useCallback((name: string, email: string) => {
    setUser({ name, email });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}

// Component using multiple contexts
export function UserProfile() {
  const { theme } = useTheme();
  const { user, logout } = useUser();

  if (!user) {
    return (
      <div className={`user-profile no-user theme-${theme}`}>
        <span>Not logged in</span>
      </div>
    );
  }

  return (
    <div className={`user-profile theme-${theme}`}>
      <span className="user-name">{user.name}</span>
      <span className="user-email">{user.email}</span>
      <button onClick={logout} className="logout-button">Logout</button>
    </div>
  );
}

// App with multiple providers
export function MultiContextApp() {
  return (
    <ThemeProvider>
      <UserProvider>
        <div className="multi-context-app">
          <header>
            <ThemedButton />
            <UserProfile />
          </header>
          <main>
            <ThemedCard title="Dashboard" content="Welcome to the dashboard" />
          </main>
        </div>
      </UserProvider>
    </ThemeProvider>
  );
}

// Nested providers with same context (shadowing)
export function NestedProviderComponent() {
  return (
    <ThemeProvider>
      <div className="outer-theme">
        <ThemedButton /> {/* Uses outer theme */}
        <ThemeProvider>
          <div className="inner-theme">
            <ThemedButton /> {/* Uses inner theme - independent */}
          </div>
        </ThemeProvider>
      </div>
    </ThemeProvider>
  );
}

// Consumer pattern (alternative to useContext)
export function ConsumerPatternComponent() {
  return (
    <ThemeProvider>
      <ThemeContext.Consumer>
        {(context) => context && (
          <div className={`consumer-component theme-${context.theme}`}>
            <span>Theme from consumer: {context.theme}</span>
            <button onClick={context.toggleTheme}>Toggle</button>
          </div>
        )}
      </ThemeContext.Consumer>
    </ThemeProvider>
  );
}

// Context with complex value
interface SettingsContextType {
  settings: {
    fontSize: number;
    language: string;
    notifications: boolean;
  };
  updateSettings: (key: string, value: unknown) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState({
    fontSize: 14,
    language: 'en',
    notifications: true,
  });

  const updateSettings = useCallback((key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function SettingsPanel() {
  const context = useContext(SettingsContext);

  if (!context) {
    return null;
  }

  const { settings, updateSettings } = context;

  return (
    <div className="settings-panel">
      <div className="setting">
        <label>Font Size:</label>
        <input
          type="number"
          value={settings.fontSize}
          onChange={(e) => updateSettings('fontSize', parseInt(e.target.value))}
        />
      </div>
      <div className="setting">
        <label>Language:</label>
        <select
          value={settings.language}
          onChange={(e) => updateSettings('language', e.target.value)}
        >
          <option value="en">English</option>
          <option value="ko">Korean</option>
          <option value="ja">Japanese</option>
        </select>
      </div>
      <div className="setting">
        <label>
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={(e) => updateSettings('notifications', e.target.checked)}
          />
          Notifications
        </label>
      </div>
    </div>
  );
}
