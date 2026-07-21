# Performance Audit & Plan

> **Status:** 📋 Analysis (nothing implemented) · **Date:** July 2026
> **Triggered by:** [nextjs-performance.md](research/nextjs-performance.md) (Core Web Vitals,
> RSC boundaries, INP/grid tuning, caching, Neon/Vercel, monitoring), read against the codebase.

## Verdict

The **architecture is already doing the expensive things right** — the research's single
highest-leverage items (deep `'use client'` boundaries, a server-side solver, small DOM,
correct DB indexes) are in place, largely because AGENTS.md already encodes them. There is no
"poor band" work to do blind; the honest first step the doc itself prescribes is **instrument,
then measure** — we currently have *zero* real-user data. The gaps below are ordered so the
cheapest, most decision-informing ones come first.

## Already solid (do NOT redo)

| Research recommendation | Status in code |
|---|---|
| Keep pages Server Components; push `'use client'` deep (the #1 win) | ✅ Only `template.tsx` is client in `src/app/`; every `page.tsx` is a thin RSC delegating to a client leaf (AGENTS.md App Router Purity) |
| Keep solver/generation off the client (Web Worker or server) | ✅ All generation is in Route Handlers (`/api/puzzle`, `/api/generate`) — never in the client bundle. Better than a Worker |
| Narrow re-render scope on the grid (colocated state, stable keys) | ✅ Per-cell `useShallow` selectors; peers + `cellToCage` precomputed once per game (O(1) highlight, no per-keystroke scan) |
| No monolithic full-grid recompute to defer | ✅ Highlight/error state is derived per-cell in each cell's own selector — there's no whole-grid pass needing `startTransition` |
| `next/image` for raster art | ✅ N/A — there are no raster images (SVG dot pattern + emoji + CSS); nothing to optimize |
| `next/font` self-hosted + `swap` + adjusted fallback | ✅ `next/font/google` for all five families in the root layout |
| DB indexes on sort/filter columns | ✅ `solve_attempts (puzzle_id, time_ms)` backs leaderboard ORDER BY; `UNIQUE(date, difficulty)` backs the daily lookup |
| Animate only transform/opacity; reduced-motion | ✅ Backdrop/juice use transform-only; motion respects the Settings toggle |
| Tailwind JIT (no CSS-library bloat) | ✅ |

## Gaps — prioritized

### Do first (cheap, decision-informing) — ✅ done (July 2026)

- ✅ **P1 — done.** `@vercel/speed-insights` + `@vercel/analytics` mounted in the root layout;
  p75 LCP/INP/CLS per route lands in the Vercel dashboard within ~24h. *(original note below)*
- **P1 — No real-user monitoring (the doc's Stage 0).** No `@vercel/speed-insights` or
  `@vercel/analytics`, so we have no p75 LCP/INP/CLS per route. Add both (`<SpeedInsights/>` and `<Analytics/>` in the root layout); field data appears within ~24h. **This is the gate for
  everything below** — the doc is explicit that most of the rest is premature without it, and
  at our scale (small DOM, RSC pages, server-side solver) there may be no real problem to fix.
- ✅ **P2 — done.** `Cell` wrapped in `React.memo`; a selection change no longer re-runs all 81
  cells' selectors, only the ones whose store slice changed. Interaction unchanged (E2E green).
- **P2 — `Cell` was not `React.memo`'d.** `Board`'s selector includes the selected row/col, so
  every selection change re-renders `Board`, which re-creates all 81 `Cell` elements — without
  memo, all 81 re-run their selectors each keystroke/arrow. `Cell`'s only props are the stable
  `{r, c}`, so `React.memo(Cell)` lets React skip the ~77 unaffected cells (the changed ones
  still update via their own store subscription). Exactly the INP scenario the doc flags for a
  9×9 grid; low risk, ~1 line. *Worth doing regardless of P1, but verify the win with P1's INP.*

### Consider only if RUM (P1) shows a problem

- **P3 — Daily/leaderboard are `force-dynamic` (no caching).** Every request hits Neon. Daily
  puzzles are identical for all users for 24h; leaderboards change slowly. The doc assumed we
  run Upstash/KV — **we don't**, so the no-new-infra path is Next's own caching: wrap the daily
  fetch + leaderboard read in `unstable_cache`/`use cache` with a `revalidate` (seconds-to-
  midnight for the daily, ~30–60s for leaderboards) and tag-invalidate on write. Real payoff
  **at scale**; at portfolio traffic the indexed single-query reads over Neon-HTTP are already
  fast, so this is a scale investment, not a fix.
- **P4 — Neon driver.** We use `@neondatabase/serverless` (HTTP) on `runtime = 'nodejs'`. The
  doc prefers pooled `pg` + `attachDatabasePool` on Vercel Node functions — but that mainly
  wins for transaction-heavy/high-concurrency; for our **single-query reads, HTTP is fewer
  round-trips (~3–4 vs ~8)** and simpler. **Likely leave as-is**; only revisit if load testing
  shows connection exhaustion.

### Nice to have (regression hygiene / Next 16 features)

- **P5 — CI perf budget.** No `@next/bundle-analyzer` / Lighthouse CI. A `budget.json` +
  `treosh/lighthouse-ci-action` would fail regressive PRs. Pairs well with the a11y E2E we
  already added.
- **P6 — Next 16 / React 19 features we're eligible for** (we're on Next 16.2.10 + React
  19.2.7): the **React Compiler** would auto-memoize (subsuming P2 and more — worth an
  RUM-verified trial); **PPR / `cacheComponents`** could serve static shells for daily/
  leaderboard with streamed dynamic holes. Both are opt-in and "results are mixed" per the
  research — evaluate *after* P1 gives a baseline. `optimizePackageImports: ['motion']` in
  `next.config` is a free small bundle trim.

## Recommendation

Do **P1 + P2 now** (instrument + memo the cell — cheap, and P1 tells us whether anything else
matters). Then **wait for ~24h of Speed Insights data** and let it decide P3–P6: if every route
is comfortably green (likely, given the architecture), stop — don't add caching infra, swap DB
drivers, or adopt experimental features without a measured reason. The research's own framing is
"instrument first, fix the poor band first," and we may simply not have a poor band.

## Caveat worth keeping

Field data lags: CrUX/ranking moves on a 28-day window, but Speed Insights shows a change within
~a day — judge fixes by RUM, not Lighthouse lab scores. And memoization isn't free; P2 is safe
(stable-prop leaf of a large list) but don't sprinkle `memo` elsewhere without profiling.
