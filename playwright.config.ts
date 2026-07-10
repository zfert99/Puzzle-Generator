import { defineConfig, devices } from '@playwright/test';

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
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
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
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
