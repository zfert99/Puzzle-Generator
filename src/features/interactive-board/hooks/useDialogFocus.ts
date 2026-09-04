'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Focus management for the app's inline dialogs (QA finding F7): when `open` becomes true, move
 * focus onto the dialog's primary action (attach the returned ref to it), and when the dialog
 * closes, hand focus back to whatever had it before opening.
 *
 * Exists because the dialog shell here is a repeated JSX pattern, not a component — the "Solved!"
 * dialogs each re-created the backdrop/panel markup and every one of them left
 * `document.activeElement` sitting on a board gridcell behind the backdrop, so a keyboard or
 * screen-reader user was never told the dialog appeared and could keep typing into the board.
 * The new-game `ConfirmModal` had the focus-in half right from the start; this extracts that
 * behavior (plus the restore half) so every dialog gets it from one place.
 *
 * Restore is best-effort by design: closing a solved dialog often unmounts the board it came
 * from, and calling `.focus()` on a detached element is a spec'd no-op — the browser then falls
 * back to the document, which is the correct outcome when the opener no longer exists.
 *
 * Deliberately NOT a full focus trap: the dialogs are `aria-modal` overlays with a full-screen
 * backdrop, matching the ConfirmModal pattern the QA finding holds up as the reference. If a
 * real trap is ever wanted, prefer the native `<dialog>` element over hand-rolled Tab wrangling.
 */
export function useDialogFocus<T extends HTMLElement>(open: boolean): RefObject<T | null> {
  const primaryRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    primaryRef.current?.focus();
    return () => opener?.focus();
  }, [open]);

  return primaryRef;
}
