# Daily Cron Route (`/api/cron/daily`)

`GET /api/cron/daily` — generates today's daily puzzles. Called at 00:07 UTC by the
[**Daily puzzles**](../../../../../.github/workflows/daily-puzzles.yml) GitHub Actions workflow,
which curls `https://biscuitlab.net/puzzles/api/cron/daily` with the `CRON_SECRET` repo secret.

## Why a GitHub Action rather than Vercel Cron (August 2026)

**Why:** it used to be a Vercel Cron declared in `vercel.json`, and that stopped working silently.
Vercel invokes crons on a project's **generated** production URL (`*.vercel.app`) — confirmed from
the runtime logs, where every successful run arrived on that domain. Enabling Deployment Protection
restricts precisely that URL: *"When you enable Standard Protection, the production generated
deployment URL becomes restricted."* Crons **do not follow redirects**, and Vercel does not log
redirected invocations at all, so from 2026-08-07 the job stopped and left no error anywhere — the
outage surfaced only because `/daily` had no boards.

Calling the **custom** domain avoids the whole class: custom production domains are exempt from
Standard Protection, so protection stays on and the request reaches the route. Nothing about
authorization changes — the `CRON_SECRET` check below was always the real guard, not the caller's
identity. The workflow also asserts afterwards that the day actually has boards, which is the check
that would have caught the silent failure, and adds a `workflow_dispatch` trigger so a missed night
can be recovered without hand-seeding from a laptop.

The alternative — Vercel's Protection Bypass for Automation — was rejected: `vercel.json` takes a
path, not headers, so the bypass secret would have to ride in the query string of a **public**
repo's committed config.

## Why the constant-time secret check

**Why:** This endpoint writes to the database, so it must not be publicly triggerable. The caller
attaches `Authorization: Bearer <CRON_SECRET>`; the route verifies it. The comparison SHA-256s both the provided and expected values
before `timingSafeEqual`, so it always compares two fixed-length digests — avoiding both
`timingSafeEqual`'s throw-on-unequal-length behavior and any timing leak of the secret's
length. If `CRON_SECRET` is unset the route **fails closed** (401), never running unguarded.

```text
If CRON_SECRET is not configured -> log misconfig, 401 (fail closed).
Constant-time compare the Authorization header against `Bearer <CRON_SECRET>`.
If it doesn't match -> 401.
Otherwise generate today's daily puzzles via the service (idempotent) and return
  { ok: true, isoDate, requested, inserted }.
On any thrown error -> log server-side, return a generic 500.
```

## Why idempotent matters here

**Why:** A cron can fire twice, or be retried after a transient failure. `generateDailyPuzzles`
returns early when the date already has boards, reporting `skipped: true` (and `inserted: 0`)
instead of touching the day. Runs on the Node.js runtime (`node:crypto` + the DB driver are
Node-only, never Edge).

The day's roll is therefore **first-write-wins**: once a date has boards, a re-run leaves them
exactly as they are. A player's board never changes under them mid-day.

> **This used to be wrong, and it mattered.** An earlier version of this note claimed a re-run's
> freshly-rolled slots would "collide and be skipped" on `UNIQUE(date, difficulty)`. They don't —
> the roll is **random**, so a second run draws *different* rungs, which have nothing to collide
> with and insert cleanly alongside the first run's. That is how 2026-07-31 ended up with 33 rows.
> The unique index dedupes identical keys; only the explicit date guard dedupes *runs*.

## `maxDuration` (daily restructure Step 3b)

Lowered **120 s → 60 s**. The old budget covered generating all 30 registry boards including every
slow tier; the roll now produces **6** boards, of which at most one standard slot can be a 9×9
extreme (the ~5.5 s Killer-extreme being the worst case) alongside millisecond-scale minis. 60 s
keeps a wide margin over the realistic worst case while trimming a function budget that no longer
reflected the work.
