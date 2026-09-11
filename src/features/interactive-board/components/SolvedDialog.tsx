'use client';

import type { ReactNode } from 'react';
import { SolvedStamp } from '@/features/juice/SolvedStamp';
import { formatElapsed } from '../store/useSavedGame';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface SolvedDialogProps {
  /** Accessible name for the dialog (e.g. "Daily solved"). */
  ariaLabel: string;
  /** Text stamped on the `SolvedStamp` badge (e.g. "Solved!"). */
  stampLabel: string;
  elapsedSeconds: number;
  mistakes: number;
  /** The focused-on-open primary action; the dialog renders and styles the button itself. */
  primaryLabel: string;
  onPrimary: () => void;
  /** Extra content between the stats line and the actions (rank line, practice note). */
  children?: ReactNode;
  /** Optional second action rendered beside the primary — a caller-styled button or Link. */
  secondaryAction?: ReactNode;
}

/**
 * The shared "you solved it" overlay: full-screen backdrop, chunky panel, `SolvedStamp`,
 * the time · mistakes line, then the actions row. Extracted because /play, /daily and
 * /archive each hand-rolled this shell and every copy had to re-wire the F7 focus
 * management; now `useDialogFocus` (focus the primary on open, restore the opener on
 * close) lives here once.
 *
 * Mount it only when the puzzle is actually solved (`status === 'solved' && <SolvedDialog…>`):
 * `SolvedStamp` fires its confetti on mount, and mounting is also what drives the focus
 * hook — so there is deliberately no `open` prop.
 *
 * Deliberately NOT a focus trap — an `aria-modal` overlay matching the ConfirmModal
 * posture (see `useDialogFocus`). If that is ever upgraded to the native `<dialog>`,
 * this component is the one place the three solved dialogs change.
 */
export function SolvedDialog({
  ariaLabel,
  stampLabel,
  elapsedSeconds,
  mistakes,
  primaryLabel,
  onPrimary,
  children,
  secondaryAction,
}: SolvedDialogProps) {
  // F7: the dialog must take focus when it appears — without this the active element stays
  // on a gridcell behind the backdrop and keyboard/screen-reader users are never told.
  const primaryRef = useDialogFocus<HTMLButtonElement>(true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="rounded-2xl border-[3px] border-ink bg-paper-2 p-8 max-w-sm w-full text-center shadow-chunky">
        <SolvedStamp label={stampLabel} />
        <p className="text-sm text-ink-soft mb-2">
          {formatElapsed(elapsedSeconds)} · {mistakes} mistake{mistakes === 1 ? '' : 's'}
        </p>
        {children}
        <div className="mt-6 flex gap-3 justify-center">
          <button ref={primaryRef} type="button" onClick={onPrimary} className="btn-primary">
            {primaryLabel}
          </button>
          {secondaryAction}
        </div>
      </div>
    </div>
  );
}
