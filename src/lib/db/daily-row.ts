import type { SudokuPuzzle, Difficulty, GridSize } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import type { KillerDifficulty } from '@/features/engine/killer/killer-sudoku';
import type { Grid, NewDailyPuzzle } from './schema';

/**
 * The daily-board registry — one entry per shared puzzle generated each day. The `key` is the
 * value stored in `daily_puzzles.difficulty`, so it doubles as the API/leaderboard key and the
 * `UNIQUE(date, key)` idempotency handle. Three sections:
 *
 * - **classic** — the original five 9×9 tiers. Their keys are the bare difficulty names, kept
 *   verbatim so every historical row stays valid (no migration).
 * - **killer** — the full 9×9 Killer ladder. (Replaces the single legacy `'killer'` key, which
 *   was one engine-medium puzzle per day; old rows remain readable via the legacy guard.)
 * - **minis** — the small boards: 4×4 and 6×6 classic, and 6×6 Killer (its full ladder).
 *
 * `minSolveMs` is the anti-cheat plausibility floor (see `solve-rules.md`) — conservative
 * lower bounds per board, not records to police fast solvers.
 */
export interface DailyBoard {
  key: string;
  section: 'classic' | 'killer' | 'minis';
  /** Short chip label for pickers/leaderboards. */
  label: string;
  variant: 'classic' | 'killer';
  gridSize: GridSize;
  /** The engine difficulty used to generate this board. */
  difficulty: Difficulty | KillerDifficulty;
  minSolveMs: number;
}

export const DAILY_BOARDS = [
  // ---- Classic 9×9 (legacy keys — never rename; historical rows depend on them) ----
  { key: 'easy', section: 'classic', label: 'easy', variant: 'classic', gridSize: 9, difficulty: 'easy', minSolveMs: 15_000 },
  { key: 'medium', section: 'classic', label: 'medium', variant: 'classic', gridSize: 9, difficulty: 'medium', minSolveMs: 20_000 },
  { key: 'hard', section: 'classic', label: 'hard', variant: 'classic', gridSize: 9, difficulty: 'hard', minSolveMs: 25_000 },
  { key: 'expert', section: 'classic', label: 'expert', variant: 'classic', gridSize: 9, difficulty: 'expert', minSolveMs: 30_000 },
  { key: 'extreme', section: 'classic', label: 'extreme', variant: 'classic', gridSize: 9, difficulty: 'extreme', minSolveMs: 45_000 },
  // ---- Killer 9×9 (full ladder) ----
  { key: 'killer-easy', section: 'killer', label: 'easy', variant: 'killer', gridSize: 9, difficulty: 'easy', minSolveMs: 20_000 },
  { key: 'killer-medium', section: 'killer', label: 'medium', variant: 'killer', gridSize: 9, difficulty: 'medium', minSolveMs: 30_000 },
  { key: 'killer-hard', section: 'killer', label: 'hard', variant: 'killer', gridSize: 9, difficulty: 'hard', minSolveMs: 40_000 },
  { key: 'killer-expert', section: 'killer', label: 'expert', variant: 'killer', gridSize: 9, difficulty: 'expert', minSolveMs: 50_000 },
  { key: 'killer-extreme', section: 'killer', label: 'extreme', variant: 'killer', gridSize: 9, difficulty: 'extreme', minSolveMs: 60_000 },
  // ---- Minis (4×4 / 6×6 classic, 6×6 Killer) ----
  { key: 'mini4-easy', section: 'minis', label: '4×4 easy', variant: 'classic', gridSize: 4, difficulty: 'easy', minSolveMs: 3_000 },
  { key: 'mini4-medium', section: 'minis', label: '4×4 medium', variant: 'classic', gridSize: 4, difficulty: 'medium', minSolveMs: 4_000 },
  { key: 'mini4-hard', section: 'minis', label: '4×4 hard', variant: 'classic', gridSize: 4, difficulty: 'hard', minSolveMs: 5_000 },
  { key: 'mini6-easy', section: 'minis', label: '6×6 easy', variant: 'classic', gridSize: 6, difficulty: 'easy', minSolveMs: 8_000 },
  { key: 'mini6-medium', section: 'minis', label: '6×6 medium', variant: 'classic', gridSize: 6, difficulty: 'medium', minSolveMs: 10_000 },
  { key: 'mini6-hard', section: 'minis', label: '6×6 hard', variant: 'classic', gridSize: 6, difficulty: 'hard', minSolveMs: 12_000 },
  { key: 'killer6-easy', section: 'minis', label: 'killer 6×6 easy', variant: 'killer', gridSize: 6, difficulty: 'easy', minSolveMs: 10_000 },
  { key: 'killer6-medium', section: 'minis', label: 'killer 6×6 medium', variant: 'killer', gridSize: 6, difficulty: 'medium', minSolveMs: 12_000 },
  { key: 'killer6-hard', section: 'minis', label: 'killer 6×6 hard', variant: 'killer', gridSize: 6, difficulty: 'hard', minSolveMs: 15_000 },
] as const satisfies readonly DailyBoard[];

