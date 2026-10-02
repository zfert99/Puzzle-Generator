import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist } from 'zustand/middleware';
import type { SudokuPuzzle, GridSize, GridConfig, Difficulty } from '@/features/engine/sudoku';
import { getGridConfig } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import type { CalcPuzzle } from '@/features/engine/calc/calc-types';
import { OPERATOR_SYMBOL } from '@/features/engine/calc/calc-types';
import { calcGridConfig } from '@/features/engine/calc/calc-generator';
import type { KakuroPuzzle, Run } from '@/features/engine/kakuro/kakuro-types';
import { kakuroGridConfig } from '@/features/engine/kakuro/kakuro-types';
import { deduceKakuro } from '@/features/engine/kakuro/kakuro-solver';
import { explainKakuroHint, type KakuroTechnique } from '@/features/engine/kakuro/kakuro-logical-solver';
import type { SkyscraperClues, SkyscrapersPuzzle, GutterSide } from '@/features/engine/skyscrapers/skyscrapers-types';
import { GUTTER_SIDES, clueFlatIndex, skyscrapersGridConfig } from '@/features/engine/skyscrapers/skyscrapers-types';
import { deduceSkyscrapers } from '@/features/engine/skyscrapers/skyscrapers-solver';
import { computePeers, toggleBit } from '../board-utils';
import { buildBlocked, buildCellToRuns, buildClues, computeRunPeers, type BoardClue } from '../kakuro-board';

/**
 * Classic Sudoku, Killer, Keisan (display name; slug `calc`), Kakuro, or Skyscrapers — the board
 * renders and plays all five. Kakuro is the odd one out: no houses, no givens, black cells,
 * digits 1–9 at every size, and peers that are run-mates rather than row/column/box.
 * Skyscrapers is a boxless Latin square (row/column peers, digits 1..N, no givens) whose only
 * extra is a strip of edge clues on all four sides — `edgeClues` — and a per-clue "done" mark.
 */
export type PuzzleVariant = 'classic' | 'killer' | 'calc' | 'kakuro' | 'skyscrapers';

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
  | (Omit<CalcPuzzle, 'difficulty'> & { difficulty: BoardDifficulty })
  | (Omit<KakuroPuzzle, 'difficulty'> & { difficulty: BoardDifficulty })
  | (Omit<SkyscrapersPuzzle, 'difficulty'> & { difficulty: BoardDifficulty });

export type GameStatus = 'configuring' | 'playing' | 'paused' | 'solved';

/**
 * What the last Hint did and why — shown under the board. Only the logical solver produces a
 * reason (Kakuro today); a plain reveal records `technique: null` with a one-line note.
 */
