import { useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GridSize } from '@/features/engine/sudoku';
import { useBoardStore, type BoardMode, type BoardDifficulty, type PuzzleVariant } from './useBoardStore';

/**
 * A one-slot description of the single in-progress game the board store is holding, or `null`
 * when there's nothing to continue. The board store persists exactly one game to localStorage
 * (shared between `/play` and `/daily`), so "continue" and the "starting a new game erases
 * your saved puzzle" warning both key off this.
 */
export interface SavedGame {
  mode: BoardMode;
  difficulty: BoardDifficulty;
  /** Lets continue labels say "Killer · medium" instead of a misleading "9×9 · medium". */
  variant: PuzzleVariant;
  gridSize: GridSize;
  /** Seconds elapsed (the client timer; frozen while away, resumes on continue). */
  elapsedTime: number;
  /** UTC date for a daily; `null` for free play. */
  dailyDate: string | null;
}

const noopSubscribe = () => () => {};

/** True once mounted on the client — guards against reading persisted state during SSR. */
function useHasMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * The saved (resumable) game, or `null`. A game is resumable while it is `playing` or
 * `paused` — i.e. started but not yet solved and not abandoned back to `configuring`.
 *
 * Returns `null` until mounted so server and first client render agree (the store rehydrates
 * from localStorage only on the client); callers can treat `null` as "nothing to continue".
 */
export function useSavedGame(): SavedGame | null {
  const mounted = useHasMounted();
  const saved = useBoardStore(
    useShallow((s): SavedGame | null => {
      if (s.status !== 'playing' && s.status !== 'paused') return null;
      return {
        mode: s.mode,
        difficulty: s.difficulty,
        variant: s.variant,
        gridSize: s.gridSize,
        elapsedTime: s.elapsedTime,
        dailyDate: s.dailyDate,
      };
    }),
  );
  return mounted ? saved : null;
}

/** Format elapsed seconds as `M:SS` for the continue labels. */
export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
