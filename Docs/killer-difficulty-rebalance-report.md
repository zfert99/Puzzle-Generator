# Killer Sudoku Difficulty Rebalance — Status Report

> **Date:** 2026-07-17 · **Branch:** `feature/killer-sudoku` · **Scope:** Phase 6 difficulty
> rebalance (research levers #1 + #2; #3 two-factor scoring deferred)
>
> Reference document: successes, failures, benchmarks, and the blockers gating harder tiers.
> Research basis: [killer-sudoku-difficulty-tiers.md](research/killer-sudoku-difficulty-tiers.md).

## What we set out to fix

Generated Killer puzzles were too easy: too many single-cell cages, no big sums, and no real
separation between difficulties. The data confirmed it — the old generator produced **52%
single-cell cages on easy and 33% on medium and hard**, and medium and hard used identical cage
settings, so they were the same puzzle wearing different labels. A single-cell cage is just a
given (a sum over one cell tells you the digit), so those numbers meant "hard" puzzles were
roughly a third pre-solved.

The research gave us four cage levers: **single-cage count** (the strongest lever), **max cage
size**, **max cage sum**, and **max combinations per cage** (ambiguity). The plan: #1 cap
singles + bias cages larger, #2 add a maxCombos gate, #3 (deferred) two-factor difficulty
scoring.

## How generation works now

One flat retry loop per puzzle, cheapest checks first:

1. Fill a complete solved grid (~0.09 ms).
2. Partition it into cages by region-growing, with a per-difficulty size window
   `[minSize, maxSize]` (~0.03 ms).
3. **Shape gate**: reject if the partition has more forced single-cell cages than the
   difficulty allows (microseconds).
4. **Uniqueness gate**: exact bitmask solver proves exactly one solution (~10 ms, and only
   ~28% pass).
5. **Solvability gate**: the logical solver confirms the puzzle is solvable within the
   difficulty's technique-tier *ceiling* (~0.45 ms).

Profiling showed **~99% of generation time is step 4**. Building candidates is free; verifying
them is everything. That fact drove most of the decisions below. (It is also why reordering the
pipeline — cages-first vs numbers-first — doesn't help: uniqueness is a property of the
grid+cages *pair*, so any ordering must test the same number of pairs.)

## The big strategic change: shape drives difficulty, tier is a ceiling

The original design required each puzzle to grade to an *exact* tier (easy = tier 1,
medium = 2, hard = 3). Once cage shape was constrained, that collided with feasibility in both
directions:

- **Easy failed completely (0 for 25).** Tier-1 solving *needs* lots of givens — that's what
  makes it tier 1. Capping easy's singles at 6 while demanding tier-1 solvability produced
  essentially zero valid puzzles. The lesson: for easy, singles aren't a bug, they're the
  mechanism.
- **Medium slowed to 2.1–2.3 seconds.** With singles suppressed, 98% of unique medium-shaped
  layouts needed tier-3 techniques, so the exact-tier-2 filter threw away 49 of every 50
  puzzles that had already paid the expensive uniqueness check.

So control was inverted: **cage shape (the singles budget + size window) creates the
difficulty; the solver tier is just a ceiling** guaranteeing the puzzle never requires a
technique we don't teach. Within-ceiling refinement is exactly what #3 (two-factor scoring:
weighted technique frequency × opportunity density) is for — the research explicitly says real
graders score this way rather than by hardest-single-technique.

## Where each difficulty landed (final, benchmarked at 20 samples each)

| | Tier ceiling | Cage sizes | Singles budget | Measured singles | Avg sum | Gen avg / median / max | Fails |
|---|---|---|---|---|---|---|---|
| **Easy** | 2 | 1–3 | ≤12 | 29% (~11/puzzle) | 10.3 | 7 ms / 5 ms / 19 ms | 0/20 |
| **Medium** | 3 | 2–3 | ≤4 | 6% (~2/puzzle) | 11.6 | 730 ms / 716 ms / 1,960 ms | 0/20 |
| **Hard** | 3 | 2–3 | ≤1 | 2% (~1/puzzle) | 11.7 | 1,302 ms / 890 ms / 4,195 ms | 0/20 |

