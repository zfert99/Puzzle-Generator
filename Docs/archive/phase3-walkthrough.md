# Phase 3 Completion: The Interactive Sudoku Board

Phase 3 turns the app from a stateless PDF generator into an interactive, stateful
puzzle platform. Players can now solve Sudoku directly in the browser at `/play` — on
4×4, 6×6, or 9×9 grids — with full keyboard/mouse/touch input, pencil marks, hints,
undo/redo, real-time error checking, a timer, and a win screen. The PDF flow at `/`
is untouched and now cross-links to play mode.

This document walks through everything that was built, why, and how it satisfies the
project's architectural rules.

## Architecture at a Glance

All the game code lives in a single feature module, `src/features/interactive-board/`,
keeping it decoupled from the PDF features (AGENTS.md Section 1, Domain-Driven
Architecture). The data flow is:

```text
/play (Server Component shell)
  └─ PlayExperience (the single "use client" boundary)
       ├─ usePuzzle ── POST /api/puzzle ── generateSinglePuzzle ── engine
       ├─ useBoardStore (Zustand + zundo + persist)  ← single source of truth
       └─ GameHeader · Board(→Cell) · Numpad · KeyboardHints · Solved modal
```

The heavy solver/generator never enters the client bundle: puzzles are generated
server-side and fetched as JSON. Everything interactive is a client leaf; the route
itself stays a Server Component.

## 1. The Puzzle Source (`/api/puzzle` + `usePuzzle`)

The plan weighed two ways to get a puzzle to the browser: generate it client-side (in
a Web Worker) or fetch it from a server route. **Option A (server route)** was chosen
because it reuses the existing engine service, keeps the generator/solver out of the
client bundle, runs off the browser's main thread (protecting INP), and — because
nothing is generated during SSR — sidesteps the `Math.random()` hydration-mismatch
pitfall entirely.

- **`generateSinglePuzzle(difficulty, gridSize)`** — a thin service function added to
  `generation.service.ts`, wrapping the engine's `generateSudoku`.
- **`POST /api/puzzle`** (`src/app/api/puzzle/route.ts`) — a controller-only route:
  validates `{ difficulty, gridSize }` (rejecting Expert/Extreme on mini grids),
  delegates to the service, emits a Pino wide event, and returns
  `{ grid, solution, difficulty, gridSize }` as JSON. On error it returns a **generic
  500** — the message and stack are logged server-side only (OWASP Security
  Misconfiguration; AGENTS.md Section 6).
- **`usePuzzle`** — a client hook that fetches `/api/puzzle` and tracks
  `{ puzzle, loading, error, fetchPuzzle }`. It only runs after mount (no SSR
  generation), and its tests mock only `fetch` — the network boundary — per the
  Mocking Boundaries rule.

## 2. The State Layer

### `board-utils.ts` — peers and bitmask helpers

Pure, isolated helpers:

- **`computePeers(config)`** precomputes, for every cell, the flat indices of its
  peers (same row/column/box). Building this once per game makes pencil-mark
  auto-stripping an O(1) lookup instead of recomputing peer unions on every keystroke.
- **`toggleBit` / `hasBit` / `maskToDigits`** operate on the per-cell candidate
  bitmask (bit `n-1` set = candidate `n` present).

### `useBoardStore.ts` — the single source of truth

A Zustand store, wrapped in two middlewares:

- **`zundo` (temporal)** provides snapshot undo/redo, `partialize`d to track **only**
  `grid` and `candidates`. Excluding the timer, status, and selection keeps the
  history to genuine puzzle moves — a per-second tick never creates an undo entry, and
  an undo never rewinds the clock.
- **`persist`** (localStorage, key `sudoku-board`) saves the in-progress game so a
  refresh resumes it. It sits *inside* `temporal`, so undo/redo still works and
  `useBoardStore.temporal` stays intact. `peers` are recomputed from `config` on
  rehydration rather than stored; actions are dropped by JSON serialization and
  re-supplied by the store creator.

**State:** `grid`, `candidates`, `givens`, `solution`, `peers`, `gridSize`, `config`,
`difficulty`, `selectedCell`, `pencilMode`, `realTimeErrors`, `status`
(`configuring | playing | paused | solved`), `elapsedTime`, `mistakes`.

**Key actions:**

- **`startNewGame(puzzle)`** loads the grid/solution, marks givens (cells that start
  non-zero), computes peers, resets the timer/mistakes, sets `status = playing`, and
  clears undo history.
