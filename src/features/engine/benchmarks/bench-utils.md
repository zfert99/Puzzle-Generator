# Benchmark Utilities (`bench-utils.ts`)

Shared plumbing for every script in this folder: a seeded PRNG, a warm-up, and a distribution
summary (median / p90 / max) beside the average.

## Why seeded draws (October 2026)

**Why:** the scripts drew from `Math.random`, so every run generated a fresh pool. For a
generator whose per-puzzle time spans an order of magnitude — classic extreme 50–250 ms, Killer
extreme 4–30 s — a row's average was mostly *which puzzles were drawn*. The HumanSolver "Extreme"
row (a 10-puzzle pool) moved between 4 and 26 ms with no code change and had to be declared noise
in the project memory. A fixed seed list keeps the inputs **varied within a run** (AGENTS.md §5:
no single grid for V8 to specialise on) while making the rows **comparable across commits**.

Each script owns a base seed (`SEED_BASE`), and draw `i` uses `base + i`, so two scripts never
time the same puzzle and the i-th puzzle of a row is the same puzzle on every commit. A change to
a *generator* changes which puzzle a seed produces — that is the one honest reason a seeded row
moves without a performance change, and the row's doc says so when it happens (the October 2026
Expert gate and Medium gate were two).

## Why median and p90, and why the log's columns stay

**Why:** an average of five extremes is dominated by the one slow draw. The median says what a
typical puzzle costs; the p90 says what the tail does, which is what the route's 45 s budget
cares about. `benchmark-logs.md` keeps its five columns — the distribution rides in the Metric
cell as `p50 · p90 · max (n, seeded)` — so old and new rows sit in one table.

## Why a warm-up

**Why:** the first timed tier of `benchmark-human-solver.ts` used to pay V8's compilation of
the whole solver; three untimed rounds first make the Basic row a solver number.

```text
mulberry32(seed)        -> () => number in [0, 1)   (the same PRNG the seeded tests use)
SEED_BASE               -> per-script base seeds (classic 1000, humanSolver 2000, …)
timeDraws(n, draw(i))   -> stats of n timed draws; draw gets i to seed itself
stats(times)            -> { avg, median, p90, max, n }
warmUp(fn, rounds = 3)  -> run fn untimed
distribution(stats)     -> the Metric cell text
currentCommit()         -> short SHA or 'unknown'
logRow(ts, sha, label, avgMs, metric) -> one table row
```
