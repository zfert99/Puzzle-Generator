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

IF store status === 'configuring' OR mode !== 'play':
  Render the config screen — reuse <GridSizeSelector>, plus difficulty buttons
  (Expert/Extreme disabled for mini grids), and a Play button.
  On Play: fetchPuzzle({ difficulty, gridSize }); if it succeeds, startNewGame(puzzle)
  (default mode 'play', so free play owns the new game).
  Show a loading label while generating and any error message.

  The `mode !== 'play'` half is why a completed daily never leaks here: the store is
  shared with /daily, so a persisted daily (mode === 'daily', status === 'playing')
  would otherwise render on /play. Gating on mode keeps "new game" in context — you
  land on the free-play config, and the daily stays on /daily.

ELSE (playing / paused / solved):
  Render a "← New game" button (always available) -> configure(), so the player can
  abandon the current puzzle and return to the play menu at any time.
  Render <GameHeader>, then <Board> (or a "Paused" placeholder when paused), then
  <Numpad>, then <KeyboardHints> (a legend of the keyboard controls).
  When solved (and not "viewing"), show a MODAL popup over the board with the final
  time + mistakes and two choices:
    "New puzzle" -> configure() (back to the menu)
    "View puzzle" -> dismiss the modal (local viewingSolved = true) to inspect the
                     completed, now-locked board.

A mounted guard (useSyncExternalStore) defers rendering until the client has hydrated
the persisted store, so a resumed game never causes an SSR/client mismatch.
```

> The solved modal now renders the Motion [SolvedStamp](../../juice/SolvedStamp.md) (chunky stamp badge + confetti + screen-flash, reduced-motion-safe) in place of the old emoji/`celebrate` CSS (5.3a).
