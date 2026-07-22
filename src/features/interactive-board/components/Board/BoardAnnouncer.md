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
