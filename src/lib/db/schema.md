# DB Schema (`schema.ts`)

The Drizzle/Postgres schema for the app domain: the shared daily puzzles and each user's
ranked solve attempt.

## Why these tables and not more

Auth-identity tables (the canonical `user`, OAuth accounts, passkeys, sessions) live in
[auth-schema.ts](./auth-schema.ts), owned by better-auth's Drizzle adapter (4.3) — keeping
them separate avoids two competing sources of truth. `solve_attempts` references that
`user`.

**History:** 4.1 shipped a minimal custom `users` (uuid) table here. 4.3 replaced it with
better-auth's string-id `user`, so `solve_attempts.user_id` is now `text` (not uuid) and
FKs to `user.id`.

## `dailyPuzzles`

**Why:** One shared puzzle per difficulty per calendar day (UTC), so every player faces
the same board and times are comparable. The `UNIQUE(date, difficulty)` constraint is
what makes the 4.2 generation cron idempotent — re-running it upserts instead of
duplicating.

```text
id          uuid, generated
date        the UTC calendar day this puzzle belongs to
difficulty  easy | medium | hard | expert | extreme
grid        the unsolved puzzle (JSON) sent to clients
solution    the solved grid (JSON) — SERVER-ONLY, never sent for an unsolved daily
clue_count  denormalized count of givens, for cheap display/sorting
created_at  timestamptz
UNIQUE (date, difficulty)
```

> Users are no longer defined here — see [auth-schema.ts](./auth-schema.ts) for the
> canonical `user` table (better-auth).

## `solveAttempts`

**Why:** A user's one ranked attempt at a daily. `time_ms` is **server-computed** in 4.4;
a client-reported time is never trusted (anti-cheat). `UNIQUE(user_id, puzzle_id)` caps
each user to one ranked attempt per puzzle; the `(puzzle_id, time_ms)` index backs the
"fastest times for today" leaderboard query. Rows cascade-delete with their user or
puzzle so no orphaned attempts survive an account/puzzle deletion.

```text
id, user_id (text) -> user (cascade), puzzle_id -> daily_puzzles (cascade)
time_ms (server-computed), completed, mistakes, created_at
UNIQUE (user_id, puzzle_id)
INDEX (puzzle_id, time_ms)
```

## Killer dailies (July 2026)

`daily_puzzles.cages` (nullable jsonb) carries the cage partition for a **Killer daily** —
one per day, stored with the literal difficulty `'killer'`. Reusing the difficulty column as
the variant key keeps the `UNIQUE(date, difficulty)` idempotency constraint and the entire
difficulty-keyed solve/leaderboard/streak flow working with **no new tables or keys**; a
classic row simply has `cages = NULL`. `clue_count` holds the cage count for Killer (it has
no given clues — the cages are the clue). Migration `0003_killer_daily_cages.sql`.

## Security note

Every column is reached only through Drizzle's parameterized query builder — never
string-built SQL (AGENTS.md §6). The `solution` JSON must never be serialized to the
client for an unsolved daily.
