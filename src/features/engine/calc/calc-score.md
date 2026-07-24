# Keisan Difficulty Score (`calc-score.ts`)

Two-factor difficulty scoring — the same architecture as Killer's `killer-score.ts` (Andrew
Stuart's model): a puzzle's difficulty is BOTH how much weighted work it demands AND how
bottlenecked that work is.

```text
raw          = Σ weight(technique) × times-it-fired      (total sophistication-weighted work)
densityFactor = clamp(2 / (1 + avgOpenSingles / 2), 0.5, 2)   (bottlenecked ↑, open ↓)
final        = raw × densityFactor
```

## Why the score matters more here than in Killer

K3 measured that most small-cage Keisan puzzles solve at tiers 1–2, so the **tier ceiling barely
separates difficulties** — the score does the real work. The generator (K4) uses the hardest tier
only as a ceiling and cuts the easy/medium/hard bands from the **score** distribution.

## Weights

On a Sudoku-Explainer-ish scale; ratios matter more than absolutes (bands are relative cuts over
measured distributions, recalibrated whenever weights change):

| Technique | Weight | Rationale |
|---|---|---|
| `cageArithmetic` | 1.0 | Foundational; fires constantly, weighted like a basic elimination. |
| `nakedSingle` | 0.2 | Cheapest placement. |
| `hiddenSingle` | 0.5 | Slightly more work than a naked single. |
| `nakedPair` | 3.0 | Classic subset. |
| `hiddenPair` | 3.4 | Slightly harder to spot than a naked pair. |
| `cageComboRestriction` | 4.5 | Multi-cell cage reasoning (≈ Killer's multi-cell innies/outies). |
| `lineSum` | 3.5 | Whole-line invariant (Rule of 21). |
| `xWing` | 3.2 | Classic fish. |

## Density factor

`2 / (1 + avgOpen / 2)`, clamped to `[0.5, 2]`: a grid averaging 0 open singles per pass (every
step must be earned) doubles its raw score; one averaging 6+ (moves everywhere) halves it. Monotone,
gentle, centred near 1 at `avgOpen ≈ 2`. Only monotonicity is load-bearing — the actual band
thresholds are calibrated against measured distributions, not the exact curve.
