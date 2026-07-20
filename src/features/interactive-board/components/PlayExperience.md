# PlayExperience Component: Plain English Pseudocode

The client-side orchestrator for `/play` — the boundary between the Server Component
route and the interactive game.

## Why it is the client boundary

The `/play` route stays a Server Component; `PlayExperience` is the single `"use client"`
entry that owns all interactivity (AGENTS.md Section 1, server-vs-client). It fetches
the puzzle **after mount** via `usePuzzle`, so nothing is generated during SSR and there
is no hydration mismatch.

## Sudoku / Killer toggle

The menu has a puzzle-type toggle. In **Killer** mode it hides the grid-size selector (Killer is
9×9), offers only easy/medium/hard, and shows a "no givens — the cage sums are the only clue"
note. `startFresh` then calls `fetchPuzzle({ variant: 'killer', difficulty })`; the returned
`KillerPuzzle` (with `cages`) flows through `startNewGame`, which sets the store's `variant`/`cages`
so the board renders the cage overlay. Classic mode is unchanged.

## Menu-first, with save & continue

The screen is driven by a LOCAL `view` ('config' | 'playing'), not the store `status`. It
always opens on the config menu so the player can choose between continuing a saved game and
starting a new one — matching the daily picker's shape. This decouples "which screen" from
"is there a parked game", which is what makes one-slot save/continue work.

```text
Local state: gridSize + difficulty (for the config), view, viewingSolved, warnOpen.
saved = useSavedGame()  → the one persisted in-progress game, or null.

Timer effect: while view === 'playing' AND status === 'playing', tick() each second.
  Gated on `view` so stepping back to the menu (or leaving the page) FREEZES the timer;
  Continue resumes it from the stored elapsedTime. This is what makes leaving/continuing fair.

IF view === 'config':
  Render the menu:
    - If a saved FREE-PLAY game exists (saved.mode === 'play'): a prominent
      "Continue {size} {difficulty} · M:SS" button → handleContinue (resume() if paused,
      then view = 'playing'). No re-fetch — the board is already in the store.
    - <GridSizeSelector> + difficulty buttons (Expert/Extreme disabled for mini grids).
    - Play button: if ANY saved game exists (play OR daily — one slot), open the
      <ConfirmModal> warning first; otherwise start fresh immediately.
  startFresh: fetchPuzzle(...); on success startNewGame(puzzle) (mode 'play'), view = 'playing'.

IF view === 'playing':
  "← Menu" button → view = 'config' (does NOT clear the game, so it stays continuable).
  <GameHeader>, <Board> (or "Paused" placeholder), <Numpad>, <KeyboardHints>.
  Solved (and not "viewing") → modal with final time + mistakes:
    "New puzzle" → view = 'config';  "View puzzle" → viewingSolved = true.

A mounted guard (useSyncExternalStore) defers rendering until the client has hydrated the
persisted store, so a resumed game never causes an SSR/client mismatch.
```

> A saved game is one the store reports as `playing`/`paused` (see `useSavedGame.ts`). The
> board store holds a SINGLE slot shared with `/daily`, so starting any new game erases it —
> hence the warning. A daily parked in the store never renders here because the board only
> shows via Continue (gated on `saved.mode === 'play'`) or a fresh play.
>
> The solved modal renders the Motion [SolvedStamp](../../juice/SolvedStamp.md) (chunky stamp badge + confetti + screen-flash, reduced-motion-safe) in place of the old emoji/`celebrate` CSS (5.3a).

## Deep link: `/play?variant=killer`

The hub's Killer card links here with a query param. A mount effect reads it via
`useSearchParams` and preselects the Killer variant (forcing 9×9 and clamping
expert/extreme to hard, same as a manual toggle). The route wraps the component in a
`Suspense` boundary (required by `useSearchParams` on a statically prerendered page); the
fallback matches the component's own pre-mount placeholder so there is no layout shift.
The Continue button is also variant-aware: a saved Killer game reads "Continue Killer
medium", not "Continue 9×9 medium".

## Expert Killer (K10/E3)

The Killer ladder is easy/medium/hard/**expert** (no extreme yet — deferred by measurement).
Expert generates server-side in ~270 ms avg, so the existing "Generating…" state covers it.
