'use client';

import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** The safe button (e.g. "Keep playing") — an explicit choice, so it can resume the game. */
  onCancel: () => void;
  /** Escape / backdrop dismiss — just close (stay on the menu). Defaults to `onCancel`. */
  onDismiss?: () => void;
}

/**
 * A small accessible confirm dialog (Biscuit Lab styling). Used for the "starting a new
 * puzzle erases your saved one" warning. Focus lands on the (safe) cancel button on open so a
 * stray Enter never destroys progress.
 *
 * `onCancel` fires on the explicit safe-button click (which may do more than dismiss — e.g.
 * resume the saved game); `onDismiss` fires on Escape / backdrop (a plain close). They're
 * separated so pressing Escape returns you to the menu rather than jumping into the game.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Start new',
  cancelLabel = 'Keep playing',
  onConfirm,
  onCancel,
  onDismiss,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dismiss = onDismiss ?? onCancel;

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={dismiss}
    >
      <div
        className="rounded-2xl border-[3px] border-ink bg-paper-2 p-6 max-w-sm w-full text-center shadow-chunky"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-xl font-semibold mb-2">
          {title}
        </h2>
        <p className="text-sm text-ink-soft mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-primary">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-3 rounded-lg border border-ink hover:bg-paper-2 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