- **`inputDigit(digit)`** is the heart of play. In pencil mode it toggles a candidate
  bit; in pen mode it places the digit or toggles it off. Placing also: enforces the
  **number lockout** (refuses a digit once all `size` of it are on the board), strips
  the digit from peers' candidates, increments **`mistakes`** if the value doesn't
  match the solution, and flips `status` to `solved` when the grid equals the solution.
- **`hint()`** reveals one correct cell (the selected empty cell, else the first empty
  cell) using the known solution. A strategy-aware "why" hint is deferred to Phase 5;
  this keeps the heavy solver out of the client.
- **`clearCell`, `selectCell`, `togglePencilMode`, `toggleRealTimeErrors`, `tick`,
  `pause`, `resume`, `configure`** round out the API. All the play actions require
  `status === 'playing'`, so a solved board is automatically **locked** — no more
  edits, only viewing.

## 3. The UI Components

Composition over inheritance, no `index.ts` barrels, tests colocated.

### `Board.tsx`

The `role="grid"` container. It renders `size × size` `Cell`s in a CSS Grid sized by a
`--size` custom property, and owns **one** centralized `keydown` handler (WAI-ARIA grid
pattern): arrows move the selection via a **roving tabindex** (only the selected cell
is tabbable; focus follows it), digits enter values, Backspace/Delete clears, and Space
toggles pencil mode — with `preventDefault` so the page never scrolls. A second,
window-level listener handles **Cmd/Ctrl+Z** (undo) and **Shift+Cmd/Ctrl+Z / Ctrl+Y**
(redo) so they work regardless of which control has focus.

### `Cell.tsx`

Each cell subscribes via `useShallow` to **only** the values/booleans that affect its
own render (value, candidates, given, `isSelected`, `isPeer`, `isError`,
`isSameNumber`). When the selection moves, only the handful of cells whose flags change
re-render — the granular-subscription pattern that keeps input latency (INP) low. The
cell also:

- synthesizes an `aria-label` ("Given clue 7, row 2, column 4" / "Candidates 2, 5, 8");
- picks **one** background by precedence: **error > selected > same-number > peer** —
  so a wrong value reads red even while it is the selected cell (a thin selection ring
  is layered on the red cell so the selection stays visible);
- renders pencil marks in a fixed per-cell grid (digit `d` always at slot `d-1`);
- adapts its thick box borders to 4/6/9 grids via computed flags.

### `Numpad.tsx`

The on-screen pad: digit buttons (each **disabled/grayed once that number is fully
placed** — the completion lockout), plus Erase, an `aria-pressed` Pencil toggle, Hint,
and Undo/Redo. Undo/Redo call zundo's temporal store directly and **disable reactively**
when their stack is empty.

### `GameHeader.tsx`

The status bar: difficulty + grid size, a live `m:ss` timer, a **mistakes counter**
("✗ N"), the real-time-error toggle, and Pause/Resume (pausing hides the board).
Everything — including `difficulty` — is read from the store so it renders correctly
after a persisted refresh.

### `KeyboardHints.tsx`

A compact, always-visible legend of the keyboard controls (arrows, 1–9, Backspace,
Space/P, ⌘Z/Ctrl+Z, ⇧⌘Z/Ctrl+Y), so the shortcuts are discoverable.

### `PlayExperience.tsx`

The single `"use client"` boundary and orchestrator. It owns the config screen (reusing
`GridSizeSelector`, with Expert/Extreme disabled for mini grids), fetches a puzzle via
`usePuzzle` on "Play", drives the per-second timer, and shows the **solved modal** — a
popup over the dimmed board with the final time + mistakes and two choices: **New
puzzle** (back to the menu) and **View puzzle** (dismiss to inspect the locked board). A
`useSyncExternalStore`-based mounted guard defers the first render until the client has
hydrated the persisted store, avoiding an SSR/client mismatch.

## 4. Routing & Navigation

- **`/play`** (`src/app/play/page.tsx`) is a Server Component shell that renders the
  client `PlayExperience`. Keeping the route server-only, with a single client
  boundary, follows the Server-vs-Client rule and keeps SSR puzzle-free.
- The landing page (`/`) gained a **"Play online →"** link.
- In-game, a **"← New game"** control returns to the play menu at any time, and a
  header link returns to the PDF generator — so navigation is complete in every
  direction.

## 5. Player-Facing Feature Summary

