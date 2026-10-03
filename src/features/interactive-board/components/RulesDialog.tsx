'use client';

import { useRef } from 'react';
import { Modal } from '@/features/chrome/Modal';
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
  kakuro: 'How to play Kakuro',
  skyscrapers: 'How to play Skyscrapers',
};

/**
 * The rules copy (QA Step 5a — net-new content, none existed anywhere in the UI). Kept to the
 * spec's shape per type: the constraint, what a cage means, one worked example. The Keisan
 * section always includes the Mystery/no-op explanation — it is the one genuinely non-obvious
 * mode and gets no other explanation in the app, so it is not worth gating behind detecting
 * whether the current board happens to be a Mystery one.
 */
function RulesBody({ variant }: { variant: PuzzleVariant }) {
  if (variant === 'skyscrapers') {
    return (
      <>
        <p className="mb-3">
          Skyscrapers (also called <strong>Towers</strong>) is a city seen from the side. Fill the
          grid with building heights from <strong>1 to N</strong> so that every row and every column
          holds each height exactly once — there are no boxes.
        </p>
        <p className="mb-3">
          A number outside the grid says <strong>how many buildings you can see</strong> looking in
          from that edge along its row or column: a taller building hides every shorter one behind
          it. Blank edges are normal — not every line gets a clue.
        </p>
        <p className="text-ink-soft text-sm">
          Example: a clue of <strong>1</strong> means the tallest building is right next to it; a
          clue of <strong>N</strong> means the heights climb 1, 2, … N from that edge. A clue turns
          red only once the cells you have filled already break it; click a clue (or press C to reach
          the clues, Enter to mark) to grey it out when you are done with it.
        </p>
      </>
    );
  }
  if (variant === 'kakuro') {
    return (
      <>
        <p className="mb-3">
          Kakuro (also called <strong>Cross Sums</strong>) is a number crossword. Fill every white
          cell with a digit from <strong>1 to 9</strong> — at any grid size — so that each{' '}
          <strong>run</strong> of white cells adds up to its clue.
        </p>
        <p className="mb-3">
          The clues sit in the black cells: the number in the <strong>upper-right</strong> half is
          the sum of the run going <em>down</em> from it, the number in the{' '}
          <strong>lower-left</strong> half is the sum of the run going <em>across</em>. A digit
          cannot repeat within a run. There are no rows, columns, or boxes to satisfy — only runs.
        </p>
        <p className="text-ink-soft text-sm">
          Example: a two-cell run summing to <strong>3</strong> must be 1 and 2; one summing to{' '}
          <strong>17</strong> must be 8 and 9. Start with the runs that have only one way to make
          their sum. (A 7×7 is named by its playable area — the clue strip along the top and left
          is not counted.)
        </p>
      </>
    );
  }

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
 * The per-type rules dialog (QA Step 5, owner ask U3). The first surface built on the native
 * `<dialog>` element — `showModal()` supplies the full a11y contract the spec demands (a real
 * focus trap, Esc-to-close, `aria-modal` semantics, focus restored to the trigger) — and since
 * October 2026 it sits on the shared `Modal` shell that generalised that choice to every dialog.
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
  const primaryRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onDismiss={onClose}
      ariaLabelledBy="rules-title"
      initialFocusRef={primaryRef}
      className="w-[calc(100%-2rem)] max-w-md"
      cardClassName="rounded-2xl border-[3px] border-ink bg-paper-2 text-ink p-6 shadow-chunky"
    >
      <h2 id="rules-title" className="text-xl font-semibold mb-3">
        {VARIANT_TITLE[variant]}
      </h2>
      <div className="text-sm text-left">
        <RulesBody variant={variant} />
      </div>
      <div className="mt-5 text-center">
        <button ref={primaryRef} type="button" onClick={onClose} className="btn-primary">
          Got it
        </button>
      </div>
    </Modal>
  );
}
