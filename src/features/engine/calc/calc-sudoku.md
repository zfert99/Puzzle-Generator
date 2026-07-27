# Keisan Generation Pipeline (`calc-sudoku.ts`)

Assembles K1–K3 into `generateCalcSudoku(difficulty)`, which emits a **uniquely-solvable,
difficulty-graded** Keisan puzzle. Offers easy/medium/hard at 4×4/6×6, and the full
**easy/medium/hard/expert/extreme** ladder at 9×9 (K7a tiers + K7c Expert + K7d Extreme).

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
| Operator mix (`operatorWeights`) | +-heavy (5/3/2) | even | **×-weighted (~39%), −/÷ retained** |
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

### 9×9 (K7a): givens-gradient tiers, NO score band

9×9 breaks the score-band model, so it's handled differently — the reasons are measured (see
`Docs/research/keisan-9x9-feasibility-findings.md` and the "honest-ladder" research):

- **Max cage size stays 3 at every tier.** maxSize-4 costs ~13× verify for no difficulty gain;
  maxSize-5 is infeasible (0% gradable). Real 9×9 Calcudoku is 2–3-cell-cage dominated.
- **Tiers separate on single-cell givens, not score.** The givens distribution is bimodal —
  `minSize: 1` → ~15–17 givens, `minSize: 2` → ~2 — so Easy/Medium share the many-givens regime and
  split by a `maxSingles` cap (**Easy ≥12, Medium 6–11**) plus the operator palette (Easy drops ×),
  and **Hard** takes the few-givens regime (**≤3**) with `techniqueFloor: 1`. The givens ranges are
  disjoint by construction → tiers are disjoint regardless of score. There is **no `scoreBand`**:
  the solver caps at ~T2 on 9×9, so its score barely discriminates (measured easy p50 36 / medium 39
  / hard 61, heavily overlapping) — a score cut would misclassify. This is the "no technique ladder"
  finding made concrete.
- **No `maxFootholds` / combo cap on 9×9.** With ~25 cages/board, any per-cage combo ceiling or tight
  gift-count rejects almost every board (a 3-cell cage naturally reaches 13 combos), which collapsed
  Hard's accept rate ~25× (~400 ms gen). Dropping them, Hard generates in ~14 ms avg, unchanged
  difficulty.
- **`verifyNodeBudget`** is available to cap the uniqueness proof on pathological low-givens boards
  (a `-1` "couldn't settle in budget" → cheap reject, never a false accept). Not needed at K7a's
  settings but wired for the harder K7b/K7c tiers.

Measured gate (100 boards/tier): gen **p95 ≤ 38 ms** (easy 22 / medium 19 / hard 38), **max 136 ms**;
**100% gradable** every tier; givens **13–23 / 7–11 / 0–3** (disjoint, monotonic); Hard carries −/÷ in
**100%** of boards. Well inside the interactive budget.

**Expert (K7c) — the 9×9 ladder's 4th tier.** `activeOps: QUAD_OP, minSize: 2, maxSize: 3,
solveCap: 5, maxSingles: 1, techniqueFloor: 4`. `solveCap: 5` admits the K7b bounded-recursion tier;
`techniqueFloor: 4` rejects anything T1–T4 already cracks — so an Expert board's **hardest required
step is a depth-1 Nishio guess** (`hardestTier === 5`), disjoint from Hard (caps at T4) *by
construction*, no score band needed (score ~99 vs Hard's ~61). `maxGuessSteps: 5` caps Expert to a
*few* hypothesis steps, ceding the many-step tail to Extreme. Generates ~240 ms avg / ~800 ms p95
(offline-pool friendly; interactive-tolerable, like Killer extreme); `verifyNodeBudget: 300000` caps
the low-givens uniqueness proof.

**Extreme (K7d) — the 5th tier, on the guess-STEP count.** K7b proved guess *depth* never exceeds 1,
but K7d Slice-0 instrumentation found the guess-step *count* (`result.guessSteps`) spreads 1→23 and is
strongly monotone with difficulty (median solve time climbs ~28× across the range). So Extreme =
`minGuessSteps: 6` — a board needing **many** Nishio steps — an honest fifth tier with **no solver
expansion** (the research's revived "count hard steps is signal"). Disjoint from Expert (≤5 steps) by
the step band; same 0-given shape + `solveCap 5` + `techniqueFloor 4`. Rare + slow: ~1.1% accept,
~2.3 s/board — an offline-cron-pool / slow-interactive tier (like Killer extreme). The Slice-1/2
technique expansion (cage-line intersection, pairwise multi-cage elimination) was **not needed** — the
step-count axis gave a cleaner, cheaper tier; those remain deferred (see the K7d research brief).

## Mystery / No-Op mode (K6)

The `noOp` pipeline option is an **orthogonal toggle** over any size/difficulty: after the normal
assign step, every multi-cell cage is flagged `noOp` *before* any gate, so the shape check, grader,
and uniqueness proof all reason over the operator-**union** table (`calcCageCombos`). The cage keeps
its real operator (to compute the target + fill from the solution) but hides it from the player. No
recalibration: the same tier configs apply, and a Mystery board simply plays a notch harder (you must
deduce the operator too) — the industry-standard treatment (calcudoku.org). Measured feasible at every
size/tier (4×4/6×6 easy/medium/hard: **30/30 unique + gradable**; 6×6 easy is the slowest at ~82 ms
avg since the union tightens the small-cage easy band). Gift/combo shape gates also read the union;
the single-operator "freebie" heuristics are skipped for no-op cages (their op is hidden).

## Gate (met, full-spec)

Every band generates **avg ≤ 78 ms** (6×6 hard the slowest, max ~245 ms — under the 1 s budget),
**0 fails in 40**, score ranges **disjoint per size**. Structure: **6×6 hard carries 0 single-cell
givens and ~4.7 four-cell cages, ~61% bent, ~39% `×`, and −/÷ in ~96% of boards** (was up to 7
givens, no size-4 cages, uniform ops). The `×` weight is deliberately *not* maximal: an early
`{mul:4}`-heavy cut left subtraction/division nearly absent (they're 2-cell-only, and hard's big
cages can only be `+`/`×`), so hard uses equal `mul/sub/div` weights — `×` still wins ~60% of the
`+`/`×`-only big cages (≥ the doc's 30%) while every board keeps some `−`/`÷`. `maxSize: 4` verifies ~0.2 ms avg — no Killer-style thrash, thanks to the multiset pruning.

**Yield note:** 6×6 hard's accept rate is ~0.1% (the tightest tier — stacked shape + score + floor
gates), but attempts are cheap (~0.07 ms; most are shape-rejected before the logical solve), so
wall-clock stays ~78 ms avg. `maxAttempts` defaults to **40 000** so exhaustion is astronomically
unlikely. **9×9 shipped as K7a (3 tiers, givens-gradient — see above).** Expert/Extreme (K7b
bounded-recursion "T5" + K7c offline pool) and No-Op / Mystery (K6) remain later slices; 5×5/7×7
deferred.
