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

### `data-motion="full"` for an explicit full choice (October 2026)

**Why:** `globals.css` now *also* honours the OS `prefers-reduced-motion` query directly, as a
fallback for when the pre-paint script never ran or could not read storage (blocked storage, a
script failure) — otherwise a user who asked their OS for less motion would get the full
animation. That media block would then override an in-app "full" choice too, so it is written as
`:root:not([data-motion="full"]) …`, and both `applySettings` and the pre-paint script now set
`data-motion="full"` when the player explicitly chose full. The attribute is absent only for
`'system'` when the OS does not ask to reduce.

```text
effective reduce        -> data-motion="reduce"
explicit 'full'         -> data-motion="full"     (beats the CSS media-query fallback)
'system', OS not reduce -> no attribute
```

## `matchMedia` guards

`motionReduced`/`subscribeSettings` guard `typeof window.matchMedia === 'function'` so they run
under jsdom (unit tests) and any non-browser env without throwing.
