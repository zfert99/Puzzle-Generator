# Generation Service

This module abstracts puzzle-generation logic away from the API controllers. It backs both the PDF batch route (`/api/generate`) and the interactive board's single-puzzle route (`/api/puzzle`).

## `generateSinglePuzzle(difficulty, gridSize)`

**Why:** The interactive board (Phase 3) needs one playable puzzle at a time. This thin service wrapper generates a single puzzle (and its solution) server-side, so the heavy solver/generator stays out of the client bundle and off the browser's main thread. It exists as a service function — rather than the route calling the engine directly — to keep the Controller-Service separation consistent with `generatePuzzleBatch`.

```text
Return generateSudoku(difficulty, gridSize)  // a { grid, solution, difficulty, gridSize } object
```

## `generatePuzzleBatch(request)`

**Why:** A user might request 2 Easy puzzles and 1 Hard puzzle in a single API call. Rather than the API route handling the for-loops and array aggregations, this service cleanly takes a `GenerationRequest` object and returns an array of fully constructed `SudokuPuzzle` objects. This fulfills the Controller-Service pattern.

```text
Extract the requested counts for easy, medium, hard, expert, and extreme from the request.
Set missing values to 0.
Extract the grid size, defaulting to 9.
Initialize an empty array to hold the generated puzzles.

Loop 'easy' times:
  Generate an 'easy' puzzle of the requested size and add it to the array.
Loop 'medium' times:
  Generate a 'medium' puzzle of the requested size and add it to the array.
Loop 'hard' times:
  Generate a 'hard' puzzle of the requested size and add it to the array.
Loop 'expert' times:
  Generate an 'expert' puzzle of the requested size and add it to the array.
Loop 'extreme' times:
  Generate an 'extreme' puzzle of the requested size and add it to the array.

Return the array of puzzles.
```
