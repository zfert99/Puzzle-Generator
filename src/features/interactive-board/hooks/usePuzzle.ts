import { useState, useCallback } from 'react';
import { apiPath } from '@/lib/base-path';
import type { SudokuPuzzle, Difficulty, GridSize } from '@/features/engine/sudoku';
import type { KillerPuzzle } from '@/features/engine/killer/killer-types';
import type { CalcPuzzle } from '@/features/engine/calc/calc-types';
import type { KakuroPuzzle } from '@/features/engine/kakuro/kakuro-types';
import { findKakuroFixture } from '@/features/engine/kakuro/kakuro-fixtures';

type AnyPuzzle = SudokuPuzzle | KillerPuzzle | CalcPuzzle | KakuroPuzzle;

interface PuzzleRequest {
  difficulty: Difficulty;
  gridSize?: GridSize;
  variant?: 'classic' | 'killer' | 'calc' | 'kakuro';
  /** Keisan Mystery / No-Op mode — hide the cage operators (calc only). */
  noOp?: boolean;
}

/**
 * Fetches a single playable puzzle from `POST /api/puzzle` and tracks the async
 * lifecycle. Generation runs server-side (see the route), so the heavy solver never
 * enters the client bundle or blocks the main thread.
 *
 * Hydration note: this only runs on the client, in response to a user action (or a
 * mount effect), so no puzzle is ever generated during SSR — sidestepping the
 * `Math.random()` server/client mismatch class of bugs (AGENTS.md Section 1).
 *
 * **Kakuro has no generator yet** (Kakuro plan: the generator is slice E4/E5). Until then a
 * Kakuro request is served from the hand-baked fixtures without touching the network — static
 * data, so the hydration concern above does not apply. There is one fixture per size and
 * difficulty for easy/medium/hard, each labelled by the classifier; `/api/puzzle` is left
 * untouched until a real generator exists.
 */
export function usePuzzle() {
  const [puzzle, setPuzzle] = useState<AnyPuzzle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPuzzle = useCallback(async ({ difficulty, gridSize = 9, variant = 'classic', noOp }: PuzzleRequest) => {
    setError('');
    if (variant === 'kakuro') {
      const fixture = findKakuroFixture(gridSize, difficulty);
      if (!fixture) {
        // Surface it like a failed request would — never quietly hand back a different puzzle.
        setError(`No ${difficulty} Kakuro at ${gridSize}×${gridSize} yet`);
        return null;
      }
      setPuzzle(fixture);
      return fixture;
    }
    setLoading(true);
    try {
      const res = await fetch(apiPath('/api/puzzle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, gridSize, variant, noOp }),
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
