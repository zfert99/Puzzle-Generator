# Skyscrapers generation benchmark (`benchmark-skyscrapers.ts`)

Times `generateSkyscrapers(difficulty, { gridSize })` end to end — Latin fill, repair-to-unique
with restarts, tier-bounded clue removal until the classifier's tier is exactly the request, and
the label — for every **offered** tier at every shipped size (`SKYSCRAPERS_SIZES` ×
`SKYSCRAPERS_TIERS_BY_SIZE`), and appends one row per cell to `benchmark-logs.md` with the
average and the maximum. Plan slice E5.

## Run

```bash
npx tsx src/features/engine/benchmarks/benchmark-skyscrapers.ts [countPerCell]
```

Default 10 per cell. Every puzzle is a fresh `Math.random` run, so V8 cannot cache shapes or
eliminate the work (AGENTS.md §5). If `git rev-parse` fails (no checkout), rows are stamped
`unknown` rather than aborting the run.

## Why it walks `SKYSCRAPERS_TIERS_BY_SIZE`, not the whole ladder

A size only offers the tiers it can actually produce (D12); asking for one it does not offer
throws `SKYSCRAPERS_LEVEL_NOT_OFFERED_ERROR` before any work. Benchmarking the offered set is
therefore exactly the set of cells production can hit — there is no "unreachable tier" row to
time out on.

## What to watch

- **The rare cells — 5×5 hard and 7×7 expert —** draw the most squares (the exact-tier hit rate
  per round is lowest there), so they carry the longest tails. Compare their **maxima** between
  runs before reading anything into an average.
- The common cells are tens to low hundreds of ms and are the stable regression signal.
- `generateSkyscrapers` has a 20 s default per-call budget; a cell whose maximum approaches it is
  a real problem, because the route's batch shares one 45 s budget across every puzzle.

## Known gaps

- **Unseeded and small.** Ten `Math.random` puzzles per cell make the averages noisy, and a rerun
  times different puzzles. Recommended (not done yet, so the history in `benchmark-logs.md` stays
  comparable until it is changed deliberately): seed each cell with `mulberry32`, raise the rare
  cells to ~50 samples, and log the **median and p90** beside the mean and max.

## Seeded draws (October 2026)

**Why:** draw *i* of a cell uses `mulberry32(base + i)` (`bench-utils.ts`,
`SEED_BASE.skyscrapers` plus 100 per cell), so the rows compare across commits; the Metric cell
carries `p50 · p90 · max (n, seeded)` instead of the bare max.
