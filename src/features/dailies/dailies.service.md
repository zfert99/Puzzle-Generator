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

## `generateDailyPuzzles(db, isoDate, { rng?, generate? })`

**Why:** One call rolls and generates today's whole set (**the type-as-slot roll** — 3 standard +
3 mini; see `daily-row.md`) and upserts it. It is **idempotent** — the `UNIQUE(date, difficulty)`
constraint plus `onConflictDoNothing` turn a retry or an accidental double-fire into a no-op, which
is exactly what a scheduled job needs. Seed and cron both go through here so they can never drift
apart.

```text
Ensure "Sudoku Bot"'s user row exists (idempotent; features/leaderboards/bot.ts).
Roll the day's assignment (rollDailyAssignment) -> 6 planned slots.
For each slot:
  Generate its puzzle with a never-empty fallback (below), then map it to an insert row.
Insert all rows in one statement; skip any that collide on (date, difficulty).
Seed Sudoku Bot's solve on every one of today's boards (see below).
Return { isoDate, requested, inserted } (inserted = how many were actually new).
```

`rng` and `generate` are **injected seams**: `rng` makes the roll deterministic, and `generate`
stubs the engine call. Tests use both so the orchestration, fallback, and row-mapping are exercised
in milliseconds rather than paying real generation (a rolled 9×9 Killer-extreme alone is ~5.5 s).

### Never leave a slot empty (plan Risk #2)

**Why:** the roll is random, so a slot could in principle land on a generator that fails — and a
blank slot means a missing daily for the whole day, with a dead leaderboard tab. `generateSlotWithFallback`
retries the rolled board a few times, then falls back to **another eligible board for the same
slot** — the key and difficulty stay fixed (preserving leaderboard identity and the day's distinct
key set), only the variant (and, for minis, the size) changes. Each retry and every fallback is
`logger.warn`-ed so a silent degradation is visible in production logs. At the tuned generator
settings this is belt-and-braces: the real failure mode is slowness, not throwing.

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
  Select every daily_puzzles row for isoDate (id, key, variant, grid).
  For each row:
    Look up botTimeMs in the PROFILE table by (variant, grid.length, difficultyForKey(key)).
    If a profile exists, build a solve_attempts row: bot's userId, that puzzle's id,
      botTimeMs, completed = true, mistakes = 0.
  Insert all such rows in one statement; skip any that collide on (userId, puzzleId) —
    the same uniqueness a real player's attempt is already constrained by.
```

**Why the profile lookup, not a key map:** the bot's time used to come from a `botTimeByKey` map
built off the flat registry. A rung key now holds a different type/size each day, so the time has to
follow the actual board — hence the row's stored `variant` plus its grid size. Rows whose board has
no profile entry (only archived/retired boards) are skipped rather than mis-timed.

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