- **Easy — clean success.** Singles nearly halved (52% → 29%) and cages grew (old easy was
  capped at 2-cell cages; now it gets 3-cell cages and sums up to 24). Still generates
  effectively instantly. It keeps a healthy dose of givens on purpose — that's what makes it
  approachable.
- **Medium — success.** Singles collapsed from 33% to 6%. `minSize: 2` means the partitioner
  never *intends* a single; the ~2 per puzzle that remain are cells that got boxed in during
  region growth. 730 ms average is acceptable for client-side generation, though no longer
  instant.
- **Hard — success with a caveat.** Essentially zero givens (0.8/puzzle; most puzzles have 0 or
  1), which per the research is the defining structural trait of hard Killer. The caveat: hard
  is distinguished from medium only by the singles budget (≤1 vs ≤4) — both sit under the same
  tier-3 ceiling and the same size window. It *is* harder (fewer anchors to start from, and the
  shape statistics prove it), but the gap is narrower than ideal. Widening it properly is a
  #3-scoring job, not a shape job — the shape route is blocked (next section).

## The 4-cell cage failure (why hard doesn't have big cages)

The biggest disappointment of the tuning, and it also gates the future tiers. "Super big sums"
means 4+ cell cages (a 4-cell cage can sum to 30; 3-cell caps at 24). Three configurations of
maxSize-4 hard were benchmarked:

| Config | Result |
|---|---|
| Sizes 2–4, ≤1 single, combo-capped, tier-4 ceiling | **0 for 12** — ~159 s average per attempt budget, 233 s worst |
| Sizes 2–4, ≤3 singles, tier-3 ceiling | Did not finish 6 samples in 10+ minutes (>100 s per puzzle) |
| Sizes 1–4, ≤6 singles, tier-3 ceiling | 5.9 s, 6.0 s, 16.2 s, and one 20 s timeout |

The root cause is a compounding failure in the **uniqueness check**. A loose 4-cell cage (say,
sum 20) has up to 12 valid digit combinations; the exact solver's cage pruning is deliberately
simple, so big loose cages give it almost nothing to cut and the backtracking search thrashes.
The codebase had already documented this cliff at cage size 5 — it turns out the cliff moves
down to size 4 the moment the givens are removed, because givens were what kept the search
anchored. Per-check cost jumped from ~10 ms to 25–47 ms, *and* the uniqueness pass-rate
dropped, *and* attempts-per-puzzle rose to 900–4,900. Multiplied together, that's minutes per
puzzle.

The one variant that sort of worked (third row) needed **six givens** — more than medium allows
— which defeats the purpose of hard entirely. So: **all difficulties ship at max cage size 3
for now**, and big cages are formally deferred to the expert-tier work. Sums still reach 24
(7+8+9), and each puzzle averages ~2.3 cages with sums ≥ 20.

## The maxCombos failure (why lever #2 was dropped)

Implemented, measured, and deliberately removed — worth documenting since the research calls it
"the master ambiguity knob."

The implementation was a binary partition gate: reject the whole layout if *any* cage exceeds N
combinations. That shape of filter is wrong at both ends:

- **At max cage size 3 it filters nothing.** A 2-cell cage has at most 4 combinations, a 3-cell
  cage at most 8. Any threshold loose enough to be satisfiable is above those numbers, so the
  gate is a no-op — confirmed: sweep results were identical with and without it.
- **At max cage size 4 it rejects everything.** A grid has ~36–44 cages; the probability that
  *every one* of them is tight is effectively zero. The tight-capped easy configs failed 25/25
  and 12/12 for exactly this reason — one loose cage anywhere nuked the whole partition.

