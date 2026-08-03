# Seed Script (`seed.ts`)

A local developer script (`npm run db:seed`) that gives a fresh database something for
the `/daily` route to load before the 4.2 generation cron exists.

## Why it exists / how it stays safe to re-run

**Why:** During local development there is no cron firing at 00:00 UTC, so a freshly
migrated database has zero daily puzzles and the `/daily` route would have nothing to
show. This script generates today's set on demand. It is **idempotent** — running it twice does not
create duplicate rows — because `generateDailyPuzzles` returns early when the date already has
boards.

That early return, **not** the `UNIQUE(date, difficulty)` index, is what makes this safe. The index
only dedupes *identical keys*, which was enough while the registry emitted a fixed key set. The
assignment is now **rolled**, so a second run draws different rungs, which wouldn't collide and
would be inserted alongside the first run's — quietly giving the day extra boards. Re-running this
script is a genuine no-op only because of the guard.

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
