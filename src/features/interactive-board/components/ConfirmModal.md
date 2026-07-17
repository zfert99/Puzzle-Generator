# ConfirmModal (`ConfirmModal.tsx`)

A small accessible confirm dialog (Biscuit Lab styling), used for the "starting a new puzzle
erases your saved one" warning on both the `/play` menu and the `/daily` picker.

## Why it exists / why these defaults

The board store holds a single saved slot, so any new game destroys the parked one — that
needs an explicit confirmation, not a silent overwrite. Design choices that matter:

- **Focus lands on Cancel** (`Keep playing`) on open, and Escape / backdrop click also cancel —
  so a stray Enter or click never destroys progress. The destructive action requires a
  deliberate press.
- `role="dialog"` + `aria-modal` + `aria-labelledby` for screen readers.

Presentational and reusable: it takes `open`, copy, labels, and `onConfirm`/`onCancel` — it
owns no business logic.
