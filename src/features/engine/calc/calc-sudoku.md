# Keisan Generation Pipeline (`calc-sudoku.ts`)

Assembles K1–K3 into `generateCalcSudoku(difficulty)`, which emits a **uniquely-solvable,
difficulty-graded** Keisan puzzle. v1 offers easy/medium/hard at 4×4 and 6×6.

## Pipeline (cheapest gate first)

```text
repeat up to maxAttempts:
  solution = random Latin square (boxless fillGrid) or an injected one
  shapes   = generateCalcCageShapes(size, {minSize, maxSize})          (K2)
  cages    = assignCalcCages(shapes, solution, {activeOps})            (K2; null → retry)
  shape gate: single-cell-cage count within [minSingles, maxSingles]   (µs)
  logical solve capped at solveCap                                     (~0.3 ms; K3)
    → not fully solved? retry
  two-factor score within the difficulty's band                       (K4)
    → out of band? retry
  uniqueness: CalcSolver.countSolutions(2) === 1                       (belt-and-braces)
  → return { variant:'calc', grid:all-zero, solution, cages, difficulty, gridSize }
```

The uniqueness check is **belt-and-braces**: the logical solver is sound (only true deductions), so a
puzzle it fully solves already has a unique solution. The exact-solver check stays as a guard against
a technique bug, off the hot path.

## Difficulty rides the score, not the tier

K3 measured that most small-cage Keisan puzzles solve at tiers 1–2, so the tier ceiling barely
separates difficulties. The **two-factor score** (`calc-score.ts`) is the primary differentiator;
`solveCap` is just a ceiling (4 for all v1 tiers). Bands are cut from **measured per-size
distributions** and are **not comparable across sizes** — a "hard 4×4" is not a "hard 6×6" (both the
plan and the external review call this out; 4×4 is compressed like 6×6 Killer).

### Measured bands (QuadOp, maxSize 3)

| Size | Distribution (min/p25/p50/p75/p90) | easy | medium | hard |
|---|---|---|---|---|
| 4×4 | 1.0 / 3.0 / 4.2 / 5.9 / 9.3 | score `< 3.5` | `[3.5, 6.5)` | `≥ 6.5` |
| 6×6 | 2.9 / 8.9 / 11.6 / 16.2 / 21.4 | `< 9` | `[9, 16)` | `≥ 16` |

Bands are disjoint by construction. Recalibrate whenever the technique weights or shape gates change.

## Single-cell-cage band (the review's min/max lever)

`minSingles`/`maxSingles` bound the number of single-cell "given" cages. `max` prevents degenerate
givens-heavy (trivial) puzzles — a documented Calcudoku failure mode; `min` (on easy tiers) keeps
beginner boards from being anchor-free. This is the one shape gate v1 uses beyond the score band.

## Gate (met)

Every band generates in **avg 1–2 ms** (max ≤ 9 ms — far under the 1 s budget), **0 fails in 40**,
and the score ranges are **disjoint per size**. QuadOp is the only operator set in v1; SingleOp /
DualOp / No-Op remain difficulty axes for a later slice.
