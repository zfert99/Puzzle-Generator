import type { SudokuPuzzle } from '@/features/engine/sudoku';
import type { Grid, NewDailyPuzzle } from './schema';

/**
 * Difficulties eligible for a daily puzzle — the full range including 'extreme'. The cron
 * generates one puzzle per entry each day; the order here is the order shown in the UI.
 */
export const DAILY_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'extreme'] as const;
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
 */
export function toDailyPuzzleRow(puzzle: SudokuPuzzle, isoDate: string): NewDailyPuzzle {
  return {
    date: isoDate,
    difficulty: puzzle.difficulty,
    grid: puzzle.grid,
    solution: puzzle.solution,
    clueCount: countClues(puzzle.grid),
  };
}

/** Format a `Date` as an ISO `YYYY-MM-DD` string in UTC (the daily rollover zone). */
export function toUtcDateString(now: Date): string {
  return now.toISOString().slice(0, 10);
}
