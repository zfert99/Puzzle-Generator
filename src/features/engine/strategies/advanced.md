# Advanced Strategies: Plain English Pseudocode

This document is a pseudocode companion to [`advanced.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/advanced.ts).

---

## 1. applyXWing(solver) → boolean — Fish Size 2

Look for a specific candidate. If there are exactly TWO rows where this candidate can be placed, AND those placements align in the exact same TWO columns, they form a perfect rectangle (an "X" shape). Since the candidate must be placed in diagonally opposite corners of this rectangle, it is guaranteed to occupy both of those columns. We can therefore eliminate the candidate from all OTHER rows in those two columns. The same logic applies in reverse (2 columns aligning into 2 rows). Delegates to `applyFishOnAxis` with `size = 2`.

*Example: Candidate 4 can only go in columns 2 and 7 within rows 1 and 5. The 4 must occupy two of those four intersections. Eliminate 4 from all other rows in columns 2 and 7.*

```text
FOR each number 1-9:
    IF solver.applyFishOnAxis(num, 'row', 2) → changed
    IF solver.applyFishOnAxis(num, 'col', 2) → changed
RETURN changed
```

## 2. applyYWing(solver) → boolean — Wing Pattern, pivotSize 2

Requires three bivalue cells. A "Pivot" cell with candidates {A, B}, and two "Pincer" cells with candidates {A, C} and {B, C}. The pivot must "see" both pincers, but the pincers must NOT see each other. The logic: if the pivot is A, Pincer 1 becomes C. If the pivot is B, Pincer 2 becomes C. Either way, one of the two pincers MUST be C. Therefore, any cell that sees BOTH pincers can never be C — we can eliminate C from those cells. Delegates to `applyWingPattern` with `pivotSize = 2`.

```text
RETURN solver.applyWingPattern(2)
```

## 3. applySwordfish(solver) → boolean — Fish Size 3

An extension of X-Wing from 2 lines to 3. Look for a candidate that appears in exactly 2–3 positions within 3 different rows, and where ALL those positions fall into exactly 3 columns. The candidate must occupy one cell per column within those 3 rows, forming a closed loop. We can eliminate it from all other rows in those 3 columns. Also checks column-based Swordfish. Delegates to `applyFishOnAxis` with `size = 3`.

```text
FOR each number 1-9:
    IF solver.applyFishOnAxis(num, 'row', 3) → changed
    IF solver.applyFishOnAxis(num, 'col', 3) → changed
RETURN changed
```

## 4. applyXYZWing(solver) → boolean — Wing Pattern, pivotSize 3

A more complex variant of the Y-Wing. The "Pivot" cell has THREE candidates {A, B, C}, and the two "Pincer" cells have {A, C} and {B, C} respectively. Both pincers must see the pivot. The logic: if Pivot is A, Pincer 1 becomes C. If Pivot is B, Pincer 2 becomes C. If Pivot is C, it IS C. In every scenario, one of these three cells is definitely C. Because the pivot itself could be C, the elimination zone is more restricted than Y-Wing: candidate C can only be removed from cells that simultaneously see ALL THREE cells (the pivot AND both pincers). Delegates to `applyWingPattern` with `pivotSize = 3`.

```text
RETURN solver.applyWingPattern(3)
```