export interface HintNote {
  cell: number;
  digit: number;
  technique: KakuroTechnique | null;
  explanation: string;
  /** The eliminations that led there, oldest first (empty for a reveal). */
  leadUp: string[];
}

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
  givens: boolean[][];     // true = not editable: a starting clue, or (Kakuro) a black cell
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

  /**
   * Kakuro only (empty for the other variants): the puzzle's runs. This is the one Kakuro field
   * that is persisted — `blocked`, `clues` and the run-mate `peers` are all derived from it at
   * game start and again on rehydration, like `cellToCage` from `cages`.
   */
  runs: Run[];
  /** Kakuro: interior mask of black cells (in no run — D3). Derived; `[]` otherwise. */
  blocked: boolean[][];
  /**
   * Kakuro: flat cell index → [across run id, down run id] (two slots per cell, −1 = none), so
   * a cell's "same run as the selection?" highlight is O(1) like Killer's `cellToCage`.
   * Derived; `[]` otherwise.
   */
  cellToRuns: number[];
  /**
   * Kakuro: display-index → the sums a black cell shows (the display grid is `size + 1` tracks
   * per axis, gutter first). Derived; `[]` otherwise.
   */
  clues: (BoardClue | null)[];

  /**
   * Skyscrapers only (`null` otherwise): the four edge-clue arrays, 0 = blank (plan decision D2).
   * Persisted — it IS the puzzle, like `runs` for Kakuro. A clue's open / satisfied / violated
   * state is never stored: each clue cell derives it from `grid` in its own selector.
   */
  edgeClues: SkyscraperClues | null;
  /**
   * Skyscrapers: the player's manual "marked done" flags, one per clue in `clueFlatIndex` order
   * (4N entries; `[]` otherwise). A real move — persisted and undo-able (D9, Tatham's model) —
   * so it rides the temporal partialize alongside `grid` and `candidates`.
   */
  doneClues: boolean[];

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
  /** The last hint's reason, or `null`. Session state: cleared on a new game, never persisted. */
  lastHint: HintNote | null;

  // Actions
  startNewGame: (puzzle: BoardPuzzle, mode?: BoardMode, dailyDate?: string | null) => void;
  configure: () => void;
  selectCell: (r: number, c: number) => void;
  inputDigit: (digit: number) => void;
  clearCell: () => void;
  hint: () => void;
  togglePencilMode: () => void;
  /** Skyscrapers: flip a clue's "marked done" grey (a move: undo-able, persisted). */
  toggleClueDone: (side: GutterSide, index: number) => void;
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
const resolvePeers = (peers: number[][], config: GridConfig, runs: Run[]): number[][] =>
  peers.length === config.size * config.size ? peers : buildPeers(config, runs);

/** Run-mates for a Kakuro (it has runs), row/column/box peers for everything else. */
const buildPeers = (config: GridConfig, runs: Run[]): number[][] =>
  runs.length > 0 ? computeRunPeers(runs, config.size) : computePeers(config);

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
 * single-cell Keisan cage is a given, so it shows just the value (no operator). A **Mystery / no-op**
 * Keisan cage (`cage.noOp`) hides its operator, so it shows only the target (`"12"`) — that hidden
 * operator IS the puzzle.
 */
