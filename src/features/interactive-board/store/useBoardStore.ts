import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist } from 'zustand/middleware';
import type { SudokuPuzzle, GridSize, GridConfig, Difficulty } from '@/features/engine/sudoku';
import { getGridConfig } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import type { CalcPuzzle } from '@/features/engine/calc/calc-types';
import { OPERATOR_SYMBOL } from '@/features/engine/calc/calc-types';
import { calcGridConfig } from '@/features/engine/calc/calc-generator';
import { computePeers, toggleBit } from '../board-utils';

/** Classic Sudoku, Killer, or Keisan (display name; slug `calc`) — the board renders and plays all three. */
export type PuzzleVariant = 'classic' | 'killer' | 'calc';

/**
 * A cage normalized for the board — cells plus a pre-formatted corner label (Killer's sum `"12"`,
 * Keisan's target+operator `"12+"`/`"3÷"`). The board never touches cage arithmetic; both variants
 * collapse to this shape at `startNewGame`, so cage rendering, `cellToCage`, and pencil-stripping
 * are variant-agnostic (the one exception — Killer-only pencil stripping — is gated on `variant`).
 */
export interface BoardCage {
  id: number;
  cells: number[];
  label: string;
}

import type { DailyDifficulty } from '@/lib/db/daily-row';

/**
 * What the board holds as the game's difficulty: an engine difficulty for free play, or a
 * daily board KEY (`killer-expert`, `mini6-hard`, legacy `killer`) for dailies — display
 * surfaces prettify keys via `formatDailyKey`.
 */
export type BoardDifficulty = Difficulty | DailyDifficulty;

/** A puzzle the board can start — engine-generated or a daily row (whose key may be 'killer'). */
export type BoardPuzzle =
  | (Omit<SudokuPuzzle, 'difficulty'> & { difficulty: BoardDifficulty })
  | (Omit<KillerPuzzle, 'difficulty'> & { difficulty: BoardDifficulty })
  | (Omit<CalcPuzzle, 'difficulty'> & { difficulty: BoardDifficulty });

export type GameStatus = 'configuring' | 'playing' | 'paused' | 'solved';

/**
 * Which surface started the current game. The board store is shared between `/play` and
 * `/daily`, so each surface renders a game only when it owns it — otherwise a persisted
 * daily would leak onto `/play` (and vice versa). "New game" then always stays in context.
 */
export type BoardMode = 'play' | 'daily';

export interface BoardState {
  // Puzzle data
  gridSize: GridSize;
  config: GridConfig;
  grid: number[][];        // current values (0 = empty)
  candidates: number[][];  // pencil-mark bitmask per cell
  givens: boolean[][];     // true = immutable starting clue
  solution: number[][];
  peers: number[][];       // flat peer indices per cell

  /** 'classic', 'killer', or 'calc' (Keisan). Killer/Keisan add cage constraints + rendering. */
  variant: PuzzleVariant;
  /** Normalized cages (empty for classic) — drives cage rendering and (Killer only) pencil stripping. */
  cages: BoardCage[];
  /**
   * Flat cell index → cage id (−1 = no cage / classic). Precomputed at game start so each
   * cell's highlight selector answers "same cage as the selection?" in O(1) — scanning
   * `cages` per cell per keystroke would break the INP budget. Derived from `cages`, so it
   * is rebuilt on rehydration rather than persisted (same treatment as `peers`).
   */
  cellToCage: number[];

  // UI / session state (deliberately NOT tracked by undo/redo)
  difficulty: BoardDifficulty;
  selectedCell: { r: number; c: number } | null;
  pencilMode: boolean;
  status: GameStatus;
  mode: BoardMode;
  /**
   * For a daily game, the UTC date (`YYYY-MM-DD`) it belongs to — persisted so a resumed
   * daily can restore its header and decide whether it's today's (rankable) daily or an
   * archived (unranked) one. `null` for free play.
   */
  dailyDate: string | null;
  elapsedTime: number;
  mistakes: number;
  /**
   * Opt-in, one-way reveal of error highlighting on a daily (which otherwise never shows
   * wrong cells — see `Cell.tsx`/`BoardAnnouncer.tsx`). Off by default so the ranked board
   * stays hand-holding-free; a player can flip it on themselves from the "Not quite!" full-
   * board review modal (`DailyExperience`) once they're stuck. Ignored in free play, where
   * highlighting instead follows the app-wide `errorHighlight` setting.
   */
  errorsRevealed: boolean;

