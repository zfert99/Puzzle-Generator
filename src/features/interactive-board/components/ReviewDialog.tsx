'use client';

import { useDialogFocus } from '../hooks/useDialogFocus';

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
 * no way out but guessing. Fullness is judged by `useBoardReview`.
 */
export function ReviewDialog({ open, wrongCount, errorsRevealed, onKeepLooking, onReveal }: ReviewDialogProps) {
  // F7: the dialog must take focus when it appears — the active element otherwise stays on a
  // gridcell behind the backdrop, and typing keeps going into the board.
  const primaryRef = useDialogFocus<HTMLButtonElement>(open);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Board full"
    >
      <div className="rounded-2xl border-[3px] border-ink bg-paper-2 p-8 max-w-sm w-full text-center shadow-chunky">
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
      </div>
    </div>
  );
}
