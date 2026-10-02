# Skyscrapers entry point (`skyscrapers.ts`)

`generateSkyscrapers(difficulty, { gridSize })` and `generateSkyscrapersBatch(counts, { gridSize })`
— what `/api/puzzle` and `/api/generate` call, the counterparts of `generateKakuro` /
`generateKakuroBatch`. Plan slice **E5** (October 2026) gave this file its final form; E4 had
shipped it with a bounded-then-fallback policy.

## What it promises

A fresh, unique Skyscrapers at the requested size **and at exactly the requested tier**, labelled
by the classifier — the label is re-derived from the finished puzzle, never taken from the request
(D7). Each size offers the tiers it can produce (`SKYSCRAPERS_TIERS_BY_SIZE`, D12): easy / medium /
hard at the 5×5 mini, the full ladder at the 6×6 standard, medium / hard / expert / extreme at the
7×7 large. The table itself lives in `skyscrapers-types.ts` (re-exported here) because the play
menu and the print form read it in the **client bundle**, and importing it from this module would
carry the generator and both solvers along (the E5 review's finding — the same class of cost the
E2 review removed). A level a size does not offer **throws a typed error**
(`SKYSCRAPERS_LEVEL_NOT_OFFERED_ERROR`, `isSkyscrapersLevelNotOfferedError` — the routes refuse it
first, with the offered list); a budget that runs out without a puzzle throws a plain error —
measured at 0 failures in the benchmark and the gate run, so that throw is a fault, not a path the
routes expect. `generateSkyscrapersDetailed` returns the puzzle **with the generator's `stats`**
(rounds drawn, repair swaps and restarts, clues kept, ms) so `/api/puzzle` can log the cost of
every served puzzle, as E4 did; `generateSkyscrapers` is the puzzle alone.

## How: the classifier in the objective, by rejection

```text
generateSkyscrapers(level, { gridSize = 6, rng, timeBudgetMs = 20 000 }):
    level not offered at the size → throw
    generateUniqueSkyscrapers({ targetTier: tierOf(level), exactTier: true, maxRounds ∞, budget })
        = per round: random Latin square → repair-to-unique (restarts) → clue removal bounded by the
          target → accept only if the classifier's tier IS the target, else next square
    null → throw
```

Where a puzzle lands is decided by the square's fully clued floor and the removal order, and a
fresh square is the cheapest way to a different landing: E4 measured the exact-hit rate per round
at 100 / 61 / 6% (5×5 easy / medium / hard), 97 / 93 / 46 / 11 / 64% (6×6) and 100 / 97 / 20 /
87% (7×7 medium–extreme), so the rare cells cost a handful of squares each. Kakuro's E5 walked a
*fill* toward its target because its objective had a gradient; here the ladder tier of a square is
a step function of which clues are blank, so rejection over squares is the honest climb.

## Why there are no per-size configs, bands or tier-flip rules (the plan's E5 list)

- **Score bands:** as for Kakuro, the tiers are the solver's ordinal levels (D6 — the weakest
  technique level that finishes the puzzle). There is nothing to band; `skyscrapers-score.ts`
  orders *within* a tier.
- **Removal-order bias per size:** `removeClues` already biases by target (trivial clues last for
  easy/medium, first for hard+); a per-size table would hold the same two words three times.
- **Tier-flip rules** (research Stage 4: demote a hard that never fires rung 6/7, promote a medium
  that does, reject any guess): they *are* the classifier — the tier is the hardest rung needed,
  and the ladder has no guessing tier.

## Why these tier sets (D12)

| size | offered | why |
|---|---|---|
| 5×5 | easy, medium, hard | hard is the rare one (8% of squares, E3b) but lands in ~40 ms; expert/extreme are locked as on every other mini |
| 6×6 | all five | every tier reachable, every cell under a second |
| 7×7 | medium, hard, expert, extreme | an easy floor is one square in fifty (3.5 s per puzzle in E4, three in four served by a fallback) — not a tier to promise |

## The batch — `generateSkyscrapersBatch(counts, { gridSize, timeBudgetMs = 45 000, minShareMs, generateOne })`

The Kakuro contract: one budget for the whole batch (inside the route's 60 s `maxDuration` with
the PDF render to spare); each puzzle is handed a fair share of what is left (up to four times the
average, at least `minShareMs` = 5 s) so one slow generation is retried rather than allowed to
starve the rest; the batch's own clock running out is the only out-of-time error
(`SKYSCRAPERS_BUDGET_ERROR`, `isSkyscrapersBudgetError`), which the route turns into a 503. A level
the size does not offer is recognised by its **typed** error and rethrown — the caller's mistake,
not a budget question (the first draft matched the message text, which a reworded throw would
have turned into a retry loop). `generateOne` is a seam for tests (the dailies service has the
same): a stand-in that misses one share proves the retry, one that throws the not-offered error
proves it is never retried.

## Measured (E5, 2026-10-02, dev machine — `benchmark-skyscrapers.ts`, 10 per cell)

| size | easy | medium | hard | expert | extreme |
|---|---|---|---|---|---|
| 5×5 | 11 ms (max 25) | 9 ms (18) | 43 ms (72) | — | — |
| 6×6 | 57 ms (131) | 32 ms (81) | 40 ms (107) | 201 ms (774) | 52 ms (93) |
| 7×7 | — | 459 ms (1,113) | 297 ms (810) | 704 ms (1,619) | 311 ms (628) |

Every offered cell averages under a second; easy / medium / hard at the standard size are 32–57 ms
against the plan's 200 ms gate. Expert is the slow cell everywhere (rare landings), as E3 and E4
said it would be.
