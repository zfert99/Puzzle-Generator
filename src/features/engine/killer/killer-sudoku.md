# Killer Sudoku Pipeline (`killer-sudoku.ts`)

`generateKillerSudoku(difficulty, options)` — assembles K1–K4 into a uniquely-solvable,
**difficulty-graded** Killer puzzle. This is the K5 slice, complete.

## The pipeline

```text
solved grid (reuse classic engine's fillGrid)
  → random cage partition (K3 generateCages, size window [minSize, maxSize])
    → cage-shape gate: singles budget + foothold band ok? (µs)
      → solvable within the tier cap? (K4 logical solver, solve({ maxTier }), ~0.5 ms)
        → uniqueness verification: exact solver countSolutions(2) === 1 (K2, ~10 ms, once)
          → return : retry with a fresh grid
```

One flat retry loop — cheapest gates first. **The logical solve runs BEFORE the uniqueness
check**, which looks backwards but is a measured ~5× speedup (hard: 5.2 s → 0.3 s): the logical
solver makes only *sound* deductions (facts true in every solution), so a grid it completes is
necessarily the unique solution — solvability-within-cap already implies uniqueness. The exact
solver stays as a belt-and-braces verification against a strategy bug, but it now runs once per
*accepted* puzzle instead of ~10 ms on every shape-passing candidate that grading would then
reject anyway. `generateUniqueKiller(maxSize)` remains the ungraded building block (one unique
layout, optional shape gate). Killer has **no givens**, so the returned `grid` is all zeros —
the cages carry every clue.

## Difficulty = cage shape, capped by tier (the rebalance)

The original scheme graded by **exact tier** and let cage shape fall where it may. Measured,
that over-produced single-cell cages (givens): ~52% of easy cages, ~33% of medium/hard — and
medium/hard were structurally identical. The difficulty research (`Docs/research/`) identifies
four cage levers, with **single-cage count the strongest** (each is a free given). So the
rebalanced scheme inverts control: **cage shape drives difficulty; the solver tier is a
ceiling**, guaranteeing the puzzle is solvable without techniques we don't have.

Exact-tier matching was dropped deliberately — once shape is constrained it craters yield
(measured: 98% of unique medium-shaped layouts rejected → 2+ s generation). Within-cap
difficulty refinement is the two-factor scoring follow-up (technique frequency × opportunity
density), not a binary gate.

| Difficulty | solveCap | size window | maxSingles | foothold band | measured shape |
|---|---|---|---|---|---|
| easy | 2 | 1–3 | 12 | — | ~11 singles/puzzle, avgSum ~10 |
| medium | 3 | 2–3 | 4 | ≥ 3 | ~2 singles, ~4.7 footholds/puzzle |
| hard | 3 | 2–3 | 1 | ≤ 3 | ~1 single, ~2.4 footholds/puzzle |

A **foothold** is a single-combination cage of 2+ cells (a 3-in-2 = {1,2}, a 24-in-3 =
{7,8,9}) — the research's "prevalence of single-combination cages" lever: strong starting
points, so fewer = harder. The bands split medium/hard from both sides: medium's floor cuts its
accidentally-hardest tail (and, as a bonus, prunes doomed candidates before the expensive
checks — medium got *faster*), hard's cap denies easy starts (accepted-hard median was ~4;
keeping ≤ 3 retains the harder 38%). Easy needs no band — its singles are footholds of the
strongest kind. Singles remain the primary lever: easy keeps a healthy dose of givens (configs
that capped easy's singles hard were infeasible: 0 yield); medium/hard suppress intentional
singles via `minSize: 2`, and `maxSingles` rejects partitions with too many *forced* singles
(cells boxed in during growth).

**Why all three stay at maxSize 3 with a 2-cell-heavy mix.** Two measured walls, both the same
root cause (verification can't follow where the difficulty levers point):

- **maxSize 4**: with singles suppressed, the exact solver's uniqueness check thrashes —
  6–160+ s per puzzle; loose 4-cell cages give its deliberately simple cage pruning nothing
  to cut.
- **Shifting the 2/3-cell mix toward 3-cell** (`maxSizeBias` in the cage generator, or
  `minSize: 3`): the tier-3-solvable rate collapses from ~10% to ~1% → 0% as 2-cell cages
  drop, because the current technique set (consistent digits, pairs, pointing, multi-unit 45)
  gets its traction from tight 2-cell cages. Pure 3-cell grids were 0-for-11 solvable and
  uniqueness checks hit 579 ms.

Both walls fall with the expert-tier work: tighter cage-sum pruning (or a node budget) in
`killer-solver.ts`, and Killer techniques (cage splitting, hard combinations) in the logical
solver. A per-cage `maxCombos` gate was also tried and dropped (no-op at maxSize 3, fatal at
maxSize 4) — the COUNT of single-combination cages (the foothold band above) is the workable
form of that lever; full ambiguity weighting belongs in two-factor scoring.

**Why only three difficulties.** Unchanged: solvable tier-4 layouts are a thin band (~1% of
uniques) and larger cages are dominated by puzzles beyond the current technique set (~86% of
maxSize-4 uniques). Expert/extreme wait for more Killer techniques.

## Speed (measured, 15–25 samples each, real random grids)

| Difficulty | avg | median | max | fails |
|---|---|---|---|---|
| easy | 12 ms | 5 ms | 55 ms | 0 |
| medium | 88 ms | 58 ms | 266 ms | 0 |
| hard | 288 ms | 268 ms | 683 ms | 0 |

Before the grade-before-uniqueness reorder, ~99% of time was `countSolutions` (~10 ms per
shape-passing layout, ~28% unique) paid on candidates the grader then rejected; hard averaged
1.3–5.2 s. With grading first (~0.5 ms, capped at the tier ceiling so a too-hard candidate is
a cheap reject, never an AIC/ALS run), the exact solver runs once per accepted puzzle and hard
dropped to ~0.3 s. `fillGrid` (0.09 ms) and cage partitioning (0.03 ms) remain noise. A fresh
solved grid per attempt (vs. reusing one) avoids thrashing on an unlucky grid — measured,
counterintuitively. The attempt cap is 20 000 (attempts are ~0.5 ms; hard accepts ~1 in 500,
so exhaustion is astronomically unlikely with a bounded ~10 s worst case).

## Determinism

Injectable `rng` / `solution` keep the whole pipeline deterministic for tests (and RNG-driven →
client-side only, AGENTS.md §1).
