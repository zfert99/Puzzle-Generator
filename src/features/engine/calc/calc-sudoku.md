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

## Difficulty rides SHAPE first, then the score (rebalanced)

The v1 first cut leaned almost entirely on the score band, which left even "hard" givens-heavy and
capped at 3-cell cages. Per `kenken-difficulty-calibration.md` (single-cell givens are "the single
strongest lever"; cage size and combo-count are the next), difficulty now rides **shape** — givens,
cage size, and gift-cage count — with the two-factor score refining *within* a shape. Bands are cut
from **measured per-size distributions** and are **not comparable across sizes** (a "hard 4×4" ≠ a
"hard 6×6").

### Shape levers per tier

| Lever | Easy | Medium | Hard |
|---|---|---|---|
| Operator palette | `+ − ÷` (no ×) | all four | all four |
| Max cage size | 4×4: 2 · 6×6: 3 | 3 | 4×4: 3 · **6×6: 4** |
| `minSize` (intentional singles) | 1 | 4×4: 1 · 6×6: 2 | 2 |
| Single-cell givens (`min/maxSingles`) | 4×4: 2–4 · 6×6: 3–6 | ≤ 4×4: 2 · 6×6: 3 | **≤ 1** |
| Gift-cage cap (`maxFootholds`) | — | — | 4×4: 2 · 6×6: 3 |

- **`maxFootholds`** caps "gift" cages — a 2+-cell cage with exactly ONE valid multiset (`3−`={1,4}),
  a free anchor. Fewer on hard so the solver must earn its progress (the `maxCombos` lever as a count).
- **`maxCombosPerCage`** (available, unused in v1) is the ceiling form — caps any cage's ambiguity to
  keep it solvable within `solveCap`.

### Measured bands (post-rebalance)

| Size | Tier shape (score p5/p50/p95) | easy | medium | hard |
|---|---|---|---|---|
| 4×4 | easy 2.8/4.2/9.5 · med 3.6/7.5/13.7 · hard 5.9/10.8/21.7 | `< 5` | `[5, 9)` | `≥ 9` |
| 6×6 | easy 11.6/20.6/35.7 · med 12.7/25.5/47.2 · hard 19.9/34.0/55.1 | `< 19` | `[19, 31)` | `≥ 31` |

Disjoint by construction. Recalibrate whenever the technique weights or shape gates change.

## Gate (met, post-rebalance)

Every band generates **avg 1–16 ms** (max 66 ms — far under the 1 s budget), **0 fails in 20**, score
ranges **disjoint per size**. The structural target holds: 6×6 hard averages **~0.7 single-cell givens
and ~3.4 four-cell cages** per puzzle (was up to 7 givens, no size-4 cages). `maxSize: 4` verifies in
~0.2 ms avg on 6×6 — no Killer-style thrash, thanks to the multiset pruning. No-Op / Mystery and
Expert/Extreme (9×9) remain later slices.
