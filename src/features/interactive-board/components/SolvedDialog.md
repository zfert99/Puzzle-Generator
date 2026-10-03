# SolvedDialog (`SolvedDialog.tsx`)

The shared "you solved it" overlay — full-screen backdrop, chunky panel,
[SolvedStamp](../../juice/SolvedStamp.md), the `time · mistakes` line, then an actions row.

## Why it exists

`/play`, `/daily` and `/archive` each hand-rolled this exact shell (September 2026 review,
quality item 1), differing only in the stamp text, one slab of extra content (the daily's rank
line, the archive's "practice" note) and the action buttons. Three copies meant three places to
re-wire the F7 focus management, three copies of the pluralization line, and three places to
touch if the accepted aria-modal-without-trap posture is ever upgraded to the native `<dialog>`.
This component is now that one place.

## Contract

```text
<SolvedDialog
  ariaLabel        # accessible dialog name ("Daily solved")
  stampLabel       # text on the SolvedStamp badge ("Daily solved!")
  elapsedSeconds   # formatted internally via formatElapsed → "M:SS"
  mistakes         # pluralized internally ("1 mistake" / "3 mistakes")
  primaryLabel + onPrimary   # the focused-on-open primary button, rendered here
  children?        # extra content between the stats line and the actions
  secondaryAction? # caller-styled button/Link rendered beside the primary
/>
```

- **Mount it only when solved** (`status === 'solved' && <SolvedDialog…>`), which is why there
  is deliberately no `open` prop: `SolvedStamp` fires its confetti on mount, and mounting is
  also what drives `useDialogFocus` — the hook is called with a constant `true`, so its effect
  runs focus-in on mount and opener-restore on unmount.
- **The primary-action ref never leaves the component.** Callers used to each call
  `useDialogFocus` and thread the ref into their own button; forgetting that wiring was exactly
  the F7 bug. The dialog renders the primary button itself, so the focus contract can't be
  dropped by a new caller.
- **Not a focus trap** — an `aria-modal` overlay matching the `ConfirmModal` posture (see
  `../hooks/useDialogFocus.md` for why, and for the native-`<dialog>` upgrade note).

## Callers

- `PlayExperience` — "Solved!", secondary "View puzzle" button.
- `DailyExperience` — "Daily solved!", the ranked-result block as children, secondary
  "Leaderboard" link.
- `ArchiveExperience` — "Solved!", "Practice replay — not ranked." as children, no secondary.

The daily "Not quite!" review dialog and `ConfirmModal` are **not** callers: they share no
stamp/stats content, so they keep their own markup and use `useDialogFocus` directly.

## On the native `Modal` shell (October 2026)

**Why:** this dialog was a hand-rolled `aria-modal` overlay (or, for the rules dialog, its own
`<dialog>` wiring). It now renders through the shared [`Modal`](../../chrome/Modal.md) —
`<dialog>.showModal()` — which gives what the overlay never could: a real focus trap and an inert
page behind it. The shell owns open/close, the deterministic initial focus (`initialFocusRef`),
Escape (`cancel`) and backdrop-click dismissal, and handing focus back to the opener. The former
`useDialogFocus` hook (focus-in + restore, explicitly not a trap) is retired. Behaviour this
component still decides: what "dismiss" means for it (see `onDismiss`).
