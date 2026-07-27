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
  isSelected    = the store's selectedCell is this cell,
  isPeer        = selectedCell shares this cell's row/column/box (the box clause is gated off on
                  a boxless 5×5/7×7 grid via `config.hasBoxes`, so a boxless board peers only
                  through rows/columns — no phantom box-mates; K0),
  isCagePeer    = selectedCell shares this cell's Killer cage (see below),
  isError       = a wrong, non-given value is present AND (free play: the `errorHighlight`
                  setting is on; daily: the player opted in via the "Not quite!" review
                  modal's `revealErrors`, see `useBoardStore.md`/`DailyExperience.md`),
  isSameNumber  = this cell holds the same non-zero value as the selected cell
                  (highlights every matching number across the board),
  selValue      = the selected cell's placed value (0 if none/empty) — passed through so
                  this cell's own candidate render can highlight the one pencil mark
                  matching it (the candidate-side echo of isSameNumber, see below).

Choose ONE background by precedence: error > selected > same-number > cage-peer > peer.
Errors win, so a wrong value reads red even while it is the selected cell; a thin
selection ring is added on top in that case so the selection is still visible. Cage
membership outranks generic peering — it's the rarer, more specific constraint.

Compute thick-border flags from box geometry (adapts to 4/6/9 grids; a boxless 5×5/7×7 grid draws
no interior thick borders — the flags are gated on `config.hasBoxes`, K0).

Render <div role="gridcell"> with:
  aria-label synthesized ("Given clue 7, row 2, column 4" / "Candidates 2, 5, 8" / "Empty…"),
  aria-selected, tabIndex (0 if selected else -1),
  onClick -> selectCell.
  Body: the value if placed, else a mini grid of pencil-mark candidates from the mask.
        Cage-sum clearance (Killer) is a pure CSS concern now — see Board.md — not something
        this component computes per cell.
```

## Cage highlighting (Killer)

A Killer cage is a no-repeat constraint region like a house, but its members get their **own**
tint (`.cagePeer`, a touch more grape-leaning than the generic `.peer`) rather than folding
into the row/column/box highlight — they read as related but distinct (July 2026; previously
cage membership was OR'd straight into the generic peer check, so a cage read identically to
a plain row/box peer). The check is O(1) per cell via the store's precomputed `cellToCage` map
(empty for classic games, so classic behaviour is untouched).

## Candidate-match highlighting (July 2026)

`isSameNumber` already highlights every other cell holding the same *placed* value as the
selection. This cell's own candidate render extends that idea to pencil marks: for each of its
own candidate digits, if it equals `selValue` (and isn't empty), that one `<span>` gets
`.candidateMatch` (grape, bold) instead of the default muted candidate color — so selecting a
placed "4" now also calls out every *pencil-marked* 4 across the board, not just other placed
4s. Computed per-digit at render time (a cheap `mask & (1 << i)` check already happening
anyway), not a new store field.
