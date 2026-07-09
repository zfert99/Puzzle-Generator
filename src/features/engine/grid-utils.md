# Grid Utils

This module provides pure, stateless utility functions for manipulating and verifying Sudoku grids. It ensures that common operations like deep copying, validation, and randomized filling are centralized and easily testable.

## `createEmptyGrid(size)`

**Why:** We need a standardized way to generate the initial state of a Sudoku puzzle. We use `0` to represent empty cells rather than `null` or `undefined` because it's easier to serialize and process mathematically in the solver logic.

```text
Initialize a 2D array of the given size.
Fill every cell with the integer 0.
Return the 2D array.
```

## `copyGrid(grid)`

**Why:** JavaScript passes arrays by reference. When algorithms like our diggers test whether removing a clue breaks the puzzle, they must operate on a clone. If they mutated the original grid, we would lose the solved state.

```text
Map over every row in the input grid.
For each row, spread its contents into a new array to create a shallow copy of the row.
Return the new 2D array containing the copied rows.
```

## `isValid(grid, row, col, num, config)`

**Why:** The fundamental rule of Sudoku. Before we can tentatively place a number during generation or counting, we must ensure it doesn't immediately violate the rules.

```text
Extract the box dimensions from the config.
For every cell in the target row and target column:
  If the cell contains the number, return false.
Calculate the top-left coordinate of the subgrid that contains the target cell.
For every cell in that subgrid:
  If the cell contains the number, return false.
If no conflicts are found, return true.
```

## `shuffle(array)`

**Why:** Sudoku generation requires randomness so we don't generate the exact same puzzle every time. The Fisher-Yates algorithm is the industry standard for an unbiased, O(n) in-place shuffle.

```text
For each index i from the end of the array down to 1:
  Pick a random index j between 0 and i inclusive.
  Swap the elements at index i and index j.
Return the shuffled array.
```

## `fillGrid(grid, config)`

**Why:** We generate puzzles by starting with a completely solved, valid grid, and then digging holes into it. This function uses backtracking to randomly traverse the empty grid and fill it with valid numbers.

```text
For every cell in the grid (using a flat index to simplify the loop):
  If the cell is empty:
    Generate an array of numbers from 1 to the maximum allowed number.
    Shuffle the array to ensure the solution is random.
    For each number in the shuffled array:
      If placing the number is valid:
        Place the number in the cell.
        Recursively call fillGrid to attempt to fill the rest of the puzzle.
        If the recursive call succeeds, return true.
        Otherwise (backtrack): reset the cell to empty (0).
    If no numbers worked, return false (dead end).
If we checked every cell and none were empty, the grid is full; return true.
```
