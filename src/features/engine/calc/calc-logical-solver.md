# Keisan Logical Solver (`calc-logical-solver.ts`)

The human-style solver: it solves a Keisan puzzle by applying deduction techniques in tiers over
rows and columns, never guessing, and records the **hardest tier required** plus technique counts
and opportunity density — the inputs the generator (K4) grades difficulty from. Distinct from the
exact solver (`calc-solver.ts`), which brute-force counts solutions for the uniqueness gate.

## Why it can't reuse `HumanSolver`

Killer's logical solver composes `HumanSolver`. Keisan can't: `HumanSolver` is box-Sudoku-only — it
applies box constraints at 4/6 and throws on 5/7 (the K0 guard). Keisan is Latin-square-only, so
this solver keeps its own candidate grid (a bitmask per cell) and its own techniques that scan **only
rows and columns** — no box units.

## Soundness (the load-bearing property)

Every technique only removes candidates or places digits that are true in **all** solutions, so a
completed logical solve necessarily equals the unique exact solution. This is fuzzed against
`calc-solver` in the tests: across many generated puzzles, no logically-placed digit ever disagrees
with the exact solution, whether or not the solve finished. Tiers decide *how hard*, never *whether
valid*.

## The tier ladder

| Tier | Techniques | Notes |
|---|---|---|
| **1** | cage arithmetic, naked single, hidden single | Single-cell cages are placed as givens at construction. Cage arithmetic restricts each empty cell to digits some still-valid multiset needs (cheap, over-approximating, sound). |
| **2** | naked pair, hidden pair, **cage-combo restriction** | Combo restriction is the strong cage deduction: enumerate valid multisets, try to fully place each into the empty cells using their candidates (respecting no-collinear-repeat), keep only digits some full placement supports. |
| **3** | line-sum invariant ("Rule of 21") | Every row/column sums to N(N+1)/2; a line with one empty cell forces it. A modest first cut — multi-cell innie/outie reasoning is a later refinement. |
| **4** | X-Wing (rows/columns) | A digit confined to the same two lines across two perpendicular lines → eliminate elsewhere. |

The solve loop applies the **cheapest** technique that makes progress and restarts from the
cheapest, so the recorded `hardestTier` is the minimum ceiling the puzzle actually demands.
`solve({ maxTier })` caps the ladder (K4 grades a would-be "easy" without paying for X-Wing).

## Instrumentation for scoring (K4)

`CalcSolveResult` carries `{ solved, hardestTier, techniqueCounts, passes, avgOpenSingles }`.
`avgOpenSingles` is the mean number of naked singles available per pass — the opportunity-density
signal (high = open/easy). K4's two-factor score is `weightedTechniqueSum × densityFactor`.

## Measured behaviour (K3 gate)

At maxSize 3, gradable share is **89–100%** across 4×4/6×6 and every operator set (QuadOp, +−, ×÷,
add-only). The hardest-tier distribution concentrates at **T1/T2** — most small-cage Keisan puzzles
are technique-light — so, like Killer, the played difficulty will ride the **two-factor score within
a tier** (K4), not the tier ceiling alone. T3/T4 fire rarely as the hardest step; they exist to keep
the grader honest on the occasional harder board.
