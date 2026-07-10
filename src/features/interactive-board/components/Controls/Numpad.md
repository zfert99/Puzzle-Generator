# Numpad Component: Plain English Pseudocode

On-screen controls for mouse/touch users. Client component.

```text
Render digit buttons 1..size -> inputDigit(digit).
Render Erase -> clearCell.
Render Pencil toggle with aria-pressed = pencilMode -> togglePencilMode.
Render Hint -> hint() (reveal one correct cell).
Render Undo / Redo -> useBoardStore.temporal.getState().undo()/redo();
  each is disabled when its stack is empty.
```

Undo/Redo talk to zundo's temporal store directly, since the history lives beside the
main store rather than inside it. Their disabled state subscribes reactively to that
store via `useStore(useBoardStore.temporal, s => s.pastStates.length / s.futureStates.length)`.
