import { useState, useCallback } from 'react';
import type { SudokuPuzzle } from '@/features/engine/sudoku';
import type { DailyDifficulty } from '@/lib/db/daily-row';

/** The `/api/daily` payload: a playable puzzle plus the daily's date. */
export interface DailyPuzzleResponse extends SudokuPuzzle {
  date: string;
  clueCount: number;
}

/**
 * Fetches today's daily puzzle from `GET /api/daily?difficulty=…`. The board's heavy
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
        `/api/daily?difficulty=${difficulty}${date ? `&date=${date}` : ''}`,
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
