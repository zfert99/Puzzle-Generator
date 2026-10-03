import { useState, useSyncExternalStore } from 'react';
import type { GridSize } from '@/features/engine/sudoku';
import { activateSlot, SLOT_KEYS, type BoardMode, type BoardDifficulty, type PuzzleVariant } from './useBoardStore';
import type { SavedGame } from './useSavedGame';

/**
 * Read a saved game straight from its slot in localStorage — without the store. The hub's
 * Continue banner needs BOTH slots (a parked daily and a parked free-play game) while the store
 * holds only the active one; and a surface that has not activated its slot yet must not reach
 * into the store for it. Returns `null` for an empty slot, a solved/abandoned game, unreadable
 * storage, or on the server.
 */
export function readSavedSlot(mode: BoardMode): (SavedGame & { elapsedTime: number }) | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SLOT_KEYS[mode]);
    if (raw === null) return null;
    const state = (JSON.parse(raw) as { state?: Record<string, unknown> }).state;
    if (!state || (state.status !== 'playing' && state.status !== 'paused')) return null;
    return {
      mode,
      difficulty: state.difficulty as BoardDifficulty,
      variant: state.variant as PuzzleVariant,
      gridSize: state.gridSize as GridSize,
      dailyDate: (state.dailyDate as string | null) ?? null,
      elapsedTime: typeof state.elapsedTime === 'number' ? state.elapsedTime : 0,
    };
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Both slots as the hub sees them: `null` until mounted (server and first client render agree),
 * then whatever each slot holds. Read once per mount — the hub starts no games, so nothing can
 * change a slot while it is on screen except another tab, and a stale banner there costs a
 * click, not progress.
 */
export function useSavedSlots(): { play: ReturnType<typeof readSavedSlot>; daily: ReturnType<typeof readSavedSlot> } | null {
  const mounted = useHasMounted();
  const [slots] = useState(() => (typeof window === 'undefined' ? null : { play: readSavedSlot('play'), daily: readSavedSlot('daily') }));
  return mounted ? slots : null;
}

/**
 * Make `mode`'s slot the store's active one for the life of this surface. Runs in the first
 * client render — a `useState` initializer, not an effect — so by the time the surface is
 * mounted and reads `useSavedGame`, the store already holds this surface's slot and never the
 * other one's. A no-op on the server (`activateSlot` guards), idempotent under StrictMode.
 */
export function useBoardSlot(mode: BoardMode): void {
  useState(() => {
    activateSlot(mode);
    return mode;
  });
}
