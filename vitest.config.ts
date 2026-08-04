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
    // Vitest defaults to roughly one worker per logical CPU minus one. This suite is unusual in
    // that a large share of its tests drive the REAL puzzle generators, each of which saturates a
    // core for its whole duration — so the default is textbook oversubscription, and it is the
    // direct cause of the timeout flake documented under `testTimeout` below. Capping the pool
    // attacks that amplification at the source instead of only raising the ceiling it hits.
    maxWorkers: '50%',
    // Vitest's 5s default is too tight for this suite, and the reason is worker
    // contention rather than slow code. Many tests drive the REAL generators, which
    // saturate a core each; with ~11 forks on a 12-core box a generator test's wall
    // clock stretches 2–13× over its isolated time. Measured: the Keisan 6×6 hard
    // operator-mix test needs 157–673ms of actual CPU (p99 673ms over 40 samples) yet
    // was observed at 5738ms in a loaded run — a timeout, not a regression. Raising the
    // floor to 20s kills that whole class of flake, including for generator tests
    // written later that would otherwise have to remember an explicit value. The only
    // cost is that a genuinely hung test surfaces in 30s instead of 5s, which is
    // irrelevant for a non-interactive suite that already carries 120s outliers.
    // Heavier tests still set their own larger per-test timeouts, which win over this.
    // 30s (not 20s): that same test was later seen at 4698ms across 54 verification runs,
    // and 673ms of intrinsic p99 work × the 13× contention factor projects a ~8.7s bad
    // case. 30s keeps ≥6× headroom on both figures; 20s would have left only ~2.3×.
    testTimeout: 30_000,
  },
  // React 19 uses the automatic JSX runtime. Vitest's esbuild transform picks up
  // `"jsx": "react-jsx"` from tsconfig.json, so no explicit jsx option is needed
  // (and Vitest 4 no longer types one on `esbuild`).
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
