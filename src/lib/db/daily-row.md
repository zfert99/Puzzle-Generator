# Daily Row Mapping (`daily-row.ts`)

Pure helpers that turn an engine-generated puzzle into a `daily_puzzles` insert row.
Kept free of any database call or clock read so both the seed script and the 4.2 cron can
reuse them and so they are trivially unit-testable at the boundary.

## `DAILY_DIFFICULTIES`

**Why:** The canonical list of difficulties a daily is generated for — `easy`, `medium`,
`hard`, `expert`. `extreme` is excluded: a daily should be beatable by a broad audience in
one sitting (Phase 4 decision). Exported so the seed, cron, and UI all agree on the set.

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
  difficulty = the puzzle's difficulty
  grid       = the unsolved grid
  solution   = the solved grid (server-only)
  clueCount  = countClues(grid)
```

## `toUtcDateString(now)`

**Why:** The daily rolls over at 00:00 UTC for everyone, so the date key must be computed
in UTC — a local-time formatter would bucket late-evening solvers into the wrong day.

```text
Take the Date's ISO string and keep the leading YYYY-MM-DD (already UTC).
```
