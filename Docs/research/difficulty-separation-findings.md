# Difficulty Separation Findings (October 2026)

> **What this is:** the measured record behind the owner's ask "make sure the difficulties are
> reasonably different for each size", produced by
> `src/features/engine/benchmarks/difficulty-separation.ts` (12 puzzles per cell, unseeded, one
> run on 2026-10-02 at `6db9c70` + the site-wide pass's engine changes). The reading and the one
> recommendation are in
> [site-wide-optimization-qa-pass.md](../site-wide-optimization-qa-pass.md) §2.7; this file keeps
> the raw table so a later recalibration can be compared against it.
>
> **How to read:** `score` is each engine's own two-factor score (Classic: the clue count —
> lower is harder). `T` buckets are the solver tier each puzzle graded at (Classic: T0 = naked
> singles alone finish it). Keisan 9×9 adds the axis its config actually separates on —
> single-cell `givens` for easy/medium/hard, `guesses` (bounded-recursion steps) for expert/extreme.

## Full table

| Type · size · tier | n | score p10 · p50 · p90 | solver tiers | avg gen |
|---|---|---|---|---|
| Classic 4×4 easy | 12 | p10 9 · p50 9 · p90 9 | T0×12 | 0 ms |
| Classic 4×4 medium | 12 | p10 6 · p50 6 · p90 6 | T0×12 | 0 ms |
| Classic 4×4 hard | 12 | p10 4 · p50 4 · p90 5 | T0×12 | 0 ms |
| Classic 6×6 easy | 12 | p10 20 · p50 20 · p90 20 | T0×12 | 0 ms |
| Classic 6×6 medium | 12 | p10 16 · p50 16 · p90 16 | T0×12 | 0 ms |
| Classic 6×6 hard | 12 | p10 10 · p50 10 · p90 11 | T0×9 T1×3 | 1 ms |
| Classic 9×9 easy | 12 | p10 41 · p50 41 · p90 41 | T0×11 T3×1 | 2 ms |
| Classic 9×9 medium | 12 | p10 31 · p50 31 · p90 31 | T0×6 T1×6 | 1 ms |
| Classic 9×9 hard | 12 | p10 26 · p50 26 · p90 26 | T1×12 | 2 ms |
| Classic 9×9 expert | 12 | p10 24 · p50 25 · p90 26 | T2×12 | 46 ms |
| Classic 9×9 extreme | 4 | p10 24 · p50 25 · p90 25 | T3×4 | 104 ms |
| Killer 4×4 easy | 12 | p10 3 · p50 3 · p90 4 | T1×12 | 1 ms |
| Killer 6×6 easy | 12 | p10 8 · p50 11 · p90 15 | T1×12 | 2 ms |
| Killer 6×6 medium | 12 | p10 17 · p50 22 · p90 27 | T1×8 T2×1 T3×3 | 3 ms |
| Killer 6×6 hard | 12 | p10 30 · p50 39 · p90 51 | T1×3 T3×9 | 11 ms |
| Killer 9×9 easy | 12 | p10 30 · p50 34 · p90 39 | T1×10 T2×2 | 9 ms |
| Killer 9×9 medium | 12 | p10 47 · p50 56 · p90 60 | T1×1 T2×2 T3×9 | 89 ms |
| Killer 9×9 hard | 12 | p10 64 · p50 76 · p90 87 | T3×12 | 613 ms |
| Killer 9×9 expert | 6 | p10 104 · p50 109 · p90 123 | T4×6 | 341 ms |
| Killer 9×9 extreme | 4 | p10 136 · p50 173 · p90 218 | T5×4 | 4185 ms |
| Keisan 4×4 easy | 12 | p10 3 · p50 4 · p90 4 | T1×12 | 1 ms |
| Keisan 4×4 medium | 12 | p10 6 · p50 8 · p90 8 | T1×10 T2×2 | 1 ms |
| Keisan 4×4 hard | 12 | p10 11 · p50 17 · p90 20 | T2×12 | 2 ms |
| Keisan 4×4 expert | — | not offered / failed: Keisan difficulty 'expert' is not available at 4×4 | — | — |
| Keisan 4×4 extreme | — | not offered / failed: Keisan difficulty 'extreme' is not available at 4×4 | — | — |
| Keisan 6×6 easy | 12 | p10 12 · p50 13 · p90 18 | T1×1 T2×11 | 2 ms |
| Keisan 6×6 medium | 12 | p10 21 · p50 24 · p90 27 | T1×1 T2×11 | 3 ms |
| Keisan 6×6 hard | 12 | p10 34 · p50 44 · p90 56 | T2×9 T4×3 | 25 ms |
| Keisan 6×6 expert | — | not offered / failed: Keisan difficulty 'expert' is not available at 6×6 | — | — |
| Keisan 6×6 extreme | — | not offered / failed: Keisan difficulty 'extreme' is not available at 6×6 | — | — |
| Kakuro 6×6 easy | 12 | p10 12 · p50 15 · p90 17 | T1×12 | 47 ms |
| Kakuro 6×6 medium | 12 | p10 18 · p50 20 · p90 31 | T2×12 | 23 ms |
| Kakuro 6×6 hard | 12 | p10 43 · p50 73 · p90 122 | T3×12 | 18 ms |
| Kakuro 6×6 expert | 6 | p10 102 · p50 137 · p90 190 | T4×6 | 183 ms |
| Kakuro 6×6 extreme | 6 | p10 165 · p50 173 · p90 223 | T5×6 | 42 ms |
| Kakuro 7×7 easy | 12 | p10 13 · p50 17 · p90 19 | T1×12 | 200 ms |
| Kakuro 7×7 medium | 12 | p10 20 · p50 29 · p90 44 | T2×12 | 262 ms |
| Kakuro 7×7 hard | 12 | p10 74 · p50 97 · p90 154 | T3×12 | 273 ms |
| Kakuro 7×7 expert | 6 | p10 128 · p50 168 · p90 290 | T4×6 | 101 ms |
| Kakuro 7×7 extreme | 6 | p10 183 · p50 255 · p90 500 | T5×6 | 98 ms |
| Kakuro 9×9 easy | 12 | p10 19 · p50 24 · p90 30 | T1×12 | 831 ms |
| Kakuro 9×9 medium | 12 | p10 42 · p50 61 · p90 72 | T2×12 | 1035 ms |
| Kakuro 9×9 hard | 12 | p10 94 · p50 177 · p90 247 | T3×12 | 605 ms |
| Kakuro 9×9 expert | 6 | p10 264 · p50 318 · p90 452 | T4×6 | 211 ms |
| Kakuro 9×9 extreme | 6 | p10 237 · p50 333 · p90 394 | T5×6 | 488 ms |
| Skyscrapers 5×5 easy | 12 | p10 12 · p50 17 · p90 21 | T1×12 | 8 ms |
| Skyscrapers 5×5 medium | 12 | p10 20 · p50 23 · p90 27 | T2×12 | 10 ms |
| Skyscrapers 5×5 hard | 12 | p10 30 · p50 46 · p90 50 | T3×12 | 56 ms |
| Skyscrapers 6×6 easy | 12 | p10 16 · p50 25 · p90 29 | T1×12 | 43 ms |
| Skyscrapers 6×6 medium | 12 | p10 32 · p50 43 · p90 55 | T2×12 | 23 ms |
| Skyscrapers 6×6 hard | 12 | p10 41 · p50 56 · p90 76 | T3×12 | 41 ms |
| Skyscrapers 6×6 expert | 6 | p10 50 · p50 61 · p90 80 | T4×6 | 205 ms |
| Skyscrapers 6×6 extreme | 6 | p10 79 · p50 95 · p90 132 | T5×6 | 47 ms |
| Skyscrapers 7×7 medium | 12 | p10 30 · p50 54 · p90 64 | T2×12 | 465 ms |
| Skyscrapers 7×7 hard | 12 | p10 66 · p50 90 · p90 110 | T3×12 | 442 ms |
| Skyscrapers 7×7 expert | 6 | p10 102 · p50 110 · p90 140 | T4×6 | 2020 ms |
| Skyscrapers 7×7 extreme | 6 | p10 135 · p50 186 · p90 227 | T5×6 | 572 ms |
| Keisan 9×9 easy | 12 | p10 19 · p50 38 · p90 57 · givens p10/p50/p90 13/15/19 | T2×11 T4×1 | 10 ms |
| Keisan 9×9 medium | 12 | p10 24 · p50 34 · p90 55 · givens p10/p50/p90 9/10/11 | T1×3 T2×9 | 11 ms |
| Keisan 9×9 hard | 12 | p10 46 · p50 58 · p90 78 · givens p10/p50/p90 1/1/3 | T2×11 T4×1 | 23 ms |
| Keisan 9×9 expert | 12 | p10 65 · p50 105 · p90 127 · guesses p10/p50/p90 1/2/4 | T5×12 | 1002 ms |
| Keisan 9×9 extreme | 4 | p10 91 · p50 141 · p90 142 · guesses p10/p50/p90 6/10/12 | T5×4 | 1722 ms |

(The Keisan 9×9 rows are from a second run with the givens/guesses axis added; the other rows
are from the first run.)

## Open questions

- ~~Should classic 9×9 **medium** carry a "not naked-singles-only" gate?~~ **Decided 2026-10-03:
  yes, 9×9 only** (`applyMediumDigger`). Re-measured after the gate (12 per cell): easy
  T0×10 T1×2 · **medium T1×12** · hard T0×1 T1×7 T3×4 · expert T2×12 · extreme T3×4; medium
  generation ~2 ms. The daily's `medium` Sudoku is a slightly harder puzzle from that day on.
- Should the HumanSolver gain **Claiming** (line → box)? Without it an occasional 41-clue easy is
  "unsolvable" to the solver, and Expert necessity is judged against an incomplete basic tier.
