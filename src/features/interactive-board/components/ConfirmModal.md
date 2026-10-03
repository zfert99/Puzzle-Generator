# ConfirmModal (`ConfirmModal.tsx`)

A small accessible confirm dialog (Biscuit Lab styling), used for the "starting a new puzzle
erases your saved one" warning on both the `/play` menu and the `/daily` picker.

## Why it exists / why these defaults

The board store holds one saved game per slot (a free-play slot and a daily slot since October
2026 — before that, a single slot shared by every surface), so a new game destroys the one parked
in that surface's slot — that needs an explicit confirmation, not a silent overwrite. Design choices that matter:

- **Focus is managed by the shared `useDialogFocus` hook** (September 2026, F7) — this modal's
  own focus-in behaviour was extracted into it, and the modal gained the restore half: closing
  now hands focus back to whatever opened it, instead of dropping it on the body.
- **Focus lands on the safe button** (`Keep playing`) on open, so a stray Enter never destroys
  progress. The destructive action requires a deliberate press.
- **`onCancel` vs `onDismiss`.** The safe *button* fires `onCancel`, which can do more than
  close — the caller wires it to **resume the saved game** ("Keep playing" takes you into your
  puzzle). Escape / backdrop fire `onDismiss` (a plain close, defaulting to `onCancel` if not
  given), so pressing Escape returns you to the menu rather than jumping into the game — the
  two intents are deliberately different.
- `role="dialog"` + `aria-modal` + `aria-labelledby` for screen readers.

Presentational and reusable: it takes `open`, copy, labels, and the handlers — it owns no
business logic (the resume/navigate decision lives in the calling surface).

## On the native `Modal` shell (October 2026)

**Why:** this dialog was a hand-rolled `aria-modal` overlay (or, for the rules dialog, its own
`<dialog>` wiring). It now renders through the shared [`Modal`](../../chrome/Modal.md) —
`<dialog>.showModal()` — which gives what the overlay never could: a real focus trap and an inert
page behind it. The shell owns open/close, the deterministic initial focus (`initialFocusRef`),
Escape (`cancel`) and backdrop-click dismissal, and handing focus back to the opener. The former
`useDialogFocus` hook (focus-in + restore, explicitly not a trap) is retired. Behaviour this
component still decides: what "dismiss" means for it (see `onDismiss`).
