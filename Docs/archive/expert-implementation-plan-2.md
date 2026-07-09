# Expanding Human Solver Strategies

After reviewing the `Expert Sudoku Strategies Document.md` research file, our current `HumanSolver` covers the essential basics but misses a few key patterns explicitly outlined in the research as standard "Expert" mechanics.

Currently, we have:

- **Fish Family**: X-Wing
- **Wing Family**: XY-Wing (Y-Wing)

According to the research document, we are missing two highly foundational advanced strategies that naturally extend what we already have:

- **Swordfish**: A 3x3 extension of the X-Wing logic.
- **XYZ-Wing**: An extension of the XY-Wing that allows the pivot cell to hold 3 candidates instead of 2.

Adding these will ensure our Expert generator fully aligns with the documented research and can resolve an even wider variety of complex puzzles logically, without resorting to guessing.

## Proposed Changes

### `lib/puzzle-engine/human-solver.ts`

#### [MODIFY] `lib/puzzle-engine/human-solver.ts`

1. **Add `applySwordfish()`**:
   - Similar to `applyXWing`, but instead of finding 2 rows with a candidate in the same 2 columns, we look for 3 rows where a candidate appears in a combined maximum of 3 columns.
   - We will implement both Row-Swordfish and Column-Swordfish.
   - If a candidate is eliminated from the cover columns (or rows), it returns `true`.

2. **Add `applyXYZWing()`**:
   - Similar to `applyYWing`, but the "pivot" cell contains exactly 3 candidates (e.g., A, B, C).
   - The two "pincers" contain 2 candidates each (e.g., A, C and B, C) and both share a house with the pivot.
   - Eliminations are made for the common candidate (C) but **only** in cells that simultaneously see the pivot AND both pincers (a much smaller elimination zone than a standard Y-Wing).

3. **Update `solve()` loop**:
   - Integrate `if (this.applySwordfish())` and `if (this.applyXYZWing())` into the Advanced Strategies section of the `while` loop.

## Verification Plan

### Automated Tests

- Run `npx jest` to ensure `applyExhaustiveDigger` still correctly leverages these new strategies to generate mathematically sound Expert puzzles without breaking.
- Run `npx tsx scripts/benchmark.ts` to ensure that adding these new loops doesn't drastically harm our ~350ms generation time. Because these strategies are only checked when simpler strategies fail, performance impact should be minimal.

## User Review Required

> [!IMPORTANT]
> The research also mentions extreme techniques like **W-Wing**, **Almost Locked Sets (ALS)**, and **Alternating Inference Chains (AICs)**. I am purposely leaving these out for now because they are highly computationally expensive and significantly increase codebase complexity. Swordfish and XYZ-Wing are the immediate "sweet spot" for ROI. Do you agree with this scope, or do you want me to attempt AICs as well?
