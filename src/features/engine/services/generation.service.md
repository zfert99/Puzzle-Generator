# Generation Service

This module abstracts puzzle-generation logic away from the API controllers. It backs both the PDF batch route (`/api/generate`) and the interactive board's single-puzzle route (`/api/puzzle`).

## `generateSinglePuzzle(difficulty, gridSize)`

**Why:** The interactive board (Phase 3) needs one playable puzzle at a time. This thin service wrapper generates a single puzzle (and its solution) server-side, so the heavy solver/generator stays out of the client bundle and off the browser's main thread. It exists as a service function — rather than the route calling the engine directly — to keep the Controller-Service separation consistent with `generatePuzzleBatch`.

```text
Return generateSudoku(difficulty, gridSize)  // a { grid, solution, difficulty, gridSize } object
```

## `generatePuzzleBatch(request, options = {})`

**Why:** A user might request 2 Easy puzzles and 1 Hard puzzle in a single API call. Rather than the API route handling the for-loops and array aggregations, this service cleanly takes a `GenerationRequest` object and returns an array of fully constructed `SudokuPuzzle` objects. This fulfills the Controller-Service pattern.

**`options.timeBudgetMs` (October 2026):** one wall-clock budget for the *whole* batch, matching
`generateKakuroBatch` / `generateKillerBatch` / `generateCalcBatch`. Before each puzzle the batch
computes what is left; if nothing is, it throws an `Error` named `SUDOKU_BUDGET_ERROR`
(`isSudokuBudgetError` from `sudoku.ts`), otherwise it hands the remainder to `generateSudoku`,
whose Expert/Extreme diggers throw the same error if they overrun it mid-dig. The point is that a
route can answer "request too large for its budget" cleanly instead of being killed by its own
function timeout half-way through a booklet. With no budget (the default) each puzzle is generated
exactly as before.

```text
Extract the requested counts for easy, medium, hard, expert, and extreme from the request.
Set missing values to 0.
Extract the grid size, defaulting to 9.
Note the start time and initialize an empty array to hold the generated puzzles.

For each difficulty in ladder order (easy → extreme), as many times as requested:
  If there is no budget:
    Generate the puzzle and add it to the array.
  Otherwise:
    remaining = budget − time elapsed
    If remaining ≤ 0, throw SUDOKU_BUDGET_ERROR.
    Generate the puzzle with timeBudgetMs = remaining and add it to the array.

Return the array of puzzles.
```
