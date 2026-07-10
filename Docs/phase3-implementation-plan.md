# Phase 3: The Interactive React Sudoku Board

Transforming the application from a stateless PDF generator into an interactive,
stateful puzzle platform: a fully responsive, playable Sudoku board in the browser
at `/play`, alongside the existing PDF flow at `/`.

> **What changed since this plan was first drafted:** the engine was hardened and
> refactored (see [agents-compliance-audit.md](agents-compliance-audit.md)). It now
> has a **bitmask + MRV generator**, a fast bitmask `HumanSolver`, structured Pino
> logging, a **Vitest** unit suite, and a **Playwright** E2E harness. This plan is
> updated to **reuse** that work rather than rebuild it, and to follow the newer
> `AGENTS.md` rules (hydration safety, INP, server/client component boundaries).

## Reuse from the existing codebase (do NOT rebuild)

The research doc's section 4 ("Algorithmic Constraints and Dynamic Puzzle
Generation") describes building a backtracking generator with MRV, unique-solution
validation, and deductive difficulty grading. **This is already built and tested** —
do not reimplement it:

- `generateSudoku(difficulty, gridSize)` and `getGridConfig(size)` from
  [sudoku.ts](../src/features/engine/sudoku.ts) — bitmask + MRV generation, unique
  solutions, difficulty graded by the `HumanSolver`. Returns
  `{ grid, solution, difficulty, gridSize }`.
- `HumanSolver` geometry from [human-solver.ts](../src/features/engine/human-solver.ts)
  — `sees(a, b)`, `inSameBox(a, b)`, `getBoxCells(b)`, and the bitmask candidate
  accessors (`candidateList`, `hasCandidate`, `removeCandidate`). Reuse these for
  peer detection and pencil-mark auto-strip instead of writing new geometry.
- [generation.service.ts](../src/features/engine/services/generation.service.ts) —
  the server-side batch generator, ready to back a puzzle API route.
- [GridSizeSelector.tsx](../src/features/puzzle-configuration/components/GridSizeSelector.tsx)
  — a presentational 4/6/9 selector; reuse it on the `/play` config screen.
- [usePuzzleGeneration.ts](../src/features/puzzle-configuration/hooks/usePuzzleGeneration.ts)
  — the existing "fetch from an API, drive loading/error state" hook is the pattern
  to mirror for fetching a playable puzzle.

## Decisions

### Decided

1. **State:** **Zustand** (not Context) with `useShallow` selectors and `zundo` for
   undo/redo. Per-cell selective subscription is what keeps an 81-cell grid from
   re-rendering on every keystroke. _Caveat (from research §3.1):_ `zundo` is stable
   but effectively "finished" — verify its open issues against React 19 before
   committing; `zustand-travel` is the maintained fallback if richer time-travel is
   ever needed.
2. **Grid sizes:** 4×4, 6×6, 9×9 from the start, via CSS Grid sized off `gridSize`.
3. **Start flow:** `/play` first shows a Size + Difficulty config screen (reusing
   `GridSizeSelector`), then generates and starts the game.
4. **Controls:** hybrid — keyboard (arrows, digits, backspace, space→pencil) and
   mouse/touch (click to select, on-screen numpad, pencil toggle).
5. **Real-time error checking:** optional toggle that reddens incorrect placements,
   validated against the `solution` returned by the engine.

### Needs your call — puzzle generation source

The generator is **synchronous** and, for Extreme, can take up to a couple of seconds
(digging + retries). Running it on the main thread would freeze the UI and wreck INP.
Two viable sources:

| Option | How | Trade-offs |
| --- | --- | --- |
| **A — On-demand API (recommended)** | New `POST /api/puzzle` route → `generation.service.ts`, returns `{ grid, solution }` JSON. Board fetches it client-side after mount. | Reuses the server engine; keeps the solver/generator **out of the client bundle**; no main-thread jank; no hydration risk (nothing generated during SSR). Costs one network round trip. Matches the existing `/api/generate` architecture. |
| **B — Client-side in a Web Worker** | Import the engine into a Web Worker; generate off the main thread; post the puzzle back. | Fully offline, no server; but bundles the engine (+solver) into client JS and is more moving parts. |

**Recommendation: Option A** — it reuses `generation.service.ts`, keeps the heavy
engine server-side, and fits the current stateless architecture. Option B is the
better pick only if offline generation becomes a requirement.

## Architecture rules to honor (AGENTS.md)

