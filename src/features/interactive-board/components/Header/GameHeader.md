# GameHeader Component: Plain English Pseudocode

The game status bar. Client component.

```text
Show "<difficulty> · <size>×<size>".
Show a live timer formatted m:ss from the store's elapsedTime.
Show a mistakes counter ("✗ N") from the store's mistakes.
Show a real-time-error toggle (aria-pressed = realTimeErrors) -> toggleRealTimeErrors.
Show Pause while playing (-> pause) or Resume while paused (-> resume).
```

Everything (including `difficulty`) is read from the store rather than props, so the
header renders correctly after a persisted refresh. The interval that advances the
timer lives in the shared `useGameClock` hook, called by each Experience component.

## Error feedback rules (July 2026)

The live mistake count (`✗ N`) and the **Errors** toggle follow the game mode:

- **Free play** — the count shows only when error highlighting is on; toggling Errors off hides
  both the red cells and the count. The Errors button is the in-game shortcut to the global
  `errorHighlight` setting.
- **Daily** — no live error feedback at all: no Errors button, no live count, no red cells
  (`Cell` gates `isError` on `!isDaily`). The mistake total is revealed only on completion, in
  the daily solved modal. Mistakes are still counted internally the whole time.

## Rules entry point + first-play auto-open (September 2026, QA Step 5)

The header owns the whole rules feature (5b + 5c) because it is the one component present on
every playing surface and it already reads the store:

- **"Rules" button** beside Pause — the always-available entry point on `/play`, `/daily`, and
  archive replays alike (5c).
- **First free-play game of a TYPE auto-opens its rules** (5b). Free play only: the
  `mode === 'daily'` gate covers both the ranked daily and archive replays, where a modal on
  first paint would tax a running clock. It cannot land on top of the "Start a new puzzle?"
  confirm by construction — that confirm lives on the config screen and this header renders only
  during play. Implemented as a render-phase state adjustment, not an effect
  (`react-hooks/set-state-in-effect` bans the effect form); SSR-safe because the server renders
  the store's initial `configuring` status, so the localStorage read never runs server-side.
  "Seen" persists on dismissal, so a reload mid-dialog shows it again.

## Timer + mistakes naming (September 2026 review)

Both used to put `aria-label` on bare `<span>`s — a span maps to the naming-prohibited `generic`
role, so the labels were invalid (axe `aria-prohibited-attr`) and some screen readers ignored
them and read "✗ 3" as "ballot X three". The timer is now `role="timer"` (a role that accepts a
name; its live behaviour stays off), and the mistakes counter uses real text — an `aria-hidden`
glyph plus visually-hidden " mistakes" — instead of a label.

`autoOpenedFor` marks the variant as **checked**, not as opened (ultra-review finding on #92,
September 2026): set on both outcomes, so the localStorage read + JSON.parse behind
`hasSeenRules` happens once per variant per mount instead of on every render of a component
that re-renders each second on the timer tick. Pinned by a storage-read-count test.

## Kakuro reads "unrated" (October 2026)

A Kakuro's `difficulty` is the classifier's label (E2a) or the literal `'unrated'`, so the header
shows it as-is — "hard · 7×7", or "unrated · 7×7" for a puzzle the ladder cannot finish. The
earlier special-casing (a review finding: the placeholder "Medium" shown as a grade) is gone
because the placeholder is gone.

## Errors toggle text token (October 2026)

When on, the Errors toggle's text is `text-on-butterscotch` instead of `text-ink`: `--ink` turns
cream in the dark theme, about 1.5:1 against the butterscotch fill. Butterscotch is mid-light in
both themes, so the text on it stays dark ink in both.

## Phone widths (October 2026)

**Why `flex-wrap` and `whitespace-nowrap`:** at 360–390 px the three groups (label, clock +
mistakes, the three buttons) did not fit on one line, and without wrapping as groups the label
broke across two lines and the mistakes counter stacked its "✗" above its digit. The row now
wraps as groups — the button trio drops to a second line whole — and the label and counter are
single-line. Seen on the production build in the site-wide pass's mobile check.
