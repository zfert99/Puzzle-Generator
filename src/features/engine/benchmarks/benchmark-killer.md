# Killer Generation Benchmark (`benchmark-killer.ts`)

Establishes generation-time baselines for Killer Sudoku, which shipped with **no** benchmark
coverage (review finding M2) despite AGENTS.md §3.

## Why benchmark generation

Every accepted puzzle is graded by the logical solver and uniqueness-checked once during generation,
and the generator retries until a puzzle grades to the requested tier — so `generateKillerSudoku`
end-to-end is where the solver cost lands in production. Extreme is the slow tier
(tier-5-necessary layouts are rare, ~5.5 s each on the reviewed hardware), which is exactly why it
needs a tracked baseline rather than being assumed cheap.

## What it measures

- 9×9 generation, averaged per tier: Easy/Medium/Hard (20×), Expert (10×), Extreme (5×).
- One 6×6 Hard row (20×) — the beginner variant (digits 1–6, easy/medium/hard only).

Counts shrink as tiers get slower to bound total wall-clock. Inputs are randomized (a fresh
`Math.random` puzzle per call) to avoid V8 shape-caching / dead-code elimination (AGENTS.md §5).

## Run

```bash
npx tsx src/features/engine/benchmarks/benchmark-killer.ts
```

Appends one row per tier to `benchmark-logs.md` (`| timestamp | commit | label | avg ms | N/A |`)
via the shared [`benchmark-log.ts`](benchmark-log.md) writer.
No fixed pass/fail target yet — this is the baseline to regression-guard against; watch for large
jumps versus the previous commit's rows.
