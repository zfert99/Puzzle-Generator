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

## The hill-climb — `hillClimb(start, objective, { stepCap, msCap, stallCap })` (internal)

One climb, two objectives (E5 factored it out of the repair):

```text
runs = the mask's runs with their sums taken from the fill
score = objective(runs)
until score == 0, or stepCap steps, or stallCap steps without a strict improvement, or msCap ms:
  pick a white cell; pick a digit legal in both its runs and different from the current one
  write it; nudge the two run sums through that cell by (new − old)
  if objective(runs) <= current: keep it   ← plateau moves included
  else: write the old digit back and un-nudge the sums
```

A one-cell mutation changes exactly two run sums and no run membership, so the sums are kept in
place and nudged rather than the grid re-scanned every step (a review finding — measured at
~0–5%, the count dominates; kept because it is simpler and the objective sees live `runs`).

## Repair — `repairToUnique(fill, { countLimit, countBudget, … })`

Objective: the solution count of the clues the fill implies, minus one, capped at `countLimit`
(exhausting `countBudget` nodes also scores the cap) — 0 exactly when the puzzle is unique.

**The defaults are measured** (E5, 30 identical seeded 9×9 fills, same climb): a count limit
of 50 plateaus — every neighbour of a many-solution fill scores the same, so the climb is blind
— and repaired 17/30 at **2.0 s per accepted puzzle**; a limit of 200 keeps a gradient (24/30)
and a stall cap of 600 steps cuts the hopeless ones short: **0.77 s per accepted puzzle**.
Larger limits (300, 500) pay more per step than they return.

| countLimit · countBudget · stallCap | repaired / 30 | ms per round | ms per accepted |
|---|---|---|---|
| 50 · 20k · ∞ (E4) | 17 | 1 139 | 2 010 |
| 100 · 20k · ∞ | 20 | 932 | 1 398 |
| **200 · 20k · 600** | **24** | **614** | **768** |
| 200 · 20k · ∞ | 24 | 732 | 915 |
| 500 · 50k · ∞ | 22 | 789 | 1 076 |

## The tier walk — `walkToTier(solution, target, …)`

The E5 piece: climb a *unique* puzzle to exactly the requested tier, keeping it unique, with
the classifier in the objective. The objective orders every fill by distance from "unique and
exactly this tier", with a gradient inside each band so it is a climb and not a lottery:

```text
not unique                      → 1000
unique, ladder cannot finish it → 500 + undecided cells
unique, harder than the target  → 100 + steps above the target tier          ← shed them one by one
unique, easier than the target  → 50 + 10·(target − h) − lean(h)              ← nearer tier first, then leaning harder on it
unique, exactly the target      → 0
```

`h` is the puzzle's hardest tier; `lean(h)` ∈ 0..9 is the share of white cells the ladder
capped at `h − 1` leaves undecided — how much of the grid the top technique carries. Each
evaluation is a 2-solution count (cheap; most mutations break uniqueness and stop there) plus
one classifier solve, and for the "easier than" band a second capped solve.

**The easier band was flat in the E5 PR** (a review finding): it capped the ladder at
`target − 1`, but a ladder that never needed more than `h ≤ target − 1` finishes under any cap
≥ `h` — the capped run takes the identical path — so `undecided` was always 0 and every
easier-than-target state scored exactly 50. The up-walks still reached their targets (a plateau
random walk lands on the target eventually), which is why the measurements looked fine; the
gradient the doc described did not exist. The band is now keyed on tier distance first, so a
mutation that gains a tier always wins, and within a tier on `lean`, so a state that depends
more on its top technique counts as progress toward needing the next. Before/after on identical
seeded bases (easy → target, 15 per cell, medians): see **Measured** below.

This is what makes easy reachable — it is 1–3% of natural output, so E4's rejection could not
get there — and it is why no per-tier layout bias was needed.

`generateUniqueKakuro({ targetTier, walk })` runs the walk after the repair, under the same
clock and with its own caps (`walk`, independent of `repair` — a review finding), and labels
the result with the target: the walk accepts only a state whose full ladder solve — the same
solver and call the classifier makes, deterministic — reports exactly that tier, so re-running
the classifier would re-derive a known answer (it did, in the E5 PR; a review finding).

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

## Measured — the up-walk gradient (review follow-up 7, 2026-10-01)

Same 15 seeded bases per cell (each walked down to easy first), then walked up to the target
with the flat band (E5 PR) and with the tiered band; steps are the CPU-independent signal
(the ms columns were taken under test-suite load):

| Cell | flat: steps median / max | flat: ms median / max | tiered: steps median / max | tiered: ms median / max |
|---|---|---|---|---|
| 7×7 → expert | 35 / 162 | 21 / 154 | 19 / 208 | 9 / 129 |
| 7×7 → extreme | 98 / 360 | 328 / 1 461 | 86 / 321 | 77 / 423 |
| 9×9 → expert | 49 / **1 832** | 311 / 6 275 | 59 / **287** | 137 / 1 972 |
| 9×9 → extreme | 139 / **886** | 605 / 3 349 | 132 / **338** | 780 / 4 416 |

Every walk reached its target either way (15/15 per cell). The medians barely move — a plateau
random walk lands on the target soon enough most of the time — but the tails are where the
gradient earns its keep: the worst 9×9 up-walk shrank from 1 832 to 287 steps (expert) and from
886 to 338 (extreme). Those tails were the widest spread in the E5 benchmark.

## Measured (E5, 2026-10-01, dev machine — `benchmark-kakuro.ts`, 10 per cell)

`generateKakuro(tier, { gridSize })` end to end — layout, fill, repair, tier walk, verify,
label; the benchmark log has the rows (commit `cd61715` + this slice):

| Size | easy | medium | hard | expert | extreme |
|---|---|---|---|---|---|
| 6×6 | 51 ms | 104 | 37 | 60 | 72 |
| 7×7 | 401 | 158 | 283 | 403 | 124 |
| 9×9 | **265** | 528 | **365** | 191 | 773 |

(9×9 maxima 0.5–3.2 s; a 9×9 figure swings run to run because a few repairs stall to their cap.)
Soundness fuzz, 500 generated puzzles per size through the logical solver: **0 unsound steps,
0 label mismatches** at every size.

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
