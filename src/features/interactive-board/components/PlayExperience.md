# PlayExperience Component: Plain English Pseudocode

The client-side orchestrator for `/play` — the boundary between the Server Component
route and the interactive game.

## Why it is the client boundary

The `/play` route stays a Server Component; `PlayExperience` is the single `"use client"`
entry that owns all interactivity (AGENTS.md Section 1, server-vs-client). It fetches
the puzzle **after mount** via `usePuzzle`, so nothing is generated during SSR and there
is no hydration mismatch.

## Sudoku / Killer / Keisan / Kakuro toggle

The menu has a puzzle-type toggle. In **Killer** mode it hides the grid-size selector (Killer is
9×9), offers only easy/medium/hard, and shows a "no givens — the cage sums are the only clue"
note. `startFresh` then calls `fetchPuzzle({ variant: 'killer', difficulty })`; the returned
`KillerPuzzle` (with `cages`) flows through `startNewGame`, which sets the store's `variant`/`cages`
so the board renders the cage overlay. Classic mode is unchanged.

**Kakuro (October 2026, plan slice V2).** A fourth toggle. Sizes are a per-variant table
(`SIZES`, plan rule D11): Kakuro offers 6/7/9 (the 6×6 mini joined in E4, D6′), and switching
type falls back to the new type's smallest size when the current one isn't offered (7 → 9
leaving Kakuro; 4 → 6 entering it); the deep link still seeds 7×7. Kakuro's difficulty picker
offers the **full ladder** at every size (generated server-side since E4 and graded by the
solver — the header shows the grade the puzzle earned, which E4 matches to the request where
its budget allows); unlike the Sudoku family's minis, a 7×7 Kakuro has an
expert and an extreme, so the "9×9 only" lock applies to every type but Kakuro
— one rule, `topTiersLockedFor(variant, size)`, used by the picker and by both clamps (switching
type, switching size), so a new size or type changes it in one place. `VARIANT_LABEL` is the one
place the four display names live (Continue label, toggle). A Kakuro's difficulty is a real value (`'easy'`…, or the
literal `'unrated'`), so the Continue label and header show it as-is.

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
> The solved modal is the shared [SolvedDialog](SolvedDialog.md) (September 2026 extraction),
> which renders the Motion [SolvedStamp](../../juice/SolvedStamp.md) (chunky stamp badge +
> confetti + screen-flash, reduced-motion-safe) in place of the old emoji/`celebrate` CSS (5.3a).

## Deep link: `/play?variant=killer|calc|kakuro`

The hub's Killer card links here with a query param (`parseVariant` accepts the four slugs and
defaults to classic). A mount effect reads it via `useSearchParams` and preselects the variant
(Killer forces 9×9 and clamps expert/extreme to hard, same as a manual toggle; Kakuro seeds its
7×7 mini). `?variant=kakuro` has no hub card yet — it is the by-URL build surface until the
Kakuro plan's E5 (D12). The route wraps the component in a
`Suspense` boundary (required by `useSearchParams` on a statically prerendered page); the
fallback matches the component's own pre-mount placeholder so there is no layout shift.
The Continue button is also variant-aware: a saved Killer game reads "Continue Killer
medium", not "Continue 9×9 medium".

## Expert Killer (K10/E3)

The Killer ladder is easy/medium/hard/**expert** (no extreme yet — deferred by measurement).
Expert generates server-side in ~270 ms avg, so the existing "Generating…" state covers it.

## 6×6 Killer size choice (M3)

The Killer menu offers a 6×6/9×9 toggle. At 6×6 the ladder trims to easy/medium/hard
(expert/extreme chips hidden, selection clamped to hard); a 4×4 classic selection bumps to
9×9 when switching into Killer. The board, cage overlay, and store were already size-generic.

## Menu consistency pass (July 2026)

The Killer menu now mirrors the Sudoku one exactly: the shared `GridSizeSelector` (with a
`sizes` subset — Killer has no 4×4) under the same "Grid Size" header, the full difficulty
ladder always visible with expert/extreme GRAYED at non-9×9 sizes (same rule and same
"only available for 9×9 grids" subtext as classic minis), and the variant-specific
"no givens" blurb removed. The only Killer-specific line left is the extreme
generation-time hint, shown only when extreme is selected.

## Solved dialog takes focus (September 2026, QA F7)

The solved overlay used to appear without moving focus — `document.activeElement` stayed on a
gridcell behind the backdrop, so keyboard/screen-reader users were never told and kept typing
into the board. Focus now lands on the primary "New puzzle" button on open and is restored on
close (best-effort — leaving to the config view unmounts the board, and a detached opener is a
spec'd no-op). That wiring lives inside the shared [SolvedDialog](SolvedDialog.md), so this
component no longer touches `useDialogFocus` itself.

## Config toggles announce selection (September 2026, QA F10)

Same F10 treatment as `PuzzleForm`: the type toggle is a labelled `role="group"` with
`aria-pressed` buttons, and the Difficulty heading became a `span` + `aria-labelledby` over its
group (size buttons get theirs from the shared `GridSizeSelector`).

## Development-only solver badge (October 2026, Kakuro E1)

Under a Kakuro board, and only when `NODE_ENV === 'development'`, the game view renders
`KakuroDevBadge` — the exact solver's uniqueness verdict and node count. It reads the *board's*
variant from the store (not the menu's `variant` state), so it follows the game actually being
played.

## Hint note (October 2026, Kakuro E2a)

The game view renders `HintNote` under the numpad: the last hint's reason and lead-up, from the
store's `lastHint`. See `HintNote.md`.
