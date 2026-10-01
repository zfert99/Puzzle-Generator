# Kakuro Score (`kakuro-score.ts`)

Two-factor within-band ordering, the same architecture as `killer-score.ts` (Andrew Stuart's,
see `Docs/research/killer-difficulty-grading-systems.md`): `final = raw × densityFactor`,
where `raw` is the sum of per-technique weights × how often each fired, and the density factor
(`2 / (1 + avgOpenSingles / 2)`, clamped to [0.5, 2]) scales up a bottlenecked solve and down an
open one.

The weights are **seeded from the ladder order** (plan E2: "re-fit in E5"): tier-1 work is
near-free, tier-2 routine, tier-3 is where the puzzle is, and chains (tiers 4–5) are priced like
Sudoku Explainer's forcing chains, 7 and 9. Only the ratios matter — bands are
relative cuts over measured distributions. The grade (hardest tier) stays the primary band; this
score orders puzzles inside it, so a grindy tier-2 can outrank a breezy tier-3. On the served
7×7s it orders easy < medium < hard (a test pins that).
