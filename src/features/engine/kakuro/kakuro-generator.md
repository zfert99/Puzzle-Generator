# Kakuro generator (`kakuro-generator.ts`)

Plan slice **E4**: a layout, a fill, and the repair that makes it unique — three plain
functions plus `generateUniqueKakuro`, which chains them. Every function takes an `rng`, so a
seed reproduces a puzzle end to end (the Keisan lesson: thread it everywhere or "same seed →
same puzzle" silently fails).

## Why repair, not retry

The yield spike (`Docs/research/kakuro-feasibility-findings.md`) measured P(unique) for a
random fill at ≈ 0.1% at every size — fill-and-retry would need a thousand fills per puzzle.
A one-cell-at-a-time hill-climb on the *same* fill, whose objective is the solution count the
implied clues allow, converges in milliseconds at 6–9 (L7, L15). So the pipeline is **layout →
fill → repair → verify**, and the layout and fill only have to be legal, not lucky.

## Layout — `generateKakuroLayout({ gridSize, blackDensity, method })`

Two methods behind one knob; both 180°-symmetric; both handed to the static validator (D9, G10)
and simply retried when it objects (layouts cost microseconds, the solver does not). The
achieved density is promised within `densityTolerance` (0.03) of the target, because density is
the generation lever E3 found (§3b).

**`scatter` (default).** Start all white; drop black cells in mirror pairs at random until the
target count, refusing any pair that leaves a white cell without an across or a down run — an
O(1) check on the cells beside the two new blacks (a white cell has a run in an axis iff it has
a white neighbour on that axis). This is the method the yield spike measured with.

**`edges-inward`.** Mathimagics' method (research gap G3): visit cells ring by ring from the
outside in, a cell and its mirror together; a decided white that has only one way left to get a
run in some axis *forces* that neighbour white (so an edge white always pulls its inward
neighbour along and no orphan is created on purpose); a cell that would orphan itself, or
overrun `MAX_RUN_LENGTH`, is forced black; the rest is a coin weighted by the density knob. The
coin is not the density — forced whites make a layout whiter than its coin, by an amount that
depends on size — so the coin is steered half the gap toward the target after every attempt.
`blockBreak` is an experimental knob that turns a coin-flip white into black when it would
complete an all-white 2×2 block.

**Why scatter is the default although the plan prescribed edges-inward:** measured head to
head (`Docs/research/kakuro-layout-method-findings.md`), edges-inward's no-orphan forcing lays
2-deep white bands along the edges, which is ~30% more all-white 2×2 blocks per layout — the
shape every sum-preserving digit swap needs — and its layouts repair to unique 2–5× less often
(9×9: 5/10 vs 10/10; 7×7: 7/10 at 569 ms vs 9/10 at 39 ms). The block-breaker barely moves the
count because the forced whites, not the coin flips, make the bands. Edges-inward stays as an
option for E5's experiments; its invariants (symmetry, no orphans, run-length cap) are what
scatter's validator enforces too.

```text
scatter:   white = all true
           until blacks == target: pick a cell; black it and its mirror;
             if a neighbour of either lost its last partner in some axis → undo, next
           while some white strip is longer than MAX_RUN_LENGTH: black a cell inside it (same rule)
           validator decides; retry whole layout on objection
```

Blacks only ever *shorten* runs, so an overlong run is one the scatter never touched — impossible
at 9×9 or below, routine above it (a 13×13 row with no black). The last loop breaks each with a
black somewhere inside it (not at an end, which would shorten it by one), so the deferred 13×13
gets a valid layout instead of 200 silent failures (a review finding); the density drifts up a
little and the tolerance absorbs it.

## `indexRuns(white)` (internal)

The runs of a bare mask, each cell's runs, and the white cells in reading order — the one index
both the fill and the repair work from (a review finding: it was built twice).

## Fill — `fillKakuroLayout(white, rng)`

Randomised DFS over the white cells in reading order with a used-digit mask per run; a digit
is legal when neither of the cell's runs holds it. The constraint is loose (runs are ≤ 9 cells
and digits are 1–9), so a valid layout essentially never backtracks far; a node budget keeps a
pathological mask from hanging.

## Repair — `repairToUnique(fill, { stepCap, msCap, countLimit, countBudget })`

```text
runs = the mask's runs with their sums taken from the fill
score() = solutions of those clues, counted up to countLimit (exhausting countBudget nodes also scores countLimit)
until score == 1, or stepCap steps, or msCap ms:
  pick a white cell; pick a digit legal in both its runs and different from the current one
  write it; nudge the two run sums through that cell by (new − old)
  if score() <= current: keep it   ← plateau moves included
  else: write the old digit back and un-nudge the sums
```

A one-cell mutation changes exactly two run sums and no run membership, so the sums are kept in
place and nudged rather than the grid re-scanned every step (a review finding). Measured on
identical seeded fills the gain is small — 0.63 → 0.60 ms per step at 7×7, none at 9×9 — because
the solution count, not the scan, is the step's cost; the change stays because it also removes a
grid copy per step and is the shape an E5 objective (classifier in the loop) will want.

Plateau moves (equal score) are what let the climb cross flat regions of the count landscape;
without them it stalls on the first local minimum. The wall-clock cap scales with the grid
(`25 × N²` ms: 6×6 0.9 s, 9×9 2 s) because a fill that has not converged by then is on a
plateau a *fresh layout* escapes faster than more steps would (measured). The objective's node
budget is 20k: the score saturates at `countLimit` anyway, so a deeper count on a hopeless fill
only costs time.

## `generateUniqueKakuro({ gridSize, blackDensity, timeBudgetMs })`

Layout → fill → repair → **exact verify** (`isKakuroUnique`, the final word — the objective
counted with a budget) → `KakuroPuzzle` labelled by `classifyKakuro`, `'unrated'` when the
ladder cannot finish it (D8). Up to `maxRounds` fresh layouts; `null` when every round failed.

`timeBudgetMs` is one clock for all rounds: each round's repair gets `min(its own cap, what is
left)`, and no round starts once the budget is spent — so a caller's budget bounds the call by
construction, not by multiplying caps (a review finding: `kakuro.ts` checked its budget only
between attempts, and one attempt could run five repair caps past it).

## Measured (E4, 2026-10-01, dev machine)

Scatter, 30 puzzles per size, `generateUniqueKakuro` end to end including classification
(E4 PR; the review-6 re-measure in brackets — the 9×9 figure swings 0.6–1.5 s between runs of
30 because a few repairs sit on plateaus to their cap, so treat it as a band):

| Size | Density | Avg | Median | Max | Tiers (e/m/h/x/X/unrated) |
|---|---|---|---|---|---|
| 6×6 | 0.40 | **95 ms** [23] | 20 ms [17] | 2.0 s [0.13] | 0/5/13/7/5/0 |
| 7×7 | 0.37 | 320 ms [133] | 43 ms [63] | 3.5 s [0.9] | 1/3/12/9/5/0 |
| 9×9 | 0.38 | **659 ms** [570–1456] | 245 ms [156–1328] | 2.2 s [2.5–8.2] | 0/2/16/7/4/1 |

E4's gates: mini < 200 ms avg ✓, 9×9 < 1 s avg at medium density ✓, yield ≥ E3's ✓ (repair
success 17–19/20 per layout at every size, 0 failures in 90 end-to-end runs). Densities of
0.42 at 9×9 slow the pipeline ~2× (2.7 s avg) — the scatter has to try many pairs and the
repair works harder — so the configs sit at 0.37–0.40.