- **Hydration-Safe Generation (§1 AI Pitfall + research §4.4):** the board is
  **client-only**. Never generate during SSR. Mark the board container
  `"use client"`, fetch/generate **after mount** (in `useEffect` or on the config
  screen's "Play" click), and render a skeleton until the grid exists. This avoids
  the `Math.random()` server/client mismatch class of bugs entirely.
- **Server vs. Client Components (§1):** `src/app/play/page.tsx` stays a **Server
  Component** shell (routing/layout only); `"use client"` lives only on the
  interactive leaves (the board, numpad, header). Do not mark the whole route client.
- **INP ≤ 200ms (§3):** the interaction budget is the real target here. Keep cell
  `onClick`/`onKeyDown` cheap; never recompute whole-board derived state (error
  highlighting, peer highlighting) on every keystroke — derive per-cell via narrow
  `useShallow` selectors. Generate off the main thread (Option A or B above).
- **Structure (§1):** new `src/features/interactive-board/` feature module.
  Components as `Board/Board.tsx` (no `index.ts` barrels). Colocate Vitest tests
  next to source; E2E specs go in the top-level `e2e/`.
- **Telemetry (§5):** the puzzle API route logs via the existing Pino logger.
  Client-side error tracking (if added) belongs in `instrumentation-client.ts`
  (browser-only), **not** the server logger.

## Proposed Changes

### Routing & navigation

- **[MODIFY]** [src/app/page.tsx](../src/app/page.tsx) — add a prominent "Play Online"
  action beside "Generate PDF Book". Stays a Server Component.
- **[NEW]** `src/app/play/page.tsx` — Server Component shell that renders the
  client `PlayExperience` (config screen → board).

### Puzzle data (Option A)

- **[NEW]** `src/app/api/puzzle/route.ts` — `export const runtime = 'nodejs'`;
  validates `{ difficulty, gridSize }`, calls `generation.service.ts`, returns one
  `{ grid, solution, difficulty, gridSize }` as JSON. Controller only; logs a wide
  event via Pino.
- **[NEW]** `src/features/interactive-board/hooks/usePuzzle.ts` — mirrors
  `usePuzzleGeneration`: fetches `/api/puzzle`, exposes `{ puzzle, loading, error }`.

### State

- **[NEW]** `src/features/interactive-board/store/useBoardStore.ts` — Zustand store.
  - **State:** `grid`, `candidates` (pencil bitmask/array per cell), `givens`
    (immutability mask), `solution`, `selectedCell`, `settings` (real-time errors),
    `status` (`configuring | playing | paused | solved`), `elapsedTime`.
  - **Actions:** `startNewGame(puzzle)`, `selectCell(r,c)`, `setCellValue(v)`,
    `toggleCandidate(v)`, `undo()`, `redo()`, `toggleRealTimeErrors()`,
    `tick()`, `pause()`.
  - **Rules:** `zundo` with `partialize` tracking only `grid`/`candidates` (exclude
    `elapsedTime`, `status`, `selectedCell` so the timer doesn't pollute history);
    optional `handleSet` debounce for rapid pencil toggles. Build a precomputed
    **O(1) peer map** at `startNewGame` (or reuse `HumanSolver.sees`) so placing a
    digit strips it from peers' candidates instantly.

### UI components (composition, no inheritance)

- **[NEW]** `.../components/Board/Board.tsx` — CSS Grid sized by `gridSize`;
  `:nth-child` for thick block borders (no wrapper divs); `role="grid"`; centralized
  `keydown` listener implementing a **roving tabindex** with
  `preventDefault()`/`stopPropagation()` on arrows.
- **[NEW]** `.../components/Board/Cell.tsx` — `role="gridcell"`,
  `tabIndex={isActive ? 0 : -1}`; subscribes via `useShallow` to only its slice;
  synthesizes `aria-label` ("Given clue 7, row 2, column 4" / "Candidates 2, 5, 8");
  conditional styles for `isSelected`/`isPeer`/`isError`/`isGiven`; **CSS Subgrid**
  for pencil-mark alignment (Baseline-available in 2026; don't nest subgrid >2 deep).
- **[NEW]** `.../components/Controls/Numpad.tsx` — numeric pad + Undo/Redo/Pencil
  (`aria-pressed`)/Hint.
- **[NEW]** `.../components/Header/GameHeader.tsx` — difficulty, grid size, live
  timer, Pause/Resume (hides the board when paused), settings toggle.

## Verification Plan

### Vitest (unit / behavioral — colocated, jsdom via `// @vitest-environment jsdom`)

- `useBoardStore.test.ts` — state transitions: placing a digit strips it from peer
  candidates; `undo`/`redo` revert grid but **not** the timer; real-time-error toggle
  flags only wrong cells. Use the Vitest `zustand` reset mock (`src/__mocks__/zustand.ts`)
  — this mocks the **external** `zustand` package to reset store state in `afterEach`
  (a boundary mock, allowed by §4; it resets state, it does not replace store logic).
- `Board.test.tsx` — accessibility-first, AAA, `@testing-library/user-event`:
  `await userEvent.keyboard('[ArrowRight]')` moves focus (roving tabindex);
  `expect(cell).toHaveFocus()`; a single `Tab` exits the grid.
- Hydration guard — a test (or the E2E below) confirming no puzzle is computed during
  SSR (the board renders a skeleton first).

### Playwright E2E (`e2e/play.spec.ts` — real browser)

- Full flow: open `/play` → pick size + difficulty → **Play** → board renders (not a
  skeleton) → keyboard-enter a few digits → complete a 4×4 to trigger the win state.
- Mini-grid gating and responsive layout (mobile viewport) checks.
- Runs via the existing `playwright.config.ts` (`npm run test:e2e`).

### Manual / profiling

- React DevTools Profiler during rapid numeric input: only the mutated cell (and its
  affected peers) should re-render; the other ~80 cells stay gray. If not, audit
  `useShallow` selectors and `React.memo`/`useCallback` referential stability.
- Sanity-check INP in the browser performance panel during sustained input.
