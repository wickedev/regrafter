import { regraft, Move } from './src/index.js';

const contextComponentContent = `import React, { createContext, useContext } from 'react';

const ThemeContext = createContext('light');

function ThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value='dark'>
      {children}
    </ThemeContext.Provider>
  );
}

function ThemedButton() {
  const theme = useContext(ThemeContext);
  return <button>{theme}</button>;
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedButton />
    </ThemeProvider>
  );
}
`;

const files = [{ path: 'component-with-context.tsx', content: contextComponentContent }];
const from = { file: 'component-with-context.tsx', line: 15, column: 10 }; // button element
const to = { file: 'component-with-context.tsx', line: 8, column: 6 }; // inside Provider

const result = regraft(files, from, to, Move.Inside);

console.log('Result ok:', result.ok);
if (!result.ok) {
  console.log('Error:', result.error);
} else {
  console.log('Success!');
  console.log(result.value.codes[0].content);
}
