<!-- markdownlint-disable MD013 -->
# Human Solver: Plain English Pseudocode

This document is a thorough, line-by-line pseudocode companion to [`human-solver.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/lib/puzzle-engine/human-solver.ts). Unlike the standard `sudoku.ts` backtracking solver which uses brute-force guessing, the `HumanSolver` uses pure logical deduction — guaranteeing that any puzzle it solves can be solved by a human without guessing.

---

## Types

```text
Cell           = { r, c }              // A row/column coordinate on the 9×9 grid
CandidateCell  = { r, c, cands[] }     // A Cell plus its sorted list of remaining candidates
```

---

## Class: HumanSolver

### Properties

```text
grid[][]           : 9×9 array of numbers (0 = empty)
candidates[][]     : 9×9 array of Sets, each holding remaining possible values (1-9)
usedAdvanced       : boolean flag — true if X-Wing, Swordfish, Y-Wing, or XYZ-Wing was used
usedExtreme        : boolean flag — true if W-Wing, ALS-XZ, or AIC was used
filledCount        : private counter — incremented by placeNumber(), enables O(1) isSolved()
```

---

## 1. Helper Methods

### inSameBox(cell1, cell2) → boolean

```text
RETURN true IF floor(cell1.r / 3) == floor(cell2.r / 3)
              AND floor(cell1.c / 3) == floor(cell2.c / 3)
```

### sees(cell1, cell2) → boolean

```text
IF cell1 and cell2 are the same cell → RETURN false
RETURN true IF cell1.r == cell2.r           // same row
              OR cell1.c == cell2.c         // same column
              OR inSameBox(cell1, cell2)    // same 3×3 box
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
Used by ALS enumeration to generate cell subsets.
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

### applyNakedSingle() → boolean

The simplest strategy. If an empty cell has had all but ONE of its candidates eliminated through row/column/box constraints, that remaining candidate MUST be the answer. The method places only one number per call and returns immediately, allowing `placeNumber`'s ripple effect to create chain reactions caught in the next loop iteration.

```text
singles = getCellsWithNCandidates(1)
IF any exist:
    take the first one → placeNumber(r, c, its only candidate)
    RETURN true   // return after ONE placement to let ripple effects propagate
RETURN false
```

### applyHiddenSingle() → boolean

Sometimes a cell has multiple candidates (e.g., it could be 4, 7, or 9). However, if you look at the entire row (or column, or box) and notice that NO OTHER CELL in that house can possibly be a 7, then the 7 MUST go here. It's a "single" that's just "hidden" among other possibilities.

```text
FOR each number 1-9:
    FOR each axis (row, col, box):
        positions = getCandidatePositions(num, axis)
        FOR each zone i:
            IF positions[i] has exactly 1 cell:
                placeNumber that cell with num
                RETURN true
RETURN false
```

### applyNakedPair() → boolean

If two cells in the same house have EXACTLY the same two candidates (e.g., both are {2, 5}), then those two numbers must be split between those two cells. No other cell in that house can be a 2 or a 5, so we can safely eliminate both candidates from all other cells in the shared row, column, or box.

```text
bivalues = getCellsWithNCandidates(2)

FOR each pair (b1, b2) of bivalues:
    IF b1.cands == b2.cands:   // identical candidate sets [X, Y]
        IF same row → delete X and Y from all OTHER cells in that row
        IF same col → delete X and Y from all OTHER cells in that column
        IF same box → delete X and Y from all OTHER cells in that box

RETURN changed
```

### applyHiddenPair() → boolean

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

### applyPointingPairs() → boolean

If a specific candidate within a 3×3 box only appears in a single row (or column), then that candidate's final position for this box MUST be somewhere along that line. Because of this, the candidate cannot exist anywhere else along that same row (or column) OUTSIDE of the box. Also known as "Box-Line Reduction."

```text
FOR each number 1-9:
    boxPositions = getCandidatePositions(num, 'box')
    FOR each box b:
        cells = boxPositions[b]
        IF cells.length is 2 or 3:
            IF all cells share the same row r:
                Delete num from all cells in row r OUTSIDE this box
            ELSE IF all cells share the same column c:
                Delete num from all cells in col c OUTSIDE this box

RETURN changed
```

---

## 5. Advanced Strategies

### applyXWing() → boolean — Fish Size 2

Look for a specific candidate. If there are exactly TWO rows where this candidate can be placed, AND those placements align in the exact same TWO columns, they form a perfect rectangle (an "X" shape). Since the candidate must be placed in diagonally opposite corners of this rectangle, it is guaranteed to occupy both of those columns. We can therefore eliminate the candidate from all OTHER rows in those two columns. The same logic applies in reverse (2 columns aligning into 2 rows). Delegates to `applyFishOnAxis` with `size = 2`.

*Example: Candidate 4 can only go in columns 2 and 7 within rows 1 and 5. The 4 must occupy two of those four intersections. Eliminate 4 from all other rows in columns 2 and 7.*

```text
FOR each number 1-9:
    IF applyFishOnAxis(num, 'row', 2) → changed
    IF applyFishOnAxis(num, 'col', 2) → changed
RETURN changed
```

### applyYWing() → boolean — Wing Pattern, pivotSize 2

Requires three bivalue cells. A "Pivot" cell with candidates {A, B}, and two "Pincer" cells with candidates {A, C} and {B, C}. The pivot must "see" both pincers, but the pincers must NOT see each other. The logic: if the pivot is A, Pincer 1 becomes C. If the pivot is B, Pincer 2 becomes C. Either way, one of the two pincers MUST be C. Therefore, any cell that sees BOTH pincers can never be C — we can eliminate C from those cells. Delegates to `applyWingPattern` with `pivotSize = 2`.

```text
RETURN applyWingPattern(2)
```

### applySwordfish() → boolean — Fish Size 3

An extension of X-Wing from 2 lines to 3. Look for a candidate that appears in exactly 2–3 positions within 3 different rows, and where ALL those positions fall into exactly 3 columns. The candidate must occupy one cell per column within those 3 rows, forming a closed loop. We can eliminate it from all other rows in those 3 columns. Also checks column-based Swordfish. Delegates to `applyFishOnAxis` with `size = 3`.

```text
FOR each number 1-9:
    IF applyFishOnAxis(num, 'row', 3) → changed
    IF applyFishOnAxis(num, 'col', 3) → changed
RETURN changed
```

### applyXYZWing() → boolean — Wing Pattern, pivotSize 3

A more complex variant of the Y-Wing. The "Pivot" cell has THREE candidates {A, B, C}, and the two "Pincer" cells have {A, C} and {B, C} respectively. Both pincers must see the pivot. The logic: if Pivot is A, Pincer 1 becomes C. If Pivot is B, Pincer 2 becomes C. If Pivot is C, it IS C. In every scenario, one of these three cells is definitely C. Because the pivot itself could be C, the elimination zone is more restricted than Y-Wing: candidate C can only be removed from cells that simultaneously see ALL THREE cells (the pivot AND both pincers). Delegates to `applyWingPattern` with `pivotSize = 3`.

```text
RETURN applyWingPattern(3)
```

---

## 6. Extreme Strategies

### applyWWing() → boolean

Two identical bivalue cells (both containing candidates {A, B}) that DON'T see each other are connected by a "strong link" (conjugate pair) on candidate A in some house. A conjugate pair means the candidate appears in exactly 2 cells in that house — if one is false, the other MUST be true. The structure looks like: `BV1 {A,B} ---sees-→ [Strong Link on A: cell1 ↔ cell2] ←---sees--- BV2 {A,B}`. Because the strong link guarantees A is "true" in at least one endpoint, at least one bivalue cell is forced away from A and must resolve to B. Therefore, any cell that sees BOTH bivalue cells can safely eliminate B.

```text
bivalues = getCellsWithNCandidates(2)

// 1. Pre-index conjugate pairs (shared helper)
conjugatesByNum = getConjugatePairs()

// 2. Search bivalue pairs
FOR each pair (bv1, bv2) of bivalues:
    IF bv1.cands != bv2.cands → SKIP                 // must be identical
    IF bv1 sees bv2 → SKIP                           // would be a Naked Pair

    [candA, candB] = bv1.cands

    FOR each linkCand in [candA, candB]:
        elimCand = the OTHER candidate

        FOR each conjugate pair [cp1, cp2] in conjugatesByNum[linkCand]:
            // Check if the conjugate pair "bridges" the two bivalues:
            //   cp1 sees bv1 AND cp2 sees bv2  (or vice versa)
            IF neither bridge orientation works → SKIP
            IF cp1 or cp2 IS one of the bivalue cells → SKIP

            // At least one bivalue cell must be elimCand
            eliminateFromCellsSeeingAll([bv1, bv2], elimCand, [bv1, bv2])
            IF eliminated anything → RETURN true

RETURN false
```

### applyALSXZ() → boolean

An Almost Locked Set (ALS) is a group of N cells within a single house containing exactly N+1 candidates. If two ALS groups share a "Restricted Common Candidate" (RCC) x — meaning ALL cells containing x in Set A see ALL cells containing x in Set B — then x is "locked" between them: it can't be true in both sets simultaneously. This locks the remaining candidates in both sets, allowing any OTHER common candidate z to be eliminated from cells that see all z-locations in BOTH sets. This is one of the most powerful elimination techniques in human Sudoku solving.

```text
// 1. Enumerate all ALS groups
allALS = enumerateALS()

// 2. Check every pair of ALS groups
FOR each pair (alsA, alsB):
    IF they share any cells → SKIP

    commonCands = intersection of alsA.candidates and alsB.candidates
    IF commonCands.length < 2 → SKIP   // need RCC + elimination candidate

    // 3. Find Restricted Common Candidates (RCCs)
    // excludeCells is the same for all candidates in this pair — hoist here
    excludeCells = alsA.cells + alsB.cells

    FOR each x in commonCands:
        xInA = cells in alsA containing x
        xInB = cells in alsB containing x
        IF NOT every cell in xInA sees every cell in xInB → SKIP  // not restricted

        // x is a valid RCC → check other common candidates for elimination
        FOR each z in commonCands where z != x:
            zInA = cells in alsA containing z
            zInB = cells in alsB containing z
            allZLocations = zInA + zInB

            // Eliminate z from cells seeing ALL z-locations (excluding ALS cells)
            IF eliminateFromCellsSeeingAll(allZLocations, z, excludeCells):
                RETURN true

RETURN false
```

### enumerateALS() → { cells[], candidates: Set }[]

Enumerates all Almost Locked Sets across all houses. An ALS is defined as N cells with exactly N+1 distinct candidates. Subset size is capped at 5 cells to prevent combinatorial explosion.

```text
maxSubsetSize = 5    // caps combinatorial cost

FOR each axis (row, col, box):
    FOR each house index 0-8:
        emptyCells = getEmptyCellsInHouse(axis, houseIdx)

        FOR subsetSize = 1 to min(maxSubsetSize, emptyCells.length):
            FOR each subset of `subsetSize` cells from emptyCells:
                unionCands = union of all candidates across the subset
                IF unionCands.size == subsetSize + 1:
                    // This is an ALS! (N cells, N+1 candidates)
                    add { cells: subset, candidates: unionCands } to results

RETURN results
```

### applyAIC() → boolean

Alternating Inference Chains are the most general elimination technique in human Sudoku solving. An AIC is a chain of (cell, candidate) nodes connected by strictly alternating strong and weak links. A **strong link** means the candidate appears in exactly 2 cells in a house (a conjugate pair) — if one is false, the other MUST be true. A **weak link** connects two candidates in the same cell, or two cells in the same house with the same candidate — if one is true, the other MUST be false.

The method builds a full inference graph of all candidates, then searches for chains using BFS with strict alternation. Two chain types yield eliminations:

- **Type 2** (strong→...→strong): At least one endpoint is true. If both endpoints have the same candidate, eliminate it from cells seeing both endpoints.
- **Type 1** (weak→...→weak): Both endpoints must be false. If both endpoints are the same candidate in cells that see each other, eliminate from both.

Max chain depth is capped at 12 nodes to prevent unbounded search.

```text
MAX_CHAIN_DEPTH = 12

// ---- BUILD THE INFERENCE GRAPH ----

Each node = "r,c,num" (a specific candidate in a specific cell)

Collect active nodes AND Weak links Type A (same cell, different candidates):
    FOR each empty cell:
        FOR each candidate in that cell:
            push node to active graph
        FOR each pair of candidates in that cell:
            add bidirectional weak link

Strong links + Weak links Type B from single scan:
    housePositions = buildHousePositions()   // one scan for both link types
    FOR num = 1..9:
        FOR h = 0..26:
            cells = housePositions[(num-1)*27 + h]
            IF cells.length == 2:
                add bidirectional strong link (conjugate pair)
            ELSE IF cells.length > 2:
                add bidirectional weak link between all pairs
    Note: All strong links are ALSO added as weak links.

// ---- BFS FOR ALTERNATING CHAINS ----

FOR each startNode in the graph:
    parse startNode into {r, c, num}
    FOR each startLinkType in [strong, weak]:
        Initialize BFS queue from startNode

        WHILE queue is not empty:
            pop { node, lastLink, depth, path }
            IF depth > MAX_CHAIN_DEPTH → SKIP

            IF depth >= 4:
                parse end node into {r, c, num}

                // TYPE 2 CHAIN: strong → ... → strong
                // At least one endpoint is true
                IF startLinkType=='strong' AND lastLink=='strong':
                    IF both endpoints have the same candidate:
                        eliminate that candidate from cells seeing BOTH endpoints
                        IF eliminated → RETURN true

                // TYPE 1 CHAIN: weak → ... → weak
                // Both endpoints must be false
                ELSE IF startLinkType=='weak' AND lastLink=='weak':
                    IF same cell, same candidate (Continuous Nice Loop):
                        self-contradiction → delete the candidate → RETURN true
                    IF same candidate AND endpoints see each other:
                        delete from BOTH endpoints → RETURN true

            // Extend chain with the OPPOSITE link type (strict alternation)
            nextLinkType = opposite of lastLink
            FOR each neighbor via nextLinkType:
                IF not already in path (except start for cycle detection):
                    add to queue with depth+1

RETURN false
```

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
