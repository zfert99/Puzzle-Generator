import type { SudokuPuzzle } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import type { Grid, NewDailyPuzzle } from './schema';

/**
 * Difficulties eligible for a daily puzzle — the five classic tiers plus `'killer'`, the one
 * Killer daily per day (engine-medium; its row stores the literal difficulty `'killer'`, so
 * the `UNIQUE(date, difficulty)` key and the difficulty-keyed solve flow need no variant
 * column). The cron generates one puzzle per entry each day; the order here is the UI order.
 */
export const DAILY_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'extreme', 'killer'] as const;
export type DailyDifficulty = (typeof DAILY_DIFFICULTIES)[number];

/** Narrowing guard for route input — is this string one of the daily difficulties? */
export function isDailyDifficulty(value: unknown): value is DailyDifficulty {
  return typeof value === 'string' && (DAILY_DIFFICULTIES as readonly string[]).includes(value);
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
 * Map an engine-generated puzzle to a `daily_puzzles` insert row for a given UTC date.
 *
 * Kept pure (no DB, no clock) so both the seed script and the 4.2 cron can reuse it and
 * so it is unit-testable at the boundary. `date` must be an ISO `YYYY-MM-DD` string in
 * UTC — the caller owns the clock (AGENTS.md microbenchmark/determinism guidance and
 * the "compute time server-side" anti-cheat posture both favor an injected date).
 *
 * A Killer puzzle stores the literal difficulty `'killer'` (its engine difficulty is a
 * generation detail — one Killer daily per day), its cages, and its cage count in
 * `clue_count` (Killer has no given clues; the cage count is the analogous display stat).
 */
export function toDailyPuzzleRow(puzzle: SudokuPuzzle | KillerPuzzle, isoDate: string): NewDailyPuzzle {
  const isKiller = 'cages' in puzzle;
  return {
    date: isoDate,
    difficulty: isKiller ? 'killer' : puzzle.difficulty,
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
