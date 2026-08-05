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
difficulty  the daily-board KEY (idempotency handle + API/leaderboard identity)
variant     puzzle TYPE: classic | killer | calc (stored, not inferred from the key)
grid        the unsolved puzzle (JSON) sent to clients
solution    the solved grid (JSON) — SERVER-ONLY, never sent for an unsolved daily
clue_count  denormalized count of givens (cage count for Killer/Keisan)
created_at  timestamptz
UNIQUE (date, difficulty)
```

**Why `variant` (July 2026, daily restructure — Step 3a).** The `difficulty` key historically
encoded the puzzle type (`killer-easy`, `calc9-hard`). The type-as-slot restructure keys standard
slots by rung (`easy…extreme`) and minis by `mini-<tier>`, with the TYPE rolled per day — so the key
no longer tells you the type. `variant` stores it explicitly. Added by migration `0004` as
**additive + backfill**: `ADD COLUMN` nullable → backfill every historical key to its type (classic /
killer / calc, by key pattern) → `SET NOT NULL` (which doubles as the no-null exhaustiveness gate).
`toDailyPuzzleRow` derives it from the generated puzzle, not the registry, so it stays correct once
the roller assigns types to rung-keyed slots. Readers (serve route, solve-time floor, bot-seed)
switch to this column in Step 3b.

> Users are no longer defined here — see [auth-schema.ts](./auth-schema.ts) for the
> canonical `user` table (better-auth).

## `solveAttempts`

**Why:** A user's one ranked attempt at a daily. `time_ms` is the **client's in-game timer** —
a deliberate tradeoff so save-and-continue doesn't punish a player for stepping away, guarded
server-side by a plausibility floor rather than by trusting the number (see
[solve-rules.md](../../features/leaderboards/solve-rules.md)). The `(puzzle_id, time_ms)`
index backs the "fastest times for today" leaderboard query. Rows cascade-delete with their
user or puzzle so no orphaned attempts survive an account/puzzle deletion.

> **This doc said "server-computed" until August 2026.** That was true when 4.4 was written and
> false after the switch to client timing; nothing in the mirrored-doc rule catches a claim that
> silently *becomes* wrong, so it survived several passes over this file. Corrected during the
> reverse-reference sweep for the solve-path hardening PR.

**Two guards, often confused.** `UNIQUE(user_id, puzzle_id)` caps one attempt **row** per user
per puzzle — it is about row count, and it says nothing about the `completed` flag. Capping one
*ranked* attempt is a separate matter: `recordSolve` enforces it with a conditional
`WHERE … AND completed = false` on the UPDATE, because a read-then-write pair over `neon-http`
(no transactions) let two concurrent submissions both pass.

Both `time_ms` and `mistakes` are `integer` (int4, max 2,147,483,647). They carry
client-supplied values, so writes clamp to that range — an unclamped number is a driver-level
error mid-UPDATE, which escapes the typed-error path and surfaces as a 500.

```text
id, user_id (text) -> user (cascade), puzzle_id -> daily_puzzles (cascade)
time_ms (client in-game timer, clamped to int4), completed, mistakes, created_at
UNIQUE (user_id, puzzle_id)
INDEX (puzzle_id, time_ms)
```

## Caged dailies (Killer / Keisan)

`daily_puzzles.cages` (nullable jsonb) carries the cage partition for a **caged daily** (Killer or
Keisan); a classic row has `cages = NULL`. `clue_count` holds the cage count for these (they ship no
given clues — the cages are the clue). Which cage interpretation applies (Killer sum vs. Keisan
operator+target) is told by the row's **`variant`** column. Historically the type was inferred from
the `difficulty` key (`killer-*`, `calc*`, or the legacy single `'killer'` key); that inference is
being retired in favor of stored `variant` (see above). Migrations: `0003_killer_daily_cages.sql`
(added `cages`), `0004_safe_pyro.sql` (added `variant`).

## Security note

Every column is reached only through Drizzle's parameterized query builder — never
string-built SQL (AGENTS.md §6). The `solution` JSON must never be serialized to the
client for an unsolved daily.
