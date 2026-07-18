# usePuzzleGeneration Hook: Plain English Pseudocode

This document explains `usePuzzleGeneration.ts`, the custom React hook that owns
all the data-fetching and async state for generating a puzzle PDF.

## Why this file exists

AGENTS.md Section 1 requires extracting data-fetching and complex state logic out
of components into custom hooks, keeping the UI components purely presentational.
`PuzzleForm` renders the form; this hook does the network work and tracks
loading/error state.

## What it exposes

The hook returns `{ loading, error, generate }`:

- `loading` — true while a request is in flight (drives the button's busy state).
- `error` — a user-facing error message, or empty string when there is none.
- `generate(config)` — an async function that performs the request and triggers
  the file download. Resolves `true` on success, `false` on failure.

## What `generate(config)` does

1. Clear any previous error.
2. **Validate client-side first** as a fast guard (the server re-validates
   authoritatively): reject when the total puzzle count is 0, or exceeds 50.
   These mirror the server's rules so the user gets instant feedback without a
   round trip.
3. Set `loading` true and `POST` the config as JSON to `/api/generate`. The `config` may include
   `variant: 'killer'`, in which case the download is named `Killer_Sudoku.pdf` (else
   `Sudoku_Puzzles.pdf`); `gridSize`/`expert`/`extreme` are optional and default sensibly.
4. If the response is not OK, read the JSON body and throw its `error` field (the
   server sends a safe, generic message — no stack traces).
5. On success, read the response as a binary `blob`, create a temporary object
   URL, and programmatically click a hidden `<a download>` to save the PDF, then
   revoke the URL and remove the element.
6. On any thrown error, store its message in `error`.
7. Always clear `loading` in the `finally` block.

## Testing note

Because this hook is the application's network boundary, tests should drive the
**real** hook and mock only `fetch` — not mock the hook itself (AGENTS.md
Section 4, Mocking Boundaries).
