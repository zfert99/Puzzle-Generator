# Human Solver: Plain English Pseudocode

This document is the pseudocode companion to [`human-solver.ts`](./human-solver.ts). Unlike the standard `sudoku.ts` backtracking solver which uses brute-force guessing, the `HumanSolver` uses pure logical deduction — guaranteeing that any puzzle it solves can be solved by a human without guessing.

---

## Types

```text
Cell           = { r, c }              // A row/column coordinate on the grid
CandidateCell  = { r, c, cands[] }     // A Cell plus its sorted list of remaining candidates
```

---

## Class: HumanSolver

### Properties

The solver's state is deliberately split into two mutable structures that evolve
together — `grid` (what is placed) and `candidates` (what remains possible) — plus
a set of immutable geometry fields derived once from the grid's length. Deriving
`size`/`boxWidth`/`boxHeight` from the grid rather than hard-coding 9 is what lets
the exact same engine solve 4x4, 6x6, and 9x9 boards without branching. **Size guard
(K0):** the constructor accepts ONLY the box-Sudoku sizes 4/6/9 and throws otherwise.
The old catch-all `else` silently assumed 3×3 boxes for any other size, which would
quietly mis-solve a boxless 5×5/7×7 KenKen grid. HumanSolver is a box-Sudoku solver;
KenKen writes its own row/col technique functions and must never route through it, so
an unsupported size is a programming error, not a grid to guess at. The
`filledCount` counter exists purely so `isSolved()` is O(1) instead of rescanning
the whole grid on every deduction loop — a hot path run thousands of times per
generated puzzle. The `usedAdvanced`/`usedExtreme` flags are how a solve run
reports back *which tier of difficulty the puzzle actually demanded*, which is the
signal the generator uses to rate difficulty.

```text
grid[][]           : NxN array of numbers (0 = empty)
candidates[][]     : NxN array of bitmasks — bit (n-1) set means digit n is still possible
                     (accessed via candidateCount / hasCandidate / removeCandidate / candidateList)
size               : grid dimension (4, 6, or 9) — inferred from grid length; anything else throws (K0)
boxWidth           : columns per box (2, 3, or 3)
boxHeight          : rows per box (2, 2, or 3)
numBoxes           : total boxes = size
numHouses          : size * 3 (rows + cols + boxes)
totalCells         : size * size
usedAdvanced       : boolean flag — true if X-Wing, Swordfish, Y-Wing, or XYZ-Wing was used
usedExtreme        : boolean flag — true if W-Wing, ALS-XZ, or AIC was used
filledCount        : private counter — incremented by placeNumber(), enables O(1) isSolved()
```

---

## 1. Helper Methods

### Candidate bitmask accessors

