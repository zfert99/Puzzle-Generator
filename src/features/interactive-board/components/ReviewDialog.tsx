'use client';

import { useRef } from 'react';
import { Modal } from '@/features/chrome/Modal';

interface ReviewDialogProps {
  open: boolean;
  wrongCount: number;
  /** Already revealed once — the reveal button is withheld. */
  errorsRevealed: boolean;
  onKeepLooking: () => void;
  onReveal: () => void;
}

/**
 * "Not quite!" — the board is full but not correct. Tells the player how many cells are wrong
 * (not which), and lets them go back to fix them or opt into error highlighting for the rest
 * of this attempt (`revealErrors`, a one-way reveal). A daily-shaped board gives no live error
 * feedback, so this is the moment they learn their count. Shared by `/daily` and the archive's
 * practice replays — the archive used to render nothing here, leaving a full, wrong board with
 * no way out but guessing. Fullness is judged by `useBoardReview`. On the native `Modal` shell:
 * focus lands on "Keep looking", Tab stays inside, Escape and the backdrop mean "keep looking".
 */
export function ReviewDialog({ open, wrongCount, errorsRevealed, onKeepLooking, onReveal }: ReviewDialogProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal open={open} onDismiss={onKeepLooking} ariaLabel="Board full" initialFocusRef={primaryRef}>
      <div className="text-4xl mb-2" aria-hidden="true">🔍</div>
      <h2 className="font-display text-2xl mb-1">Not quite!</h2>
      <p className="text-sm text-ink-soft mb-6">
        The board is full, but{' '}
        <strong className="text-ink">
          {wrongCount} cell{wrongCount === 1 ? ' is' : 's are'}
        </strong>{' '}
        still incorrect. Find and fix {wrongCount === 1 ? 'it' : 'them'} to solve the puzzle.
      </p>
      <div className="flex gap-3 justify-center">
        <button ref={primaryRef} type="button" onClick={onKeepLooking} className="btn-primary">
          Keep looking
        </button>
        {!errorsRevealed && (
          <button
            type="button"
            onClick={onReveal}
            className="px-5 py-3 rounded-lg border border-ink hover:bg-paper-2 transition-colors"
          >
            Show me what&apos;s wrong
          </button>
        )}
      </div>
    </Modal>
  );
}
