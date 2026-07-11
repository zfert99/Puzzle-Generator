import { create } from 'zustand';
import { temporal } from 'zundo';
import type { SudokuPuzzle, GridSize, GridConfig } from '@/features/engine/sudoku';
import { getGridConfig } from '@/features/engine/sudoku';
import { computePeers, toggleBit } from '../board-utils';

export type GameStatus = 'configuring' | 'playing' | 'paused' | 'solved';

export interface BoardState {
  // Puzzle data
  gridSize: GridSize;
  config: GridConfig;
  grid: number[][];        // current values (0 = empty)
  candidates: number[][];  // pencil-mark bitmask per cell
  givens: boolean[][];     // true = immutable starting clue
  solution: number[][];
  peers: number[][];       // flat peer indices per cell

  // UI / session state (deliberately NOT tracked by undo/redo)
  selectedCell: { r: number; c: number } | null;
  pencilMode: boolean;
  realTimeErrors: boolean;
  status: GameStatus;
  elapsedTime: number;

  // Actions
  startNewGame: (puzzle: SudokuPuzzle) => void;
  configure: () => void;
  selectCell: (r: number, c: number) => void;
  inputDigit: (digit: number) => void;
  clearCell: () => void;
  hint: () => void;
  togglePencilMode: () => void;
  toggleRealTimeErrors: () => void;
  tick: () => void;
  pause: () => void;
  resume: () => void;
}

const emptyGrid = (size: number): number[][] =>
  Array.from({ length: size }, () => Array<number>(size).fill(0));

const initialConfig = getGridConfig(9);

/**
 * The interactive board's single source of truth (Zustand + zundo). Per-cell
 * components subscribe to only their slice via `useShallow`, so an 81-cell grid
 * never re-renders wholesale on a keystroke — the crux of keeping INP low
 * (research §2, AGENTS.md Section 3).
 *
 * Undo/redo is provided by the `zundo` temporal middleware, `partialize`d to track
 * ONLY `grid` and `candidates`. Excluding the timer, status, and selection keeps
 * the history stack to genuine puzzle moves — a per-second timer tick must never
 * create an undo entry, and an undo must not rewind the clock (research §3.2).
 */
