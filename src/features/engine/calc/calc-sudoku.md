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

### Difficulty rides BOTH cage shape and score (rebalanced)

The first cut used `maxSize: 3` for every tier with generous single-cell-cage budgets, which made
even "hard" feel small-caged and givens-heavy (6×6 hard averaged ~7 single-cell cages/puzzle and
never produced a size-4 cage) — the same problem the Killer generator once had. The rebalance:

- **Easy** keeps `minSize 1, maxSize 3` and generous givens — small cages + anchors for beginners.
- **Medium/Hard** set `minSize 2` (no *intentional* single-cell givens — they now average ~0.7–1.1)
  and raise `maxSize` to **4**, with `maxSizeBias` skewing harder tiers toward the big cages: 6×6
  medium ~34% size-4, 6×6 hard ~50%. On the 16-cell **4×4** a size-4 cage is a quarter of the board,
  so 4×4 medium stays `≤3` and only 4×4 hard gets size-4 (else medium/hard don't separate).
- `maxSize: 4` was verified viable: uniqueness-verify stays well under the 50 ms budget (max ~36 ms
  at heavy bias; Killer's maxSize-4 thrashing does not occur here — multiset pruning + node budget).

Measured bands (QuadOp), cut disjoint from the new per-size distributions:

| Size | easy (p50) | medium (p50) | hard (p50) | Bands |
|---|---|---|---|---|
| 4×4 | 4.8 | 8.4 | 11.0 | easy `< 6` · medium `[6, 11)` · hard `≥ 11` |
| 6×6 | 12.6 | 30.5 | 34.3 | easy `< 20` · medium `[20, 34)` · hard `≥ 34` |

Bands are disjoint by construction. Recalibrate whenever the technique weights or shape gates change.

## Shape gates: single-cell band + cage size

- `minSingles`/`maxSingles` bound single-cell "given" cages. `max` (tight on medium/hard, ~1–2)
  prevents givens-heavy trivial puzzles; `min` (easy only) keeps beginner boards from being
  anchor-free. Combined with `minSize 2` on medium/hard, this is what killed the old givens flood.
- `minSize`/`maxSize`/`maxSizeBias` shape the cage-size mix — the rebalance lever (above) that gives
  hard its chunky size-4 cages.

## Gate (met, post-rebalance)

Every band generates far under the 1 s budget (4×4 ~1–2 ms; 6×6 easy ~1 ms, medium ~15 ms, hard
~29 ms avg / 166 ms max — the rare big-cage tail), **0 fails in 30**, and score ranges are
**disjoint per size**. QuadOp is the only operator set in v1; SingleOp / DualOp / No-Op remain
difficulty axes for a later slice.
