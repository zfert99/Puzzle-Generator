# Skyscrapers Fixtures (`skyscrapers-fixtures.ts`)

Hand-baked Skyscrapers puzzles for the slices before the generator existed (plan V1 → E3b; since
E4 the board generates fresh puzzles and these are test data plus what `/api/generate` prints
until E5): the
workbench route draws them, the board (V2) and PDF (V3) serve them, and the exact solver (E1)
proves them unique. Plan:
[skyscrapers-implementation-plan.md](../../../../Docs/skyscrapers-implementation-plan.md).

## Why a fixture is a solved square plus a clue mask

A fixture is written as its **solution** — one string per row, one digit per cell — and a
**mask** per side (`x` kept, `.` blank). The clue values are then *derived* with `deriveClues`
and filtered by the mask. A hand-typed clue that disagreed with its square would look exactly
like a correct one on screen; deriving makes that error impossible (the Kakuro V1 lesson). The
mask, not a clue list, is what a human authors, because "which clues are kept" is the whole
difficulty lever of this puzzle (research §3).

```text
parseSkyscrapersFixture(rows, mask, difficulty = 'unrated'):
    refuse a row count that is not a GridSize (isGridSize — never a cast)
    solution = each row's characters as digits; refuse a row of the wrong length (named),
               and anything but 1..N
    all      = deriveClues(solution)
    for each side: clues[side][i] = all[side][i] if mask[side][i] is 'x', else 0;
                   refuse a mask of the wrong length or with another character
    build the puzzle with an all-zero grid (no givens, D3)
    refuse it if validateSkyscrapers reports any problem
```

`difficulty` defaults to `'unrated'`: no fixture carries a grade the classifier did not assign
(D7). **Since E2 the served set carries the classifier's word as a typed label** — `'easy'`,
`'extreme'`, `'extreme'` for 5×5 / 6×6 / 7×7 (the 5×5 graded `'hard'` until the E3 re-tier put
its three small line scans at tier 1) — so the header, the Continue label and the PDF title show
the solver's grade. The label is *written*, not computed at import: this module sits
in the client bundle via `usePuzzle`, and grading at import would run three full solves plus the
permutation-table builds (~30 ms) on every `/play` load for a value that never changes (the E2
review's efficiency finding; the first draft did exactly that). The drift guard is
`skyscrapers-fixtures.test.ts`: it re-grades every fixture with `classifySkyscrapers` and fails if
a typed label disagrees, and `skyscrapers-logical-solver.test.ts` pins the tiers. The
`SKYSCRAPERS_NONUNIQUE_4X4` pair stays `'unrated'`.

## How the squares and masks were found

A throwaway script (not in the repo): a random Latin square → all 4N clues → a counting solver
(per-line permutation buckets filtered against cell masks, propagated to a fixpoint, then MRV
branching — the E1 design; a cell-by-cell backtracker never finished a 7×7 count, the research's
warning about naive enumeration made concrete) → **reject or repair** the square until exactly
one solution → remove clues in a random order, keeping each removal only while the puzzle stays
unique.

"Reject" worked at 5×5 (2 squares) and 6×6 (15 squares). **At 7×7 it never did: 0 of 94,962
random squares were unique with all 28 clues** (log measurement, G4) — the research's all-clue
ambiguity (35% at 4×4, 58% at 5×5) is ≈ 93% at 6×6 and effectively 100% at 7×7. The 7×7 was
therefore **repaired**: random intercalate swaps (swap the two symbols of a 2×2 sub-square whose
corners read a·b / b·a, which keeps the square Latin), each accepted when the capped solution
count did not rise — unique after 38 steps, 192 ms. The Kakuro lesson (repair the fill, never
retry it) holds here from the first fixture, and E3 / E4 start from that measurement rather than
from the plan's "reject the square is cheap at N ≤ 7".

| Fixture | Kept clues | Note |
|---|---|---|
| 5×5 | 5 of 20 | one above the N−1 conjecture's floor (G5) |
| 6×6 | 15 of 24 | rejected 14 non-unique squares first |
| 7×7 | 14 of 28 | square repaired into uniqueness by intercalate swaps |

**Proven in-repo since E1:** `skyscrapers-solver.test.ts` counts every fixture's solutions (exactly
one, and the solver's solution equals the square) and the 4×4 pair's (exactly two); the
throwaway counter's claim is now a test.

## `SKYSCRAPERS_NONUNIQUE_4X4`

The research's 4×4 counterexample: two different Latin squares that imply the same 16 clues
(top 4,2,2,1 · bottom 1,2,2,4 · left 4,2,2,1 · right 1,2,2,4). Kept so E1's counting solver has a
canonical case that must report **two** solutions — and so the all-clue ambiguity measured in the
research (35.42% of 4×4 squares) has one concrete witness in the repo.

## `selectSkyscrapersBatch(counts, { gridSize })` (V3)

What `/api/generate` prints until the generator exists — the Kakuro counterpart was
`selectKakuroBatch`, replaced by `generateKakuroBatch` in E5. There is exactly one fixture per size
and it carries no grade, so the function answers a request with that fixture **once**, whatever
level the counts name, and only when the counts total exactly one; any other total, or a size
with no fixture, throws with the reason (the route turns the total case into a 400 before
calling). Lives beside the fixtures, not in the route, so the route stays a controller
(AGENTS.md §1; the Kakuro review-4 finding).
