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

## Deterministic initial focus (September 2026 review)

The `autoFocus` attribute was inert: React applies it imperatively at MOUNT — and GameHeader
mounts this dialog permanently closed — so no `autofocus` attribute ever reached the HTML dialog
focusing steps, and focus landed inside the modal only by browser fallback. The open effect now
calls `.focus()` on the primary button explicitly, right after `showModal()`.

## Kakuro body (October 2026)

A fourth body for `variant === 'kakuro'`: the digits are 1–9 at any size, the only constraint is
that each run sums to its clue with no repeat, where the two sums sit (upper-right = down,
lower-left = across — the convention the board draws), a worked example of a forced two-cell
run (3 → 1+2, 17 → 8+9), and the interior-size naming convention (a "7×7" is its playable
area; the clue strip is not counted — plan decision D2). "Cross Sums" is named as the generic
alias (D1).

## Skyscrapers body (October 2026, V2)

A fifth body for `variant === 'skyscrapers'`: the Latin-square rule (heights 1..N, no boxes),
what an edge clue means (how many buildings are visible looking in, taller hides shorter),
that blank edges are normal, the two one-move clues (1 → the tallest is adjacent, N → the heights
climb), and the clue UX from decision D9 — a clue turns red only once the filled cells already
break it, and a click (or `C` then Enter) greys a clue out. Title: "How to play Skyscrapers".

## On the native `Modal` shell (October 2026)

**Why:** this dialog was a hand-rolled `aria-modal` overlay (or, for the rules dialog, its own
`<dialog>` wiring). It now renders through the shared [`Modal`](../../chrome/Modal.md) —
`<dialog>.showModal()` — which gives what the overlay never could: a real focus trap and an inert
page behind it. The shell owns open/close, the deterministic initial focus (`initialFocusRef`),
Escape (`cancel`) and backdrop-click dismissal, and handing focus back to the opener. The former
`useDialogFocus` hook (focus-in + restore, explicitly not a trap) is retired. Behaviour this
component still decides: what "dismiss" means for it (see `onDismiss`).
