'use client';

import { useBoardStore } from '../store/useBoardStore';

const HINTS: ReadonlyArray<readonly [string, string]> = [
  ['↑ ↓ ← →', 'Move selection'],
  ['1–9', 'Enter number'],
  ['Backspace', 'Erase cell'],
  ['Space / P', 'Toggle pencil marks'],
  ['⌘Z / Ctrl+Z', 'Undo'],
  ['⇧⌘Z / Ctrl+Y', 'Redo'],
];

/** The gutter keys a Skyscrapers board adds (D9) — listed only while one is on the board. */
const SKYSCRAPERS_HINTS: ReadonlyArray<readonly [string, string]> = [
  ['C', 'Jump to the clues'],
  ['Enter / Space', 'Mark a clue done'],
  ['Esc', 'Back to the board'],
];

/**
 * A compact legend of the board's keyboard controls, so the shortcuts implemented in
 * `Board` are discoverable rather than hidden. Reads one store field — the board's variant —
 * so the Skyscrapers gutter keys appear on every surface that shows this legend (play, daily,
 * archive) without each passing a prop (the G8 pass: the `C` key was mentioned only in the
 * rules dialog, so a keyboard user who skipped it could never reach the clues).
 * Hidden below the `sm` breakpoint — a touch-only device has no keyboard, so the legend
 * is just noise there. A pure CSS breakpoint (not a JS viewport check) so there is no
 * server/client mismatch to worry about (AGENTS.md hydration-safety rule).
 */
export function KeyboardHints() {
  const variant = useBoardStore((s) => s.variant);
  const hints = variant === 'skyscrapers' ? [...HINTS, ...SKYSCRAPERS_HINTS] : HINTS;
  return (
    <div className="hidden sm:block mt-6 w-full max-w-[520px] mx-auto text-xs text-ink-soft">
      <p className="mb-2 font-medium uppercase tracking-wide">Keyboard</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
        {hints.map(([keys, description]) => (
          <li key={description} className="flex items-center justify-between gap-3">
            <kbd className="px-1.5 py-0.5 rounded bg-paper border border-ink-soft font-mono text-[11px] whitespace-nowrap">
              {keys}
            </kbd>
            <span className="text-right">{description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
