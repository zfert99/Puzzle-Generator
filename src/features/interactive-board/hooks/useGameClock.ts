'use client';

import { useEffect } from 'react';
import { useBoardStore } from '../store/useBoardStore';

/**
 * The one game clock: ticks the store's `elapsedTime` once a second while `active`, and ONLY
 * while the tab is visible. `/play`, `/daily` and `/archive` each used to own a copy of this
 * interval, and none of them watched `visibilitychange` — so a backgrounded tab kept counting
 * at whatever rate the browser throttled it to (Chrome: full speed for ~5 minutes, then about
 * once a minute; iOS Safari: suspended entirely). A ranked time therefore partly counted the
 * minutes a player spent in another tab, and by an amount that varied by browser. The product
 * rule is that leaving freezes the clock (`useSavedGame` says as much), so a hidden document
 * simply does not tick; coming back resumes the interval.
 *
 * Not a pause: the game's `status` is untouched, so no "Paused" placeholder appears and nothing
 * has to be clicked on return — the clock just did not run while nobody could see the board.
 *
 * `active` is the caller's "this surface is showing a live board" (its view is the board AND
 * the store's status is `playing`); the store's own `tick` additionally no-ops unless playing.
 */
export function useGameClock(active: boolean): void {
  const tick = useBoardStore((s) => s.tick);

  useEffect(() => {
    if (!active) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id == null) id = setInterval(tick, 1000);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const syncToVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };
    syncToVisibility();
    document.addEventListener('visibilitychange', syncToVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', syncToVisibility);
    };
  }, [active, tick]);
}
