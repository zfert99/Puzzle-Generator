# App basePath helper (`base-path.ts`)

Single source of truth for the app's Next.js `basePath` on the client side, and the
fix for the class of bug that broke puzzle generation, the daily, and PDF export after
the multi-zone migration.

## Why this exists

The migration to `biscuitlab.net/puzzles` set `basePath: '/puzzles'` in `next.config.ts`
(unconditionally — it applies in local dev too). That means every route handler now
lives at `/puzzles/api/...`, in dev and prod.

Next.js auto-prepends `basePath` to the framework navigation primitives it controls —
`<Link>`, `next/image`, `router.push()`/`replace()`, and `/_next/*` assets. It does
**not** touch `fetch()`, because `fetch` is a browser primitive Next never sees. So a
client call like `fetch('/api/generate')` still targets `/api/generate`, which under the
hub's proxy resolves to the hub (root) zone rather than the puzzles zone — a 404. That is
exactly why generation, the daily, and PDF export silently stopped working after cutover:
the server logic was intact, but the client could no longer reach it.

The auth layer already handled this (`auth-client.ts` sets `basePath: '/puzzles/api/auth'`);
the app's own data-fetch calls were the ones missed. See
`Docs/research/multi-zone-basepath-fetch-fix.md` for the full incident write-up.

## What it provides

| Export | Purpose |
|---|---|
| `BASE_PATH` | The `'/puzzles'` constant. A hand-maintained mirror of `next.config.ts`'s `basePath` — Next inlines `basePath` at build time and never exposes it to client runtime, so there is no framework API to read it from. |
| `apiPath(path)` | Prepends `BASE_PATH` to a root-relative `/api/...` path. Every same-origin `fetch()` to one of our own route handlers goes through this. |

## The sync contract

`/puzzles` is written in three places that must agree:

1. `next.config.ts` → `basePath: '/puzzles'` (the actual mount).
2. `src/lib/base-path.ts` → `BASE_PATH` (client `fetch()` prefix).
3. `src/features/auth/auth-client.ts` → `basePath: '/puzzles/api/auth'` (better-auth client).

If the mount path ever changes, change it in all three. A single source-of-truth env
var (`NEXT_PUBLIC_BASE_PATH`) was considered but rejected for now: `basePath` in
`next.config.ts` is intentionally a hardcoded, build-time-inlined literal (migration
plan §3), and introducing a required build env creates a fail-open footgun if it is ever
unset. The hardcoded constant plus this sync note is the pragmatic trade-off.

## Guardrail

Any new client-side `fetch('/api/...')` MUST be wrapped in `apiPath(...)`. A bare
`fetch('/api/...')` is a latent 404 under the basePath. Server-side code (route handlers,
cron) is unaffected — those receive the already-stripped path and never call `apiPath`.
