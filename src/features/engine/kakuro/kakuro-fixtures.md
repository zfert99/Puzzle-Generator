# Kakuro Fixtures (`kakuro-fixtures.ts`)

Hand-baked puzzles: static, known-good boards that the UI renders and later engine slices are
tested against, until a generator exists (plan slice V1 in
[kakuro-implementation-plan.md](../../../../Docs/kakuro-implementation-plan.md)).

## Why a fixture is written as its *solution*

The plan first proposed writing fixtures in puzzle form — clue cells typed as `across\down`. They
are written as the **solved interior grid** instead:

```text
'##64###'      a digit = a white cell and its answer
'#587964'      #       = a black cell
```

Everything else is derived. The clue sums come from `deriveRuns`, so a fixture has one source of
truth and cannot contain a clue that contradicts its own solution. Typing clues by hand would
mean two things to keep in agreement, and a wrong clue would look exactly like a right one.

## `parseKakuroFixture(rows, difficulty)`

```text
read each character: "#" → 0, "1".."9" → that digit, anything else → throw (naming row + column)
derive the runs from the solved grid
collect problems from validateKakuroLayout (the shape) and validateKakuroRuns (the digits)
if there are any → throw, listing all of them
return the puzzle: empty player grid, the solution, the runs, the given difficulty
```

It throws rather than returning errors because fixtures are built at **import time**: a bad
fixture should stop the module loading, so it fails every test that touches it instead of
rendering a subtly wrong board. The run validator is what catches the easiest typing mistake —
a digit repeated within a run.

## The fixtures

Two hand-drawn layouts (7×7: 32 whites, 20 runs; 9×9: 55 whites, 38 runs), each carrying
**three served fills** — easy, medium, hard — and one **chain** fill kept for tests only.

| Group | What | Difficulty |
|---|---|---|
| `KAKURO_FIXTURES` (served) | one per size × easy / medium / hard | the tier the logical ladder needs: T1 / T2 / T3 |
| `KAKURO_FIXTURE_7X7_CHAINS`, `_9X9_CHAINS` | the first fills found (V1): unique, but the T1–3 ladder stalls with ~27–29 cells undecided | `'unrated'` — E2b's chain-tier test material |

`findKakuroFixture(size, difficulty)` is what `usePuzzle` serves; `ALL_KAKURO_FIXTURES` is what
the uniqueness and soundness tests sweep.

The digits were **not** typed by hand. A throwaway hill-climb (not in the repo) mutated one cell
at a time, scoring a fill by the repo's own solvers: non-unique counts first, then "cells the
ladder leaves undecided" with the ladder capped at the target tier. Finding a 7×7 at each tier
took 0.5–2.4 s; the 9×9s took 11 s (hard), ~90 s (medium, one restart) and ~70 s (easy) — see
[kakuro-log.md](../../../../Docs/kakuro-log.md) → Measurements. The tests here check that every
fixture is legal and self-consistent, that **every served label equals what `classifyKakuro`
assigns** (so a label can never drift from the solver), and that the chain fills stay unrated;
`kakuro-solver.test.ts` proves all eight unique.

Neither grid is copied from a published puzzle.
