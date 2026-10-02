# Skyscrapers Score (`skyscrapers-score.ts`)

Two-factor within-band ordering, the same architecture as `kakuro-score.ts` and
`killer-score.ts` (Andrew Stuart's; see `Docs/research/killer-difficulty-grading-systems.md`):
`final = raw × densityFactor`, where `raw` is the sum of per-technique weights × how often each
fired, and the density factor (`2 / (1 + avgOpenSingles / 2)`, clamped to [0.5, 2]) scales up a
bottlenecked solve and down an open one (Pelánek's dependency structure: a puzzle with one
available move at a time is harder than one with many, at equal technique).

The weights are **seeded from the ladder order** (plan E2: "re-fit in E5"): the one-move clue
rules are near-free (0.2–0.3 — the opening every player makes), a small line scan 0.6, the
clue-2 patterns, reachability and a one-line enumeration routine (1.2 / 1.5 / 1.6), the long
line filter and the Latin subsets are where a hard puzzle lives (3.0–3.4), the X-wing 5.0, and a forcing chain 8.0 — priced like Sudoku Explainer's chains.
Only the ratios matter: bands are relative cuts over measured distributions, recalibrated whenever
weights change. The grade (hardest tier) stays the primary band; this score orders puzzles inside
it, so a grindy tier-3 can outrank a breezy tier-4.

```text
scoreSkyscrapersSolve(result):
    raw = Σ TECHNIQUE_WEIGHTS[t] × result.techniqueCounts[t]
    densityFactor = clamp(2 / (1 + result.avgOpenSingles / 2), 0.5, 2)
    → { raw, densityFactor, final: raw × densityFactor }
```

On the served fixtures (after the E3 re-tier of the line scan): 5×5 **13.2** (raw 10.4 × 1.27),
6×6 **139.3** (94.7 × 1.47), 7×7 **100.6** (81.0 × 1.24) — the 6×6 outranks the bigger 7×7 within the extreme band because it
needed twice the chains and was more bottlenecked, which is exactly the ordering the two factors
exist to express. A test pins the chain-tier 7×7 above the small-scan-tier 5×5.
