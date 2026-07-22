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
