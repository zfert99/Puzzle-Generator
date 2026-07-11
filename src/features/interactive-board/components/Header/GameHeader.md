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
