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

| Fixture | Whites | Runs |
|---|---|---|
| `KAKURO_FIXTURE_7X7` | 32 | 20 |
| `KAKURO_FIXTURE_9X9` | 55 | 38 |

Both layouts were drawn by hand to the layout rules. The digits were **not** typed by hand: a
throwaway script searched for a fill whose clues have exactly one solution (details and timings
in [kakuro-log.md](../../../../Docs/kakuro-log.md) → Measurements). The tests here check that
they are legal and self-consistent; **uniqueness is proven in-repo by `kakuro-solver.test.ts`**
(slice E1), which also checks that the one solution the solver finds is the baked one.

`difficulty` on both is a **placeholder** (`'medium'`). Nothing can grade a Kakuro until the
classifier exists (slice E2), which then assigns the real label.

Neither grid is copied from a published puzzle.
