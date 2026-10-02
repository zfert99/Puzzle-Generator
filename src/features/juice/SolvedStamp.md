# Solved Stamp (`SolvedStamp.tsx`)

The completion "stamp" — the design system's win moment (§4).

## Why

**Why:** A genuine puzzle completion is the emotional peak, so it earns the biggest effect:
a chunky rounded badge that **scales in `0 → 1.15 → 1`** with a squash/rotate (CSS keyframes),
a one-off **confetti** burst, and a single **opacity screen-flash** (never a shake). It
replaces the old `celebrate`/emoji CSS and is mounted **only when a puzzle is actually
solved** — the effect stays meaningful by being rare.

```text
on mount (if not reduced-motion): fireConfetti()
render:
  screen-flash overlay  -> .stamp-flash: opacity 0 → 0.28 → 0 (not rendered under reduced motion)
  badge (.stamp-pop)    -> scale [0,1.15,1] + rotate squash; butterscotch fill, -3deg tilt,
                           Fredoka label, edged by a hand-inked WobbleFrame (chaos §8)
  a scrawled "nice work!" Caveat aside (decorative, aria-hidden)
```

## Why CSS keyframes, not the `motion` library (October 2026)

**Why:** the stamp was the last consumer of the `motion` library once the route `template`
moved to CSS (see `src/app/template.md`), and a two-keyframe pop does not justify shipping a
~39 KB gzipped runtime. The badge and flash are now plain `<div>`s carrying `.stamp-pop` and
`.stamp-flash`, keyframes defined in `globals.css` with the same values the Motion props used
(0.55 s pop with the peak at 60%; 0.5 s flash). `motion` is no longer a dependency. The label
text moved to `text-on-butterscotch`, since `--ink` turns cream in the dark theme and measured
about 1.5:1 on the butterscotch fill.

## Reduced motion

Renders the badge **instantly** with no animation, no confetti, no flash. Two switches agree:
the CSS keyframes are turned off by `[data-motion="reduce"]` (set before first paint by the
settings pre-paint script), and the confetti and the flash element are skipped via the single
[`useReducedMotion`](./useReducedMotion.md) hook, which reads the same setting. Used by the shared
[`SolvedDialog`](../interactive-board/components/SolvedDialog.md) — the `/play`, `/daily`
and `/archive` solved modals.