The research is still right that combination ambiguity matters — but it works as a **weighted
average across the grid in a difficulty score**, not as a per-cage binary threshold. That is
precisely the #3 two-factor scoring design, so the lever isn't abandoned, it's relocated. The
code carries a comment explaining this so nobody re-adds the gate.

## Harder difficulties (expert/extreme) — the road ahead

Three independent blockers stack up:

1. **The solvable band is thin.** Measured: only ~1% of unique layouts grade to tier 4, and
   **~86% of maxSize-4 unique layouts are beyond the current technique set entirely** — the
   logical solver can't finish them, so no human solve-path can be verified. Rejection-sampling
   into a 1% band that also carries the shape constraints above would grind for minutes.
2. **The technique gap.** The research's ladder for Hard+ includes cage splitting, hard
   combinations, multi-cell innies/outies beyond what we have, and the classic chain arsenal
   (X-Cycles, XY-Chains, 3D Medusa, AIC, ALS). `KillerLogicalSolver` tops out at tier 4
   (classic advanced/extreme), with the Killer-specific techniques — cage splitting especially
   — not yet implemented. Every technique added converts some of that unreachable 86% into
   gradable territory, widening the expert band.
3. **The exact solver needs pruning work.** Even if grading worked, generation is bottlenecked
   by `countSolutions` thrashing on big cages (the 4-cell story above). Expert needs either
   tighter cage-sum bound propagation during backtracking (prune a branch the moment a partial
   cage can't reach its sum with any remaining combination) or a node-budget bail-out so
   pathological layouts get abandoned in milliseconds instead of thrashing for seconds.

The realistic sequence for expert/extreme: **solver pruning first** (unlocks maxSize 4–5 at
sane speed, which also retroactively gives *hard* its big sums), **then Killer techniques**
(cage splitting, chains — widens the gradable band), **then two-factor scoring** (separates
expert from hard honestly). Until then, three well-separated difficulties is the honest ladder.

## Housekeeping from this pass

- All **184 tests pass** (60 Killer); two tests that encoded the old exact-tier contract were
  updated to the ceiling contract, plus a new per-difficulty singles-budget test.
- Mirrored docs updated ([killer-sudoku.md](../src/features/engine/killer/killer-sudoku.md),
  [cage-generator.md](../src/features/engine/killer/cage-generator.md)); roadmap status
  refreshed with the new numbers.
- The research doc had a non-compliant auto-generated filename — renamed to
  [killer-sudoku-difficulty-tiers.md](research/killer-sudoku-difficulty-tiers.md) and
  lint-cleaned.
- Fixed a real repo hazard: the on-disk directory had drifted to lowercase `docs` while git
  tracks `Docs/` — invisible on macOS, but it would have split the tree on any case-sensitive
  system (CI, Linux).
- New sample regenerated and visually verified:
  [killer-sudoku-sample.pdf](samples/killer-sudoku-sample.pdf).

## Bottom line

Lever #1 succeeded and is the entire rebalance: singles 52/33/33% → 29/6/2%, bigger cages and
sums, real structural separation, zero generation failures, speeds from 7 ms to 1.3 s. Lever #2
was implemented, measured, and correctly killed — its job moves to #3. The blockers — 4-cell
cages, exact-tier grading, and everything expert-tier — all trace back to one root: **the exact
solver's pruning is too weak for big loose cages**, and that is the single highest-leverage
piece of future engine work.

## Addendum (same day): research-alignment pass

A second research doc
([killer-difficulty-grading-systems.md](research/killer-difficulty-grading-systems.md) —
Stuart's scoring architecture, SE weights, HoDoKu's generator) prompted a follow-up pass
applying its cage-structure levers. Outcomes:

**Foothold bands (lever d, adopted).** A "foothold" is a single-combination cage of 2+ cells —
a strong starting point, so fewer = harder. Implemented as *count* gates (the workable form of
the failed per-cage maxCombos): medium requires **≥ 3 footholds** (guaranteed anchors; cuts its
accidentally-hardest tail), hard allows **≤ 3** (accepted-hard median was ~4; the cap keeps the
harder 38%). Medium and hard now differ on two structural axes (givens ~2 vs ~1, footholds
~4.7 vs ~2.4) instead of one.

**2-cell-mix lever (lever b, measured and blocked).** Added `maxSizeBias` to the cage
generator (probability of drawing `maxSize` instead of uniform) to thin out 2-cell cages at
the draw. The lever works structurally but the **tier-3-solvable rate collapses from ~10% to
~1% → 0%** as 2-cell cages drop (pure 3-cell grids: 0-for-11 solvable, uniqueness checks
579 ms avg). The current technique set gets its traction from tight 2-cell cages — the same
verification ceiling as maxSize 4, now measured precisely. The knob ships unused, ready for
the expert tier.

**Pipeline reorder (major speed win).** Grading now runs BEFORE the uniqueness check: the
logical solver makes only sound deductions, so a grid it completes is necessarily the unique
solution — solvability-within-cap implies uniqueness, and `countSolutions` becomes a
once-per-accepted-puzzle verification instead of a ~10 ms toll on every candidate. Measured
result (15–25 samples, zero failures):

| Difficulty | Before | After reorder + bands |
|---|---|---|
| easy | 7 ms avg | 12 ms avg / 55 ms max |
| medium | 730 ms avg | **88 ms avg** / 266 ms max |
| hard | 1,302 ms avg | **288 ms avg** / 683 ms max |

Hard briefly hit 5.2 s avg when the foothold cap landed on the old pipeline order; the reorder
paid for the entire alignment pass and then some.

**Also validated by the new research:** the generate-and-grade over-produce-and-filter pattern
(Stuart, HoDoKu, Krazydad all do exactly this), the singles-discard rule (Stuart discards cage
grids with too many single-cell cages for higher grades), and the deferral of expert (Stuart:
~1 in 5,000 random puzzles reaches "extreme"). For #3, the research supplies the architecture
(hardest-technique band + weighted-sum × opportunity-density intra-band score, SE 1.0–11.9
weights as backbone) and the necessity-testing caveat (verify a technique is required by
*disabling* it and re-solving, not by reading a solve trace — our tier-cap check already works
this way at band granularity).

## Addendum 2: two-factor scoring (#3) implemented

Stuart's `raw × density` architecture is now live (`killer-score.ts` + solver
instrumentation):

