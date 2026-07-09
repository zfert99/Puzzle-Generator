# Diggers

This module is responsible for transforming a fully solved Sudoku grid into a playable puzzle by selectively removing clues ("digging"). Different difficulties require fundamentally different digging strategies.

## `countSolutions(grid, config, limit)`

**Why:** A valid Sudoku puzzle must have exactly ONE unique solution. The standard diggers (Easy/Medium/Hard) use this brute-force backtracking solver to verify uniqueness after every clue removal. We set a limit (default 2) because counting all 500 solutions for a sparse grid would crash the browser; the moment we see a second solution, we know the puzzle is invalid and can abort early.

```text
Initialize a counter to 0.

Define a recursive solve function:
  If the counter has reached the limit, stop early.
  For every cell in the grid:
    If the cell is empty:
      For every possible number from 1 to maxNum:
        If placing the number is valid:
          Place the number in the cell.
          Call the solve function recursively.
          Remove the number (backtrack).
      Return from the function because we must try the other branches.
  If the loop finishes without finding an empty cell, increment the counter.

Start the recursion with the initial grid.
Return the counter.
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
