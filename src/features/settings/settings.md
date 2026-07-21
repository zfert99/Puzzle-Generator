# App Settings (`settings.ts`)

App-wide preferences — **motion**, **colorblind mode**, **error highlighting** — persisted to
`localStorage` (`pl-settings`) and applied to `<html>` as `data-motion` / `data-colorblind`
so CSS keys off them with **no flash** (same pre-paint pattern as the theme).

## Why an event-backed store, not Zustand

To match `theme.ts` and keep the pre-paint script a trivial `JSON.parse` — the value must be
applied to `<html>` before React hydrates, so a tiny sync store the pre-paint can mirror in
plain JS is the right shape.

## Motion is three-state

`'system'` follows the OS `prefers-reduced-motion`; `'reduce'` and `'full'` override it. The
pre-paint folds the OS query into an effective boolean and sets `data-motion="reduce"` only
when motion should be reduced — so **`'full'` keeps animation even when the OS asks to reduce
it** (a player who wants the cell shake regardless). All CSS motion rules were converted from
`@media (prefers-reduced-motion: reduce)` to `:root[data-motion="reduce"]` for this reason.

## `matchMedia` guards

`motionReduced`/`subscribeSettings` guard `typeof window.matchMedia === 'function'` so they run
under jsdom (unit tests) and any non-browser env without throwing.
