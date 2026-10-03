# Difficulty-Separation Report (`difficulty-separation.ts`)

Does each puzzle type's ladder actually step up, at every size it is offered at?

## Why it exists

**Why:** "The generator was asked for hard" and "the puzzle is hard" are different claims, and
until October 2026 nothing measured the second one across sizes: the site-wide pass found that
38 of 40 classic "Expert" puzzles solved with basic strategies, and the small sizes (4×4, 5×5,
6×6, 7×7) had never been graded at all. This script generates a sample for every
(type, size, tier), grades each puzzle with the engine's **own** logical solver and two-factor
scorer, and prints the distribution — so adjacent tiers are compared on the axis the generator
itself uses, not on wall-clock or guesswork.

It is a distribution report, not a timing row: it prints a Markdown table to stdout and does
**not** append to `benchmark-logs.md`.

```bash
npx tsx src/features/engine/benchmarks/difficulty-separation.ts [count] [type]
# count: puzzles per cell (default 10; expert/extreme cells use fewer)
# type:  classic | killer | keisan | kakuro | skyscrapers — prefix filter, optional
```

## What each column means

```text
score p10 · p50 · p90   the engine's two-factor score (Killer/Keisan/Kakuro/Skyscrapers)
                        — for Classic, the CLUE COUNT (lower is harder; quota tiers)
extra axis              Keisan 9×9 only: `givens` (single-cell cages) for easy/medium/hard,
                        `guesses` (bounded-recursion steps) for expert/extreme — the axes the
                        9×9 config separates on, which the score cannot see
solver tiers            how many puzzles graded at each tier (Classic: T0 = naked singles
                        alone finish it, T1 basic, T2 advanced, T3 beyond advanced)
avg gen                 generation time per puzzle, for context only
```

## How to read it — the design behind each ladder

- **Classic 4×4 / 6×6 and 9×9 easy–hard are clue-quota tiers**, not technique tiers: the
  digger removes a fixed number of clues and checks only uniqueness. Separation is in clue
  count (4×4: 9 / 6 / 4; 6×6: 20 / 16 / 10; 9×9: 41 / 31 / 26) and in how far naked singles
  alone get you. Expert and Extreme are technique-gated (advanced / extreme strategies
  genuinely required — enforced since October 2026).
- **Killer, Kakuro, Skyscrapers** separate on the logical solver's hardest tier plus a score
  band; adjacent tiers should show different `T` numbers and (mostly) disjoint p10–p90 ranges.
- **Keisan** separates on different axes per size: 4×4 and 6×6 on score bands; **9×9 easy /
  medium / hard on single-cell givens** (13–22 / 7–11 / 1–3, and easy drops ×), and **expert /
  extreme on guess-step count** (≤ 5 / ≥ 6) — by design, because the solver's score overlaps
  across the 9×9 givens-defined tiers (`DIFFICULTY_CONFIG_9` in `calc-sudoku.ts`). The
  `givens`/`guesses` column is the one to read there, not the score.

## Known gaps

- The Classic T3 bucket means "the HumanSolver could not finish at the advanced tier". Before
  Claiming joined the basic ladder (October 2026) that included puzzles needing a technique the
  solver lacked, and an occasional easy 9×9 landed there; it should now hold only genuinely
  extreme puzzles.
- Samples are unseeded, so rows differ run to run; 12 per cell is enough to read the shape of a
  tier, not to recalibrate a band. Use the generator's own seeded tests for that.
