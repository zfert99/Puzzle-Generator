'use client';

import { useRef, type ReactNode } from 'react';
import { Modal } from '@/features/chrome/Modal';
import { SolvedStamp } from '@/features/juice/SolvedStamp';
import { formatElapsed } from '../store/useSavedGame';

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
  /** Escape / backdrop. Defaults to the primary action, so the dialog can always be left. */
  onDismiss?: () => void;
}

/**
 * The shared "you solved it" dialog: the native `Modal` shell, chunky panel, `SolvedStamp`,
 * the time · mistakes line, then the actions row. Extracted because /play, /daily and
 * /archive each hand-rolled this shell and every copy had to re-wire the F7 focus
 * management; the shell now owns it (focus the primary on open, trap Tab, restore the opener
 * on close — the October 2026 native-dialog migration).
 *
 * Mount it only when the puzzle is actually solved (`status === 'solved' && <SolvedDialog…>`):
 * `SolvedStamp` fires its confetti on mount, and mounting is also what opens the shell — so
 * there is deliberately no `open` prop.
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
  onDismiss,
}: SolvedDialogProps) {
  // F7: the dialog must take focus when it appears — without this the active element stays
  // on a gridcell behind the backdrop and keyboard/screen-reader users are never told.
  const primaryRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal open onDismiss={onDismiss ?? onPrimary} ariaLabel={ariaLabel} initialFocusRef={primaryRef}>
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
    </Modal>
  );
}
