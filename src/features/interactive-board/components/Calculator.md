# Calculator Component: Plain English Pseudocode

A small floating four-function calculator for Killer — cage-sum arithmetic is math the
player has to do in their head; this gives them somewhere to check it without leaving the
puzzle. Client component, mounted only when `variant === 'killer'` (`Numpad.tsx`).

## Why entirely local state

**Why:** Nothing here needs to be remembered, undone, persisted, or validated server-side —
it's scratch arithmetic, not game state. So it's a single component owning its own
`useState` (display string, stored operand, pending operator, "fresh entry" flag) with zero
involvement from the board store, unlike almost everything else in this feature area. This
was the deciding factor in scoping it small: no new store fields, no persistence, no
anti-cheat surface.

## Why it reuses `ConfirmModal`'s dialog shell

**Why:** The backdrop, `role="dialog"` + `aria-modal`, Escape-to-close, click-outside-to-close,
and focus-on-open pattern already exists and is already accessible — rebuilding it would be
pure duplication. The calculator's popup is that same shell with a number display and a
button grid instead of confirm/cancel buttons.

```text
State: display (string), stored (number | null), pendingOp (+/−/×/÷ | null), freshEntry (bool)

Digit press    -> replace display if freshEntry (or display is "0"), else append.
Decimal press  -> same rule, but no-op if display already has a ".".
Operator press -> if a previous op is pending and this isn't a fresh entry,
                    compute it against the current display first (chained ops, e.g. 5 + 3 − 2);
                    store the (possibly-just-computed) current value as the left operand,
                    queue the new operator, mark entry fresh for the next number.
Equals press   -> compute stored OP display; show the result (or "Error" on ÷0 -> non-finite);
                    clear stored/pendingOp so a bare digit starts a new calculation.
C press        -> reset everything to the "0" starting state.
⌫ press        -> drop the last character of display (or reset to "0" if only one remains).
Escape / backdrop click / ✕ -> close the popup. Trigger button re-opens it fresh each time
  (state is NOT reset on close, so a half-finished calculation survives a re-open).
```

## Keyboard entry (July 2026)

**Why:** Every button has a key equivalent (digits, `.`, `+ - * /` for the four operators —
`*`/`x` both map to `×`, `/` maps to `÷`, and `Enter` doubles for `=`), so the calculator is
fully operable without a mouse/touch once open, matching how a real desktop calculator app
behaves. The keydown listener is the same `window`-level one Escape already used; it now
reads `e.key` against digits/operator characters and calls the matching handler.

**Why `useCallback` on every handler:** the listener effect closes over `inputDigit`,
`chooseOp`, etc. — if those were plain `const`s (recreated fresh every render) the effect
would either need to re-run on every render (to avoid a stale closure holding onto whatever
`display`/`stored`/`pendingOp` existed when the calculator was first opened) or silently use
stale state. Wrapping each handler in `useCallback` with its actual dependencies gives them a
stable identity that only changes when the state they close over does, so the effect's
dependency array is both correct (no stale closures) and only changes when the state does —
which, for `display`, is every digit typed, so the listener does re-attach per keystroke.
Not the board's INP-critical hot path (AGENTS.md §3) — this is a low-frequency popup — but the
correct fix costs nothing extra here.

## Focus-on-open is its own `[open]` effect (October 2026)

**Why:** the "focus the Close button on open" call used to sit inside the keyboard effect above.
That effect re-runs whenever a handler's closure changes, which is every digit typed, so every
keystroke also re-ran the focus call and yanked focus back to Close. A keyboard user tabbing
across the keypad was pulled off the key they had reached each time they typed. Focus-on-open
now lives in a separate effect keyed on `open` alone, so it runs once when the popup opens.

```text
effect [open]:          if open -> focus the Close button
effect [open, handlers]: if open -> attach the window keydown listener (digits, ops, Escape)
```

## Future ideas (not built — deliberately deferred, per user request)

Two richer versions of this were discussed and explicitly parked for later, in increasing
order of scope:

- **Insert result into the selected cell.** Would need the calculator to read/write the
  board store (`inputDigit`/`selectedCell`) instead of staying fully local — the main reason
  this version was deferred rather than built first, since it changes the "zero store
  involvement" scoping call above.
- **Cage-sum-aware suggestions** (e.g., pre-filling "remaining sum" for the selected cage
  based on already-placed cage-mates). This is a real feature, not a QoL tweak — it would need
  the cage/candidate data threaded in and some UI for "which cage am I even looking at,"
  closer in scope to the cage-highlighting work in `Cell.md` than to a calculator.

If either gets picked up, start from this component rather than replacing it — the arithmetic
core (`compute`, the operator-chaining logic) stays the same either way.

## On the native `Modal` shell (October 2026)

**Why:** this dialog was a hand-rolled `aria-modal` overlay (or, for the rules dialog, its own
`<dialog>` wiring). It now renders through the shared [`Modal`](../../chrome/Modal.md) —
`<dialog>.showModal()` — which gives what the overlay never could: a real focus trap and an inert
page behind it. The shell owns open/close, the deterministic initial focus (`initialFocusRef`),
Escape (`cancel`) and backdrop-click dismissal, and handing focus back to the opener. The former
`useDialogFocus` hook (focus-in + restore, explicitly not a trap) is retired. Behaviour this
component still decides: what "dismiss" means for it (see `onDismiss`).
