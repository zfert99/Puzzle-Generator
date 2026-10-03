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

One row per tier is appended to `benchmark-logs.md` through the shared
[`benchmark-log.ts`](benchmark-log.md) writer, so a run's numbers are comparable against the
commit-stamped history rather than only the console output.

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

## October 2026: the Advanced row stepped up — the pool changed, not the solver

The Advanced pool is `generateSudoku('expert')`. Until October 2026 the Expert digger never
checked that its puzzles *needed* an advanced strategy, and ~90% of them were basic-solvable, so
this row mostly timed basic solves. The digger now verifies necessity (`diggers.md`), and the row
moved from **~0.19 ms to ~0.61 ms** in the same session. Re-timing the advanced tier on an
old-style (single-pass, unverified) pool gave **0.18 ms**, so the solver itself did not slow
down: the row now measures what its name says. Compare future runs against the post-change rows
only.

## Known gaps

- **Unseeded pools.** Every pool is drawn with `Math.random`, so two runs time different puzzles. **Done October 2026 — see "Seeded" below.**
  The Extreme row in particular is a 10-puzzle lottery — it has swung across a ~4–26 ms band with
  no code change. Recommended (not done yet, so the logged history stays comparable until it is
  done deliberately): seed each pool with `mulberry32` from a fixed seed, grow the Extreme pool to
  ~50 puzzles, and log the **median and p90** per tier alongside the mean.
- The **Expected Results** numbers above predate the bitmask candidate store and the October 2026
  pool change; `benchmark-logs.md` is the source of truth for current values.

## Seeded pools, a warm-up, and the distribution (October 2026)

**Why:** each tier's pool is now drawn from `mulberry32(base + i)` (`bench-utils.ts`,
`SEED_BASE.humanSolver`), so puzzle *i* of a tier is the same puzzle on every commit. The
Extreme pool was 10 unseeded puzzles and its row moved between 4 and 26 ms with no code change —
the project memory had to carry "the Extreme row is noise". It is 50 puzzles now, and a move in
the row is a move in the solver (or, the one honest exception, in which puzzle a seed yields when
a generator changes — the Expert gate did this to the Advanced row). One untimed pass over each
pool precedes the timing so the Basic row no longer pays the solver's JIT compilation. The
Metric cell carries `solves/sec · p50 · p90 · max (n, seeded)`; the Avg column is unchanged.
