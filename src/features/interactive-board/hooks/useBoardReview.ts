'use client';

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../store/useBoardStore';

/**
 * The "board is full but not solved" check behind the review dialog (`ReviewDialog`). A
 * daily-shaped board gives no live error feedback, so completion is judged on FULLNESS, not
 * correctness: once every editable cell holds a value, either the store says `solved` or the
 * player is told how many cells are wrong (never which).
 *
 * "Full" counts only the cells a player can edit. The first version checked
 * `every cell !== 0`, which a Kakuro can never satisfy — its black cells are stored as 0 and
 * flagged as givens — so a full-but-wrong Kakuro daily never showed the dialog, and since the
 * dialog is the only route to `revealErrors` on a daily, the player had no signal at all.
 *
 * Returns `showReview` (full, not solved, not yet dismissed this time round) and the count. The
 * dismissal clears itself as soon as the board stops being full, so re-filling it asks again.
 */
export function useBoardReview(active: boolean): { showReview: boolean; wrongCount: number; dismissReview: () => void } {
  const { isFull, wrongCount, status } = useBoardStore(
    useShallow((s) => {
      let empty = 0;
      let wrong = 0;
      for (let r = 0; r < s.grid.length; r++) {
        for (let c = 0; c < s.grid[r].length; c++) {
          if (s.givens[r]?.[c]) continue;
          const v = s.grid[r][c];
          if (v === 0) empty++;
          else if (v !== s.solution[r]?.[c]) wrong++;
        }
      }
      const isFull = s.grid.length > 0 && empty === 0;
      return { isFull, wrongCount: isFull ? wrong : 0, status: s.status };
    }),
  );
  const [dismissed, setDismissed] = useState(false);
  // Adjust-state-during-render, keyed on the previous fullness: a board that is no longer full
  // forgets its dismissal, so the dialog can reappear when it fills up again.
  const [wasFull, setWasFull] = useState(isFull);
  if (isFull !== wasFull) {
    setWasFull(isFull);
    if (!isFull) setDismissed(false);
  }
  return {
    showReview: active && isFull && status !== 'solved' && !dismissed,
    wrongCount,
    dismissReview: () => setDismissed(true),
  };
}
