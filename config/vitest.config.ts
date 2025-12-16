import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['../src/**/*.test.ts'],
    exclude: ['../src/__tests__/e2e/**'],
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['../src/**/*.ts'],
      exclude: [
        '../src/**/*.test.ts',
        '../src/**/__tests__/**',
        '../src/**/index.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
