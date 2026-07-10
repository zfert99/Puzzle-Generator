# GameHeader Component: Plain English Pseudocode

The game status bar. Client component.

```text
Show "<difficulty> · <size>×<size>".
Show a live timer formatted m:ss from the store's elapsedTime.
Show a real-time-error toggle (aria-pressed = realTimeErrors) -> toggleRealTimeErrors.
Show Pause while playing (-> pause) or Resume while paused (-> resume).
```

`difficulty` is passed in as a prop (the store tracks mechanics, not the label). The
timer value is read from the store; the interval that advances it lives in
`PlayExperience`.
