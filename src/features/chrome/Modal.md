# Modal (`Modal.tsx`)

The app's one modal shell — the native `<dialog>` element opened with `showModal()`.

## Why native, and why one shell

**Why:** `showModal()` is the only platform primitive that gives a real **focus trap** and makes
everything behind the dialog **inert**: Tab cannot leave it, and a screen reader cannot read the
board or header underneath. The five hand-rolled overlays it replaced in October 2026 — the new-game
confirm, the solved dialog, the "Not quite!" review, Settings and the Killer calculator — were
`aria-modal` divs with a scrim: they moved focus in and handled Escape, but Tab walked straight out
onto controls hidden behind the backdrop (the a11y review's A12, WCAG 2.4.3 / 2.4.11).
`RulesDialog` had already proven the element; this is that pattern written once, with the four
behaviours the others had each grown separately. The former `useDialogFocus` hook (focus-in +
restore, explicitly *not* a trap) is retired with them.

```text
props: open, onDismiss, ariaLabel | ariaLabelledBy, initialFocusRef?, className?, cardClassName?
render only while open:
  <dialog aria-label… onCancel onClick class="m-auto bg-transparent p-0 backdrop:bg-black/50 {width}">
    <div class={card}>{children}</div>
effect on open:
  remember document.activeElement (the opener)
  showModal()                         -> top layer, trap, inert page
  focus initialFocusRef ?? first focusable control   (React autoFocus runs before showModal, so explicit)
  cleanup (close or unmount): close() if still open; focus the opener
Escape   -> native `cancel` -> preventDefault + onDismiss   (React state stays the source of truth)
backdrop -> click whose target is the <dialog> itself (its ::backdrop or padding) -> onDismiss
```

**Why `onDismiss` never fires on a programmatic close:** only `cancel` (Escape) and the backdrop
click call it; `open` flipping to false just runs the cleanup. So an owner can set state in
`onDismiss` without a second call arriving when that state closes the dialog.

**Why the card is a child, not the dialog itself:** the e2e overlay-bounds test measures the
visible card (`dialog > div`) — the dialog element's own box is padding-less and transparent, and
in the old shells the `role="dialog"` sat on a full-viewport scrim whose box was meaningless.

**jsdom:** `vitest.setup.ts` polyfills `showModal`/`close` (toggle `open`, fire `close`) with no
focus behaviour, which is why the shell places and restores focus itself rather than relying on
the browser. Trap and inert assertions belong in Playwright (`e2e/a11y.spec.ts`).
