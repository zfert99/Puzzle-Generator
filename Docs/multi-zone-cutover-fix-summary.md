# Multi-zone cutover — post-migration fix summary (2026-07-30)

One-page summary of the regression that broke puzzle generation, the daily, and PDF
export after the move to `biscuitlab.net/puzzles`, and how it was fixed. The deep
write-up is [multi-zone-basepath-fetch-fix.md](research/multi-zone-basepath-fetch-fix.md);
this is the executive version.

## What was broken

After the multi-zone cutover, three features stopped working at once:

- **Puzzle generation** on `/play`.
- **The daily** on `/daily`.
- **PDF export** on `/generate`.
- (Also affected: the leaderboard's own-rank / streak / bests panels.)

## Root cause (one sentence)

The cutover set `basePath: '/puzzles'`, which moves every route handler to
`/puzzles/api/...`, but **Next.js does not prepend the basePath to `fetch()`** (only to
`<Link>`, `next/image`, `router`, and `/_next/*`), so the app's nine client
`fetch('/api/...')` calls resolved to the hub's root zone and 404'd.

The auth client had already been migrated (`basePath: '/puzzles/api/auth'`); the app's own
data-fetch calls were the piece missed. The pre-cutover audit only checked *absolute* URLs,
so these *relative* fetches (correct-looking precisely because relative) slipped through.

## The fix

- New helper **`src/lib/base-path.ts`** — `BASE_PATH = '/puzzles'` + `apiPath(path)`.
- Wrapped all **9** client fetches in `apiPath(...)`:
  - `usePuzzle.ts` → `/api/puzzle`
  - `usePuzzleGeneration.ts` → `/api/generate`
  - `useDaily.ts` → `/api/daily`
  - `DailyExperience.tsx` → `/api/me/today`, `/api/solve`, `/api/daily/start`
  - `LeaderboardView.tsx` → `/api/leaderboard`, `/api/me/streak`, `/api/me/bests`
- Updated all 5 mirror `.md` docs and the 2 tests that asserted the old bare paths.

## The sync contract

`/puzzles` now lives in three places that must stay in agreement — change all three together:

1. `next.config.ts` → `basePath: '/puzzles'` (the real mount)
2. `src/lib/base-path.ts` → `BASE_PATH` (client `fetch()` prefix)
3. `src/features/auth/auth-client.ts` → `basePath: '/puzzles/api/auth'` (better-auth client)

## Verification

| Check | Result |
|---|---|
| Dev smoke: `POST /puzzles/api/puzzle` | **HTTP 200** + generated grid |
| Dev smoke: `POST /api/puzzle` (old bare path) | **HTTP 404** (reproduces the break) |
| `npx vitest run` | **353/353 passing** |
| `npm run lint` | clean |
| `npx markdownlint-cli` (touched docs) | clean |

## Guardrail

Any new client-side `fetch('/api/...')` MUST go through `apiPath()`. A bare
`fetch('/api/...')` is a latent 404 under the basePath. Server-side code (route handlers,
cron) is unaffected. See [src/lib/base-path.md](../src/lib/base-path.md).

## Follow-up: the daily cron missed 2026-07-30 (separate from the fetch bug)

Production smoke-testing after the fetch fix surfaced a **second, unrelated** cutover
casualty: the daily-generation cron did not run for **2026-07-30**, so every daily board
was missing that day. This is *not* the `fetch()` bug — the cron is server-to-server
(Vercel → the guarded route handler) and never touches client `fetch()`.

**Evidence (read-only query of `daily_puzzles.created_at`, prod DB):** dailies were
generated on time every day 07-16 → 07-29 (always just after 00:00 UTC; one earlier
one-off miss on 07-24, pre-migration), then nothing for 07-30.

**Most likely cause:** a deploy/config-mismatch during the cutover window — when the
00:00 UTC 07-30 run fired, the production deployment's registered cron path and the route's
new basePath'd location (`/puzzles/api/cron/daily`) were momentarily out of sync, so the
scheduled invocation 404'd and inserted nothing. Everything reconciled by the later deploys
(#29–#35): the route now returns 401 (reachable + `CRON_SECRET`-guarded), `vercel.json`'s
cron path matches, and the old path 404s.

**Remediation applied (2026-07-30 ~19:52 UTC):** backfilled today by calling
`generateDailyPuzzles(db, <today UTC>)` directly against the prod DB (the same idempotent
function the cron runs; `onConflictDoNothing` on `(date, difficulty)`). Result:
**30/30 boards inserted**, all now serving `200` via `/puzzles/api/daily`, and the
leaderboard populated (Sudoku Bot seeded).

**Open item:** confirm the **07-31 00:00 UTC** scheduled run self-heals (config is
internally consistent, so it should). The exact 07-30 failure log lives in Vercel's cron
execution history — checking runs older than the retention window requires a Vercel Pro
plan, so the deploy-window explanation above stands as the working root cause.

## Related docs

- Deep write-up: [research/multi-zone-basepath-fetch-fix.md](research/multi-zone-basepath-fetch-fix.md)
- Migration plan (regression folded into §3/§4): [multi-zone-migration-plan.md](multi-zone-migration-plan.md)
- Roadmap entry: [roadmap.md](roadmap.md) (§ "Multi-zone cutover regression")
