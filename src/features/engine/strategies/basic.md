# Basic Strategies: Plain English Pseudocode

This document is a pseudocode companion to [`basic.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/basic.ts).

---

## 1. applyNakedSingle(solver) → boolean

The simplest strategy. If an empty cell has had all but ONE of its candidates eliminated through row/column/box constraints, that remaining candidate MUST be the answer. The method places only one number per call and returns immediately, allowing `placeNumber`'s ripple effect to create chain reactions caught in the next loop iteration.

```text
singles = solver.getCellsWithNCandidates(1)
IF any exist:
    take the first one → solver.placeNumber(r, c, its only candidate)
    RETURN true   // return after ONE placement to let ripple effects propagate
RETURN false
```

## 2. applyHiddenSingle(solver) → boolean

Sometimes a cell has multiple candidates (e.g., it could be 4, 7, or 9). However, if you look at the entire row (or column, or box) and notice that NO OTHER CELL in that house can possibly be a 7, then the 7 MUST go here. It's a "single" that's just "hidden" among other possibilities.

```text
FOR each number 1-9:
    FOR each axis (row, col, box):
        positions = solver.getCandidatePositions(num, axis)
        FOR each zone i:
            IF positions[i] has exactly 1 cell:
                solver.placeNumber that cell with num
                RETURN true
RETURN false
```

## 3. applyNakedPair(solver) → boolean

If two cells in the same house have EXACTLY the same two candidates (e.g., both are {2, 5}), then those two numbers must be split between those two cells. No other cell in that house can be a 2 or a 5, so we can safely eliminate both candidates from all other cells in the shared row, column, or box.

```text
bivalues = solver.getCellsWithNCandidates(2)

FOR each pair (b1, b2) of bivalues:
    IF b1.cands == b2.cands:   // identical candidate sets [X, Y]
        IF same row → delete X and Y from all OTHER cells in that row
        IF same col → delete X and Y from all OTHER cells in that column
        IF same box → delete X and Y from all OTHER cells in that box

RETURN changed
```

## 4. applyHiddenPair(solver) → boolean

The inverse of Naked Pairs. If two specific candidates (e.g., 2 and 5) are restricted to the exact same two cells within a house, then those two cells MUST contain those two numbers. All other candidates in those two cells are distractions and can be safely eliminated — effectively turning them into a Naked Pair for future passes.

```text
FOR each axis (row, col, box):
    FOR each zone i:
        Find all candidates that appear in exactly 2 cells within this zone
        FOR each pair of such candidates (numA, numB):
            IF numA and numB occupy the EXACT same 2 cells:
                // Hidden Pair found!
                Remove ALL other candidates from those 2 cells
                // This effectively turns them into a Naked Pair

RETURN changed
```

## 5. applyPointingPairs(solver) → boolean

If a specific candidate within a 3×3 box only appears in a single row (or column), then that candidate's final position for this box MUST be somewhere along that line. Because of this, the candidate cannot exist anywhere else along that same row (or column) OUTSIDE of the box. Also known as "Box-Line Reduction."

```text
FOR each number 1-9:
    boxPositions = solver.getCandidatePositions(num, 'box')
    FOR each box b:
        cells = boxPositions[b]
        IF cells.length is 2 or 3:
            IF all cells share the same row r:
                Delete num from all cells in row r OUTSIDE this box
            ELSE IF all cells share the same column c:
                Delete num from all cells in col c OUTSIDE this box

RETURN changed
```
