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
timer lives in `PlayExperience`.

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
