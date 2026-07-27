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
| **5** | **bounded recursion, depth-1 (Nishio)** | NOT a named technique — the ladder's overflow. When T1–T4 stall, hypothesise a candidate in the min-remaining-values cell, propagate with T1–T4; if it hits a contradiction, its negation is a **sound elimination**. The `keen.c` transplant (K7b). |
| **6** | **bounded recursion, depth-2** | A hypothesis whose refutation itself needs one depth-1 Nishio round. Implemented + budget-guarded, but see "Measured behaviour" — it **never fires** on feasible 9×9 boards, so it's dormant capacity, not a used tier. |

The solve loop applies the **cheapest** technique that makes progress and restarts from the
cheapest, so the recorded `hardestTier` is the minimum ceiling the puzzle actually demands.
`solve({ maxTier })` caps the ladder (K4 grades a would-be "easy" without paying for X-Wing).

### The bounded-recursion tiers (K7b)

Tiers 5/6 are the honest answer to "the named ladder caps at ~T2 on 9×9, so what discriminates the
hardest 0-given boards?" — the `keen.c` design, where the top tiers have *no* bespoke technique and
are produced by counted guess-and-check. Mechanics: `snapshot`/`restore` roll back a hypothesis
branch; `hasContradiction` detects a dead branch (an empty cell with no candidates, **or** a
fully-placed cage matching no valid multiset — the latter catches a guess that fills a cage's last
cell directly, which `cageArithmetic` can't); `isRefutable` tests one hypothesis; `nishioRound` scans
MRV-first and eliminates the first refutable candidate. `solve({ maxTier: 5 })` allows depth-1,
`maxTier: 6` allows depth-2; the loop escalates **minimal depth first**, so `hardestTier = 4 +
maxGuessDepth` records the *cheapest* guess the board needs. A `guessNodeBudget` (default 200 k
hypotheses) bounds the depth-2 path. Every elimination is sound, so a completed guess-solve is a
valid logical solution path — a `-1`-style "gave up" never yields a wrong grid, only an unsolved one.

## Instrumentation for scoring (K4)

`CalcSolveResult` carries `{ solved, hardestTier, techniqueCounts, passes, avgOpenSingles,
maxGuessDepth, guessSteps }`. `avgOpenSingles` is the mean number of naked singles available per
pass — the opportunity-density signal (high = open/easy). K4's two-factor score is
`weightedTechniqueSum × densityFactor`. `maxGuessDepth` (0/1/2) is the deepest bounded-recursion
guess the solve needed (only populated when `maxTier ≥ 5`); the guess tiers deliberately do **not**
feed the score — they are a separate axis (`hardestTier`), not weighted technique work.

`guessSteps` (K7d instrumentation) is the **count** of bounded-recursion eliminations the solve made
— distinct from their max depth. Depth never exceeds 1 (K7b), but the *count* spreads 1→23 and is
strongly monotone with difficulty (measured: median solve time climbs ~28× from 1 step to many). It's
the axis the 9×9 **Extreme** tier rides — "needs many hypothesis steps" — an honest fifth tier with no
solver expansion (the research's revived "count hard steps" signal, Pelánek).

## Measured behaviour (K3 gate + K7b bounded-recursion)

At maxSize 3, gradable share is **89–100%** across 4×4/6×6 and every operator set (QuadOp, +−, ×÷,
add-only). The hardest-tier distribution concentrates at **T1/T2** — most small-cage Keisan puzzles
are technique-light — so, like Killer, the played difficulty will ride the **two-factor score within
a tier** (K4), not the tier ceiling alone. T3/T4 fire rarely as the hardest step; they exist to keep
the grader honest on the occasional harder board.

**K7b bounded-recursion measurement (9×9, 0-given).** Of unique low-givens boards, ~77% solve at
T4 and **~23% are T4-stuck**. Of the T4-stuck ones, **depth-1 Nishio (T5) solves 100%, all correct**
(verified against the exact solution) — and crucially **depth-2 never fires**: across both maxSize-3
and maxSize-4 populations, every T4-stuck board that solves at all solves at depth-1. So the honest
bounded axis is a single step (needs-a-guess vs not), not a depth ladder. T5 grading costs ~65 ms avg
(p95 ~450 ms) at maxSize 3; maxSize-4 T6 grading is far slower (p95 ~7 s). **Consequence:** guess
*depth* can't separate Expert from Extreme — that's the open K7c design fork (see
`Docs/research/keisan-9x9-feasibility-findings.md` §7 and the plan).
