# Solved Stamp (`SolvedStamp.tsx`)

The completion "stamp" — the design system's win moment (§4).

## Why

**Why:** A genuine puzzle completion is the emotional peak, so it earns the biggest effect:
a chunky rounded badge that **scales in `0 → 1.15 → 1`** with a squash/rotate (via Motion),
a one-off **confetti** burst, and a single **opacity screen-flash** (never a shake). It
replaces the old `celebrate`/emoji CSS and is mounted **only when a puzzle is actually
solved** — the effect stays meaningful by being rare.

```text
on mount (if not reduced-motion): fireConfetti()
render:
  screen-flash overlay  -> opacity 0 → 0.28 → 0 (skipped under reduced motion)
  badge (Motion)        -> scale [0,1.15,1] + rotate squash; butterscotch fill, -3deg tilt,
                           Fredoka label, edged by a hand-inked WobbleFrame (chaos §8)
  a scrawled "nice work!" Caveat aside (decorative, aria-hidden)
```

## Reduced motion

Gated on the single [`useReducedMotion`](./useReducedMotion.md) switch: renders the badge
**instantly** with no animation, no confetti, no flash. Used by the `/play` and `/daily`
solved modals.
