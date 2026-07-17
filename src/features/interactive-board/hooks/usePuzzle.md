# usePuzzle Hook: Plain English Pseudocode

This document explains `usePuzzle.ts`, the custom React hook the interactive board
uses to obtain a playable puzzle.

## Why this file exists

Per AGENTS.md Section 1, data-fetching and async state belong in a custom hook, not
in a component. This hook owns the request to `POST /api/puzzle` and the
loading/error state, keeping the board components presentational. It is the mirror,
for the interactive board, of `usePuzzleGeneration` on the PDF side.

## What it exposes

Returns `{ puzzle, loading, error, fetchPuzzle }`:

- `puzzle` — the last successfully fetched `SudokuPuzzle`, or `null`.
- `loading` — true while a request is in flight (drives the board's skeleton state).
- `error` — a user-facing message, or empty string.
- `fetchPuzzle({ difficulty, gridSize })` — async; resolves the puzzle on success or
  `null` on failure.

## What `fetchPuzzle` does

1. Clear any previous error; set `loading` true.
2. `POST` the `{ difficulty, gridSize }` as JSON to `/api/puzzle`.
3. If the response is not OK, read the JSON body and throw its `error` field (the
   server sends a safe, generic message — no stack traces).
4. On success, parse the puzzle JSON, store it in `puzzle`, and return it.
5. On any thrown error, store its message in `error` and return `null`.
6. Always clear `loading` in the `finally` block.

## Killer support

`fetchPuzzle` takes an optional `variant: 'classic' | 'killer'` (default classic), forwarded to
`/api/puzzle`. A Killer request returns a `KillerPuzzle` (with `cages`), so the hook's puzzle type
is `SudokuPuzzle | KillerPuzzle`; the board's `startNewGame` handles either.

## Hydration and testing notes

- The hook only runs on the client, in response to a user action (or a mount
  effect), so no puzzle is generated during SSR — avoiding the `Math.random()`
  hydration-mismatch class of bugs.
- Because this is the board's network boundary, tests drive the **real** hook and
  mock only `fetch` (AGENTS.md Section 4, Mocking Boundaries).
