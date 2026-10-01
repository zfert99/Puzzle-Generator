# Kakuro generation benchmark (`benchmark-kakuro.ts`)

Times `generateKakuro(difficulty, { gridSize })` end to end — layout, fill, repair-to-unique,
the tier walk, the exact uniqueness verify and the classifier's label — for every tier at every
shipped size (`KAKURO_SIZES` × `KAKURO_LADDER`), and appends one row per cell to
`benchmark-logs.md` with the average and the maximum. Plan slice E5.

## Run

```bash
npx tsx src/features/engine/benchmarks/benchmark-kakuro.ts [countPerCell]
```

Default 10 per cell (150 puzzles, ~1–2 minutes). Every puzzle is a fresh `Math.random` run, so
V8 cannot cache shapes or eliminate the work (AGENTS.md §5).

## What to watch

- **9×9 expert and extreme** walk the farthest from the natural tier distribution and carry the
  longest tails; 9×9 easy walks far too (it is 1–3% of natural output) but each step is cheap.
- A 9×9 average that jumps by more than ~2× between runs is probably a repair-plateau tail (a
  few fills stall to the cap), not a regression — compare the maxima, and re-run before
  concluding. Averages below the E5 gate (easy/medium/hard 9×9 < 500 ms) are the target.
- The 6×6 and 7×7 rows are the stable regression signal: tens to low hundreds of ms.
