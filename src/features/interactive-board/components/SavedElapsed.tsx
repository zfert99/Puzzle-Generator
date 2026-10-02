'use client';

import { useBoardStore } from '../store/useBoardStore';
import { formatElapsed } from '../store/useSavedGame';

/**
 * The saved game's clock as `M:SS` — the "Continue · 3:12" label on the hub banner and the
 * play/daily menus. It is its own tiny component so that only THIS text subscribes to
 * `elapsedTime`: when the clock was a field of `useSavedGame`, every Experience component that
 * called the hook re-rendered once a second while a game was running — and with it the whole
 * board tree, the numpad and the cage overlay — to update a label that was not even on screen.
 */
export function SavedElapsed() {
  const elapsedTime = useBoardStore((s) => s.elapsedTime);
  return <>{formatElapsed(elapsedTime)}</>;
}
