# Benchmark: Human Solver

This script measures the performance of our pure logical deduction engine (`human-solver.ts`) across different difficulty tiers (`basic`, `advanced`, and `extreme`). This ensures that puzzle generation at each difficulty level remains highly performant.

## What it does

It runs the `HumanSolver` class across three separate benchmark profiles. Each
profile pre-generates its own pool of **unique, freshly generated puzzles at a
difficulty that genuinely exercises that tier** before the timer starts. Using a
fresh, randomized pool (rather than one static grid) is deliberate: it stops the
V8 JIT from caching object shapes or eliminating dead code, which would produce
deceptively fast microbenchmark numbers (see AGENTS.md Section 5).

1. **Basic Tier (`maxTier: 'basic'`)**: 50 **hard** puzzles solved with only the
   basic strategy set (5,000 iterations).
2. **Advanced Tier (`maxTier: 'advanced'`)**: 50 **expert** puzzles solved with
   advanced strategies like X-Wings and Y-Wings (5,000 iterations).
3. **Extreme Tier (`maxTier: 'extreme'`)**: 10 **extreme** puzzles that require the
   computationally expensive extreme strategies — W-Wings, ALS-XZ, and Alternating
   Inference Chains (1,000 iterations).

### Why the pool difficulty must match the tier

An earlier version benchmarked **every** tier against expert-only puzzles. That
made the extreme tier meaningless: an expert puzzle is fully solvable by advanced
strategies, so the solver reached `isSolved()` before ever invoking the extreme
strategies — the expensive W-Wing/ALS/AIC code was never exercised, and the tier
reported the same ~0.5ms as the advanced tier. Matching each pool's difficulty to
its tier is what makes the per-tier thresholds below actually measure the code
they name.

For each tier, it calculates:

- The total time taken to run all iterations
- The average time taken per solve/evaluation
- The estimated number of solves per second

## How to run

Execute the script from the root of the project using `tsx` (which is standard for executing TypeScript files directly in modern Node environments):

```bash
npx tsx src/features/engine/benchmarks/benchmark-human-solver.ts
```

## Expected Results

Representative numbers on a modern CPU with the current `Set`-based candidate
representation (see `benchmark-logs.md` for the full history):

- **Basic Tier** (hard puzzles): **~0.5–0.6 ms** per evaluation
- **Advanced Tier** (expert puzzles): **~0.5–0.6 ms** per solve
- **Extreme Tier** (extreme puzzles): **~30–35 ms** per solve

### Note on the AGENTS.md thresholds

AGENTS.md Section 3 cites example targets of **Basic < 0.3 ms** and
**Extreme < 10 ms**. With the honest, tier-representative pools the engine
currently **exceeds both**: the Basic tier is roughly 2x over and the Extreme tier
several times over. This is expected given the engine stores candidates as
`Set<number>[][]` and enumerates ALS subsets with generic combination helpers.
AGENTS.md Section 1 calls for a **bitmask-based representation with a popcount MRV
heuristic**; migrating to it is the primary lever for bringing these tiers back
under threshold. (For context, the Phase 1 roadmap target of "AIC-heavy boards
< 2 s" is comfortably met — 35 ms is well inside 2 s.) The point of this benchmark
is to keep those numbers honest, not to hide them behind a non-representative pool.