- Generate a fresh 4×4 / 6×6 / 9×9 puzzle at a chosen difficulty.
- Select by click or arrow keys; enter digits by keyboard or numpad.
- Pencil-mark mode with automatic candidate stripping from peers.
- **Same-number highlight** — select a value and every matching number glows.
- **Real-time error checking** (toggle) — wrong values turn red (error beats selection).
- **Number lockout** — a digit's button grays out once all of it is placed.
- **Undo/redo** — buttons and Cmd/Ctrl+Z · ⇧⌘Z / Ctrl+Y.
- **Hints**, a **mistakes counter**, a **timer with pause**, and a **win celebration**.
- **Persistence** — refresh mid-game and it resumes exactly where you left off.

## 6. How It Honors the Project Rules (AGENTS.md)

- **Hydration-safe (Section 1):** no puzzle is generated during SSR; the board is
  client-only, data is fetched after mount, and a mounted guard gates persisted state.
- **Server vs. Client (Section 1):** `/play` is a Server Component; `"use client"` is
  confined to the interactive leaves.
- **INP ≤ 200 ms (Section 3):** granular `useShallow` per-cell subscriptions, cheap
  handlers, and server-side generation keep interactions snappy.
- **Structure (Section 1):** a `src/features/interactive-board/` feature module, no
  `index.ts` barrels, files named `Board/Board.tsx`, aliased imports.
- **Telemetry (Section 5):** the puzzle route logs structured Pino wide events; the
  generic 500 never leaks internals.
- **Documentation (Section 2 / Docs Rules):** every new `.ts`/`.tsx` has a mirrored
  `.md`, and this walkthrough lives in `Docs/archive/` with a kebab-case name.

## 7. Key Decisions & Trade-offs

- **Server API over client Web Worker** for generation (Option A) — reuses the engine
  service and keeps it off the main thread and out of the bundle.
- **CSS Subgrid deferred** — pencil marks already render cleanly in fixed slots
  (confirmed by screenshot); true cross-cell subgrid alignment needs a board-grid
  restructure for a subtle gain, so it was consciously skipped.
- **Undo/redo shortcuts require a modifier** — standalone `z`/`x` were tried, then
  removed at request, to keep ordinary typing unaffected.
- **Error color beats selection** — a wrong value is always red; a ring keeps the
  selected cell visible.
- **Mistakes count each wrong placement**, not distinct wrong cells — matching how
  players think of "mistakes made."

## 8. Testing

- **Vitest — 91 unit tests** across the board module, including:
  - `board-utils` (peer counts across grid sizes; bitmask ops),
  - `useBoardStore` (placement + peer stripping, given immutability, completion,
    undo/redo not rewinding the timer, hint, number lockout, mistakes counting),
  - `Board` (roving-tabindex arrow nav, digit entry, given protection, same-number
    highlight, keyboard Ctrl+Z/Ctrl+Y),
  - `Numpad` (a completed digit's button disables),
  - `usePuzzle` (fetch-boundary mock, success + error).
- **Playwright — 6 E2E** in Chromium: landing→play link, generate + enter a digit,
  game→menu return, mini-grid difficulty gating, solve-via-Hint → solved modal →
  View-puzzle, and a **persistence reload** test (place a digit, reload, it's still
  there).

## 9. Verification (at merge)

- `tsc --noEmit` clean · `eslint` clean · `markdownlint` clean.
- **91 Vitest** + **6 Playwright** all green.
- A clean production `next build` — routes `/`, `/play`, `/api/puzzle`, `/api/generate`
  all build (`/play` prerendered static).

## 10. New Files (feature module + route)

```text
src/app/play/page.tsx
src/app/api/puzzle/route.ts
src/features/interactive-board/
  board-utils.ts
  hooks/usePuzzle.ts
  store/useBoardStore.ts
  components/
    PlayExperience.tsx
    KeyboardHints.tsx
    Board/Board.tsx  Board/Cell.tsx  Board/Board.module.css
    Controls/Numpad.tsx
    Header/GameHeader.tsx
```

(Each source file has a colocated `.md` mirror and, where applicable, a `.test.ts(x)`.)

## Next Steps

Phase 3's core is complete and merged to `main`. Natural follow-ons: strategy-aware
hints and solver-step serialization (Phase 5), dailies/accounts/leaderboards with a
database (Phase 4), and optional polish (CSS Subgrid pencil alignment, a mistakes
limit, sound). The roadmap's Phase 3 status can move to ✅ Done.
