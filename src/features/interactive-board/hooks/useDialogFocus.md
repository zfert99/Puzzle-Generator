# useDialogFocus (`useDialogFocus.ts`)

Focus management for the app's inline dialogs — QA finding **F7** (September 2026).

## Why it exists

The dialog shell here is a repeated JSX pattern, not a component: the "Solved!" dialogs
(`PlayExperience`, `DailyExperience`, `ArchiveExperience`), the daily "Not quite!" review, and
the new-game `ConfirmModal` each re-create the backdrop/panel markup. Every one of them except
`ConfirmModal` left `document.activeElement` sitting on a board gridcell *behind* the backdrop —
so a keyboard or screen-reader user was never told a dialog appeared, and keystrokes kept going
into the board. `ConfirmModal` had the focus-in half right from the start; this hook extracts
that behaviour (plus the restore half it lacked) so every dialog gets both from one place.

## What it does

```text
useDialogFocus(open) -> ref for the dialog's PRIMARY action

effect on `open`:
  open  -> remember document.activeElement (the opener), focus the primary action
  close -> focus the remembered opener (effect cleanup)
```

- **Restore is best-effort by design.** Closing a solved dialog often unmounts the board it
  came from, and `.focus()` on a detached element is a spec'd no-op — the browser falls back to
  the document, which is the correct outcome when the opener no longer exists. When the opener
  *is* still mounted (the review dialog's "Keep looking", ConfirmModal's cancel), focus lands
  right back where the user was.
- **Deliberately NOT a full focus trap.** The dialogs are `aria-modal` overlays with a
  full-screen backdrop, matching the `ConfirmModal` pattern the QA finding holds up as the
  reference. If a real trap is ever wanted, prefer the native `<dialog>` element over
  hand-rolled Tab wrangling.
- Callers pass `open` and attach the ref, so the hook runs unconditionally at the top of
  components whose dialogs render conditionally — no extracted dialog component required.
