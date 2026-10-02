# Board Announcer (`BoardAnnouncer.tsx`)

A visually-hidden `aria-live="polite"` region that voices board changes for screen readers
(WCAG 4.1.3). Typing a digit doesn't move focus, so a screen reader would otherwise say
nothing — this diffs the grid and announces "5 entered, row 3 column 4", "cell cleared", or
"puzzle solved". Correctness ("…, incorrect") is spoken only when mistake-highlighting is on,
mirroring the visual cue.

Derives the message **during render** from the grid/status changed since the last render
(React's sanctioned prev-value-in-state pattern) — no effect, no ref-during-render, so it
satisfies the `react-hooks` lint rules.

## "Puzzle solved" outranks the placement (October 2026)

**Why:** the solving move changes `status` and `grid` in the same store update, so both diffs run
in one render, and the last `setMessage` wins. The grid diff ran second, so "Puzzle solved" was
always overwritten by "7 entered, row 9, column 9" and never heard. A local `justSolved` flag,
set when the status diff announces the solve, now skips the grid diff for that render.

```text
on render:
  status changed to solved -> message = "Puzzle solved"; justSolved = true
  grid changed and same size and not justSolved -> message = describe the placement
```

## Daily suppression

The "…, incorrect" announcement follows the same rule as the visual highlight: on a daily it's
suppressed unless the player opted in via the "Not quite!" review modal's error reveal
(`errorsRevealed` in the board store); in free play it follows the `errorHighlight` setting
instead. Either way, a screen-reader player gets no live correctness signal until it's actually
turned on.

## Skyscrapers clue marks (October 2026, plan G8)

Marking a clue done changes the focused clue cell's own accessible name, and screen readers do
not re-announce the name of the element that already has focus — so the mark was silent. The
announcer now diffs the store's `doneClues` as it diffs the grid, finds the flipped flag, turns the
flat index back into `(side, index)` with `clueFromFlatIndex` (the inverse of `clueFlatIndex`,
kept beside it so the packing is written once), and says the clue's new name — "Clue 2, from the
top of column 2, marked done", or the unsolved/satisfied/violated form when the mark is taken back.
A new game resets every flag at once and swaps the clues; that is not a mark, so the diff is
re-based (not spoken) on any render where `edgeClues` changed — otherwise a same-size restart with
nothing typed would announce the new puzzle's clue at a stale index as "unsolved" (review fix).
