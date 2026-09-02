# Deduction Enumerator: Plain English Pseudocode

This document is a pseudocode companion to [`deductions.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/deductions.ts).

## Why this file exists

`HumanSolver.solve()` is a **stepper**: it tries strategies cheapest-first, applies the first one
that fires, and restarts. That is exactly right for rating difficulty and for the generator's
hot loop, but it cannot answer "what are *all* the moves available in this position?" — it only
ever knows the first one.

A hint agent needs the full list. More importantly, an **eval harness** for that agent needs a
ground truth to grade claimed hints against: *does the deduction the model named actually exist
in this state?* This file is that oracle. It never mutates the solver it inspects.

Built for the hint-agent weekend (see `src/features/hint-agent/`), September 2026.

## Data shape

A `Deduction` is one technique application: a `strategy` label (e.g. `"Hidden Single"`), its
`tier` (`basic` / `advanced` / `extreme`), and **either** `placements` **or** `eliminations`,
never both. A placement's ripple eliminations are consequences of the placement, so reporting
them would double-count. Hidden singles also carry the `house` that forces them (`"row 3"`,
1-indexed) because that is the natural hint phrasing.

`STRATEGY_NAMES` exports every label the enumerator can emit, so a grader can check a claimed
technique name against the closed set.

## 1. cloneSolver(solver) → HumanSolver

**Why copy candidates, not just the grid:** constructing a `HumanSolver` from a grid rebuilds
candidates from scratch, which forgets every elimination made so far. A mid-solve state cloned
that way would report deductions that were already taken, or miss ones that eliminations
enabled. So the clone copies the candidate bitmasks cell-by-cell after construction.

```text
clone = new HumanSolver(solver.grid)        // sets grid, filledCount, and box geometry
FOR each cell: clone.candidates[r][c] = solver.candidates[r][c]
RETURN clone
```

## 2. listDeductions(solver) → Deduction[]

**Strategy:** singles are enumerated per cell (any one of them is a correct hint). Every other
technique is run on its own clone and the candidate bitmasks are diffed. Advanced and extreme
techniques are skipped for non-9×9 grids, mirroring the solve loop.

**Trade-off — one deduction per elimination strategy, not per instance:** the strategy
functions (`applyNakedPair`, `applyXWing`, …) apply *every* instance they find in a single call.
Splitting per instance would mean reimplementing each technique's search. For grading a hint,
the union is enough: a claimed elimination is valid if it appears in that strategy's set.

```text
IF solver.isSolved(): RETURN []
deductions = listNakedSingles(solver) ++ listHiddenSingles(solver)
FOR each elimination strategy (cheapest-first order):
    IF strategy is 9×9-only AND solver.size ≠ 9: skip
    clone = cloneSolver(solver)
    IF NOT strategy.apply(clone): skip
    eliminations = diffEliminations(solver, clone)
    IF eliminations is empty: skip          // defensive; apply() returning true implies a change
    deductions.push({ strategy, tier, placements: [], eliminations })
RETURN deductions
```

## 3. listNakedSingles(solver)

A cell with exactly one candidate left. The solver already indexes these.

```text
FOR each cell in solver.getCellsWithNCandidates(1):
    emit { "Naked Single", basic, placements: [that cell + its only candidate] }
```

## 4. listHiddenSingles(solver)

A digit with exactly one legal position in some house. `findAndPlaceHiddenSingle` is not reused
because it places the first one and stops; this scans every (axis, house, digit) explicitly.
The same cell/digit can be forced by more than one house — it is reported once, with the first
house found (row before column before box).

```text
seen = ∅
FOR axis in [row, col, box]:
    FOR house in 0..size-1:
        cells = empty cells in that house
        FOR digit in 1..size:
            spots = cells where digit is still a candidate
            IF |spots| ≠ 1: continue
            key = (r, c, digit); IF key ∈ seen: continue
            emit { "Hidden Single", basic, placements: [spot + digit], house: "axis house+1" }
```

## 5. diffEliminations(before, after)

Bitmask diff: a candidate that was set before and is clear after was eliminated.

```text
FOR each cell:
    removed = before.candidates[r][c] AND NOT after.candidates[r][c]
    FOR each digit whose bit is in removed: emit { r, c, digit }
```

## Tests

`deductions.test.ts` grades the enumerator against the generator's own solution: every placement
must equal the solution digit, and no elimination may remove the solution digit, at **every
step** of a walk from the initial grid to solved, across easy/medium/hard/expert 9×9 and an
easy 6×6. It also checks the enumerator does not mutate its input and that `cloneSolver`
preserves eliminations.
