# RulesDialog (`RulesDialog.tsx`)

Per-type "how to play" dialog + the per-type seen flags — QA Step 5 (owner ask U3),
September 2026.

## Why the native `<dialog>`, not the app's overlay shell

The spec's a11y bar is the full contract: modal semantics, focus moved in, **focus trapped**,
Esc closes, focus returned to the trigger. The app's hand-rolled overlays (even via
`useDialogFocus`) deliberately do not trap focus; `showModal()` supplies every item natively.
One belt-and-braces addition: an explicit Escape `keydown` handler, because some input drivers
(and older jsdom) never surface Esc as the native `cancel` — with `preventDefault` so the two
paths cannot double-fire. jsdom itself lacks `showModal`/`close` entirely; `vitest.setup.ts`
carries a minimal polyfill (toggle `open`, fire `close`) so any jsdom test rendering
`GameHeader` keeps working.

## Content (5a — net-new; none existed anywhere in the UI)

Per the spec's shape: the constraint, what a cage means, one worked example — for classic,
Killer, and Keisan. The Keisan section **always** includes the 🔮 Mystery/no-op explanation:
it is the one genuinely non-obvious mode, previously unexplained anywhere, and not worth
gating behind detecting whether the current board happens to be a Mystery one.

## Seen flags (5b)

```text
localStorage 'pl-rules-seen' -> { classic?: true, killer?: true, calc?: true }
```

Keyed **per type** (knowing Sudoku says nothing about Killer cages), same best-effort posture
as `pl-settings`: unreadable storage reads as "not seen", which merely re-shows a dismissible
dialog. Persisted on **dismissal**, not on open — a player who reloads mid-dialog sees it
again. The auto-open trigger itself lives in `GameHeader` (see its doc).
