# KeyboardHints Component: Plain English Pseudocode

A small, always-visible legend of the board's keyboard controls, shown beneath the
numpad in the game view so the shortcuts are discoverable.

```text
Render a compact list mapping keys -> action:
  Arrows        -> move selection
  1–9           -> enter number
  Backspace     -> erase cell
  Space / P     -> toggle pencil marks
```

Purely presentational (no store access). Harmless on touch devices, where the numpad
is the primary input.