  // Actions
  startNewGame: (puzzle: BoardPuzzle, mode?: BoardMode, dailyDate?: string | null) => void;
  configure: () => void;
  selectCell: (r: number, c: number) => void;
  inputDigit: (digit: number) => void;
  clearCell: () => void;
  hint: () => void;
  togglePencilMode: () => void;
  revealErrors: () => void;
  tick: () => void;
  pause: () => void;
  resume: () => void;
}

const emptyGrid = (size: number): number[][] =>
  Array.from({ length: size }, () => Array<number>(size).fill(0));

/**
 * `peers` self-heal: normally precomputed once and reused (the whole point is avoiding an
 * O(size²) rebuild per keystroke), but it can momentarily lag `config` during Zustand
 * rehydration — `config`/`status` restore synchronously from localStorage, while the
 * `onRehydrateStorage` callback that rebuilds `peers` (never persisted) can run a tick later.
 * A stale/empty `peers` indexed by the CURRENT config's size throws ("is not iterable")
 * instead of silently doing nothing, so callers that read `peers[r * config.size + c]` route
 * through this first rather than crashing on that narrow window.
 */
const resolvePeers = (peers: number[][], config: GridConfig): number[][] =>
  peers.length === config.size * config.size ? peers : computePeers(config);

/** Flat cell index → cage id map (−1 where uncaged); [] for classic games. */
const buildCellToCage = (cages: BoardCage[], size: number): number[] => {
  if (cages.length === 0) return [];
  const map = new Array<number>(size * size).fill(-1);
  for (const cage of cages) {
    for (const cell of cage.cells) map[cell] = cage.id;
  }
  return map;
};

/**
 * Normalize a puzzle's cages to the board's label-carrying shape. Killer labels are the bare sum
 * (`"12"`); Keisan labels are the target followed by its operator glyph (`"12+"`, `"3÷"`) — a
 * single-cell Keisan cage is a given, so it shows just the value (no operator).
 */
