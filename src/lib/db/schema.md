# DB Schema (`schema.ts`)

The Drizzle/Postgres schema for Phase 4's stateful pivot. Three tables define what the
app now remembers: the shared daily puzzles, the users who solve them, and each user's
ranked solve attempt.

## Why these tables and not more

Auth-identity tables (OAuth accounts, passkeys, sessions) are **deliberately absent**.
They are owned by better-auth's Drizzle adapter and land in slice 4.3. Defining them
here too would create two competing sources of truth for the same tables. `users` is
kept minimal for the same reason — no `password_hash` column exists yet, and if password
auth is ever added it must be Argon2id + a 16-byte salt (AGENTS.md §6), never a raw hash.

## `dailyPuzzles`

**Why:** One shared puzzle per difficulty per calendar day (UTC), so every player faces
the same board and times are comparable. The `UNIQUE(date, difficulty)` constraint is
what makes the 4.2 generation cron idempotent — re-running it upserts instead of
duplicating.

```text
id          uuid, generated
date        the UTC calendar day this puzzle belongs to
difficulty  easy | medium | hard | expert   (extreme is excluded from dailies)
grid        the unsolved puzzle (JSON) sent to clients
solution    the solved grid (JSON) — SERVER-ONLY, never sent for an unsolved daily
clue_count  denormalized count of givens, for cheap display/sorting
created_at  timestamptz
UNIQUE (date, difficulty)
```

## `users`

**Why:** A stable identity to attach solve attempts and streaks to. Minimal on purpose —
authentication details live in better-auth's adapter tables.

```text
id, username (unique), created_at
```

## `solveAttempts`

**Why:** A user's one ranked attempt at a daily. `time_ms` is **server-computed** in 4.4;
a client-reported time is never trusted (anti-cheat). `UNIQUE(user_id, puzzle_id)` caps
each user to one ranked attempt per puzzle; the `(puzzle_id, time_ms)` index backs the
"fastest times for today" leaderboard query. Rows cascade-delete with their user or
puzzle so no orphaned attempts survive an account/puzzle deletion.

```text
id, user_id -> users (cascade), puzzle_id -> daily_puzzles (cascade)
time_ms (server-computed), completed, mistakes, created_at
UNIQUE (user_id, puzzle_id)
INDEX (puzzle_id, time_ms)
```

## Security note

Every column is reached only through Drizzle's parameterized query builder — never
string-built SQL (AGENTS.md §6). The `solution` JSON must never be serialized to the
client for an unsolved daily.
