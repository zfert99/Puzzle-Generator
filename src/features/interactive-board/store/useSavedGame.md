# useSavedGame (`useSavedGame.ts`)

One place that answers "is there an in-progress game to continue, and what is it?" for the
three surfaces that need it: the hub `ContinueBanner`, the `/play` menu, and the `/daily`
picker.

## Why a single hook

The board store persists exactly ONE game to localStorage (shared between `/play` and
`/daily`). Save & continue and the "starting a new game erases your saved puzzle" warning both
key off the same question, so it lives in one hook rather than being re-derived three times.

- **Resumable = `status` is `playing` or `paused`.** A `solved` game has nothing to continue;
  a `configuring` one was abandoned back to the menu.
- Returns a small descriptor (`mode`, `difficulty`, `gridSize`, `elapsedTime`, `dailyDate`)
  used to label the Continue button and to restore a daily's context on resume.

## Hydration safety

The store rehydrates from localStorage only on the client, so reading it during SSR would
mismatch. The hook returns `null` until mounted (a `useSyncExternalStore` guard), so server
and first client render agree and callers can treat `null` as "nothing to continue".

`formatElapsed(seconds)` → `M:SS`, shared by every continue label.
