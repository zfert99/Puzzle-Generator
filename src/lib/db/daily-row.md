# Daily Registry & Row Mapping (`daily-row.ts`)

The daily registry (**type-as-slot** model) plus the pure helpers that turn an engine-generated
puzzle into a `daily_puzzles` insert row. Kept free of any database call or clock read so both the
seed script and the cron can reuse them and so they are trivially unit-testable at the boundary.

## The model: one slot per TYPE, difficulty randomized

**Why:** `/daily` had grown to a **30-board wall** — every type × every tier × every size, generated
nightly, most leaderboards empty. A daily should be a ritual with a clear win condition, not a menu.
The restructure inverts what's fixed: **one slot per puzzle TYPE, with the DIFFICULTY rolled per
day.** At four types (Kakuro joined in its plan's slice R1, October 2026) that's **4 standard +
3 mini = 7 boards** (down from 30); minis stay at three slots and roll three of the four types
(Kakuro plan decision D4), so one type sits out the minis each day.
Full rationale and the step history: `Docs/daily-redesign-plan.md`.

The consequence that drives everything else here: **the key no longer encodes the type.** A key like
`hard` is Classic one day and Killer the next, so the type is stored per row in
`daily_puzzles.variant` (migration `0004`) and read from there — never inferred from the key.

## Slots

- **Standard** — keyed by difficulty RUNG (`easy…extreme`, reusing the historical classic keys so no
  migration). Each day draws **one distinct rung per type** of the 5 (4 at four types — a random
  injection; a full 5-rung bijection once 5 types exist) and assigns one to each type. Always the
  type's standard size (9×9 for all four) — every type grades the full ladder there, so no
  eligibility gaps.
- **Mini** — keyed `mini-easy` / `mini-medium` / `mini-hard`, three slots regardless of type count:
  three of the four types are seated each day (D4). Minis are **3-tier only** (no expert/extreme
  minis) and **size is per type** (`SIZES`, Kakuro plan D11): the easy/medium boards are played at
  the seated type's smallest mini size and the hard board at a size rolled from the type's list —
  for the Sudoku family (`mini: [4, 6]`) that is exactly the old "easy/medium = 4×4, hard =
  random(4×4/6×6)" rule, and for Kakuro (`mini: [6]`) always its 6×6. The hard slot is thus the
  *only* rolled size, with two consequences elsewhere: cross-date aggregates must group by size as
  well as key and variant (`attempts.service.md`), and a generation fallback must try the rolled
  size before any other (`dailies.service.md`).

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
the type's STANDARD size (SIZES[variant].standard: 9×9 for four types, 6×6 for Skyscrapers)
     -> always eligible (every type grades the full 5-rung ladder at its standard size)
a size the type does not ship -> never
expert/extreme at a mini size -> never (no expert/extreme minis)
killer at 4×4 -> easy ONLY  (de-risked: a 16-cell no-givens grid collapses to tier-1 logic
                             — see Docs/research/killer-4x4-feasibility.md)
otherwise (classic/calc minis, killer 6×6, kakuro 6×6, skyscrapers 5×5) -> eligible at e/m/h
```

**Skyscrapers' standard is the 6×6 (Skyscrapers plan D5, owner's call 2026-10-02)** — the first
non-9×9 standard. It is the only Skyscrapers size that offers all five rungs (E5's tier sets: the
5×5 tops out at hard, the 7×7 has no easy), and a standard slot must cover the whole ladder for the
roll's bijection. Its mini is the 5×5. Nothing in the mechanism keyed on 9 — `isEligible` always
read `SIZES[variant].standard` — but every surface that *filed* a board by "smaller than 9×9 ⇒
mini" had to move to `sectionForKey` (below).

A test asserts `isEligible ⟺ getProfile` over the whole space, so a rolled slot can never be missing
its floor/bot time (plan Risk #1).

## `rollDailyAssignment(rng)`

**Why:** selection happens **at cron time**, not via a date-seeded PRNG, because the stored row is
already the single source of truth — every player reads the same row, so the roll only has to happen
once. `rng` is injected so the roll is deterministic in tests.

```text
Standard:
  shuffle the 5 rungs, take one per type (5 at five types — every rung, every day, a bijection);
  shuffle the types; pair them up, each at its OWN standard size (Skyscrapers at 6×6).
  Every pairing is valid (all types cover their standard size), so no filtering is needed.

Minis (miniConfigurations):
  enumerate every ordered pick of 3 of the N types into the easy/medium/hard seats,
    easy/medium at the seated type's smallest mini size, hard at each size the type ships,
  keep only assignments where EVERY slot passes isEligible,
  group by seating; pick a seating uniformly, then a hard size uniformly within it.
  (Restricted to the Sudoku family this is the old PERMS_3 x {4, 6} set — 6 configurations —
   and the roller test asserts it.)

Two draws rather than one uniform pick over configurations (a review finding on R1): a
configuration is a seating × a hard size, so a type with two mini sizes would be twice as likely
in the hard seat as a one-size type. Measured over 2 000 seeds the hard seat now goes classic
24% / killer 33% / keisan 20% / kakuro 23% — Kakuro even with the rest; Killer's lead is the
older skew (it cannot sit in the medium seat at 4×4, so its valid seatings lean easy/hard), and
the roller test bounds every type's share to 15–35%. The `Variant` union itself lives with the
column (`schema.ts` `DailyVariant`) and is re-exported here, so the registry and the column can
never list different types.

Return the 8 planned slots (key, section, variant, gridSize, difficulty) — 5 standard + 3 minis.
```

Enumerate-then-filter (rather than roll-and-retry) is what guarantees Killer only ever lands on
easy-4×4 or a 6×6 slot, and a valid assignment always exists because classic/Keisan cover
medium/hard at 4×4.

## `sectionForKey(key, gridSize)` (Skyscrapers R1 — D5)

```text
a bare rung (easy…extreme)  -> 'standard'   (active standard — whatever its size)
mini-<tier>                 -> 'mini'       (active mini)
anything else (retired key) -> gridSize < 9 ? 'mini' : 'standard'
```

**Why a key rule with a size fallback, not either alone.** "Smaller than 9×9 ⇒ mini" was the rule
everywhere a board was filed — `/api/daily/slots`, the playing label, the continue banner, the
archive progress aggregate — and it held while every standard was 9×9. Skyscrapers' 6×6 standard
(D5) breaks it: a `hard` Skyscrapers would be filed under the minis. The key is the truth for active
boards. The size stays as the fallback for **retired** keys because their prefixes lie (`mini4-*`,
`killer6-*`, `calc4-*` are minis without a `mini-` prefix) while every retired standard was 9×9. The
same rule is written once more as SQL in `attempts.service.ts`'s progress aggregate.

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

`variant` is derived from the **puzzle object itself** (Killer/Keisan/Kakuro/Skyscrapers carry an
explicit `variant`; classic doesn't) rather than from the registry — which is what keeps it correct
now that the roller assigns types to rung-keyed slots. Killer/Keisan ship no givens, so their `grid`
is all zeros and the cage count stands in for `clue_count`; a Skyscrapers grid is likewise all
zeros (D3) and its present-clue count is the stat.

## `toDailyPuzzleRow` and Skyscrapers (Skyscrapers R1 — D2)

A Skyscrapers' **edge clues ride the `cages` column** as `StoredSkyscraperClue { side, index,
count }[]`, one entry per present clue — `storeSkyscraperClues(clues)`; a blank is simply absent,
so the entry count is the clue count. `/api/daily` turns them back into the four length-N gutter
arrays with `restoreSkyscraperClues(stored, size)` (an out-of-range index is ignored rather than
written past the array) and hands them to the board as `clues`, so `startNewGame` sees a
`SkyscrapersPuzzle`. No migration, the Keisan/Kakuro rule: the row's `variant` gates every reader.

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

## `isIsoMonth(value)` (September 2026)

**Why:** the same rule as `isIsoDate`, one axis shorter, for routes taking a `?month=YYYY-MM`
(`/api/me/progress`, `/api/daily/days`). One shared definition instead of a per-route regex — the
route-local copies each accepted year `0000`, which Postgres cannot build a date in, so the shape
match became a driver 500 one layer down (see `isIsoDate` above).

```text
Reject anything not matching YYYY-MM outright.
Reject year 0000 and month < 1 or > 12.
```

## `firstDayOfNextMonth(month)` (September 2026)

**Why:** the exclusive upper bound for "everything in this month" queries — `getArchiveMonth` and
`getDailyProgress` both want a whole month, and an *inclusive* bound has to know how long the month
is (and gets February wrong in a leap year if it guesses). Day 1 of the next month always exists, so
`date >= '<month>-01' AND date < firstDayOfNextMonth(month)` needs no month-length table.

**Why string arithmetic, not `Date.UTC`:** the obvious spelling is wrong at both ends of the range
`isIsoMonth` accepts. `Date.UTC` maps years `0`–`99` onto 1900–1999, so `0050-03` would silently
become April **1950**; and `9999-12` formats as `+010000-01-01`, an extended-year string Postgres
rejects outright. Neither is reachable with real data (the archive starts in 2026), but "correct
except at the edges the validator allows" is exactly the bug shape `isIsoDate` exists to kill, so
it is closed rather than left in place.

```text
month 12 -> `${year + 1}-01-01`
otherwise -> `${year}-${month + 1 padded}-01`
```

## `isDailyVariant(value)` (October 2026)

A type guard for the registry's `Variant`. The board store's `PuzzleVariant` and the registry's
`Variant` agree since Kakuro joined the daily (plan slice R1), but a surface that labels a board
from the store still narrows with this guard instead of a type assertion, so a future unregistered
variant falls back visibly rather than inventing a type.

## `toDailyPuzzleRow` and Kakuro (R1)

A Kakuro's **runs ride the `cages` column**: a run is structurally a Killer cage plus a direction
(the plan's reason for shaping it that way — D2/D3), so `StoredCage` gained `StoredKakuroRun` and
no migration was needed. The row's `variant` says which interpretation applies, exactly as it
already did for Killer vs Keisan; `clue_count` holds the run count, the analogous display stat.
`/api/daily` hands the column back as `runs` for a Kakuro row so `startNewGame` sees a
`KakuroPuzzle`.

## Skyscrapers profile rows are estimates (Skyscrapers R1)

No Skyscrapers telemetry exists either (research gap G6): the only public numbers are a
~3.4–4.5 s hall-of-fame on small easy grids and GM Puzzles' 9–36 min "very hard" 6×6. The **6×6
standard** (36 cells, no givens) floors sit well below record pace (8–20 s across the ladder,
≈ 0.2–0.5 s per cell) and the bot near a typical skilled pace (1.5–10 min); the 5×5 mini (25 cells)
scales down (4–6 s; 45 s–2 min). Flagged as estimates in the code; tune from live attempts.

## Kakuro profile rows are estimates (R1)

No Kakuro telemetry exists, so its floors and bot times are **derived from cell count** (research
gap G2) rather than from the logical rating: a 9×9 has ~50 white cells and the record pace is
anecdotally near 0.8 s/cell, so floors sit well below that (20–50 s across the ladder) and the bot
near a typical skilled pace (5–25 min); the 6×6 mini (~22 cells) scales the same way (6–10 s;
1–2.5 min). They are flagged as estimates in the code and should be tuned from live attempts.
