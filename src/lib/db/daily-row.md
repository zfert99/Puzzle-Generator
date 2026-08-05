# Daily Registry & Row Mapping (`daily-row.ts`)

The daily registry (**type-as-slot** model) plus the pure helpers that turn an engine-generated
puzzle into a `daily_puzzles` insert row. Kept free of any database call or clock read so both the
seed script and the cron can reuse them and so they are trivially unit-testable at the boundary.

## The model: one slot per TYPE, difficulty randomized

**Why:** `/daily` had grown to a **30-board wall** — every type × every tier × every size, generated
nightly, most leaderboards empty. A daily should be a ritual with a clear win condition, not a menu.
The restructure inverts what's fixed: **one slot per puzzle TYPE, with the DIFFICULTY rolled per
day.** Today that's **3 standard + 3 mini = 6 boards** (down from 30); at five types it becomes 5+5.
Full rationale and the step history: `Docs/daily-redesign-plan.md`.

The consequence that drives everything else here: **the key no longer encodes the type.** A key like
`hard` is Classic one day and Killer the next, so the type is stored per row in
`daily_puzzles.variant` (migration `0004`) and read from there — never inferred from the key.

## Slots

- **Standard** — keyed by difficulty RUNG (`easy…extreme`, reusing the historical classic keys so no
  migration). Each day draws **3 distinct rungs** of the 5 and assigns one to each type (a random
  injection; a full 5-rung bijection once 5 types exist). Always 9×9 — every type grades the full
  9×9 ladder, so no eligibility gaps.
- **Mini** — keyed `mini-easy` / `mini-medium` / `mini-hard`. Minis are **3-tier only** (no
  expert/extreme minis) and **size follows difficulty**: easy/medium = 4×4, hard = random(4×4/6×6).
  That hard slot is the *only* rolled size, and it has two consequences elsewhere: cross-date
  aggregates must group by size as well as key and variant (`attempts.service.md`), and a generation
  fallback must try the rolled size before any other (`dailies.service.md`).

No anti-monotony cap is needed — one-slot-per-type makes the types distinct by construction.

## `PROFILE` — the `(variant, size, difficulty)` table

**Why:** with type decoupled from the key, per-board tuning can't hang off the key any more. The
profile table is keyed on what actually determines a board's character:

- `minSolveMs` — the anti-cheat plausibility floor (see `solve-rules.md`). Conservative lower
  bounds, not records to police fast solvers.
- `botTimeMs` — "Puzzle Bot"'s time on that board (`features/leaderboards/bot.ts`): a hand-tuned
  "good, beatable" human time. Sourced from the difficulty research across this project (community
  classic solve-time bands; Killer runs slower than classic since it starts with no givens; minis
  scale down with the grid). Deliberately well above `minSolveMs` ("impossibly fast", not
  "typical"), so it reads as a genuine skilled solve. Flavor, not a derived value — retune freely.

Values were **moved verbatim** from the pre-restructure registry; only `killer-4-easy` is new
(Step 2). `getProfile(variant, size, difficulty)` is the accessor.

## `isEligible(variant, size, difficulty)`

**Why:** not every combination is a real board, so the roller must be constrained rather than
free — otherwise it would ask for puzzles the engines can't honestly grade.

```text
9×9  -> always eligible (every type grades the full 5-rung ladder)
expert/extreme at 4×4 or 6×6 -> never (no expert/extreme minis)
killer at 4×4 -> easy ONLY  (de-risked: a 16-cell no-givens grid collapses to tier-1 logic
                             — see Docs/research/killer-4x4-feasibility.md)
otherwise (classic/calc minis, killer 6×6) -> eligible at e/m/h
```

