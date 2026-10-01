# Kakuro entry point (`kakuro.ts`)

`generateKakuro(difficulty, { gridSize })` and `generateKakuroBatch(counts, { gridSize })` —
what `/api/puzzle` and `/api/generate` call, the counterparts of `generateKillerSudoku` /
`generateKillerBatch`. Plan slice **E5** (October 2026) gave this file its final form; E4 had
shipped it thin.

## What it promises

A fresh, unique Kakuro at the requested size **and at exactly the requested tier**, labelled
by the classifier — the label is re-derived from the finished puzzle, never taken from the
request (plan decision D8). It throws when the budget runs out without one; measured at 0
failures in 1,500 puzzles across the sizes, so a throw is a fault (a budget far too small, or a
regression), not a path the routes expect.

## How: the classifier in the objective

```text
puzzle = generateUniqueKakuro(size, density for the size, targetTier = tier of the difficulty)
          = layout → fill → repair-to-unique → walkToTier → exact verify → classifier label
```

`walkToTier` (in `kakuro-generator.ts`) hill-climbs the unique puzzle, keeping it unique, until
the logical solver's hardest tier is the one asked for — shedding above-tier steps one by one to
get easier, or making the tier-below ladder leave more undecided to get harder. That is what
makes **easy reachable**: it is 1–3% of natural output, so E4's bounded rejection almost always
fell back to a fixture for it. E5 removed the fallback and the fixtures from the serving path.

One clock: layout, fill, repair and the walk share `timeBudgetMs` (default 20 s, far above any
measured need), so a call is bounded by construction. **A batch shares one budget too**
(`generateKakuroBatch`, default 45 s — inside `/api/generate`'s 60 s `maxDuration` with the
PDF render to spare): each puzzle is handed what is left, and when it runs out the batch throws
rather than letting the function time out with a booklet half-built (a review finding: 50
puzzles × a 20 s per-call budget was bounded only at 1 000 s). The share is fair, not
winner-takes-all: each puzzle may run to four times the average share of what is left (at least
5 s), a puzzle that misses its share is retried on the next, and only the batch's own clock
running out is the error — a typed one (`isKakuroBudgetError`, `error.name ===
'KakuroBudgetError'`) that `/api/generate` turns into a **503 with "ask for fewer puzzles"**
rather than a generic 500 (review follow-up 8). At the measured averages a full 50-puzzle 9×9
batch is ~15–30 s on the dev machine.

## Why no per-tier density, and no score bands

`DIFFICULTY_CONFIG` is one density per size (6×6 0.40, 7×7 0.37, 9×9 0.38 — the band where
repair converges fast, findings §3b). The plan anticipated per-tier layout bias and score bands
from measured distributions; neither was needed:

- the tier walk reaches every target from the natural distribution in well under a second at
  every size (benchmark table in `kakuro-generator.md`), so density stays the size knob E3 found;
- tiers are the solver's **ordinal** levels — the weakest technique level that finishes the
  puzzle (D5′, G9) — not a weighted score, so there are no bands to calibrate. The scorer
  (`kakuro-score.ts`) orders puzzles *within* a tier for the dev badge and, later, the daily.

## Sizes

`KAKURO_SIZES = [6, 7, 9]` (D6′): the 6×6 mini, 7×7, the 9×9 standard. 13×13 is deferred
(findings §3f).

## Measured (E5)

| Size | easy | medium | hard | expert | extreme |
|---|---|---|---|---|---|
| 6×6 | 51 ms | 104 | 37 | 60 | 72 |
| 7×7 | 401 | 158 | 283 | 403 | 124 |
| 9×9 | 265 | 528 | 365 | 191 | 773 |

`benchmark-kakuro.ts`, 10 per cell, averages; the 9×9 row swings run to run (repair-plateau
tails). Soundness fuzz: 500 generated puzzles per size through the solver, 0 unsound steps, 0
label mismatches.
