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
