# `useSettings`

`useSetting(key)` reads one setting reactively via `useSyncExternalStore`, returning the
DEFAULT on the server / first client render (no hydration mismatch) then the persisted value.
Selecting a single primitive keeps `Object.is` stable, so a consumer like the 81 board cells
only re-renders when *its* setting changes. `useMotionReduced()` is the JS counterpart to the
CSS `[data-motion]` rules (used by the juice hooks).
