const HINTS: ReadonlyArray<readonly [string, string]> = [
  ['↑ ↓ ← →', 'Move selection'],
  ['1–9', 'Enter number'],
  ['Backspace', 'Erase cell'],
  ['Space / P', 'Toggle pencil marks'],
  ['⌘Z / Ctrl+Z', 'Undo'],
  ['⇧⌘Z / Ctrl+Y', 'Redo'],
];

/**
 * A compact, always-visible legend of the board's keyboard controls, so the
 * shortcuts implemented in `Board` are discoverable rather than hidden. Purely
 * presentational (no store access), and irrelevant-but-harmless on touch devices.
 */
export function KeyboardHints() {
  return (
    <div className="mt-6 w-full max-w-[520px] mx-auto text-xs text-ink-soft">
      <p className="mb-2 font-medium uppercase tracking-wide">Keyboard</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
        {HINTS.map(([keys, description]) => (
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
