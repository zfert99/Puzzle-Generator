# Diggers

This module is responsible for transforming a fully solved Sudoku grid into a playable puzzle by selectively removing clues ("digging"). Different difficulties require fundamentally different digging strategies.

## `countSolutions(grid, config, limit)`

**Why:** A valid Sudoku puzzle must have exactly ONE unique solution. The standard diggers (Easy/Medium/Hard) call this after every clue removal, so it is a hot path. It uses the same **bitmask + MRV backtracking** as `fillGrid` (see `grid-utils.md`): O(1) legality tests via row/column/box bitmasks and always branching on the most-constrained empty cell first. We set a limit (default 2) because counting all solutions for a sparse grid would be a massive waste of CPU; the moment we see a second solution the puzzle is non-unique and we abort early.

```text
Seed rowMask/colMask/boxMask from the grid's existing clues.
Initialize a counter to 0.

solve():
  If the counter has reached the limit, stop early.
  MRV scan over empty cells: allowed = full & ~(rowMask | colMask | boxMask).
    If any empty cell has 0 allowed digits → dead end, return.
    Pick the empty cell with the fewest allowed digits (stop early on a forced single).
  If there were no empty cells → a complete solution; increment the counter and return.
  For each allowed digit of the chosen cell:
    Place it and set the row/column/box mask bits.
    Recurse.
    Backtrack: clear the cell and mask bits.
    If the counter reached the limit, return.

Start the recursion and return the counter.
```

## `applyExhaustiveDigger(grid, config)`

**Why:** Used for Expert puzzles. Brute-force uniqueness is not enough for higher difficulties — a puzzle might be unique, but require guessing. We must guarantee that a *human* can solve it using pure logic. We iterate through every single cell and try to remove it, verifying solvability with the `HumanSolver` at each step.

```text
Create an array of all cell positions and shuffle it.
For each position in the shuffled array:
  Calculate the row and column.
  Save the current value of the cell.
  If it's already empty, continue.
  Set the cell to empty.
  Create a copy of the modified grid.
  Run the HumanSolver on the copied grid (up to the 'advanced' tier).
  If the solver fails to completely solve the grid:
    The removal made the puzzle too hard (requires guessing).
    Put the saved value back into the cell.
```

## `applyQuotaDigger(grid, difficulty, config)`

**Why:** Used for Easy, Medium, and Hard puzzles. These difficulties just need a specific number of clues removed to feel right. It's much faster to randomly poke holes and check brute-force uniqueness than to run the full `HumanSolver` simulation.

```text
Determine the target number of clues to remove based on the grid size and difficulty.
Set an attempts counter to 0.
While we still need to remove clues AND we haven't failed 100 times:
  Pick a random row and column.
  If the cell is already empty, pick again until we find a filled cell.
  Save the value and empty the cell.
  Create a copy of the grid.
  If countSolutions on the copy returns exactly 1:
    The puzzle is still unique!
    Decrement the number of clues to remove.
  Else:
    Removing the clue created multiple solutions.
    Restore the saved value.
    Increment the attempts counter.
```

## `applyExtremeDigger(grid, solution, config)`

**Why:** Extreme puzzles must explicitly *require* advanced techniques (like AICs). Standard exhaustive digging often results in Expert puzzles by chance. We wrap the exhaustive digger in a retry loop: if the resulting puzzle doesn't actually trigger the extreme logic paths in our solver, we throw it away and start over with a fresh solution grid.

```text
Loop up to 50 times (MAX_RETRIES):
  If this is a retry attempt (not the first loop):
    Generate a completely new solved grid and overwrite the current grid and solution.
  
  Run the exact same logic as applyExhaustiveDigger (shuffle positions, try removing each one).
  When testing removals, use the full HumanSolver (all tiers).

  Once all possible clues are removed:
    Call canHumanSolveExtreme to verify the puzzle ACTUALLY requires extreme strategies.
    If it does:
      Return immediately (success).
      
  If it doesn't, the loop continues to the next attempt.
```
