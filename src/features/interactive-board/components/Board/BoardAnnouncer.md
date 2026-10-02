# Board Announcer (`BoardAnnouncer.tsx`)

A visually-hidden `aria-live="polite"` region that voices board changes for screen readers
(WCAG 4.1.3). Typing a digit doesn't move focus, so a screen reader would otherwise say
nothing — this diffs the grid and announces "5 entered, row 3 column 4", "cell cleared", or
"puzzle solved". Correctness ("…, incorrect") is spoken only when mistake-highlighting is on,
mirroring the visual cue.

Derives the message **during render** from the grid/status changed since the last render
(React's sanctioned prev-value-in-state pattern) — no effect, no ref-during-render, so it
satisfies the `react-hooks` lint rules.

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
flat index back into `(side, index)` (the inverse of `clueFlatIndex`: `GUTTER_SIDES[flat / N]`,
`flat % N`), and says the clue's new name — "Clue 2, from the top of column 2, marked done", or the
unsolved/satisfied/violated form when the mark is taken back.
