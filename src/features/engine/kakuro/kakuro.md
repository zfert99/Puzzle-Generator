# Kakuro entry point (`kakuro.ts`)

`generateKakuro(difficulty, { gridSize })` — what `/api/puzzle` calls, the counterpart of
`generateKillerSudoku` / `generateCalcSudoku`. Plan slice **E4** ships this file in its *thin*
form; **E5** rewrites the inside without changing the contract.

## What it promises

A playable, unique Kakuro at the requested size, **labelled with the tier the classifier
assigned** — never the request dressed up as a grade (plan decision D8). Where the budget
allows, that tier is the one asked for.

## How E4 gets there: bounded rejection

```text
repeat up to `attempts` times, within `timeBudgetMs`:
  puzzle = generateUniqueKakuro(size, density for the size)      ← fresh, unique, classifier-graded
  if its tier is the one requested → return it            (source: generated)
  else remember it if its tier is the nearest so far
budget spent:
  a baked fixture of the exact tier at this size, if one exists  (source: fixture — 7×7 / 9×9)
  else the nearest-tier puzzle generated, with its real label     (source: nearest — 6×6)
```

The request's clock is one clock: each attempt is handed what is left of `timeBudgetMs` (and
threads it into every repair), and the fixture-less last resort gets one more budget of the
same length — so a call is bounded by `2 × timeBudgetMs` by construction, not by adding up caps
(a review finding).

Why this works for most of the ladder and not all of it: the natural tier distribution of
unique puzzles at these densities is hard-heavy (research findings §3c and the E4
measurements — roughly hard 45%, expert 25%, extreme 15%, medium 10%, easy 1–3%). Hard, expert
and extreme land in one or two tries; medium in a handful; **easy usually exhausts the
budget** and falls back. At 7×7 and 9×9 the fallback is the same baked easy puzzle every time —
exactly what the board served before E4, so nothing regressed; at 6×6 there is no fixture, so
an easy request can come back labelled medium or hard. The route logs `source`, so the
fallback rate per tier and size is measurable in production, which is the input E5 needs.

## What E5 changes

The classifier moves *into* the repair objective (search for a tier instead of waiting for
one), `DIFFICULTY_CONFIG` grows per-tier density bias and score bands from measured
distributions, and the fallback goes away. `DIFFICULTY_CONFIG` here is the E4 starting point:
one density per size, the band where repair converges fast (6×6 0.40, 7×7 0.37, 9×9 0.38).

## Sizes

`KAKURO_SIZES = [6, 7, 9]` (D6′): the 6×6 mini, 7×7, the 9×9 standard. 13×13 is deferred
(findings §3f).
