'use client';

import { useEffect, useRef } from 'react';
import type { PuzzleVariant } from '../store/useBoardStore';

/**
 * Which puzzle types this browser has seen the rules for (QA Step 5b) — keyed PER TYPE, not one
 * global flag: knowing Sudoku says nothing about what a Killer cage means. Same localStorage
 * posture as the settings store (`pl-settings`): best-effort, wrapped in try/catch, and an
 * unreadable store means "not seen", which merely re-shows a dismissible dialog.
 */
const RULES_SEEN_KEY = 'pl-rules-seen';

export function hasSeenRules(variant: PuzzleVariant): boolean {
  try {
    return JSON.parse(localStorage.getItem(RULES_SEEN_KEY) ?? '{}')[variant] === true;
  } catch {
    return false;
  }
}

export function markRulesSeen(variant: PuzzleVariant): void {
  try {
    const seen = JSON.parse(localStorage.getItem(RULES_SEEN_KEY) ?? '{}');
    seen[variant] = true;
    localStorage.setItem(RULES_SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Storage unavailable — the dialog will simply show again next time.
  }
}

const VARIANT_TITLE: Record<PuzzleVariant, string> = {
  classic: 'How to play Sudoku',
  killer: 'How to play Killer',
  calc: 'How to play Keisan',
};

/**
 * The rules copy (QA Step 5a — net-new content, none existed anywhere in the UI). Kept to the
 * spec's shape per type: the constraint, what a cage means, one worked example. The Keisan
 * section always includes the Mystery/no-op explanation — it is the one genuinely non-obvious
 * mode and gets no other explanation in the app, so it is not worth gating behind detecting
 * whether the current board happens to be a Mystery one.
 */
function RulesBody({ variant }: { variant: PuzzleVariant }) {
  if (variant === 'killer') {
    return (
      <>
        <p className="mb-3">
          Normal Sudoku rules apply: fill every row, column, and box with the digits 1 to N (the
          grid size), each exactly once — but there are <strong>no given digits</strong>.
        </p>
        <p className="mb-3">
          The dashed outlines are <strong>cages</strong>. The digits in a cage must add up to the
          small number in its corner, and a digit cannot repeat inside a cage.
        </p>
        <p className="text-ink-soft text-sm">
          Example: a two-cell cage marked <strong>3</strong> must be 1&nbsp;+&nbsp;2 — so a
          neighbouring cell in the same row can rule those digits out.
        </p>
      </>
    );
  }

  if (variant === 'calc') {
    return (
      <>
        <p className="mb-3">
          Fill every row and column with the digits 1 to N (the grid size), each exactly once.
          There are <strong>no boxes</strong> — and no given digits.
        </p>
        <p className="mb-3">
          The outlined <strong>cages</strong> each show a target and an operator: the digits in
          the cage must produce the target using that operation (<strong>12+</strong> means they
          sum to 12, <strong>3÷</strong> means one divides the other into 3). A digit{' '}
          <em>may repeat inside a cage</em> — only the row/column rule limits it. A single-cell
          cage is just that digit.
        </p>
        <p className="mb-3 text-ink-soft text-sm">
          Example: a three-cell <strong>6×</strong> cage could be 1&nbsp;×&nbsp;2&nbsp;×&nbsp;3.
        </p>
        <p className="text-ink-soft text-sm">
          🔮 <strong>Mystery mode</strong> hides the operators — a cage shows only its target,
          and working out <em>which</em> operation fits is part of the puzzle.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="mb-3">
        Fill every cell so that each <strong>row</strong>, each <strong>column</strong>, and each
        outlined <strong>box</strong> contains the digits 1 to N (the grid size), each exactly
        once.
      </p>
      <p className="text-ink-soft text-sm">
        Example: if a 4×4 row already holds 1, 3, and 4, its empty cell must be 2. Start where a
        row, column, or box is nearly full.
      </p>
    </>
  );
}

/**
 * The per-type rules dialog (QA Step 5, owner ask U3). Built on the native `<dialog>` element,
 * deliberately not on the app's hand-rolled overlay shell: `showModal()` supplies the full
 * a11y contract the spec demands — real focus trapping, Esc-to-close (the `close` event keeps
 * React's state in sync), `aria-modal` semantics, and focus restored to the trigger on close —
 * where the shared `useDialogFocus` hook is explicit about not being a focus trap.
 */
export function RulesDialog({
  variant,
  open,
  onClose,
}: {
  variant: PuzzleVariant;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Esc: the native close-request path already handles this for real user input, but some
      // input drivers (and older jsdom) never surface it as a cancel — an explicit handler makes
      // the behaviour uniform and testable. preventDefault stops the native path double-firing;
      // onClose is idempotent anyway (setState(false) + an idempotent localStorage write).
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
      aria-labelledby="rules-title"
      className="rounded-2xl border-[3px] border-ink bg-paper-2 text-ink p-6 max-w-md w-[calc(100%-2rem)] shadow-chunky backdrop:bg-black/50 m-auto"
    >
      <h2 id="rules-title" className="text-xl font-semibold mb-3">
        {VARIANT_TITLE[variant]}
      </h2>
      <div className="text-sm text-left">
        <RulesBody variant={variant} />
      </div>
      <div className="mt-5 text-center">
        <button type="button" autoFocus onClick={onClose} className="btn-primary">
          Got it
        </button>
      </div>
    </dialog>
  );
}
