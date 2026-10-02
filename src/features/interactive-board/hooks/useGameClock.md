# Game Clock Hook (`useGameClock.ts`)

The single timer interval behind `/play`, `/daily` and `/archive`.

## Why one hook

**Why:** The three Experience components each carried their own
`setInterval(tick, 1000)` effect. Three copies drift — and all three had the same gap: none
watched the document's visibility. A tab in the background kept ticking at whatever rate the
browser throttled it to (Chrome runs background timers at full speed for about five minutes,
then roughly once a minute; iOS Safari suspends them outright), so a ranked daily time partly
counted the minutes a player spent elsewhere, by an amount that depended on the browser. The
product rule — stated on `useSavedGame` — is that leaving freezes the clock. Centralising the
interval makes that rule true in one place.

## Visibility, not pause

**Why:** Pausing the game on `visibilitychange` would have flipped `status` to `paused`, hidden
the board behind the "Paused" placeholder, and made the player click Resume every time they
came back. The clock instead stops ticking while the document is hidden and restarts when it is
visible again; the game's status never changes. The store's `tick` still no-ops unless the
status is `playing`, so a paused or solved game cannot advance either way.

```text
useGameClock(active):
  effect on [active, tick]:
    if not active -> nothing
    start()  = begin a 1 s interval if none is running
    stop()   = clear it
    sync()   = document hidden ? stop() : start()
    sync() now; listen for visibilitychange -> sync()
    cleanup  -> stop(), remove the listener
```

Callers pass `active` as "this surface is showing a live board": its own view is the board
and the store's status is `playing`.
