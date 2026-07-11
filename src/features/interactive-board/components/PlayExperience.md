# PlayExperience Component: Plain English Pseudocode

The client-side orchestrator for `/play` — the boundary between the Server Component
route and the interactive game.

## Why it is the client boundary

The `/play` route stays a Server Component; `PlayExperience` is the single `"use client"`
entry that owns all interactivity (AGENTS.md Section 1, server-vs-client). It fetches
the puzzle **after mount** via `usePuzzle`, so nothing is generated during SSR and there
is no hydration mismatch.

```text
Local state: selected gridSize + difficulty for the config screen.

Timer effect: while status === 'playing', run one interval that calls tick() each second.

IF store status === 'configuring':
  Render the config screen — reuse <GridSizeSelector>, plus difficulty buttons
  (Expert/Extreme disabled for mini grids), and a Play button.
  On Play: fetchPuzzle({ difficulty, gridSize }); if it succeeds, startNewGame(puzzle).
  Show a loading label while generating and any error message.

ELSE (playing / paused / solved):
  Render a "← New game" button (always available) -> configure(), so the player can
  abandon the current puzzle and return to the play menu at any time.
  Render <GameHeader>, then <Board> (or a "Paused" placeholder when paused), then
  <Numpad>, then <KeyboardHints> (a legend of the keyboard controls).
  When solved, also show a celebration and a "New Puzzle" button -> configure().
```
