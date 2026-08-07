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
`webServer` block. No manual server start is required.

**Already have a dev server running?** Pass a different port:

```bash
E2E_PORT=3100 npm run test:e2e
```

This matters more than it looks. `reuseExistingServer` is on locally, so without
`E2E_PORT` the suite attaches to *whatever* is on port 3000 — including a server
running a **different branch's** code. That is not hypothetical: it produced two
confident, wrong failures the first time this suite ran for real.

## The `basePath` trap (read before writing a spec)

The app is mounted at `basePath: '/puzzles'`. **Import `test` and `expect` from
[`./fixtures`](fixtures.ts), never from `@playwright/test` directly** — the fixture
prefixes navigation so `page.goto('/play')` reaches `/puzzles/play`, and fails any
test whose navigation returns >= 400.

Importing straight from `@playwright/test` still compiles and still 404s silently.
That combination is exactly how this suite spent months passing against Next's 404
page: `baseURL` was the bare origin, every `goto` missed the mount, the axe scans
found nothing to complain about on a 404, and `npm run test:e2e` could not even
start because the readiness probe never saw a 2xx. Putting a path in `baseURL` does
**not** fix it — root-relative paths discard it.

## Database

34 of the 38 specs run without a database. The four that play a real daily board
skip themselves unless `DATABASE_URL` is set, which is what lets CI run the suite
without one.

## Conventions

- Specs are named `*.spec.ts` and live in this directory.
- Import `test`/`expect` from `./fixtures` (see above).
- Use accessibility-first locators (`getByRole`, `getByLabel`, `getByText`) to
  assert user-visible behaviour, matching the querying discipline of the unit
  tests.
- **Do not hardcode a daily's difficulty or type in a selector.** Under
  type-as-slot both roll daily — the picker reads "Easy · Classic" today and
  something else tomorrow. Take whatever the picker preselects. A stale
  `/^easy$/i` selector survived here precisely because the suite never ran.
- Keep smoke tests fast: assert page structure and interactions. Reserve the slow
  full PDF-generation flow for a dedicated, generously-timed spec if added later.
