# Daily Cron Route (`/api/cron/daily`)

`GET /api/cron/daily` — the Vercel Cron target that generates today's daily puzzles.
Scheduled at 00:00 UTC in `vercel.json`.

## Why the constant-time secret check

**Why:** This endpoint writes to the database, so it must not be publicly triggerable.
Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` when that env var is
set; the route verifies it. The comparison SHA-256s both the provided and expected values
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

**Why:** A cron can fire twice, or be retried after a transient failure. Because
generation upserts on `UNIQUE(date, difficulty)`, a second same-day run simply reports
`inserted: 0` instead of duplicating the day's puzzles. Runs on the Node.js runtime
(`node:crypto` + the DB driver are Node-only, never Edge).

Note this makes the day's roll **first-write-wins**: if rows already exist for the date, a re-run's
freshly-rolled slots collide and are skipped rather than replacing them. That is the desired
behaviour (a player's board never changes under them mid-day), and it is what makes the
restructure's cutover day safe — the pre-existing rows simply stand.

## `maxDuration` (daily restructure Step 3b)

Lowered **120 s → 60 s**. The old budget covered generating all 30 registry boards including every
slow tier; the roll now produces **6** boards, of which at most one standard slot can be a 9×9
extreme (the ~5.5 s Killer-extreme being the worst case) alongside millisecond-scale minis. 60 s
keeps a wide margin over the realistic worst case while trimming a function budget that no longer
reflected the work.
