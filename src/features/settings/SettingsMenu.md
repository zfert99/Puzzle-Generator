# Settings Menu (`SettingsMenu.tsx`)

The ⚙️ gear in the header (reachable on every page) opening an accessible settings dialog. It
**absorbs the theme toggle** — theme (light/dark) is a row here alongside Motion
(Auto/Full/Reduced), Colorblind mode, and Highlight mistakes.

## Practises the a11y research on itself

Follows the modal pattern from `Docs/research/accessibility-responsive-qa.md`: `role="dialog"` with `aria-modal`, focus moved in on open and **returned to the gear on close**, `Esc` to close,
a click-outside scrim, and `role="switch"`/`aria-pressed` on the controls. Theme is read via a
`useSyncExternalStore` subscription to `themechange` (no setState-in-effect).

## Fixed + viewport-centered, not anchored to the gear (July 2026 mobile fix)

**Why:** the panel used to be `position: absolute; right: 0` relative to the gear button's
own tiny wrapper — on desktop the gear sits at the header's right edge so this worked, but
on mobile the header is cramped (account controls push the gear toward mid-header) and the
288px-wide panel opening "left from the anchor" ran off the left edge of the viewport,
rendering mostly off-screen. Switched to the same `fixed inset-0` centered-overlay pattern
[`ConfirmModal`](../interactive-board/components/ConfirmModal.md) already uses — a single
full-viewport flex-centered container, click-outside-closes via a bubbled click on the outer
element (stopped by the inner panel), works identically at any viewport size regardless of
where the gear button ends up in the header's flex layout.

## Selected-choice text token (October 2026)

An active `Choice` button's text is `text-on-butterscotch`, not `text-ink`: `--ink` turns cream in the dark theme, about 1.5:1 against the butterscotch fill; butterscotch is
mid-light in both themes, so the text on it stays dark ink in both (`globals.css`).

## On the native `Modal` shell (October 2026)

**Why:** this dialog was a hand-rolled `aria-modal` overlay (or, for the rules dialog, its own
`<dialog>` wiring). It now renders through the shared [`Modal`](../chrome/Modal.md) —
`<dialog>.showModal()` — which gives what the overlay never could: a real focus trap and an inert
page behind it. The shell owns open/close, the deterministic initial focus (`initialFocusRef`),
Escape (`cancel`) and backdrop-click dismissal, and handing focus back to the opener. The former
`useDialogFocus` hook (focus-in + restore, explicitly not a trap) is retired. Behaviour this
component still decides: what "dismiss" means for it (see `onDismiss`).
