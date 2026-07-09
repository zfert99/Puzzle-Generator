# Generation Service

This module acts as the orchestrator for generating multiple puzzles in a single request. It abstracts the looping logic away from the API controller.

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
