# Keisan Generation Benchmark (`benchmark-calc.ts`)

Establishes generation-time baselines for Keisan (Calcudoku), which shipped with **no** benchmark
coverage (review finding M2) despite AGENTS.md §3 requiring the tiered benchmarks when solving logic
changes.

## Why benchmark generation, not the solver in isolation

Every accepted puzzle is graded by `calc-logical-solver` during generation, and the generator retries
until it finds one that grades to the requested tier. So `generateCalcSudoku` end-to-end is where the
solver's cost actually lands in production — including the tier-5/6 bounded-recursion guesser
(`snapshot()` deep-copies grid+candidates per hypothesis branch; `hasContradiction()` scans every
fixpoint iteration). Timing generation captures that real cost on real inputs, rather than a synthetic
solve of a hand-picked grid.

## What it measures

- 9×9 generation, averaged per tier: Easy/Medium/Hard (20×), Expert (10×), Extreme (5×).
- One 9×9 Hard **Mystery/No-Op** row (10×) to keep the operator-union combo path on the radar.

Counts shrink as tiers get slower to keep total wall-clock bounded; Extreme is the expensive tier
(rare tier-5/6-necessary layouts). Inputs are randomized (a fresh `Math.random` puzzle per call) to
avoid V8 shape-caching / dead-code elimination (AGENTS.md §5).

## Run

```bash
npx tsx src/features/engine/benchmarks/benchmark-calc.ts
```

Appends one row per tier to `benchmark-logs.md` (`| timestamp | commit | label | avg ms | N/A |`).
No fixed pass/fail target yet — this is the baseline to regression-guard against; watch for large
jumps versus the previous commit's rows.