export const useBoardStore = create<BoardState>()(
  temporal(
    (set, get) => ({
      gridSize: 9,
      config: initialConfig,
      grid: emptyGrid(9),
      candidates: emptyGrid(9),
      givens: Array.from({ length: 9 }, () => Array<boolean>(9).fill(false)),
      solution: emptyGrid(9),
      peers: [],

      selectedCell: null,
      pencilMode: false,
      realTimeErrors: false,
      status: 'configuring',
      elapsedTime: 0,

      startNewGame: (puzzle: SudokuPuzzle) => {
        const size = puzzle.gridSize as GridSize;
        const config = getGridConfig(size);
        set({
          gridSize: size,
          config,
          grid: puzzle.grid.map(row => [...row]),
          candidates: emptyGrid(size),
          givens: puzzle.grid.map(row => row.map(v => v !== 0)),
          solution: puzzle.solution.map(row => [...row]),
          peers: computePeers(config),
          selectedCell: null,
          pencilMode: false,
          status: 'playing',
          elapsedTime: 0,
        });
        // Drop any history from a previous game so the first move can't be undone
        // "before" the puzzle started.
        useBoardStore.temporal.getState().clear();
      },

      configure: () => set({ status: 'configuring', selectedCell: null }),

      selectCell: (r, c) => set({ selectedCell: { r, c } }),

      inputDigit: (digit: number) => {
        const { selectedCell, status, givens, grid, candidates, pencilMode, peers, config, solution } = get();
        if (status !== 'playing' || !selectedCell) return;
        const { r, c } = selectedCell;
        if (givens[r][c]) return; // never edit a given clue

        if (pencilMode) {
          if (grid[r][c] !== 0) return; // no pencil marks on a placed cell
          const nextCandidates = candidates.map(row => [...row]);
          nextCandidates[r][c] = toggleBit(nextCandidates[r][c], digit);
          set({ candidates: nextCandidates });
          return;
        }

        // Pen mode: place the digit, or toggle it off if it's already there.
        const nextGrid = grid.map(row => [...row]);
        const nextCandidates = candidates.map(row => [...row]);

        if (nextGrid[r][c] === digit) {
          nextGrid[r][c] = 0;
        } else {
          // Lockout: once all `size` instances of a digit are on the board, it can't
          // be placed again (mirrors the grayed-out numpad button).
          let placed = 0;
          for (const row of grid) for (const v of row) if (v === digit) placed++;
          if (placed >= config.size) return;

          nextGrid[r][c] = digit;
          nextCandidates[r][c] = 0; // a placed value has no pencil marks
          // Strip the placed digit from every peer's candidates (O(1) peer lookup).
          const bit = ~(1 << (digit - 1));
          for (const peer of peers[r * config.size + c]) {
            const pr = Math.floor(peer / config.size);
            const pc = peer % config.size;
            nextCandidates[pr][pc] &= bit;
          }
        }

        const solved = nextGrid.every((row, rr) => row.every((v, cc) => v === solution[rr][cc]));
        set({ grid: nextGrid, candidates: nextCandidates, status: solved ? 'solved' : 'playing' });
      },

      clearCell: () => {
        const { selectedCell, status, givens, grid, candidates } = get();
        if (status !== 'playing' || !selectedCell) return;
        const { r, c } = selectedCell;
        if (givens[r][c]) return;
        const nextGrid = grid.map(row => [...row]);
        const nextCandidates = candidates.map(row => [...row]);
        nextGrid[r][c] = 0;
        nextCandidates[r][c] = 0;
        set({ grid: nextGrid, candidates: nextCandidates });
      },

      hint: () => {
        const { status, grid, solution, givens, selectedCell, candidates, peers, config } = get();
        if (status !== 'playing') return;

        // Prefer the selected empty cell; otherwise reveal the first empty cell.
        const isEditableEmpty = (r: number, c: number) => grid[r][c] === 0 && !givens[r][c];
        let target: { r: number; c: number } | null = null;
        if (selectedCell && isEditableEmpty(selectedCell.r, selectedCell.c)) {
          target = selectedCell;
        } else {
          for (let r = 0; r < config.size && !target; r++) {
            for (let c = 0; c < config.size; c++) {
              if (isEditableEmpty(r, c)) { target = { r, c }; break; }
            }
          }
        }
        if (!target) return;

        const { r, c } = target;
        const value = solution[r][c];
        const nextGrid = grid.map(row => [...row]);
        const nextCandidates = candidates.map(row => [...row]);
        nextGrid[r][c] = value;
        nextCandidates[r][c] = 0;
        const bit = ~(1 << (value - 1));
        for (const peer of peers[r * config.size + c]) {
          nextCandidates[Math.floor(peer / config.size)][peer % config.size] &= bit;
        }
        const solved = nextGrid.every((row, rr) => row.every((v, cc) => v === solution[rr][cc]));
        set({ grid: nextGrid, candidates: nextCandidates, selectedCell: target, status: solved ? 'solved' : 'playing' });
      },

      togglePencilMode: () => set(state => ({ pencilMode: !state.pencilMode })),
      toggleRealTimeErrors: () => set(state => ({ realTimeErrors: !state.realTimeErrors })),

      tick: () => set(state => (state.status === 'playing' ? { elapsedTime: state.elapsedTime + 1 } : {})),
      pause: () => set(state => (state.status === 'playing' ? { status: 'paused' } : {})),
      resume: () => set(state => (state.status === 'paused' ? { status: 'playing' } : {})),
    }),
    {
      // Only puzzle progress is time-travelled; ephemeral UI/session state is excluded.
      partialize: (state) => ({ grid: state.grid, candidates: state.candidates }),
      limit: 100,
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }
  )
);
