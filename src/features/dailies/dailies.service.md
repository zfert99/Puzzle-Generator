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
3 mini; see `daily-row.md`) and stores it, which is exactly what a scheduled job needs. Seed and
cron both go through here so they can never drift apart.

```text
Ensure "Puzzle Bot"'s user row exists (upserted; features/leaderboards/bot.ts).
If this date ALREADY has any board:          <- the idempotency guard
  Re-seed bot solves (that part is idempotent) and return { requested: 0, skipped: true }.
Roll the day's assignment (rollDailyAssignment) -> 6 planned slots.
For each slot:
  Generate its puzzle with a never-empty fallback (below), then map it to an insert row.
Insert all rows in one statement; skip any that collide on (date, difficulty).
Seed Puzzle Bot's solve on every one of today's boards (see below).
Return { isoDate, requested, inserted, skipped: false }.
```

### Why idempotency needs an explicit guard now

**A re-run used to be free.** The old flat registry emitted the SAME 30 keys every time, so
`UNIQUE(date, difficulty)` + `onConflictDoNothing` made a second run a true no-op.

**The roll is random**, so the unique index can no longer recognise a re-run: a second call draws
*different* rungs, which don't collide and are therefore inserted **alongside** the existing ones —
silently turning a 6-board day into 8+, with two boards of one type and a wrong archive denominator.
This is not theoretical: 2026-07-31 holds 33 rows because the first post-restructure run added its 3
new `mini-*` keys to a day that already had the old 30.

So the service checks the date first and returns early. Cron retries, redeploy-triggered runs and
manual `db:seed` all rely on it. The batch insert is a single statement, so a day is always either
empty or complete — probing for any one row is enough.

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

## Puzzle Bot seeding (July 2026)

**Why:** After the day's boards exist, `generateDailyPuzzles` gives "Puzzle Bot"
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

## Superseded designs (kept for orientation, no longer how this works)

Two earlier shapes of this service are described here only so an older commit or doc reference
makes sense. **Neither is current** — see `generateDailyPuzzles` above for what the code does now.

- **Single Killer daily.** `'killer'` was once a literal difficulty key generated at engine-medium,
  special-cased inside the loop. The key is now retired-but-readable (archive replay only), and
  the type is stored in `daily_puzzles.variant` rather than encoded in the key.
- **Registry-driven generation (July 2026).** The service looped a flat `DAILY_BOARDS` array of 30
  fixed boards and declared `maxDuration = 120`. The type-as-slot restructure replaced that with a
  per-day roll over 6 slots and dropped `maxDuration` to 60. Critically, the old loop's idempotency
  came free from the fixed key set; the roll is random, so it needs the explicit guard documented
  above.
