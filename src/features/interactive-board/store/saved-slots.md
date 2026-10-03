# Saved Slots (`saved-slots.ts`)

Reading the two saved-game slots without the store, and activating a surface's slot.

## Why slots are read from storage here, not from the store

**Why:** since October 2026 a daily board and a free-play board park under different
localStorage keys (`SLOT_KEYS` in `useBoardStore.ts`), and the store holds only the slot of the
surface that is active. The hub's Continue banner needs **both** — it offers to resume a parked
daily and a parked free-play game — so it reads the keys directly (`readSavedSlot`), once per
mount (`useSavedSlots`), gated behind "mounted" so server and first client render agree. The hub
starts no games, so a slot cannot change under it except from another tab, and a stale banner
there costs a click, not progress.

## Why a surface activates its slot in a `useState` initializer

**Why:** `useBoardSlot(mode)` must run before the surface's first mounted read of the saved
game, or `/play` would briefly see a parked daily (and offer to "continue" it as free play).
A `useState` initializer runs during the first client render — before the `mounted` flag flips —
and `activateSlot` is a no-op on the server and idempotent, so StrictMode's double call is fine.

```text
readSavedSlot(mode)  -> parse SLOT_KEYS[mode]; null unless status is playing|paused
useSavedSlots()      -> { play, daily } after mount, null before
useBoardSlot(mode)   -> useState(() => activateSlot(mode))
```
