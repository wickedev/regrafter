/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    // ========================================================================
    // TypeScript - Type Safety (Tier 1)
    // ========================================================================
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'warn', // 너무 엄격하여 warn으로 조정

    // TypeScript - Code Consistency (Tier 1)
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/consistent-type-assertions': [
      'error',
      {
        assertionStyle: 'never', // 모든 타입 단언 완전 금지
      },
    ],
    '@typescript-eslint/no-unnecessary-type-assertion': 'error', // 불필요한 타입 단언 금지
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

    // TypeScript - Existing Rules (strengthened)
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',

    // ========================================================================
    // TypeScript - Code Quality (Tier 2)
    // ========================================================================
    '@typescript-eslint/no-unnecessary-condition': 'warn', // 일부 방어적 코드에서는 필요할 수 있음
    '@typescript-eslint/no-inferrable-types': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn', // 타입 단언이 필요한 경우를 위해 warn
    '@typescript-eslint/prefer-for-of': 'error',
    '@typescript-eslint/prefer-includes': 'error',
    '@typescript-eslint/prefer-string-starts-ends-with': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/prefer-reduce-type-parameter': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',

    // ========================================================================
    // TypeScript - Advanced Protection (Tier 3)
    // ========================================================================
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/return-await': ['error', 'in-try-catch'],

    // ========================================================================
    // Import Rules
    // ========================================================================
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-duplicates': 'error',

    // ========================================================================
    // General Rules
    // ========================================================================
    'no-console': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'no-param-reassign': 'error',

    // Code Complexity (Tier 3) - 실용적인 수준으로 조정
    'complexity': ['warn', 25], // 복잡한 분석 로직을 위해 25로 조정
    'max-depth': ['warn', 5], // 5단계까지 허용
    'max-lines-per-function': ['warn', 200], // 200줄까지 허용
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    '*.cjs',
    '*.mjs',
    '**/__tests__/**',
    '**/*.test.ts',
    'test/fixtures/**',
  ],
  overrides: [
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier',
      ],
      rules: {
        // Relax type-checking rules for tests
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-for-in-array': 'off',
        '@typescript-eslint/no-implied-eval': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
        '@typescript-eslint/prefer-readonly': 'off',
        '@typescript-eslint/prefer-regexp-exec': 'off',
        '@typescript-eslint/prefer-string-starts-ends-with': 'off',
        '@typescript-eslint/promise-function-async': 'off',
        '@typescript-eslint/require-array-sort-compare': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/restrict-plus-operands': 'off',
        '@typescript-eslint/unbound-method': 'off',

        // Allow any and unsafe operations in tests
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',

        // Relax complexity rules for tests
        'complexity': 'off',
        'max-depth': 'off',
        'max-lines-per-function': 'off',
      },
    },
  ],
};
