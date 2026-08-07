import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { BASE_PATH } from './src/lib/base-path';

// Next loads `.env.local` for the app, but NOT for this test runner's own process. Without this
// the DB-gated specs read `process.env.DATABASE_URL` as undefined and skip themselves even on a
// machine with a working database — coverage quietly dropping from 38 to 34 with nothing to show
// for it. CI has no `.env.local`, so there it is a no-op and the repo secret decides.
loadEnv({ path: '.env.local', quiet: true });

/**
 * Port the suite runs against. Override with `E2E_PORT` to run alongside a dev server you are
 * already using — otherwise `reuseExistingServer` below will happily attach to *whatever* is on
 * 3000, including a server running a different branch's code. That is not hypothetical: it
 * produced two confident, wrong failures on this suite's first real run.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const ORIGIN = `http://localhost:${PORT}`;

/**
 * Playwright is the mandated E2E tool (AGENTS.md Section 4 — real WebKit/Safari
 * coverage and free parallelization, unlike Cypress). End-to-end specs live in the
 * top-level `e2e/` directory, which is exempt from the unit-test colocation rule.
 *
 * One-time setup before the first run: `npx playwright install chromium`
 * (downloads the browser binaries). Then: `npm run test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Local runs get a retry too. Locally the server is `next dev`, which compiles on demand, so
  // parallel workers hitting cold routes time out in ways that look like assertion failures
  // (~67% of runs saw one; every such test passed 5/5 solo). A retry keeps that from drowning the
  // signal, and Playwright still REPORTS a retried pass as "flaky" — it is visible, not hidden.
  retries: process.env.CI ? 2 : 1,
  reporter: 'list',
  use: {
    // Origin only. The app is mounted at `basePath: '/puzzles'`, but a path here would NOT help:
    // the specs navigate with root-relative paths, and `new URL('/play', '…/puzzles')` discards
    // the path. The prefixing lives in `e2e/fixtures.ts`, which also fails the test on any 4xx/5xx
    // navigation — see that file for the full history of why the suite used to pass on 404 pages.
    baseURL: ORIGIN,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Enable these once the browsers are installed for full cross-engine coverage:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
  ],
  // Boot the app for the tests. Reuses an already-running dev server locally so
  // the suite is quick to iterate on; CI always starts a fresh one.
  webServer: {
    // A PRODUCTION build in CI, `next dev` locally.
    //
    // `next dev` compiles routes on demand. With `fullyParallel` workers all hitting a cold route
    // at once, that compile happens under CPU contention and can blow a test's timeout — measured
    // here as 38/38, 35/38, 37/38 across three consecutive full-suite runs, while every failing
    // test passed 5/5 in isolation. Nothing was wrong with the assertions; the server was busy
    // compiling. Building once removes the variable entirely and tests what users actually get.
    command: process.env.CI
      ? `npm run build && npm run start -- --port ${PORT}`
      : `npm run dev -- --port ${PORT}`,
    // MUST include the basePath. Playwright treats 404 as "not ready", so pointing this at `/`
    // (which 404s under the `/puzzles` mount) meant the readiness probe never succeeded and the
    // whole run aborted before a single test.
    url: `${ORIGIN}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    // A production build has to finish before the server answers; dev needs far less.
    timeout: process.env.CI ? 300_000 : 120_000,
  },
});
