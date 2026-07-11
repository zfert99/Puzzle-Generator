# Seed Script (`seed.ts`)

A local developer script (`npm run db:seed`) that gives a fresh database something for
the `/daily` route to load before the 4.2 generation cron exists.

## Why it exists / how it stays safe to re-run

**Why:** During local development there is no cron firing at 00:00 UTC, so a freshly
migrated database has zero daily puzzles and the `/daily` route would have nothing to
show. This script generates today's set on demand. It is written to be **idempotent** —
running it twice does not create duplicate rows — because the `UNIQUE(date, difficulty)`
constraint plus `onConflictDoNothing` turn a repeat run into a no-op.

```text
Load env from .env.local (via the load-env side-effect import, kept first).
Build a db client with createDb(DATABASE_URL) — the unguarded factory, since the
  server-only app client cannot be imported from a plain tsx script.
Call generateDailyPuzzles(db, today's UTC date) — the SAME service the cron uses,
  so seed and cron can never drift.
Log how many were newly inserted (and how many already existed).
Exit 0 on success, 1 on failure.
```

## Note

This is a Node script run via `tsx`, not part of the Next.js app build. It deliberately
uses the unguarded `createDb` factory rather than the `server-only` app client — the guard
would throw outside a bundler. Env comes from `.env.local` via the `load-env` import, which
must stay the first import so `DATABASE_URL` is set before it is read.
