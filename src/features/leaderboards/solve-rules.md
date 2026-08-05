# Solve Rules (`solve-rules.ts`)

Pure anti-cheat rules for a daily solve — no DB, no clock — so they are unit-testable and
live in one reviewable place.

## Why pure, and why pragmatic

**Why:** The services apply these around the server-authoritative timing and grid data;
keeping the rules pure means the (easy to get subtly wrong) checks are tested in isolation.
The posture is deliberately **pragmatic** (project decision): we keep serving the solution
to the board so hints/mistake-highlighting work, and rely on these server-side checks
rather than hiding the solution — a sudoku is externally solvable anyway.

## `gridsMatch(a, b)`

**Why:** The server verifies a submitted grid against the stored solution before recording
any time — you can't rank without actually solving it. Deep cell-by-cell equality.

## `isImplausiblyFast(variant, gridSize, difficulty, timeMs)`

**Why:** Rejects a submission faster than any human could solve (i.e. instant autofill).
The floor only needs to exclude the impossible, not police fast solvers, so it is set
conservatively below real human records and rises with difficulty.

```text
floor = getProfile(variant, gridSize, difficulty).minSolveMs   (daily-row.ts PROFILE table)
isImplausiblyFast(...) -> timeMs < floor
```

**Why keyed on the board, not the slot key (daily restructure Step 3b).** Floors used to be a
`MIN_SOLVE_MS[key]` map built from the flat board registry. Under type-as-slot a rung key like
`hard` holds a **different type and size each day**, so a key-indexed floor would validate a Keisan
9×9 solve against a Classic 9×9 floor (and the new `mini-*` keys wouldn't be in the map at all).
Deriving from the puzzle's stored `(variant, size, difficulty)` keeps the floor attached to the
board a player actually solved. Killer floors sit above classic at the same tier — Killer starts
from an empty grid (no givens), so it takes longer.

A `DEFAULT_MIN_SOLVE_MS` (3 s) covers the unreachable case of a board with no profile row — the
`isEligible ⟺ getProfile` coverage test guarantees every rolled board has one. It sits below every
real floor, so it never wrongly rejects a genuine solve.

## What the floor does NOT do (read before tuning it)

**The floor is compared against the client-supplied `timeMs`, so it cannot stop a chosen value at
any setting.** Raising a floor from 3 s to 20 s just means a scripted submission says `20001`; the
attacker's cost is editing one integer. What the floor genuinely buys is exclusion of *accidental*
garbage — a mis-wired client, an autofill, a zeroed timer — which is what it was designed for.

Do not reach for these numbers as an anti-cheat lever. The lever that would work is a **second,
server-controlled clock** (`solve_attempts.created_at`, already stamped by `/api/daily/start` and
currently unused by `recordSolve`), which bounds how fast a submission can arrive regardless of
what it claims — and, unlike server-measured *ranking*, costs save-and-continue nothing.

That is analysed, costed, and gated against Phase 9 in
[Docs/research/daily-solve-time-trust.md](../../../Docs/research/daily-solve-time-trust.md).
It is **not** a defect in what ships today: while the leaderboard is flavor, the accepted posture
here is the right call, and the proposed guard carries its own false-rejection risk on the fastest
minis.

## `maxPlausibleMistakes(puzzleGrid)`

**Why:** `mistakes` is client-reported and unverifiable, so the only answerable question is
"could a real client have produced this number?" — and the board is what answers it. Givens are
not editable, so they cannot be got wrong; an empty cell has exactly `size - 1` wrong digits
available. The distinct-wrong-placement count is therefore `emptyCells × (size - 1)`.

```text
count the zeros in the stored puzzle grid    # blanks; givens are excluded by construction
distinct = blanks × (size - 1)               # every blank, every digit that isn't its answer
return max(100, distinct)                    # the floor is, in practice, the 4×4 bound
```

Concretely, measured across the boards actually in rotation:

| Board | Blanks | Distinct | Bound |
|---|---|---|---|
| 4×4 easy (classic) | 7 | 21 | **100** (floor) |
| 4×4 medium (classic) | 10 | 30 | **100** (floor) |
| 4×4 hard (classic) | 12 | 36 | **100** (floor) |
| 4×4 caged — no givens | 16 | 48 | **100** (floor) |
| 6×6 easy (classic) | 16 | 80 | **100** (floor) |
| 6×6 medium (classic) | 20 | 100 | **100** (exactly) |
| 6×6 hard (classic) | 26 | 130 | **130** |
| 6×6 caged — no givens | 36 | 180 | **180** |
| 9×9 classic (easy) | 40 | 320 | **320** |
| 9×9 caged — no givens | 81 | 648 | **648** |

**Why the floor.** The distinct count is the right *shape* but too tight on the smallest boards. A
4×4 admits only 30 distinct wrong placements, and a flailing beginner can pass that inside one bad
session by re-entering the same wrong digit — the board counts every wrong placement, and erasing
does not decrement. Truncating a *real* player's count is the failure this bound exists to avoid.

**Which boards sit on the floor is a fact about the roller, not about size.** The table shows 6×6
easy and medium at or under 100 — they do not reach this function today only because `recordSolve`
sees dailies alone and [`rollDailyAssignment`](../../lib/db/daily-row.md) rolls a size for the
`mini-hard` slot and no other, so every 6×6 daily is the `hard` tier. If `mini-easy` or
`mini-medium` ever rolls to 6×6, those boards silently become floor-bound instead of board-derived.
Worth knowing before changing the roller; it is the same "a slot key is not an identity" trap that
has bitten this repo twice.

The ceiling this replaces was a flat **100 000**, two-plus orders of magnitude above anything the
app can generate; a probe's `99999999999` was duly stored as `100000` on a 4×4 and served on the
public leaderboard.

**Why clamp instead of reject.** Past the bound the count stops being informative, and `mistakes`
is cosmetic — it never touches ranking — so failing an otherwise-valid solve over a display stat
would be the worse outcome. Clamping keeps the solve and loses only the uninformative tail.

**What it is not.** Like the plausibility floor above, this is not an anti-cheat lever: a scripted
submission simply sends a believable number instead of an absurd one. It is validation — it keeps
impossible values out of a column the leaderboard serves.
