# End-to-End Tests (Playwright)

This directory holds the Playwright end-to-end suite. Per AGENTS.md Section 4,
Playwright is the mandated E2E tool (real WebKit/Safari coverage, free
parallelization) and E2E specs live in this **top-level** directory, exempt from
the unit-test colocation rule that governs `src/`.

These tests drive the real application in a real browser, unlike the Vitest unit
tests which exercise modules in isolation.

## One-time setup

Install the browser binaries (only needed once per machine):

```bash
npx playwright install chromium
```

For full cross-engine coverage, install all browsers and enable the `firefox` and
`webkit` projects in `playwright.config.ts`:

```bash
npx playwright install
```

## Running

```bash
npm run test:e2e
```

The config (`playwright.config.ts`) starts the app automatically via its
`webServer` block (`npm run dev` on `http://localhost:3000`) and reuses an
already-running dev server locally. No manual server start is required.

## Conventions

- Specs are named `*.spec.ts` and live in this directory.
- Use accessibility-first locators (`getByRole`, `getByLabel`, `getByText`) to
  assert user-visible behaviour, matching the querying discipline of the unit
  tests.
- Keep smoke tests fast: assert page structure and interactions. Reserve the slow
  full PDF-generation flow for a dedicated, generously-timed spec if added later.
