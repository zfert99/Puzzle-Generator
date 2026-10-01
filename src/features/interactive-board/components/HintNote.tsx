'use client';

import { useBoardStore } from '../store/useBoardStore';

/**
 * The last hint's reason, under the board: "Hint — Only 9 fits at row 2, column 4 (across
 * 16-in-two; down 17-in-two)". A `role="status"` live region, so a screen-reader user hears the
 * explanation the moment the digit lands rather than only the placement (which the
 * `BoardAnnouncer` already announces). Renders nothing until a hint has been taken.
 *
 * The lead-up (the eliminations that made the placement possible) is listed when there is one:
 * that is the "why" a player can learn from, and it is what distinguishes a solver-explained
 * hint from a plain reveal.
 */
export function HintNote() {
  const hint = useBoardStore((s) => s.lastHint);
  if (!hint) return null;

  return (
    <div role="status" className="mt-4 w-full max-w-[520px] mx-auto text-sm text-ink-soft">
      <p>
        <span className="font-semibold text-ink">Hint</span> — {hint.explanation}
      </p>
      {hint.leadUp.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer">How we got there ({hint.leadUp.length} steps)</summary>
          <ol className="list-decimal ml-5 mt-1 space-y-0.5">
            {hint.leadUp.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
