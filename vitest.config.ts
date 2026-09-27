import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup-env.ts'],
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Database-backed suites share one lesson slug, so they must not interleave.
    fileParallelism: false,
    testTimeout: 60_000,
    // Playwright owns tests/e2e. Vitest must not try to run those.
    exclude: ['node_modules', 'tests/e2e/**'],
    // Phase 0 acceptance: `pnpm test` runs green with zero tests.
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
