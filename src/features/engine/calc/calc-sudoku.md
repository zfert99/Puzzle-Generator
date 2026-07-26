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

### Shape levers per tier (full `keisan-difficulty-levers.md` spec)

| Lever | Easy | Medium | Hard |
|---|---|---|---|
| Operator palette (`activeOps`) | `+ − ÷` (no ×) | all four | all four |
| Operator mix (`operatorWeights`) | +-heavy (5/3/2) | even | **×-weighted (~55%)** |
| Max cage size (`maxSize`) | 4×4: 2 · 6×6: 3 | 3 | 4×4: 4 · 6×6: 4 |
| Single-cell givens (`min/maxSingles`) | 4×4: 2–4 · 6×6: 3–6 | ≤2 / ≤3 | **0** |
| Gift-cage cap (`maxFootholds` × `giftBanLevel`) | `combos1`, uncapped | `twoCell` | `mulLowFactor`, ≤2/3 |
| Per-cage combo ceiling (`maxCombosPerCage`) | 4×4: 3 · 6×6: 6 | 5 / 10 | 8 / 15 |
| Technique floor (`techniqueFloor`) | — | — | `> T1` |

- **`giftBanLevel`** broadens what counts as a gift (near-freebie) cage with tier — `combos1`
  (fully-determined) → `twoCell` (keen.c's degenerate 2-cell patterns) → `mulLowFactor` (× that
  factors into ≤2 sets) — and `maxFootholds` caps the count. Harder tiers use both a broader
  definition and a tighter cap, so freebies get scarce.
- **`maxCombosPerCage`** bounds any single cage's ambiguity (keeps it solvable within `solveCap`).
- **`minBentRatio`** (available, unused) — a bent cage (spans ≥2 rows AND columns) permits repeats →
  more combinations → harder. Not gated on any tier: `maxSize: 4` already yields ~61% bent naturally,
  so forcing a floor only halved the generation yield for no structural gain. Kept as a lever.
- **`techniqueFloor`** is Tatham's tier gate: a fresh solve capped one tier down must FAIL, so the
  tier is the *minimum* sufficient difficulty. Applied lightly (hard, `> T1`) because our solver's
  tier ladder is coarse — see below.

### Score band is the primary tier gate (coarse solver tiers)

Measured: our logical solver's `hardestTier` concentrates at **T1/T2** — medium and hard are both
mostly T2; they differ by *how much* T2 work, which is the **score**, not the tier. So the two-factor
score band is the primary separator (a HoDoKu weighted-sum model), with the hard `techniqueFloor: 1`
as a light backstop. A stronger Tatham-style technique gate would need a richer solver (more distinct
techniques, e.g. cage-line reduction as a separate tier) — a future K3 expansion.

| Size | easy | medium | hard |
|---|---|---|---|
| 4×4 | `< 5` | `[5, 9)` | `≥ 9` |
| 6×6 | `< 19` | `[19, 31)` | `≥ 31` |

Disjoint by construction. Recalibrate whenever the technique weights or shape gates change.

## Gate (met, full-spec)

Every band generates **avg ≤ 78 ms** (6×6 hard the slowest, max ~245 ms — under the 1 s budget),
**0 fails in 40**, score ranges **disjoint per size**. Structure: **6×6 hard carries 0 single-cell
givens and ~4.7 four-cell cages, ~61% bent, ~55% `×`** (was up to 7 givens, no size-4 cages, uniform
ops). `maxSize: 4` verifies ~0.2 ms avg — no Killer-style thrash, thanks to the multiset pruning.

**Yield note:** 6×6 hard's accept rate is ~0.1% (the tightest tier — stacked shape + score + floor
gates), but attempts are cheap (~0.07 ms; most are shape-rejected before the logical solve), so
wall-clock stays ~78 ms avg. `maxAttempts` defaults to **40 000** so exhaustion is astronomically
unlikely. No-Op / Mystery (K6) and 9×9 + 5-tier (K7) remain later slices; 5×5/7×7 deferred.
