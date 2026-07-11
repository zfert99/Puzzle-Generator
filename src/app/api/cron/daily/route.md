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
