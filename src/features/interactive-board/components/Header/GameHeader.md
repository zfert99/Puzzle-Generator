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