const toBoardCages = (puzzle: BoardPuzzle, variant: PuzzleVariant): BoardCage[] => {
  if (variant === 'killer') {
    return (puzzle as KillerPuzzle).cages.map((cage) => ({ id: cage.id, cells: cage.cells, label: String(cage.sum) }));
  }
  if (variant === 'calc') {
    return (puzzle as CalcPuzzle).cages.map((cage) => ({
      id: cage.id,
      cells: cage.cells,
      label: cage.cells.length === 1 || cage.noOp ? String(cage.target) : `${cage.target}${OPERATOR_SYMBOL[cage.op]}`,
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
      runs: [],
      blocked: [],
      cellToRuns: [],
      clues: [],
      edgeClues: null,
      doneClues: [],

      difficulty: 'easy' as Difficulty,
      selectedCell: null,
      pencilMode: false,
      status: 'configuring',
      mode: 'play',
      dailyDate: null,
      elapsedTime: 0,
      mistakes: 0,
      errorsRevealed: false,
      lastHint: null,

      startNewGame: (puzzle: BoardPuzzle, mode: BoardMode = 'play', dailyDate: string | null = null) => {
        const size = puzzle.gridSize as GridSize;
        // Real discriminant: killer/calc carry an explicit `variant` tag; classic (SudokuPuzzle)
        // has none. This replaces the old `'cages' in puzzle` duck-typing, which couldn't tell
        // killer from calc (both carry cages).
        const variant: PuzzleVariant = 'variant' in puzzle ? puzzle.variant : 'classic';
        // Keisan is Latin-square-only, so it uses a BOXLESS config even at 4/6 — that makes peers
        // row/col-only (the box sentinel degenerates to the row) and turns off Cell.tsx's box
        // borders (K0's `hasBoxes` gate).
        // Skyscrapers is boxless at EVERY size too (a 6×6 has no 2×3 boxes): row/column peers
        // and no box borders, with digits 1..N.
        const config =
          variant === 'calc'
            ? calcGridConfig(size)
            : variant === 'kakuro'
              ? kakuroGridConfig(size)
              : variant === 'skyscrapers'
                ? skyscrapersGridConfig(size)
                : getGridConfig(size);
        const cages = toBoardCages(puzzle, variant);
        const runs = variant === 'kakuro' ? (puzzle as KakuroPuzzle).runs : [];
        const blocked = buildBlocked(runs, size);
        // Copied, like every other puzzle field: `usePuzzle` hands over the module-level fixture
        // itself until E5, and the store must never share arrays with it.
        const sourceClues = variant === 'skyscrapers' ? (puzzle as SkyscrapersPuzzle).clues : null;
        const edgeClues = sourceClues
          ? { top: [...sourceClues.top], bottom: [...sourceClues.bottom], left: [...sourceClues.left], right: [...sourceClues.right] }
          : null;
        set({
          gridSize: size,
          config,
          grid: puzzle.grid.map(row => [...row]),
          candidates: emptyGrid(size),
          // Kakuro has no givens, but its black cells are just as uneditable — marking them as
          // givens is what makes every edit path (input, clear, hint, the Tab-stop seed) skip
          // them without a second flag to check.
          givens: variant === 'kakuro' ? blocked.map(row => [...row]) : puzzle.grid.map(row => row.map(v => v !== 0)),
          solution: puzzle.solution.map(row => [...row]),
          peers: buildPeers(config, runs),
          variant,
          cages,
          cellToCage: buildCellToCage(cages, size),
          runs,
          blocked,
          cellToRuns: buildCellToRuns(runs, size),
          clues: buildClues(runs, size),
          edgeClues,
          doneClues: edgeClues ? new Array<boolean>(4 * size).fill(false) : [],
          difficulty: puzzle.difficulty,
          selectedCell: null,
          pencilMode: false,
          status: 'playing',
          mode,
          dailyDate,
          elapsedTime: 0,
          mistakes: 0,
          errorsRevealed: false,
          lastHint: null,
        });
        // Drop any history from a previous game so the first move can't be undone
        // "before" the puzzle started.
        useBoardStore.temporal.getState().clear();
      },

      configure: () => set({ status: 'configuring', selectedCell: null }),

      selectCell: (r, c) => set({ selectedCell: { r, c } }),

      inputDigit: (digit: number) => {
        const { selectedCell, status, givens, grid, candidates, pencilMode, peers, config, solution, mistakes, variant, cages, runs } = get();
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
          // be placed again (mirrors the grayed-out numpad button). Not for Kakuro — with no
          // house constraint a digit may appear any number of times across the grid.
          if (variant !== 'kakuro') {
            let placed = 0;
            for (const row of grid) for (const v of row) if (v === digit) placed++;
            if (placed >= config.size) return;
          }

          nextGrid[r][c] = digit;
          nextCandidates[r][c] = 0; // a placed value has no pencil marks
          // Strip the placed digit from every peer's candidates (O(1) peer lookup).
          const bit = ~(1 << (digit - 1));
          for (const peer of resolvePeers(peers, config, runs)[r * config.size + c]) {
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
        // A completed grid is view-only — freeze it. Clearing the undo/redo history disables both
        // the Numpad buttons (empty history → not enabled) and the Cmd/Ctrl+Z shortcut (no-op on
        // empty history), so the finished grid can't be mutated back out of its solved state.
        if (solved) useBoardStore.temporal.getState().clear();
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
        const { status, grid, solution, givens, selectedCell, candidates, peers, config, runs, variant, edgeClues } = get();
        if (status !== 'playing') return;

        const isEditableEmpty = (r: number, c: number) => grid[r][c] === 0 && !givens[r][c];
        let target: { r: number; c: number } | null = null;
        let note: HintNote | null = null;
        const agrees = (f: { cell: number; digit: number }) =>
          f.digit === solution[Math.floor(f.cell / config.size)][f.cell % config.size];

        // Kakuro: a hint is a DEDUCTION, not a reveal, whenever the solvers can make one from the
        // board as it stands. First choice is the logical solver's next placement — a named
        // technique with a plain-English reason ("16-in-two: only {7,9}"); second is the exact
        // solver's propagation (sound, but unexplained): the selected cell if it is forced, else
        // the first forced cell. Either is used only if its digit agrees with the solution: from
        // a board holding a wrong entry, a deduction can be consistent with the mistake and wrong
        // against the answer, and a hint must never plant one — but one bad forced cell must not
        // discard the rest. Nothing usable falls through to the plain reveal below.
        if (variant === 'kakuro') {
          const shape = { gridSize: config.size, runs };
          const selectedIndex = selectedCell ? selectedCell.r * config.size + selectedCell.c : -1;
          const preferCell =
            selectedCell && isEditableEmpty(selectedCell.r, selectedCell.c) ? selectedIndex : undefined;
          // No detour (the default): the selected cell is honoured only when it is the very next
          // deduction, so the explanation always describes the board as the player sees it.
          const explained = explainKakuroHint(shape, grid, { preferCell });
          if (explained && agrees(explained)) {
            target = { r: Math.floor(explained.cell / config.size), c: explained.cell % config.size };
            note = { cell: explained.cell, digit: explained.digit, technique: explained.technique, explanation: explained.explanation, leadUp: explained.leadUp };
          } else {
            const { forced, contradiction } = deduceKakuro(shape, grid);
            if (!contradiction) {
              const pick = forced.find((f) => f.cell === selectedIndex && agrees(f)) ?? forced.find(agrees);
              if (pick) {
                target = { r: Math.floor(pick.cell / config.size), c: pick.cell % config.size };
                note = { ...pick, technique: null, explanation: 'Forced by the runs it sits in (no single named step)', leadUp: [] };
              }
            }
          }
        }

        // Skyscrapers (plan slice E1): the exact solver's propagation — the selected cell if it is
        // forced, else the first forced cell — accepted only if it agrees with the solution (L9: a
        // board holding a mistake can force a height that is consistent with the mistake). The
        // logical solver (E2) adds the named technique and the reason; until then the note says
        // the height is forced, without a single named step.
        if (variant === 'skyscrapers' && edgeClues) {
          const selectedIndex = selectedCell ? selectedCell.r * config.size + selectedCell.c : -1;
          const { forced, contradiction } = deduceSkyscrapers({ gridSize: config.size, clues: edgeClues }, grid);
          if (!contradiction) {
            const pick = forced.find((f) => f.cell === selectedIndex && agrees(f)) ?? forced.find(agrees);
            if (pick) {
              target = { r: Math.floor(pick.cell / config.size), c: pick.cell % config.size };
              note = { ...pick, technique: null, explanation: 'Forced by the clues and the row and column it sits in (no single named step)', leadUp: [] };
            }
          }
        }

        // Otherwise prefer the selected empty cell, else reveal the first empty cell.
        if (!target) {
          if (selectedCell && isEditableEmpty(selectedCell.r, selectedCell.c)) {
            target = selectedCell;
          } else {
            for (let r = 0; r < config.size && !target; r++) {
              for (let c = 0; c < config.size; c++) {
                if (isEditableEmpty(r, c)) { target = { r, c }; break; }
              }
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
        for (const peer of resolvePeers(peers, config, runs)[r * config.size + c]) {
          nextCandidates[Math.floor(peer / config.size)][peer % config.size] &= bit;
        }
        const solved = nextGrid.every((row, rr) => row.every((v, cc) => v === solution[rr][cc]));
        if (!note) {
          note = { cell: r * config.size + c, digit: value, technique: null, explanation: `Revealed ${value} at row ${r + 1}, column ${c + 1}`, leadUp: [] };
        }
        set({ grid: nextGrid, candidates: nextCandidates, selectedCell: target, status: solved ? 'solved' : 'playing', lastHint: note });
        // Freeze a completed grid (view-only) — see the note in `inputDigit`.
        if (solved) useBoardStore.temporal.getState().clear();
      },

      togglePencilMode: () => set(state => ({ pencilMode: !state.pencilMode })),

      toggleClueDone: (side, index) => {
        const { status, edgeClues, doneClues, config } = get();
        if (status !== 'playing' || !edgeClues) return;
        // Range-check the side AND the index before packing: `clueFlatIndex` is `side × N + index`,
        // so an index ≥ N would wrap into the next side's flags instead of failing.
        if (!GUTTER_SIDES.includes(side) || !Number.isInteger(index) || index < 0 || index >= config.size) return;
        const flat = clueFlatIndex(side, index, config.size);
        if (flat >= doneClues.length) return;
        const next = [...doneClues];
        next[flat] = !next[flat];
        set({ doneClues: next });
      },

      revealErrors: () => set({ errorsRevealed: true }),

      tick: () => set(state => (state.status === 'playing' ? { elapsedTime: state.elapsedTime + 1 } : {})),
      pause: () => set(state => (state.status === 'playing' ? { status: 'paused' } : {})),
      resume: () => set(state => (state.status === 'paused' ? { status: 'playing' } : {})),
    }),
      {
        // Persist the in-progress game to localStorage so a refresh resumes it.
        // Actions are dropped by JSON serialization and re-supplied by the creator;
        // derived fields are recomputed in `merge` below rather than stored.
        name: 'sudoku-board',
        // v6 (Skyscrapers V2): `edgeClues` and `doneClues` joined the persisted shape and
        // `variant` gained `'skyscrapers'`; a v5 game has neither, so a saved Skyscrapers would
        // rehydrate with an empty gutter. v5 (Kakuro V2): `runs` joined the persisted shape and
        // `variant` gained `'kakuro'`; a v4 game has no `runs`, so a saved Kakuro would rehydrate
        // with every cell white and no clues. v4 (Keisan K5): `cages` changed from Killer's `{id, sum, cells}` to the
        // normalized `BoardCage` `{id, cells, label}`, and `variant` gained `'calc'`. Saved games
        // are ephemeral — discard rather than migrate (the `migrate` below resets to the config
        // screen). v3 (K0) added `hasBoxes` to `config`; v2 added `mode`.
        version: 6,
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
          runs: state.runs,
          edgeClues: state.edgeClues,
          doneClues: state.doneClues,
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
        // Derived fields (`peers`, `cellToCage`, `blocked`, `clues`) are rebuilt HERE, inside the
        // hydration merge, so they land in the same `set` as the persisted fields they derive
        // from. They used to be assigned in `onRehydrateStorage` by mutating the state object —
        // which happens after hydration's own `set` and notifies no subscriber, so a cell that
        // had already rendered kept reading the empty arrays until the next unrelated store
        // change (Kakuro V2 found it: a resumed board came back with every cell white and no
        // clues). `merge` runs before the hydrated state is set, so nothing can observe the
        // half-built state and the `resolvePeers` self-heal above becomes a belt-and-braces.
        merge: (persisted, current) => {
          const merged = { ...current, ...(persisted as Partial<BoardState>) };
          if (merged.config) {
            const runs = merged.runs ?? [];
            merged.peers = buildPeers(merged.config, runs);
            merged.cellToCage = buildCellToCage(merged.cages ?? [], merged.config.size);
            merged.blocked = buildBlocked(runs, merged.config.size);
            merged.cellToRuns = buildCellToRuns(runs, merged.config.size);
            merged.clues = buildClues(runs, merged.config.size);
          }
          return merged;
        },
      }
    ),
    {
      // Only puzzle progress is time-travelled; ephemeral UI/session state is excluded. A
      // Skyscrapers "marked done" clue is progress too (D9) — undo takes it back like a digit.
      partialize: (state) => ({ grid: state.grid, candidates: state.candidates, doneClues: state.doneClues }),
      limit: 100,
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }
  )
);
