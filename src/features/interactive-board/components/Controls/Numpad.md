# Numpad Component: Plain English Pseudocode

On-screen controls for mouse/touch users. Client component.

```text
Render digit buttons 1..size -> inputDigit(digit).
Render Erase -> clearCell.
Render Pencil toggle with aria-pressed = pencilMode -> togglePencilMode.
Render Undo / Redo -> call useBoardStore.temporal.getState().undo()/redo().
```

Undo/Redo talk to zundo's temporal store directly, since the history lives beside the
main store rather than inside it.
