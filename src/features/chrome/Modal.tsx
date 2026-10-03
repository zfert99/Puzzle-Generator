'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface ModalProps {
  open: boolean;
  /** Escape or a click on the backdrop. Never fired for a programmatic close (`open` → false). */
  onDismiss: () => void;
  /** Accessible name — pass one of the two. */
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /** The element to focus on open; defaults to the first focusable control in the card. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Sizing classes for the dialog box itself (width). Default: a small card. */
  className?: string;
  /** Classes for the card (the dialog's one child). Default: the chunky paper panel. */
  cardClassName?: string;
  children: ReactNode;
}

const DEFAULT_WIDTH = 'w-[calc(100%-2rem)] max-w-sm';
const DEFAULT_CARD = 'rounded-2xl border-[3px] border-ink bg-paper-2 text-ink p-8 text-center shadow-chunky';

/**
 * The app's one modal shell, on the native `<dialog>` element via `showModal()`.
 *
 * Why native: `showModal()` is the only thing in the platform that gives a real focus trap AND
 * makes everything behind the dialog inert — Tab cannot reach the board, the header or the page
 * under the scrim. The five hand-rolled overlays this replaced (confirm, solved, review, settings,
 * calculator) were `aria-modal` divs: Escape and a focused primary button, but Tab walked straight
 * out of them onto controls hidden behind the backdrop, and a screen reader could still read the
 * page beneath (WCAG 2.4.3 / 2.4.11 — the October 2026 a11y review's A12). `RulesDialog` had
 * already proven the element here; this is that pattern, once, with the behaviour the others had
 * grown separately: dismiss on Escape and backdrop click, a deterministic initial focus, and focus
 * handed back to the opener on close.
 *
 * Mount it only while open (`{open && <Modal …>}` is fine, and so is a constant `open`): the
 * dialog is rendered only when `open` is true, so a closed modal leaves nothing in the DOM.
 *
 * - **Escape** fires the native `cancel` event; it is intercepted so React state stays the source
 *   of truth (`onDismiss`) rather than the element closing itself and drifting from `open`.
 * - **Backdrop click**: a click whose target is the `<dialog>` itself (its `::backdrop` and its
 *   own padding — never the card) dismisses.
 * - **Initial focus**: React's `autoFocus` runs at mount, before `showModal()`, so the dialog
 *   focusing steps never see it; focus is placed explicitly after opening, on `initialFocusRef`
 *   or the first focusable control.
 * - **Focus restore**: the opener (`document.activeElement` at open) gets focus back on close or
 *   unmount — browsers do this for `close()` natively; doing it here as well covers unmount and
 *   the jsdom polyfill (`vitest.setup.ts`), which implements neither.
 */
export function Modal({
  open,
  onDismiss,
  ariaLabel,
  ariaLabelledBy,
  initialFocusRef,
  className = DEFAULT_WIDTH,
  cardClassName = DEFAULT_CARD,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const target =
      initialFocusRef?.current ??
      dialog.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    target?.focus();
    return () => {
      if (dialog.open) dialog.close();
      opener?.focus();
    };
    // `initialFocusRef` is a ref: stable identity, read at open time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      // Escape: the native close-request path fires `cancel`; keep the element from closing
      // itself and let the owner's state decide (it may, e.g., resume a game on dismiss).
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onDismiss();
      }}
      className={`m-auto bg-transparent p-0 backdrop:bg-black/50 ${className}`}
    >
      <div className={cardClassName}>{children}</div>
    </dialog>
  );
}
