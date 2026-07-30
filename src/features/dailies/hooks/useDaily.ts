import { useState, useCallback } from 'react';
import { apiPath } from '@/lib/base-path';
import type { SudokuPuzzle } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import type { CalcPuzzle } from '@/features/engine/calc/calc-types';
import type { DailyDifficulty } from '@/lib/db/daily-row';

/**
 * The `/api/daily` payload: a playable puzzle plus the daily's date, as a discriminated
 * union — a Killer daily carries `variant: 'killer'` + `cages` (sum-based), a Keisan daily
 * `variant: 'calc'` + `cages` (operator+target), a classic daily neither. `startNewGame`
 * branches on `variant`. `difficulty` is the board KEY from the daily registry (`daily-row.ts`),
 * e.g. `killer-expert`, `mini6-hard`, or `calc6-hard`.
 */
type DailyBase = { difficulty: DailyDifficulty; date: string; clueCount: number };
export type DailyPuzzleResponse =
  | (Omit<SudokuPuzzle, 'difficulty'> & DailyBase & { variant?: undefined; cages?: undefined })
  | (Omit<KillerPuzzle, 'difficulty'> & DailyBase)
  | (Omit<CalcPuzzle, 'difficulty'> & DailyBase);

/**
 * Fetches today's daily puzzle from `GET /api/daily?difficulty=…` (via `apiPath`, which adds
 * the `/puzzles` basePath — Next does not prefix `fetch()`; see `src/lib/base-path.ts`). The board's heavy
 * logic never runs during SSR — this only fires client-side on a user action — so it
 * sidesteps the hydration-mismatch pitfall (AGENTS.md §1), same as `usePuzzle`.
 *
 * Distinct from `usePuzzle` (which POSTs to generate a throwaway puzzle) because a daily
 * is fetched, not generated: every player must get the identical stored board.
 */
export function useDaily() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDaily = useCallback(async (difficulty: DailyDifficulty, date?: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(
        apiPath(`/api/daily?difficulty=${difficulty}${date ? `&date=${date}` : ''}`),
        { method: 'GET' },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ||
            (res.status === 404 ? "Today's daily isn't ready yet" : 'Failed to load daily puzzle'),
        );
      }

      return (await res.json()) as DailyPuzzleResponse;
    } catch (err: unknown) {
      setError((err as Error).message || 'An unexpected error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, fetchDaily };
}
