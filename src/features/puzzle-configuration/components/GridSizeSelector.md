# GridSizeSelector: Plain English Pseudocode

This document explains `GridSizeSelector.tsx`, a small presentational component
that lets the user pick the puzzle grid size.

## Why this file exists

It was extracted out of `PuzzleForm` to keep that parent small and composable
(AGENTS.md Section 1, "fragment large monolithic UI components"). It is a pure,
controlled component: it holds no state of its own and simply renders the current
selection and reports clicks upward.

## What it does

1. Define a fixed list of grid-size options: 4x4, 6x6, and 9x9.
2. Accept two props: `value` (the currently selected size) and `onChange` (a
   callback invoked with the newly chosen size).
3. Render a labelled row of segmented buttons, one per option.
4. Highlight the button whose value matches the current `value`; the rest render
   in a muted style.
5. When a button is clicked, call `onChange` with that option's value. The parent
   owns the state and decides what to do.

`sizes` (optional) restricts the offered options — Killer passes `[6, 9]` so both variants
share one selector and one visual layout.
