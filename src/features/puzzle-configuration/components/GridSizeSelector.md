# GridSizeSelector: Plain English Pseudocode

This document explains `GridSizeSelector.tsx`, a small presentational component
that lets the user pick the puzzle grid size.

## Why this file exists

It was extracted out of `PuzzleForm` to keep that parent small and composable
(AGENTS.md Section 1, "fragment large monolithic UI components"). It is a pure,
controlled component: it holds no state of its own and simply renders the current
selection and reports clicks upward.

## What it does

1. Define a fixed list of grid-size options: 4x4, 6x6, 7x7, and 9x9. 7x7 is Kakuro's mini
   and is offered only when a caller lists it; the default set is the Sudoku family's 4/6/9.
2. Accept two props: `value` (the currently selected size) and `onChange` (a
   callback invoked with the newly chosen size).
3. Render a labelled row of segmented buttons, one per option.
4. Highlight the button whose value matches the current `value`; the rest render
   in a muted style.
5. When a button is clicked, call `onChange` with that option's value. The parent
   owns the state and decides what to do.

`sizes` (optional) restricts the offered options — Killer passes `[6, 9]`, Keisan `[4, 6, 9]` —
so every variant, in both the `/play` menu (`PlayExperience`) and the PDF form (`PuzzleForm`),
shares one selector and one visual layout.

## Selection is announced, not colour-only (September 2026, QA F10)

Each size button carries `aria-pressed`, and the buttons sit in a `role="group"` labelled by the
visible "Grid Size" text — which became a `span` + `aria-labelledby` (a `<label>` without a
control is itself an a11y smell). Colour still shows the selection visually; the ARIA state is
what a screen reader announces.

## Generic in the size union (October 2026, Kakuro V2)

Kakuro's sizes are 7 and 9, so the option list gained 7×7 and the prop types widened to
`SelectableSize = 4 | 6 | 7 | 9`. The component is generic in `S extends SelectableSize`
(default `4 | 6 | 9`) and `sizes: readonly S[]` narrows `onChange` to `(size: S) => void` — so a
caller whose state is `6 | 9` (the Killer rows) keeps a correctly-typed callback with no runtime
guard, and nothing outside Kakuro can be handed a 7 by accident.
