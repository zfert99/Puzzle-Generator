# Two-Factor Difficulty Score (`killer-score.ts`)

`scoreKillerSolve(result)` turns a logical-solve trace into a difficulty score using **Andrew
Stuart's published architecture** (`Docs/research/killer-difficulty-grading-systems.md`):
`final = raw × densityFactor`. The hardest-technique tier stays the *primary* band (the
generator's `solveCap`); this score orders puzzles **within** a band.

## Why two factors

Each factor alone has a documented failure mode. Max-technique alone (Sudoku Explainer's model)
under-rates a puzzle that needs many hard-ish steps; a plain sum over-rates a puzzle that is
long but easy. Measured on our own generator: medium's grindy top quartile out-scored hard's
median before banding — a "medium" could genuinely play harder than a "hard". Stuart's fix is a
work-sum *times* an opportunity-density multiplier, which is what we implement.

## Factor 1 — weighted technique sum

Every technique application recorded by `KillerLogicalSolver.solve()` is weighted on the
**Sudoku Explainer 1.0–11.9 backbone** (the community's defensible scale, per the research),
with Killer-specific techniques slotted by SudokuWiki's ordering: single-house Rule of 45 ≈
single-cell innies (3.5), multi-unit regions ≈ multi-cell innies/outies (4.5), cage arithmetic
weighted like a foundational elimination (1.0). Cheap fills (naked/hidden singles) score near
zero so bookkeeping doesn't drown signal.

Absolute weights matter less than **ratios** — bands are relative cuts on measured
distributions (Stuart's sextile approach), so re-tuning a weight only requires re-measuring the
cuts, not defending an absolute number.

## Factor 2 — opportunity density

The solver samples, at each deduction pass, how many naked singles are *simultaneously*
available (`avgOpenSingles`). Many parallel moves = an open, forgiving grid; near zero = every
step must be earned through a bottleneck. The multiplier maps that onto `[0.5, 2]`:

```text
densityFactor = clamp(2 / (1 + avgOpenSingles / 2), 0.5, 2)
```

The shape is a pragmatic choice — monotone decreasing, centred near 1 at the observed easy-tier
norm (~2 open singles/pass), clamped so no grid more than doubles or halves its raw score. Only
monotonicity is load-bearing; the band cuts absorb the rest.

## How the generator uses it

`DIFFICULTY_CONFIG` in `killer-sudoku.ts` gives each difficulty a **disjoint** `scoreBand`
(easy < 42, medium 42–62, hard ≥ 62 — cuts placed on measured 30-sample distributions).
A candidate that solves within its tier cap but scores outside its band is rejected, exactly
like a failed shape gate. Measured result: generated scores land at easy 18–41 / medium 43–61 /
hard 64–96 with no overlap, at a modest yield cost (medium ~88 → ~117 ms, hard ~288 → ~404 ms).

**Recalibrate the cuts** (re-run the distribution sweep) whenever technique weights, shape
gates, or solver techniques change — the cuts are only meaningful relative to the generator
that produced the distribution.
