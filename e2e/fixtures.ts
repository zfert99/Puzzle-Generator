import { test as base, expect } from '@playwright/test';
import { BASE_PATH } from '@/lib/base-path';

/**
 * Playwright fixtures for this app's **`basePath`** and a guard against the failure that made
 * the whole suite meaningless for months.
 *
 * ## The bug this exists to prevent
 *
 * The app is mounted at `basePath: '/puzzles'` (see `next.config.ts` and
 * [`base-path.ts`](../src/lib/base-path.ts)), in dev and prod alike. The specs navigate with
 * root-relative paths (`page.goto('/play')`), and `baseURL` used to be the bare origin
 * `http://localhost:3000` — so every navigation landed on `/play`, which **404s**, and the axe
 * scans plus the horizontal-overflow checks happily passed against Next's 404 page. `webServer.url`
 * pointed at `/` for the same reason, never got a 2xx, and `npm run test:e2e` could not even start.
 *
 * A `baseURL` carrying the path does **not** fix it: `page.goto('/play')` is root-relative, so
 * `new URL('/play', 'http://localhost:3000/puzzles')` discards the path and yields
 * `http://localhost:3000/play` again. Making it work through `baseURL` alone would require every
 * spec to drop its leading slash *and* `baseURL` to carry a trailing one — a convention where a
 * single stray `/` silently escapes the zone and goes green.
 *
 * ## What this does instead
 *
 * 1. **Prefixes navigation automatically.** `page.goto('/play')` → `/puzzles/play`. Specs keep
 *    writing ordinary root-relative paths and cannot get it wrong; a new spec inherits the
 *    behavior by importing `test` from here rather than from `@playwright/test`.
 * 2. **Fails on a non-OK navigation.** Any `goto` returning ≥ 400 throws. This is the meta-guard:
 *    if the mount path moves again, the suite goes **red** instead of quietly scanning a 404 page.
 *    That is the property the old setup lacked — it is not enough to fix the paths once.
 *
 * Import `test` and `expect` from this module in every spec. Importing `test` straight from
 * `@playwright/test` still compiles and still 404s, so the convention is the only thing holding —
 * `e2e/no-raw-playwright-import.spec.ts` asserts it mechanically.
 */
/**
 * Whether a **real** database is reachable, which four `/daily` specs need (they play an actual
 * daily board). Everything else runs without one.
 *
 * Why this is not simply `Boolean(process.env.DATABASE_URL)`: a production build **fails** without
 * that variable — `/api/daily` and `/api/cron/daily` evaluate the DB client at module scope, so
 * `next build` dies during page-data collection. CI therefore always sets a *placeholder*
 * connection string just to get the build through, which makes the variable's presence useless as
 * a signal. `E2E_HAS_DB` carries the real answer (set from the repo secret's presence); locally,
 * where `.env.local` holds a genuine string and no placeholder is involved, we fall back to it.
 */
export const HAS_DATABASE =
  'E2E_HAS_DB' in process.env
    ? process.env.E2E_HAS_DB === 'true'
    : Boolean(process.env.DATABASE_URL);

export const test = base.extend({
  // The second argument is Playwright's fixture callback, which its docs name `use`. Named
  // `provide` here because `react-hooks/rules-of-hooks` sees a bare `use(...)` call and reports
  // it as a misplaced React `use` hook. The name is positional and arbitrary, so renaming is
  // cheaper than an eslint suppression a future reader would have to re-evaluate.
  page: async ({ page }, provide) => {
    const rawGoto = page.goto.bind(page);

    page.goto = (async (url: string, options?: Parameters<typeof rawGoto>[1]) => {
      const target =
        url.startsWith('/') && !url.startsWith(`${BASE_PATH}/`) && url !== BASE_PATH
          ? `${BASE_PATH}${url === '/' ? '' : url}`
          : url;

      const response = await rawGoto(target, options);

      // A navigation that 404s must not be silently scanned. `null` is legitimate — it means no
      // navigation happened (same-document hash change), not a failure.
      if (response && !response.ok()) {
        throw new Error(
          `Navigation to ${target} returned HTTP ${response.status()}. ` +
            `The app is mounted at "${BASE_PATH}" — a 404 here means the basePath wiring broke ` +
            `again, not that the page is legitimately missing.`,
        );
      }
      return response;
    }) as typeof page.goto;

    await provide(page);
  },
});

export { expect };