A test asserts `isEligible ⟺ getProfile` over the whole space, so a rolled slot can never be missing
its floor/bot time (plan Risk #1).

## `rollDailyAssignment(rng)`

**Why:** selection happens **at cron time**, not via a date-seeded PRNG, because the stored row is
already the single source of truth — every player reads the same row, so the roll only has to happen
once. `rng` is injected so the roll is deterministic in tests.

```text
Standard:
  shuffle the 5 rungs, take 3; shuffle the 3 types; pair them up.
  Every pairing is valid (all types cover 9×9), so no filtering is needed.

Minis:
  enumerate every (type -> slot permutation) x (hard-slot size in {4, 6}),
  keep only assignments where EVERY slot passes isEligible,
  pick one uniformly at random.

Return the 6 planned slots (key, section, variant, gridSize, difficulty).
```

Enumerate-then-filter (rather than roll-and-retry) is what guarantees Killer only ever lands on
easy-4×4 or a 6×6 slot, and a valid assignment always exists because classic/Keisan cover
medium/hard at 4×4.

## Keys: active vs. retired

`isDailyDifficulty` accepts **active slot keys** (the 5 rungs + 3 mini keys) *and* **retired keys**
(`killer-*`, `killer6-*`, `mini4-*`, `mini6-*`, `calc4-*`, `calc6-*`, `calc9-*`, and the legacy
single `killer`). Retired keys are never generated again but must stay valid so archived rows remain
replayable — the same pattern the legacy `'killer'` key already used.

`formatDailyKey(key)` labels a key **on its own** (no variant context): active standard keys are the
bare rung, minis read `mini <tier>`, retired keys keep their old prettified form. Composing the
richer "Difficulty · Type" label needs the row's stored `variant`, so that lives in the UI layer
(`features/dailies/slot-display.ts`), not here.

## `countClues(grid)`

**Why:** `clue_count` is denormalized onto the row for cheap display/sorting, so we count the givens
once at insert time rather than deriving it on every read.

```text
Walk every cell of the grid. Count the cells that are not 0 (0 means empty). Return the count.
```

## `toDailyPuzzleRow(puzzle, isoDate, key)`

**Why:** centralizes the puzzle→row shape in one place. It takes the date as an argument rather than
reading the clock, keeping the function deterministic — the caller owns "what day is it," which
matches the server-authoritative-time posture of the anti-cheat design. The caller also owns the
KEY, since the same engine difficulty generates under different keys (`hard` vs `mini-hard`).

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

`variant` is derived from the **puzzle object itself** (Killer/Keisan carry an explicit `variant`;
classic doesn't) rather than from the registry — which is what keeps it correct now that the roller
assigns types to rung-keyed slots. Killer/Keisan ship no givens, so their `grid` is all zeros and
the cage count stands in for `clue_count`.

## `toUtcDateString(now)`

**Why:** the daily rolls over at 00:00 UTC for everyone, so the date key must be computed in UTC — a
local-time formatter would bucket late-evening solvers into the wrong day.

```text
Take the Date's ISO string and keep the leading YYYY-MM-DD (already UTC).
```

## `isIsoDate(value)`

**Why:** shape is not existence, and the gap between them reached the database. Every route taking
a `?date=` used to validate with `/^\d{4}-\d{2}-\d{2}$/`, which happily accepts `2026-02-31`. That
string cleared validation, was compared against a Postgres `date` column, and the driver threw —
an unhandled 500 carrying a stack trace, produced by input the route had already said yes to. It is
the same failure shape as the `time_ms` int4 overflow: a loose check waves the value through and
the column, not the validator, does the rejecting.

The cases below were each measured against the live database first, so the rules encode observed
behaviour rather than guesses — which matters because the two obvious shortcuts are both wrong:
rejecting every February 29 would break `2024-02-29` (a real day), and flooring the year at the
project's own history would break the archive's honest "no puzzles that day" answer.

**`/api/leaderboard` is the route to probe when checking this guard**, because it is the only one of
the three without a `isoDate > todayIso` future check — so its response isolates *this* rule instead
of confounding it. On the guarded routes a future-but-real date like `2400-02-29` comes back 400
`Cannot fetch a future daily`, which reads like a rejection by `isIsoDate` and is not one. Against
`/api/leaderboard`: `2400-02-29` → 404 (accepted, no puzzle that day), `2400-02-30` → 400,
`2100-02-29` → 400. That trio is the century rule verified end to end, not just in the unit test.

```text
Reject anything not matching YYYY-MM-DD outright.
Reject year 0000        -> the SQL calendar runs 1 BC -> AD 1; `0000-01-01` 500s.
Reject month < 1 or > 12.
Reject day < 1 or day > the month's real length,
  where February is 29 only in a proleptic-Gregorian leap year (÷4, except ÷100 unless ÷400)
  -> `2026-02-29` 500s, `2024-02-29` and `2400-02-29` are real days.
```

**What it deliberately does not do:** decide whether the date is one the app *has puzzles for*.
"Is this a date?" and "is this a day we ran?" are different questions with different answers — a
valid but empty day still deserves an empty list or a 404, never a 400.
