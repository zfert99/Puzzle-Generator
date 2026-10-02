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
2. `POST` the `{ difficulty, gridSize }` as JSON to `apiPath('/api/puzzle')`. `apiPath`
   prepends the `/puzzles` basePath — Next does not apply basePath to `fetch()`, so a bare
   `/api/puzzle` 404s under the multi-zone rewrite (see `src/lib/base-path.md`).
3. If the response is not OK, read the JSON body and throw its `error` field (the
   server sends a safe, generic message — no stack traces).
4. On success, parse the puzzle JSON, store it in `puzzle`, and return it.
5. On any thrown error, store its message in `error` and return `null`.
6. Always clear `loading` in the `finally` block.

## Variant support

`fetchPuzzle` takes an optional `variant: 'classic' | 'killer' | 'calc' | 'kakuro' | 'skyscrapers'` (default
classic), forwarded to `/api/puzzle` for the three generated types. A Killer request returns a
`KillerPuzzle` (with `cages`), Keisan a `CalcPuzzle`; the hook's puzzle type is the union of all
four and the board's `startNewGame` handles any of them.

### Kakuro goes through the route like every other type (October 2026, E4)

From V2 to E3 a Kakuro request short-circuited before `fetch` and served a hand-baked fixture
(one per size and level, labelled by the classifier). Since E4 `/api/puzzle` has a Kakuro
branch backed by `generateKakuro`, so the hook treats Kakuro exactly like Killer and Keisan:
POST, `loading`, the route's puzzle. The served `difficulty` is the classifier's; since E5 it is
also exactly the one requested (the generator walks every puzzle to the asked-for tier), so the
header and the picker agree.

## Hydration and testing notes

- The hook only runs on the client, in response to a user action (or a mount
  effect), so no puzzle is generated during SSR — avoiding the `Math.random()`
  hydration-mismatch class of bugs.
- Because this is the board's network boundary, tests drive the **real** hook and
  mock only `fetch` (AGENTS.md Section 4, Mocking Boundaries).

### Skyscrapers is served from its fixtures, client-side (October 2026, V2)

Exactly what Kakuro did from V2 to E3: a `skyscrapers` request returns the baked fixture for the
requested size (the first fixture if none matches) **before** `fetch`, with no loading state and
no network. The fixtures are static data, so there is no hydration concern. E5 puts
`generateSkyscrapers` behind `/api/puzzle` and this branch goes away, as Kakuro's did in E4.