Candidates are stored as one integer per cell (bit `n-1` set means digit `n` is
still possible). Strategies never touch the raw mask; they go through these four
accessors, which keep the bit-twiddling in one place and let the representation
stay an implementation detail. The `popcount` (Brian Kernighan's algorithm) behind
`candidateCount` is why "how many candidates does this cell have?" is O(set bits)
instead of the O(grid size) it was under the old `Set<number>[][]`.

```text
candidateCount(r, c)          → number of set bits in the cell's mask
hasCandidate(r, c, num)       → is bit (num-1) set?
removeCandidate(r, c, num)    → clear bit (num-1); RETURN true if it was set (state changed)
candidateList(r, c)           → ascending array of the cell's candidate digits
```

### findAndPlaceHiddenSingle() → boolean

Places the first Hidden Single found and returns true, else false. A hidden single
is a digit with exactly one legal position within some house (row, column, or box).
This lives on the solver (not in `strategies/basic.ts`) because it owns the bitmask
and the reused scratch buffers. It is the deduction loop's hottest strategy, so it
avoids the naive `3 × size` full-grid scans in favour of a single tallying pass —
the change that brought the Basic tier under its target (see `basic.md`).

```text
Reset the reused count buffer (indexed by globalHouse * size + digitIndex).
FOR each empty cell (r, c):
    Determine its row-house, column-house, and box-house.
    FOR each candidate digit d in the cell (iterate the bitmask directly):
        Increment count for each of the three houses at digit d; record the cell.
FOR each (house, digit) entry:
    IF its count == 1 → that digit has one home in that house: placeNumber, RETURN true.
RETURN false
```

### inSameBox(cell1, cell2) → boolean

```text
RETURN true IF floor(cell1.r / boxHeight) == floor(cell2.r / boxHeight)
              AND floor(cell1.c / boxWidth) == floor(cell2.c / boxWidth)
```

### sees(cell1, cell2) → boolean

```text
IF cell1 and cell2 are the same cell → RETURN false
RETURN true IF cell1.r == cell2.r           // same row
              OR cell1.c == cell2.c         // same column
              OR inSameBox(cell1, cell2)    // same box
```

### getBoxCells(boxIndex) → Cell[]

```text
startRow = floor(boxIndex / 3) × 3
startCol = (boxIndex % 3) × 3
FOR i = 0..8:
    push { r: startRow + floor(i/3), c: startCol + (i % 3) }
RETURN all 9 cells in that box
```

### getEmptyCellsInHouse(axis, houseIdx) → Cell[]

Consolidates the row/col/box iteration pattern into a single reusable helper. Returns all empty cells that still have at least one candidate within a specific house.

```text
IF axis == 'row':
    FOR c = 0..8:
        IF grid[houseIdx][c] == 0 AND candidates[houseIdx][c] is non-empty:
            push { r: houseIdx, c }
ELSE IF axis == 'col':
    FOR r = 0..8:
        IF grid[r][houseIdx] == 0 AND candidates[r][houseIdx] is non-empty:
            push { r, c: houseIdx }
ELSE (box):
    FOR each { r, c } in getBoxCells(houseIdx):
        IF grid[r][c] == 0 AND candidates[r][c] is non-empty:
            push { r, c }
RETURN cells
```

### buildHousePositions() → Cell[][]

Low-level single-pass scan that buckets every candidate by all 27 houses simultaneously. Returns a flat array of 243 cell lists. This is the data source for conjugate pairs (length === 2) and peer weak links (length > 2). Used by getConjugatePairs (for W-Wing) and directly by AIC.

```text
// Flat array indexed by (num-1)*27 + houseIndex
// Houses 0-8 = rows, 9-17 = cols, 18-26 = boxes
houseCells = array of 243 empty arrays

FOR each cell (r, c) on the grid:
    IF cell is filled → SKIP
    box = floor(r/3)*3 + floor(c/3)
    FOR each candidate num in cell:
        base = (num-1) * 27
        push {r,c} to houseCells[base + r]       // row house
        push {r,c} to houseCells[base + 9 + c]   // col house
        push {r,c} to houseCells[base + 18 + box] // box house

RETURN houseCells
```

### getConjugatePairs() → Map<number, `[Cell, Cell][]`>

Finds all conjugate pairs (strong links) across all houses, indexed by candidate number. Used by W-Wing. AIC uses buildHousePositions() directly for both strong and weak links.

```text
houseCells = buildHousePositions()

FOR num = 1..9:
    base = (num-1) * 27
    FOR h = 0..26:
        IF houseCells[base + h].length == 2:
            push pair to result[num]
RETURN result
```

### getCellsWithNCandidates(n) → CandidateCell[]

```text
FOR each cell (r, c) on the grid:
    IF cell is empty AND candidates[r][c].size == n:
        push { r, c, cands: sorted array from the Set }
RETURN matching cells
```

### getCandidatePositions(num, axis) → Cell[][]

```text
positions = array of 9 empty arrays
FOR each empty cell (r, c) that has `num` in its candidate set:
    IF axis == 'row': push to positions[r]
    IF axis == 'col': push to positions[c]
    IF axis == 'box': push to positions[boxIndex]
RETURN positions
// positions[i] = list of cells in line i that contain candidate `num`
```

### eliminateFromCellsSeeingAll(targets, cand, excludeCells?) → boolean

```text
changed = false
FOR each empty cell (r, c) on the grid:
    SKIP if cell is in excludeCells
    SKIP if cell doesn't have `cand` in its candidates
    IF cell sees EVERY cell in `targets`:
        delete `cand` from candidates[r][c]
        changed = true
RETURN changed
```

### applyFishOnAxis(num, axis, size) → boolean

*Generic fish pattern detector. Size 2 = X-Wing, Size 3 = Swordfish, Size 4 = Jellyfish.*

```text
positions = getCandidatePositions(num, axis)
getSecondary(cell) = cell.c if axis=='row', cell.r if axis=='col'

// 1. Find eligible primary lines (those with 2..size positions)
eligible = all i where 2 <= positions[i].length <= size
IF eligible.length < size → RETURN false

// 2. Try every combination of `size` eligible lines
FOR each combo of `size` lines from eligible:
    secondarySet = union of all secondary indices across the combo
    IF secondarySet.size != size → SKIP  (not a valid fish)

    // 3. Eliminate from cover secondaries in all non-fish primary lines
    FOR each sec in secondarySet:
        FOR each primary line NOT in the combo:
            IF candidates[pri][sec] has `num`:  (coordinates depend on axis)
                delete it → changed = true

RETURN changed
```

### combinations(arr, k) → number[][]

```text
Recursively generate all k-element subsets of arr.
Used by applyFishOnAxis to enumerate line groupings.
```

### applyWingPattern(pivotSize) → boolean

*Generic wing pattern detector. pivotSize 2 = Y-Wing, pivotSize 3 = XYZ-Wing.*

```text
bivalues = getCellsWithNCandidates(2)
pivots   = getCellsWithNCandidates(pivotSize)

FOR each pivot:
    // Determine target candidates Z
    IF pivotSize == 2:
        zCandidates = all numbers 1-9 NOT in pivot.cands
    ELSE:
        zCandidates = pivot.cands

    FOR each z in zCandidates:
        others = pivot.cands excluding z
        IF others.length != 2 → SKIP
        [x, y] = others

        pincer1Cands = sorted [x, z]
        pincer2Cands = sorted [y, z]

        pincer1Options = bivalues matching pincer1Cands that see the pivot
        pincer2Options = bivalues matching pincer2Cands that see the pivot

        FOR each (p1, p2) combination:
            IF p1 and p2 are the same cell → SKIP
            IF pivotSize == 2 AND p1 sees p2 → SKIP  (Y-Wing constraint)

            targets = pivotSize == 2 ? [p1, p2] : [pivot, p1, p2]
            exclude = pivotSize == 2 ? [pivot] : []
            IF eliminateFromCellsSeeingAll(targets, z, exclude) → changed = true

RETURN changed
```

### combinationsOfCells(arr, k) → Cell[][]

```text
Same as combinations() but operates on Cell objects.
General-purpose helper (ALS enumeration no longer uses it — see enumerateALS below).
```

### enumerateALS() → { cells, mask }[]

Finds every Almost Locked Set (a group of N cells in a house whose combined
candidates number exactly N+1). This is the costliest input to the extreme tier, so
it does **not** materialise all C(n, k) subsets per house. Instead it walks the
subsets as a DFS carrying the running candidate-union as a bitmask, and prunes any
branch whose union already exceeds `maxSubsetSize + 1` candidates — impossible for a
valid ALS, and the union only grows. Each returned ALS carries its candidate `mask`
so `applyALSXZ` can intersect two ALS in O(1).

```text
FOR each house (all rows, cols, boxes):
    emptyCells = empty cells in the house
    DFS(startIndex, unionMask, chosenCells):
        IF chosen ≥ 1 AND popcount(unionMask) == chosen.length + 1:
            emit { cells: chosen, mask: unionMask }        // a valid ALS
        IF chosen.length == maxSubsetSize (5): RETURN
        FOR i from startIndex:
            newMask = unionMask OR candidates[emptyCells[i]]
            IF popcount(newMask) > maxSubsetSize + 1: SKIP  // prune — branch is dead
            recurse with emptyCells[i] added
```

---

## 2. Initialization and Placement

### constructor(initialGrid)

```text
grid       = deep copy of initialGrid
candidates = 9×9 grid of Sets, each initialized to {1,2,3,4,5,6,7,8,9}

FOR each cell (r, c):
    IF grid[r][c] != 0:
        placeNumber(r, c, grid[r][c])
```

### placeNumber(r, c, num)

```text
grid[r][c] = num
filledCount++
candidates[r][c].clear()

boxStartR = floor(r/3) * 3
boxStartC = floor(c/3) * 3

FOR i = 0..8:
    candidates[r][i].delete(num)                                      // eliminate from row
    candidates[i][c].delete(num)                                      // eliminate from column
    candidates[boxStartR + floor(i/3)][boxStartC + (i % 3)].delete(num)  // eliminate from box
```

### isSolved() → boolean

```text
RETURN filledCount == 81
// O(1) check instead of scanning all 81 cells
```

---

## 3. Main Solving Loop

### solve(options: { maxTier }) → { solved, requiresAdvanced, requiresExtreme }

```text
changed = true

WHILE changed AND NOT isSolved():
    changed = false

    // --- BASIC STRATEGIES (Easy / Medium / Hard) ---
    IF applyNakedSingle()    → changed=true, CONTINUE
    IF applyHiddenSingle()   → changed=true, CONTINUE
    IF applyNakedPair()      → changed=true, CONTINUE
    IF applyHiddenPair()     → changed=true, CONTINUE
    IF applyPointingPairs()  → changed=true, CONTINUE

    IF options.maxTier == 'basic' → BREAK

    // --- ADVANCED STRATEGIES (Expert) ---
    IF applyXWing()    → usedAdvanced=true, changed=true, CONTINUE
    IF applySwordfish() → usedAdvanced=true, changed=true, CONTINUE
    IF applyYWing()    → usedAdvanced=true, changed=true, CONTINUE
    IF applyXYZWing()  → usedAdvanced=true, changed=true, CONTINUE

    IF options.maxTier == 'advanced' → BREAK

    // --- EXTREME STRATEGIES (Extreme / Impossible) ---
    IF applyWWing()  → usedExtreme=true, changed=true, CONTINUE
    IF applyALSXZ()  → usedExtreme=true, changed=true, CONTINUE
    IF applyAIC()    → usedExtreme=true, changed=true, CONTINUE

RETURN { solved: isSolved(), requiresAdvanced, requiresExtreme }
```

---

## 4. Basic Strategies

The basic strategies (Naked/Hidden Singles, Naked/Hidden Pairs, Pointing Pairs) have been extracted to their own module.
For their pseudocode, please see [`basic.md`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/basic.md).

---

## 5. Advanced Strategies

The advanced strategies (X-Wing, Y-Wing, Swordfish, XYZ-Wing) have been extracted to their own module.
For their pseudocode, please see [`advanced.md`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/advanced.md).

---

## 6. Extreme Strategies

The extreme strategies (W-Wing, ALS-XZ, AIC) have been extracted to their own module.
For their pseudocode, please see [`extreme.md`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/extreme.md).

---

## 7. Exported Utility Functions

### canHumanSolveExpert(grid) → boolean

Used by the puzzle generator to verify a puzzle qualifies as "Expert" difficulty — solvable by logic alone, and requiring at least one advanced strategy (X-Wing, Swordfish, Y-Wing, or XYZ-Wing).

```text
solver = new HumanSolver(grid)
result = solver.solve({ maxTier: 'advanced' })
RETURN result.solved AND result.requiresAdvanced
```

### canHumanSolveExtreme(grid) → boolean

Used by the puzzle generator to verify a puzzle qualifies as "Extreme" difficulty — solvable by logic alone, and requiring at least one extreme strategy (W-Wing, ALS-XZ, or AIC).

```text
solver = new HumanSolver(grid)
result = solver.solve({ maxTier: 'extreme' })
RETURN result.solved AND result.requiresExtreme
```
