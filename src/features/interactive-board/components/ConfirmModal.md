# ConfirmModal (`ConfirmModal.tsx`)

A small accessible confirm dialog (Biscuit Lab styling), used for the "starting a new puzzle
erases your saved one" warning on both the `/play` menu and the `/daily` picker.

## Why it exists / why these defaults

The board store holds a single saved slot, so any new game destroys the parked one — that
needs an explicit confirmation, not a silent overwrite. Design choices that matter:

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
