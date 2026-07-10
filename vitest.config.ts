import { defineConfig } from 'vitest/config';
import path from 'path';

// AGENTS.md Section 4 mandates Vitest (not Jest). The global test environment
// stays `node` to keep the Next.js API-route tests free of a `Request` polyfill
// collision; React UI test files opt into jsdom individually with a
// `// @vitest-environment jsdom` pragma at the top of the file.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  // React 19 uses the automatic JSX runtime; esbuild handles the transform for
  // component tests without needing the Babel-based @vitejs/plugin-react.
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
