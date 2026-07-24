# Keisan Generator — K2 building blocks (`calc-generator.ts`)

The ungraded generation primitives for Keisan: a boxless Latin-square fill, a region-growing cage
partition, operator/target assignment, and `generateUniqueCalc` (fill → cage → assign → uniqueness
gate). Difficulty grading and the tiered pipeline are K4.

## `calcGridConfig(size)` — always boxless

Keisan is a pure Latin square at **every** size, including the box-tileable 4/6. So this returns a
config with `hasBoxes: false` and the row-strip box sentinel (`boxWidth = size`, `boxHeight = 1`) —
*not* `getGridConfig`, which would box-constrain 4/6. Feeding this to `fillGrid` (K0) yields a random
Latin square with no box constraint. (See `sudoku.md` for the sentinel; the box mask degenerates to
the row mask, so `fillGrid` needs no Keisan-specific code.)

## `generateCalcCageShapes` — region growing without the no-repeat stop

Killer's cage generator stops growing a cage when every neighbour's digit is already used (the cage
"boxes itself in"). **Keisan has no such stop** — repeats are legal — so growth terminates on the
drawn target size alone (or when no unassigned neighbour remains). Seeds are taken in scan order (so
every cell is covered and the loop terminates); each step annexes a random unassigned orthogonal
neighbour, with **no digit check**.

The plan flags "target size alone" as weaker than the reference generators, so the real quality
backstops are: the hard `maxSize` cap (here), the single-cell-cage band + `maxCombos` re-test (K4),
and the **uniqueness gate** below. The `minSize`/`maxSize`/`maxSizeBias` levers carry over from
Killer. (Measured: cages do not all run to `maxSize` — smaller cages appear from both the random
target draw and boxing-in.)

## Operator/target assignment

`assignCalcCages` turns bare cell shapes into clued `CalcCage`s:

- **Single-cell cages are givens:** `op = 'add'`, `target = the digit` (operator irrelevant).
- **Multi-cell cages** pick a random operator among those **legal for the size** (`sub`/`div`
  two-cell-only) AND — for `div` — yielding an **integer** target (`larger % smaller === 0`).
  `add`/`mul`/`sub` always produce a valid integer target.
- Returns `null` if any cage has no assignable operator (e.g. a `÷`-only set with a non-divisible
  pair). `generateUniqueCalc` regenerates rather than emit a malformed puzzle, and asserts the K1
  **legality invariant** up front (a 3+-cell cage needs `add` or `mul` in the active set) so an
  unsatisfiable operator set fails loud instead of silently wedging.

Operator choice is a difficulty axis (K4's active-operator sets: SingleOp → DualOp → QuadOp) and is
itself part of what the generate-and-test loop varies to hit uniqueness.

## `generateUniqueCalc(size, options)`

```text
assert every cage size 2..maxSize has an assignable operator (else throw — legality invariant)
repeat up to maxAttempts:
  solution = a random Latin square (fillGrid on the boxless config), or an injected one
  shapes   = generateCalcCageShapes(size, …)
  cages    = assignCalcCages(shapes, solution, { activeOps })   // null → un-cluable, retry
  if CalcSolver(cages, size).countSolutions(2, verifyNodeBudget) === 1:
    return { cages, solution, gridSize }
throw (no unique layout found)
```

This is the K2 building block; K4 wraps it with difficulty grading (a logical-solver tier + a
two-factor score) and the shape gates. RNG is injectable (`rng`) and a solution can be injected
(`solution`) for deterministic tests.