const toBoardCages = (puzzle: BoardPuzzle, variant: PuzzleVariant): BoardCage[] => {
  if (variant === 'killer') {
    return (puzzle as KillerPuzzle).cages.map((cage) => ({ id: cage.id, cells: cage.cells, label: String(cage.sum) }));
  }
  if (variant === 'calc') {
    return (puzzle as CalcPuzzle).cages.map((cage) => ({
      id: cage.id,
      cells: cage.cells,
      label: cage.cells.length === 1 ? String(cage.target) : `${cage.target}${OPERATOR_SYMBOL[cage.op]}`,
    }));
  }
  return [];
};

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
    persist(
      (set, get) => ({
      gridSize: 9,
      config: initialConfig,
      grid: emptyGrid(9),
      candidates: emptyGrid(9),
      givens: Array.from({ length: 9 }, () => Array<boolean>(9).fill(false)),
      solution: emptyGrid(9),
      peers: [],

      variant: 'classic',
      cages: [],
      cellToCage: [],

      difficulty: 'easy' as Difficulty,
      selectedCell: null,
      pencilMode: false,
      status: 'configuring',
      mode: 'play',
      dailyDate: null,
      elapsedTime: 0,
      mistakes: 0,
      errorsRevealed: false,

      startNewGame: (puzzle: BoardPuzzle, mode: BoardMode = 'play', dailyDate: string | null = null) => {
        const size = puzzle.gridSize as GridSize;
        // Real discriminant: killer/calc carry an explicit `variant` tag; classic (SudokuPuzzle)
        // has none. This replaces the old `'cages' in puzzle` duck-typing, which couldn't tell
        // killer from calc (both carry cages).
        const variant: PuzzleVariant = 'variant' in puzzle ? puzzle.variant : 'classic';
        // Keisan is Latin-square-only, so it uses a BOXLESS config even at 4/6 — that makes peers
        // row/col-only (the box sentinel degenerates to the row) and turns off Cell.tsx's box
        // borders (K0's `hasBoxes` gate).
        const config = variant === 'calc' ? calcGridConfig(size) : getGridConfig(size);
        const cages = toBoardCages(puzzle, variant);
        set({
          gridSize: size,
          config,
          grid: puzzle.grid.map(row => [...row]),
          candidates: emptyGrid(size),
          givens: puzzle.grid.map(row => row.map(v => v !== 0)),
          solution: puzzle.solution.map(row => [...row]),
          peers: computePeers(config),
          variant,
          cages,
          cellToCage: buildCellToCage(cages, size),
          difficulty: puzzle.difficulty,
          selectedCell: null,
          pencilMode: false,
          status: 'playing',
          mode,
          dailyDate,
          elapsedTime: 0,
          mistakes: 0,
          errorsRevealed: false,
        });
        // Drop any history from a previous game so the first move can't be undone
        // "before" the puzzle started.
        useBoardStore.temporal.getState().clear();
      },

      configure: () => set({ status: 'configuring', selectedCell: null }),

      selectCell: (r, c) => set({ selectedCell: { r, c } }),

      inputDigit: (digit: number) => {
        const { selectedCell, status, givens, grid, candidates, pencilMode, peers, config, solution, mistakes, variant, cages } = get();
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
        let mistakeIncrement = 0;

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
          for (const peer of resolvePeers(peers, config)[r * config.size + c]) {
            const pr = Math.floor(peer / config.size);
            const pc = peer % config.size;
            nextCandidates[pr][pc] &= bit;
          }
          // Killer: a digit can't repeat within a cage either — strip it from the cage-mates'
          // pencil marks (the solution already encodes the constraint, so a repeat still counts
          // as a mistake; this just keeps candidates honest).
          if (variant === 'killer') {
            const cellIdx = r * config.size + c;
            const cage = cages.find((cg) => cg.cells.includes(cellIdx));
            if (cage) {
              for (const cell of cage.cells) {
                if (cell === cellIdx) continue;
                nextCandidates[Math.floor(cell / config.size)][cell % config.size] &= bit;
              }
            }
          }
          // A placement that doesn't match the solution is a mistake.
          if (digit !== solution[r][c]) mistakeIncrement = 1;
        }

        const solved = nextGrid.every((row, rr) => row.every((v, cc) => v === solution[rr][cc]));
        set({
          grid: nextGrid,
          candidates: nextCandidates,
          status: solved ? 'solved' : 'playing',
          mistakes: mistakes + mistakeIncrement,
        });
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
        for (const peer of resolvePeers(peers, config)[r * config.size + c]) {
          nextCandidates[Math.floor(peer / config.size)][peer % config.size] &= bit;
        }
        const solved = nextGrid.every((row, rr) => row.every((v, cc) => v === solution[rr][cc]));
        set({ grid: nextGrid, candidates: nextCandidates, selectedCell: target, status: solved ? 'solved' : 'playing' });
      },

      togglePencilMode: () => set(state => ({ pencilMode: !state.pencilMode })),
      revealErrors: () => set({ errorsRevealed: true }),

      tick: () => set(state => (state.status === 'playing' ? { elapsedTime: state.elapsedTime + 1 } : {})),
      pause: () => set(state => (state.status === 'playing' ? { status: 'paused' } : {})),
      resume: () => set(state => (state.status === 'paused' ? { status: 'playing' } : {})),
    }),
      {
        // Persist the in-progress game to localStorage so a refresh resumes it.
        // Actions are dropped by JSON serialization and re-supplied by the creator;
        // peers are recomputed on rehydration rather than stored.
        name: 'sudoku-board',
        // v4 (Keisan K5): `cages` changed from Killer's `{id, sum, cells}` to the normalized
        // `BoardCage` `{id, cells, label}`, and `variant` gained `'calc'`. A persisted v3 game has
        // the old cage shape (no `label`), so its cage overlay would render blank labels. Saved
        // games are ephemeral — discard rather than migrate (the `migrate` below resets to the
        // config screen). v3 (K0) added `hasBoxes` to `config`; v2 added `mode`.
        version: 4,
        // A saved game is ephemeral, so old persisted shapes aren't worth migrating — but a
        // version mismatch with NO migrate makes zustand log a console.error (surfaced as the
        // Next.js error overlay). Discard cleanly instead: drop the stale game and land the
        // player on the menu (no resumable state), silently.
        migrate: () => ({ status: 'configuring' as GameStatus }),
        partialize: (state) => ({
          gridSize: state.gridSize,
          config: state.config,
          grid: state.grid,
          candidates: state.candidates,
          givens: state.givens,
          solution: state.solution,
          variant: state.variant,
          cages: state.cages,
          difficulty: state.difficulty,
          selectedCell: state.selectedCell,
          pencilMode: state.pencilMode,
          status: state.status,
          mode: state.mode,
          dailyDate: state.dailyDate,
          elapsedTime: state.elapsedTime,
          mistakes: state.mistakes,
          errorsRevealed: state.errorsRevealed,
        }),
        onRehydrateStorage: () => (state) => {
          if (state && state.config) {
            state.peers = computePeers(state.config);
            state.cellToCage = buildCellToCage(state.cages ?? [], state.config.size);
          }
        },
      }
    ),
    {
      // Only puzzle progress is time-travelled; ephemeral UI/session state is excluded.
      partialize: (state) => ({ grid: state.grid, candidates: state.candidates }),
      limit: 100,
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }
  )
);
