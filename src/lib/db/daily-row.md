# Daily Row Mapping (`daily-row.ts`)

Pure helpers that turn an engine-generated puzzle into a `daily_puzzles` insert row.
Kept free of any database call or clock read so both the seed script and the 4.2 cron can
reuse them and so they are trivially unit-testable at the boundary.

## `DAILY_DIFFICULTIES`

**Why:** The canonical list of difficulties a daily is generated for — `easy`, `medium`,
`hard`, `expert`, `extreme` (the full range). Exported so the seed, cron, and UI all agree on
the set, and the array order is the order shown in the UI.

`isDailyDifficulty(value)` is the narrowing guard routes use to validate the `difficulty`
input (query or body) against this set — shared so every daily/solve/leaderboard route
validates identically.

## `countClues(grid)`

**Why:** `clue_count` is denormalized onto the row for cheap display/sorting, so we count
the givens once at insert time rather than deriving it on every read.

```text
Walk every cell of the grid.
Count the cells that are not 0 (0 means empty).
Return the count.
```

## `toDailyPuzzleRow(puzzle, isoDate)`

**Why:** Centralizes the puzzle→row shape in one place. It takes the date as an argument
rather than reading the clock, keeping the function deterministic — the caller owns "what
day is it," which matches the server-authoritative-time posture of the anti-cheat design.

```text
Return a row with:
  date       = the given ISO YYYY-MM-DD (UTC) string
  difficulty = the daily-board KEY passed by the caller
  variant    = the puzzle TYPE: 'variant' in puzzle ? puzzle.variant : 'classic'
  grid       = the unsolved grid
  solution   = the solved grid (server-only)
  clueCount  = cage count for Killer/Keisan, else countClues(grid)
  cages      = the cage partition for Killer/Keisan, else null
```

`variant` is derived from the puzzle object itself (Killer/Keisan carry an explicit `variant`;
classic doesn't), **not** from the registry — so it stays correct once the roller assigns types to
rung-keyed slots (Step 3b). It backs the stored `daily_puzzles.variant` column (migration `0004`),
which readers use instead of inferring type from the key.

## `toUtcDateString(now)`

**Why:** The daily rolls over at 00:00 UTC for everyone, so the date key must be computed
in UTC — a local-time formatter would bucket late-evening solvers into the wrong day.

```text
Take the Date's ISO string and keep the leading YYYY-MM-DD (already UTC).
```

## The Killer daily ('killer' as a sixth difficulty)

`DAILY_DIFFICULTIES` ends with `'killer'` — one Killer daily per day, generated at engine
difficulty medium (a service constant, not schema). `toDailyPuzzleRow` accepts
`SudokuPuzzle | KillerPuzzle`; a Killer puzzle maps to difficulty `'killer'` (the engine
difficulty is a generation detail), stores its cages, and records the cage count in
`clue_count`. Treating `'killer'` as a difficulty rather than adding a variant column means
every difficulty-keyed surface (picker, solve route, leaderboard tabs, streaks) picks the
Killer daily up with zero changes.

## The daily-board registry (July 2026)

`DAILY_BOARDS` replaced the flat difficulty list: 30 boards/day across four sections — classic
9×9 (keys unchanged, so historical rows need no migration), the full Killer 9×9 ladder
(`killer-easy` … `killer-extreme`), minis (`mini4-*`, `mini6-*`, `killer6-*`, `calc4-*`, `calc6-*`),
and Keisan 9×9 (`calc9-*`). (This flat registry is being reshaped into a slot-list + profile table by
Step 3b of the daily restructure — see `Docs/daily-redesign-plan.md`.) The `key`
IS the `daily_puzzles.difficulty` value, the API/leaderboard key, and the idempotency handle.
Each entry carries its section, label, variant, gridSize, engine difficulty, and anti-cheat
floor (`minSolveMs` — single source of truth for `solve-rules`). `toDailyPuzzleRow` now takes
the key explicitly (the same engine difficulty generates under different keys). The legacy
`'killer'` key (the pre-ladder single daily) stays readable for archived rows but is never
generated; `formatDailyKey` prettifies keys for display.

## `botTimeMs` (Sudoku Bot, July 2026)

**Why:** Each board also carries `botTimeMs` — "Sudoku Bot"'s (`features/leaderboards/bot.ts`)
daily time on that board, a hand-tuned "good, beatable" human time, not a record. Sourced
from the difficulty research gathered across this project (community classic-Sudoku
solve-time bands; Killer research noting it runs slower than classic since it starts with no
givens; minis scale down with the smaller grid). It's deliberately well above `minSolveMs`,
which marks "impossibly fast" rather than "typical," so the bot's time reads as a genuine
skilled solve rather than a floor-skimming one. It's flavor, not a derived/anti-cheat value —
retune freely.