- **Factor 1 — weighted technique sum.** `KillerLogicalSolver.solve()` now returns
  per-technique application counts (the deduction loop was refactored into a tier-ordered
  technique table); `killer-score.ts` weights them on the Sudoku Explainer 1.0–11.9 backbone
  with Killer techniques slotted per SudokuWiki's ordering (single-house R45 3.5, multi-unit
  regions 4.5, cage arithmetic 1.0).
- **Factor 2 — opportunity density.** Each deduction pass samples how many naked singles are
  simultaneously available (one popcount scan, ~µs). The mean maps onto a [0.5, 2] multiplier:
  bottlenecked grids score up, open grids down.
- **Disjoint acceptance bands** placed on measured 30-sample distributions: easy < 42,
  medium 42–62, hard ≥ 62. This closed a real, measured hole: before banding, medium's grindy
  top quartile (p75 = 74) out-scored hard's median (65) — a "medium" could genuinely play
  harder than a "hard". Generated puzzles now land at easy 18–41 / medium 43–61 / hard 64–96
  with zero overlap.

Speed after banding (20 samples, zero failures): easy 12 ms, medium 117 ms, hard 404 ms avg
(1.45 s max) — the band rejections cost medium ~30 ms and hard ~120 ms over the unbanded
pipeline, well within budget. The cuts must be re-measured whenever weights, shape gates, or
solver techniques change (they are relative cuts, Stuart-style, not absolute numbers).
