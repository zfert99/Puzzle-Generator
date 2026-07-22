# Numpad Component: Plain English Pseudocode

On-screen controls for mouse/touch users. Client component.

**`showHint` prop (default `true`):** free play shows the Hint button; the daily passes
`showHint={false}` — a competitive, one-attempt ranked puzzle shouldn't hand out answers.

```text
Render digit buttons 1..size -> inputDigit(digit).
  A digit button is DISABLED once all `size` instances of it are on the board
  (completion lockout) — counts are derived from the grid via a useShallow selector.
Render Erase -> clearCell.
Render Pencil toggle with aria-pressed = pencilMode -> togglePencilMode.
Render Hint -> hint() (reveal one correct cell).
Render Undo / Redo -> useBoardStore.temporal.getState().undo()/redo();
  each is disabled when its stack is empty.
Render Calculator (Killer only) -> a self-contained trigger+popup, see Calculator.md.
```

Undo/Redo talk to zundo's temporal store directly, since the history lives beside the
main store rather than inside it. Their disabled state subscribes reactively to that
store via `useStore(useBoardStore.temporal, s => s.pastStates.length / s.futureStates.length)`.

## Control-row column count (July 2026: now 3 factors, not 2)

The row's grid column count depends on TWO independent flags now: `showHint` (free play vs.
daily) and `isKiller` (`s.variant === 'killer'`, only true in Killer games). Four combinations
→ four possible counts (4/5/5/6), written as literal Tailwind classes
(`grid-cols-4`/`grid-cols-5`/`grid-cols-6`) via a nested ternary — Tailwind's class scanner
needs each complete class name to appear literally in source, so this can't be a computed
`` `grid-cols-${n}` `` string.
