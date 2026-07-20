# ContinueBanner (`ContinueBanner.tsx`)

The front-door "continue" affordance, shown above the hub's bento grid.

## What it does

Reads the single saved game via `useSavedGame` and, when one exists, renders a prominent bar
linking to the surface that owns it — `/daily` or `/play` (by `saved.mode`) — where the
Continue button resumes it. It renders **nothing** when there's no saved game, which is also
the SSR/pre-mount default (`useSavedGame` returns null until mounted), so there's no hydration
flash.

## Why it links to the surface rather than deep-linking into the board

Continue is offered in three places (hub + each config screen). The hub banner routes to the
owning surface's menu, where the same Continue button resumes play. Keeping the actual resume
on the surface avoids threading a "resume now" signal through the URL (and the Suspense/render
caveats that `useSearchParams` would add), at the cost of one extra click from the hub.

## Killer-aware label

A saved free-play Killer game reads "Killer · medium" instead of the misleading
"9×9 · medium" (`SavedGame.variant`); a parked Killer daily reads "Daily · killer" as before.
