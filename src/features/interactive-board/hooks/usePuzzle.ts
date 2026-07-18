import { useState, useCallback } from 'react';
import type { SudokuPuzzle, Difficulty, GridSize } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';

type AnyPuzzle = SudokuPuzzle | KillerPuzzle;

interface PuzzleRequest {
  difficulty: Difficulty;
  gridSize?: GridSize;
  variant?: 'classic' | 'killer';
}

/**
 * Fetches a single playable puzzle from `POST /api/puzzle` and tracks the async
 * lifecycle. Generation runs server-side (see the route), so the heavy solver never
 * enters the client bundle or blocks the main thread.
 *
 * Hydration note: this only runs on the client, in response to a user action (or a
 * mount effect), so no puzzle is ever generated during SSR — sidestepping the
 * `Math.random()` server/client mismatch class of bugs (AGENTS.md Section 1).
 */
export function usePuzzle() {
  const [puzzle, setPuzzle] = useState<AnyPuzzle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPuzzle = useCallback(async ({ difficulty, gridSize = 9, variant = 'classic' }: PuzzleRequest) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/puzzle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, gridSize, variant }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate puzzle');
      }

      const data: AnyPuzzle = await res.json();
      setPuzzle(data);
      return data;
    } catch (err: unknown) {
      setError((err as Error).message || 'An unexpected error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { puzzle, loading, error, fetchPuzzle };
}
