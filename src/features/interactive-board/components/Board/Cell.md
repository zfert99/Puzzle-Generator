# Cell Component: Plain English Pseudocode

A single board square. Client component.

## Why it uses a `useShallow` selector

`Cell` computes its own derived flags (`isSelected`, `isPeer`, `isError`) **inside** a
`useShallow` selector so it re-renders only when one of those booleans (or its value /
candidates) actually changes. When the selection moves, just the cells whose flags flip
re-render — not the whole grid. This is the granular-subscription pattern that protects
INP (research §2.3).

```text
Select from the store (shallow):
  value, candidate mask, isGiven,
  isSelected  = the store's selectedCell is this cell,
  isPeer      = selectedCell shares this cell's row/column/box,
  isError     = real-time errors ON and a wrong, non-given value is present.

Compute thick-border flags from box geometry (adapts to 4/6/9 grids).

Render <div role="gridcell"> with:
  aria-label synthesized ("Given clue 7, row 2, column 4" / "Candidates 2, 5, 8" / "Empty…"),
  aria-selected, tabIndex (0 if selected else -1),
  onClick -> selectCell.
  Body: the value if placed, else a mini grid of pencil-mark candidates from the mask.
```
