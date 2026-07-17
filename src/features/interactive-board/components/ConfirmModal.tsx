'use client';

import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small accessible confirm dialog (Biscuit Lab styling). Used for the "starting a new
 * puzzle erases your saved one" warning. Escape or a backdrop click cancels; focus lands on
 * the (safe) Cancel button on open so a stray Enter never destroys progress.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Start new',
  cancelLabel = 'Keep playing',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
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
