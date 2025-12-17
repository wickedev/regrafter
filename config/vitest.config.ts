import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.bench.ts'],
    exclude: ['src/__tests__/e2e/**'],
    root: rootDir,
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.bench.ts',
        'src/**/__tests__/**',
        'src/**/index.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    benchmark: {
      include: ['src/**/*.bench.ts'],
      exclude: ['src/__tests__/e2e/**'],
    },
  },
});
