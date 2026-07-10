# Phase 3: The Interactive React Sudoku Board

Transforming the application from a stateless PDF generator into an interactive, stateful puzzle platform. We will build a fully responsive, playable Sudoku board in the browser.

## User Review Required

- **State Management:** I propose using **Zustand** over React Context. Sudoku boards have 81 cells that update frequently (timer, cell selection, pencil marks). Zustand allows us to select specific slices of state via `useShallow` to prevent whole-board re-renders on every keystroke, which is critical for performance. It also makes implementing an Undo/Redo stack trivial via `zundo`.

## Decisions Made

1. **Grid Size Scope:** We will support 4x4, 6x6, and 9x9 from the start. We will use CSS Grid to dynamically size the board based on the selected configuration.
2. **Start Flow:** When the user navigates to `/play`, they will first see a Difficulty and Grid Size configuration screen (similar to the PDF generator). Pressing "Play" will generate the board and start the game.
3. **Controls:** We will support a hybrid control scheme. Users can navigate via Keyboard (Arrows, Numbers, Backspace, Spacebar for pencil marks), and via Mouse/Touch (Clicking cells to select, using an on-screen numpad for entry, and an on-screen toggle button for pencil mode).
4. **Real-Time Error Checking:** We will include an optional "Real-Time Error Checking" toggle in the game settings that immediately turns incorrect placements red.

## Proposed Changes

We will create a new feature module at `src/features/interactive-board` to contain all the game logic, keeping it decoupled from the PDF generation features.

### Routing & Navigation

#### [MODIFY] src/app/page.tsx

- Update the landing page to act as a split hub. Add a prominent "Play Online" button alongside the existing "Generate PDF Book" flow.

#### [NEW] src/app/play/page.tsx

- The main entry point for the interactive experience. It will initially render a configuration screen (Size & Difficulty). Once configured, it switches to rendering the `interactive-board` feature components.

---

### Interactive Board Feature (State)

#### [NEW] src/features/interactive-board/store/useBoardStore.ts

- A Zustand store managing the entire game state.
- **State:** `grid` (current values), `candidates` (pencil marks per cell), `initialGrid` (to detect givens), `solution` (to drive real-time error checking), `settings` (toggle for real-time error checking), `selectedCell` (row/col), `status` (configuring, playing, paused, solved), `history` (for undo/redo via `zundo`), `elapsedTime` (timer in seconds).
- **Actions:** `selectCell(r, c)`, `setCellValue(val)`, `toggleCandidate(val)`, `undo()`, `redo()`, `toggleRealTimeErrors()`, `startNewGame(config)`, `tickTimer()`, `pauseTimer()`.
- **Architectural Rules:**
  - Utilize `zundo` middleware for snapshot-based undo/redo.
  - Configure `zundo`'s `partialize` to omit `elapsedTime`, `status`, and `selectedCell` to prevent the timer from polluting the history stack.
  - Implement a precomputed $O(1)$ peer-lookup map during initialization to make automatic candidate stripping (when a number is placed) completely instantaneous.

---

### Interactive Board Feature (UI Components)

Following the rule to use composition and avoid deep inheritance:

#### [NEW] src/features/interactive-board/components/Board/Board.tsx

- The primary layout component using CSS Grid. It dynamically adjusts columns/rows based on `gridSize` (4, 6, or 9).
- Uses `:nth-child` pseudo-classes to render the thick 3x3 block borders cleanly without extra wrapper divs.
- Maps over the 1D or 2D array from the store to render `Cell` components.
- Implements strict WAI-ARIA guidelines: `<div role="grid">`.
- Implements a centralized `keydown` listener to manage a **Roving Tabindex** for the grid cells, suppressing default browser scrolling.

#### [NEW] src/features/interactive-board/components/Board/Cell.tsx

- Renders an individual square. `<div role="gridcell" tabIndex={isActive ? 0 : -1}>`.
- Subscribes only to its specific state in the store using `useShallow` to prevent unnecessary re-renders.
- Dynamically synthesizes an `aria-label` (e.g., "Given clue 7", "Candidates 2, 5, and 8").
- Handles complex conditional styling for:
  - `isSelected` (highlight cell)
  - `isPeer` (highlight same row/col/box as selected cell)
  - `isError` (conflicts with another cell)
  - `isGiven` (immutable starting numbers)
- Utilizes **CSS Subgrid** (`display: grid`, `grid-template-columns: subgrid`) to render a mini 3x3 grid inside itself for pencil-mark candidates, ensuring flawless typographic alignment with the master board.

#### [NEW] src/features/interactive-board/components/Controls/Numpad.tsx

- On-screen number pad for mouse/touch users.
- Includes action buttons: Undo, Redo, Toggle Pencil Mode (with `aria-pressed`), and Hint.

#### [NEW] src/features/interactive-board/components/Header/GameHeader.tsx

- Displays the current difficulty, grid size, and a **live updating Timer component**.
- Includes **Pause/Resume controls** (pausing hides the board to prevent cheating).
- Includes a Settings gear (to toggle Real-Time Error Checking).

## Verification Plan

### Automated Tests

- Build a global Zustand mock (`src/__mocks__/zustand.ts`) that intercepts store creation and resets state via an `afterEach` hook to prevent state leakage between Vitest cases.
- Unit tests for `useBoardStore` verifying state transitions (e.g., placing a number clears corresponding candidates in peers, undo reverts state).
- Behavioral UI tests for `Board.tsx` using `@testing-library/user-event` to asynchronously simulate keyboard navigation (`await userEvent.keyboard('[ArrowRight]')`) and validate the Roving Tabindex.

### Manual Verification

- Playtest a 9x9 game to completion to verify the celebration animation triggers.
- Verify touch targets and layout responsiveness on mobile viewports via Chrome DevTools.
- Verify that performance is smooth (no input lag) by recording a session in the React DevTools Profiler during rapid numeric input. Validate that only the targeted cell turns green/yellow, and the remaining 80 cells bypass rendering.
