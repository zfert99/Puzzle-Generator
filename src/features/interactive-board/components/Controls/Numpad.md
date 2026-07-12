# Numpad

**`showHint` prop (default `true`):** free play shows the Hint button; the daily passes
`showHint={false}` — a competitive, one-attempt ranked puzzle shouldn't hand out answers.
When hidden, the control row drops from a 5-column to a 4-column grid so it stays even.
 Component: Plain English Pseudocode

On-screen controls for mouse/touch users. Client component.

```text
Render digit buttons 1..size -> inputDigit(digit).
  A digit button is DISABLED once all `size` instances of it are on the board
  (completion lockout) — counts are derived from the grid via a useShallow selector.
Render Erase -> clearCell.
Render Pencil toggle with aria-pressed = pencilMode -> togglePencilMode.
Render Hint -> hint() (reveal one correct cell).
Render Undo / Redo -> useBoardStore.temporal.getState().undo()/redo();
  each is disabled when its stack is empty.
```

Undo/Redo talk to zundo's temporal store directly, since the history lives beside the
main store rather than inside it. Their disabled state subscribes reactively to that
store via `useStore(useBoardStore.temporal, s => s.pastStates.length / s.futureStates.length)`.
