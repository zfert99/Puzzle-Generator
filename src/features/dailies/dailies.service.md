# Dailies Service (`dailies.service.ts`)

Data access for the shared daily puzzles. Backs both the daily cron and the `/api/daily`
read route, and is reused by the local seed script.

## Why `db` is a parameter, not a module import

**Why:** Every function takes the Drizzle `db` as its first argument instead of importing
the `server-only` app client at module scope. That single choice lets the *same* module be
imported by the API routes (which pass the guarded client) **and** by the `tsx` seed script
(where importing `server-only` would throw — there is no bundler to satisfy its
`react-server` condition). The `Database` import is type-only, so nothing here drags the
Neon driver in at import time. It also makes the service trivially testable: a stand-in db
object mocks the boundary without touching the network.

## `generateDailyPuzzles(db, isoDate)`

**Why:** One call generates today's whole set (one puzzle per eligible difficulty) and
upserts it. It is **idempotent** — the `UNIQUE(date, difficulty)` constraint plus
`onConflictDoNothing` turn a retry or an accidental double-fire into a no-op, which is
exactly what a scheduled job needs. Seed and cron both go through here so they can never
drift apart.

```text
Ensure "Sudoku Bot"'s user row exists (idempotent; features/leaderboards/bot.ts).
For each daily difficulty (easy, medium, hard, expert):
  Generate a puzzle and map it to an insert row for isoDate.
Insert all rows in one statement; skip any that collide on (date, difficulty).
Seed Sudoku Bot's solve on every one of today's boards (see below).
Return { isoDate, requested, inserted } (inserted = how many were actually new).
```

## Sudoku Bot seeding (July 2026)

**Why:** After the day's boards exist, `generateDailyPuzzles` gives "Sudoku Bot"
(`features/leaderboards/bot.ts`) a clean, completed solve on each one — a visible "time to
beat" for a small player base, without any separate cron or infra. It runs as a step inside
the *existing* idempotent pipeline (already called by both the Vercel cron and the local seed
script), so no new scheduled job is needed.

**Why a fresh SELECT, not the insert's `.returning()`:** `.returning()` only reflects rows
*this call* actually inserted — on a day where the puzzles already existed (cron re-run,
manual re-seed), it would be empty and the bot would never get seeded for that day. Selecting
all of today's rows by date instead means the bot backfills automatically the next time
generation runs for that date, including boards that were generated before this feature
shipped.

```text
seedBotSolves(db, isoDate):
  Select every daily_puzzles row for isoDate (id, difficulty/key).
  For each row whose key has a tuned botTimeMs (DAILY_BOARDS):
    Build a solve_attempts row: bot's userId, that puzzle's id, botTimeMs,
      completed = true, mistakes = 0.
  Insert all such rows in one statement; skip any that collide on (userId, puzzleId) —
    the same uniqueness a real player's attempt is already constrained by.
```

## `getDailyPuzzle(db, isoDate, difficulty)`

**Why:** Fetches the single stored puzzle for a UTC day + difficulty, or `null` if the
cron has not produced it yet (the route turns that into a 404). Returns the full row
*including* `solution`; the route — not the service — decides what to expose, keeping this
layer a plain, unopinionated repository.

```text
Select the row where date = isoDate AND difficulty = difficulty, limit 1.
Return it, or null if none.
```

## Security note

All access is parameterized through Drizzle (AGENTS.md §6). Daily puzzles are shared,
public, read-only to clients — no ownership check applies here. The BOLA-sensitive writes
(a user's solve attempt) live in the leaderboard/solve service (4.3.1 / 4.4).

## Killer daily generation

`generateDailyPuzzles` special-cases the `'killer'` entry: it calls
`generateKillerSudoku('medium')` (the score-banded graded generator) instead of
`generateSudoku`. Generation cost is ~120 ms — negligible next to the classic Extreme digger
the cron already pays for. Idempotency is unchanged: the `'killer'` row rides the same
`UNIQUE(date, difficulty)` + `onConflictDoNothing` upsert.

## Registry-driven generation (July 2026)

`generateDailyPuzzles` loops `DAILY_BOARDS` (19/day): classic via
`generateSudoku(difficulty, gridSize)`, killer via `generateKillerSudoku(difficulty,
{ gridSize })`. The slow ones are classic extreme (digger) and killer-extreme (~5.5 s
tier-5 search); the cron route declares `maxDuration = 120` for headroom. Idempotency
unchanged — same `UNIQUE(date, difficulty)` + `onConflictDoNothing`.
