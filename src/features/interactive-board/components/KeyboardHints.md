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
