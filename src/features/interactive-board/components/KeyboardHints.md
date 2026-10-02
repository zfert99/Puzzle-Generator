# KeyboardHints Component: Plain English Pseudocode

A small legend of the board's keyboard controls, shown beneath the numpad in the game
view so the shortcuts are discoverable — on devices that have a keyboard.

```text
Render a compact list mapping keys -> action:
  Arrows        -> move selection
  1–9           -> enter number
  Backspace     -> erase cell
  Space / P     -> toggle pencil marks
  Cmd/Ctrl+Z              -> undo
  Shift+Cmd/Ctrl+Z / Ctrl+Y -> redo

Hidden below the `sm` breakpoint (Tailwind `hidden sm:block`).
```

Purely presentational (no store access). July 2026: actually hidden on touch-only devices
(previously rendered unconditionally, described as "harmless" there since the numpad is the
primary input, but the legend was still visible noise). A CSS breakpoint, not a JS viewport
check, so there's no server/client mismatch to introduce (AGENTS.md hydration-safety rule).

## Skyscrapers gutter keys (October 2026, plan G8)

The legend reads one store field — the board's `variant` — and appends three rows while a
Skyscrapers board is up: **C** jump to the clues, **Enter / Space** mark a clue done, **Esc** back
to the board. Before the G8 pass the `C` key existed only in the rules dialog, so a keyboard user
who dismissed it (or had seen it before) had no way to discover the gutter. Reading the store here
rather than taking a prop means every surface that renders the legend (play, daily, archive) gets
the rows without plumbing. The component is `'use client'` for the selector.