export type DailyBoardKey = (typeof DAILY_BOARDS)[number]['key'];

/**
 * Every key routes accept. Includes the legacy `'killer'` key (the pre-ladder single Killer
 * daily) so archived rows stay replayable; it is never generated anymore.
 */
export type DailyDifficulty = DailyBoardKey | 'killer';

const BOARD_BY_KEY = new Map<string, DailyBoard>(DAILY_BOARDS.map((board) => [board.key, board]));

/** The registry entry for a key — `undefined` for unknown/legacy keys. */
export function getDailyBoard(key: string): DailyBoard | undefined {
  return BOARD_BY_KEY.get(key);
}

/** Narrowing guard for route input — a registry key or the legacy `'killer'`. */
export function isDailyDifficulty(value: unknown): value is DailyDifficulty {
  return typeof value === 'string' && (value === 'killer' || BOARD_BY_KEY.has(value));
}

/** Human label for any daily key (legacy `'killer'` included) or plain difficulty string. */
export function formatDailyKey(key: string): string {
  if (key === 'killer') return 'killer';
  const board = getDailyBoard(key);
  if (!board) return key;
  if (board.section === 'classic') return board.label;
  if (board.section === 'killer') return `killer ${board.label}`;
  return board.label;
}

/** Count the given (non-empty) clues in a grid — a 0 cell is empty. */
export function countClues(grid: Grid): number {
  let clues = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== 0) clues++;
    }
  }
  return clues;
}

/**
 * Map an engine-generated puzzle to a `daily_puzzles` insert row for a given UTC date under a
 * registry key. Kept pure (no DB, no clock) so both the seed script and the cron can reuse it
 * and so it is unit-testable at the boundary; the caller owns the clock AND the key (the same
 * engine difficulty generates under different keys — e.g. `medium` vs `mini6-medium`).
 *
 * Killer rows store cages and use the cage count as `clue_count` (Killer has no givens; the
 * cage count is the analogous display stat).
 */
export function toDailyPuzzleRow(
  puzzle: SudokuPuzzle | KillerPuzzle,
  isoDate: string,
  key: DailyDifficulty,
): NewDailyPuzzle {
  const isKiller = 'cages' in puzzle;
  return {
    date: isoDate,
    difficulty: key,
    grid: puzzle.grid,
    solution: puzzle.solution,
    clueCount: isKiller ? puzzle.cages.length : countClues(puzzle.grid),
    cages: isKiller ? puzzle.cages : null,
  };
}

/** Format a `Date` as an ISO `YYYY-MM-DD` string in UTC (the daily rollover zone). */
export function toUtcDateString(now: Date): string {
  return now.toISOString().slice(0, 10);
}
